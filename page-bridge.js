(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_BRIDGE__) return;
  window.__NIAKGPT_BRIDGE__ = true;

  const REQ = 'niakgpt:rpc-request';
  const RES = 'niakgpt:rpc-response';
  const nativeFetch = window.fetch.bind(window);
  const allowed = [
    /^\/backend-api\/conversations(?:\?|$)/,
    /^\/backend-api\/conversation\/[A-Za-z0-9_-]+$/,
    /^\/backend-api\/gizmos\/snorlax\/sidebar(?:\?|$)/,
    /^\/backend-api\/gizmos\/g-p-[A-Za-z0-9_-]+\/conversations(?:\?|$)/
  ];
  const conversationRx = /^\/backend-api\/conversation\/[A-Za-z0-9_-]+$/;
  const projectConversationsRx = /^\/backend-api\/gizmos\/g-p-[A-Za-z0-9_-]+\/conversations(?:\?|$)/;

  let cachedToken = '';
  let tokenAt = 0;

  function isAllowed(path, method) {
    if (!allowed.some(rx => rx.test(path))) return false;
    if (method === 'GET') return true;
    return method === 'PATCH' && conversationRx.test(path);
  }

  function normalizeProjectConversationPath(path, mode = 'safe') {
    if (!projectConversationsRx.test(path)) return path;
    try {
      const url = new URL(path, location.origin);
      if (mode === 'default') {
        url.searchParams.delete('limit');
      } else {
        const requested = Number(url.searchParams.get('limit') || 0);
        if (!requested || requested > 20) url.searchParams.set('limit', '20');
      }
      if (!url.searchParams.has('cursor')) url.searchParams.set('cursor', '0');
      return `${url.pathname}${url.search}`;
    } catch {
      return path;
    }
  }

  async function getAccessToken(force = false) {
    if (!force && cachedToken && Date.now() - tokenAt < 120000) return cachedToken;
    try {
      const r = await nativeFetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (!r.ok) return '';
      const session = await r.json();
      cachedToken = String(session?.accessToken || '');
      tokenAt = Date.now();
      return cachedToken;
    } catch {
      return '';
    }
  }

  function parsePayload(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  function xhrRequest(path, method, body, token) {
    return new Promise(resolve => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(method, path, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('OAI-Language', document.documentElement.lang || 'fr-FR');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (method !== 'GET') xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 20000;
        xhr.onload = () => resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          data: parsePayload(xhr.responseText),
          error: xhr.status >= 200 && xhr.status < 300 ? '' : `XHR HTTP ${xhr.status}`,
          transport: 'xhr'
        });
        xhr.onerror = () => resolve({ ok:false, status:0, data:null, error:'xhr_network_error', transport:'xhr' });
        xhr.ontimeout = () => resolve({ ok:false, status:0, data:null, error:'xhr_timeout', transport:'xhr' });
        xhr.send(method === 'GET' ? null : JSON.stringify(body ?? {}));
      } catch (error) {
        resolve({ ok:false, status:0, data:null, error:`xhr_exception:${String(error?.message || error)}`, transport:'xhr' });
      }
    });
  }

  async function fetchRequest(path, method, body, token) {
    const init = {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'OAI-Language': document.documentElement.lang || 'fr-FR',
        Authorization: `Bearer ${token}`
      }
    };
    if (method !== 'GET') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body ?? {});
    }
    try {
      const r = await nativeFetch(path, init);
      const text = await r.text();
      return {
        ok: r.ok,
        status: r.status,
        data: parsePayload(text),
        error: r.ok ? '' : `FETCH HTTP ${r.status}`,
        transport: 'fetch'
      };
    } catch (error) {
      return { ok:false, status:0, data:null, error:`fetch_exception:${String(error?.message || error)}`, transport:'fetch' };
    }
  }

  async function requestWithTransportFallback(path, method, body, token) {
    let result = await fetchRequest(path, method, body, token);
    if (result.status === 0) {
      const xhr = await xhrRequest(path, method, body, token);
      if (xhr.ok || xhr.status !== 0) result = xhr;
      else result = {
        ok:false,
        status:0,
        data:null,
        error:`${result.error};${xhr.error}`,
        transport:'fetch+xhr'
      };
    }
    return result;
  }

  async function backendFetch(path, method, body, forceToken = false) {
    const token = await getAccessToken(forceToken);
    if (!token) return { ok:false, status:401, data:null, error:'auth_session_missing', transport:'auth' };

    const originalPath = path;
    let effectivePath = method === 'GET' ? normalizeProjectConversationPath(path, 'safe') : path;
    let result = await requestWithTransportFallback(effectivePath, method, body, token);

    if (result.status === 401 && !forceToken) {
      cachedToken = '';
      return backendFetch(originalPath, method, body, true);
    }

    if (method === 'GET' && projectConversationsRx.test(originalPath) && result.status === 422) {
      const noLimitPath = normalizeProjectConversationPath(originalPath, 'default');
      if (noLimitPath !== effectivePath) {
        const retry = await requestWithTransportFallback(noLimitPath, method, body, token);
        if (retry.status === 401 && !forceToken) {
          cachedToken = '';
          return backendFetch(originalPath, method, body, true);
        }
        result = retry;
        effectivePath = noLimitPath;
      }
    }

    if (effectivePath !== originalPath) {
      result.request_path = effectivePath;
      result.normalized_by_bridge = true;
    }
    return result;
  }

  document.addEventListener(REQ, async event => {
    const d = event.detail || {};
    const id = String(d.id || '');
    const method = String(d.method || 'GET').toUpperCase();
    const path = String(d.path || '');

    if (!id || !isAllowed(path, method)) {
      document.dispatchEvent(new CustomEvent(RES, {
        detail: { id, ok:false, status:0, error:`blocked_request:${method}:${path}`, transport:'guard' }
      }));
      return;
    }

    // Since v0.8.5, all NiakGPT project moves go through Project Governance.
    // This prevents the legacy classifier from overriding a user's manual move.
    if (method === 'PATCH' && conversationRx.test(path) && d.governance !== true) {
      document.dispatchEvent(new CustomEvent(RES, {
        detail: { id, ok:false, status:409, data:null, error:'project_move_requires_governance', transport:'governance-guard' }
      }));
      return;
    }

    const result = await backendFetch(path, method, d.body);
    document.dispatchEvent(new CustomEvent(RES, { detail:{ id, ...result } }));
  });
})();
