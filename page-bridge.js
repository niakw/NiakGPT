(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_BRIDGE__) return;
  window.__NIAKGPT_BRIDGE__ = true;

  const REQ = 'niakgpt:rpc-request';
  const RES = 'niakgpt:rpc-response';
  const allowed = [
    /^\/backend-api\/conversations(?:\?|$)/,
    /^\/backend-api\/conversation\/[A-Za-z0-9_-]+$/,
    /^\/backend-api\/gizmos\/snorlax\/sidebar(?:\?|$)/,
    /^\/backend-api\/gizmos\/g-p-[A-Za-z0-9_-]+\/conversations(?:\?|$)/
  ];

  let cachedToken = '';
  let tokenAt = 0;

  function isAllowed(path, method) {
    if (!allowed.some(rx => rx.test(path))) return false;
    if (method === 'GET') return true;
    return method === 'PATCH' && /^\/backend-api\/conversation\//.test(path);
  }

  async function getAccessToken(force = false) {
    if (!force && cachedToken && Date.now() - tokenAt < 120000) return cachedToken;
    try {
      const r = await fetch('/api/auth/session', {
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

  async function backendFetch(path, method, body, forceToken = false) {
    const token = await getAccessToken(forceToken);
    if (!token) return { ok: false, status: 401, data: null, error: 'auth_session_missing' };

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
      const r = await fetch(path, init);
      if (r.status === 401 && !forceToken) {
        cachedToken = '';
        return backendFetch(path, method, body, true);
      }
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { ok: r.ok, status: r.status, data, error: r.ok ? '' : `HTTP ${r.status}` };
    } catch (error) {
      return { ok: false, status: 0, data: null, error: String(error?.message || error) };
    }
  }

  document.addEventListener(REQ, async (event) => {
    const d = event.detail || {};
    const id = String(d.id || '');
    const method = String(d.method || 'GET').toUpperCase();
    const path = String(d.path || '');

    if (!id || !isAllowed(path, method)) {
      document.dispatchEvent(new CustomEvent(RES, {
        detail: { id, ok: false, status: 0, error: 'blocked_request' }
      }));
      return;
    }

    const result = await backendFetch(path, method, d.body);
    document.dispatchEvent(new CustomEvent(RES, { detail: { id, ...result } }));
  });
})();
