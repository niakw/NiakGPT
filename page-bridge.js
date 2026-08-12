(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_BRIDGE__) return;
  window.__NIAKGPT_BRIDGE__ = true;

  const REQ = 'niakgpt:rpc-request';
  const RES = 'niakgpt:rpc-response';
  const allowed = [
    /^\/backend-api\/conversations(?:\?|$)/,
    /^\/backend-api\/conversation\/[A-Za-z0-9_-]+$/,
    /^\/backend-api\/gizmos\/snorlax\/sidebar(?:\?|$)/
  ];

  function isAllowed(path, method) {
    if (!allowed.some(rx => rx.test(path))) return false;
    if (method === 'GET') return true;
    return method === 'PATCH' && /^\/backend-api\/conversation\//.test(path);
  }

  document.addEventListener(REQ, async (event) => {
    const d = event.detail || {};
    const id = String(d.id || '');
    const method = String(d.method || 'GET').toUpperCase();
    const path = String(d.path || '');
    if (!id || !isAllowed(path, method)) {
      document.dispatchEvent(new CustomEvent(RES, { detail: { id, ok: false, status: 0, error: 'blocked_request' } }));
      return;
    }
    try {
      const init = { method, credentials: 'include', headers: { 'Accept': 'application/json' } };
      if (method !== 'GET') {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(d.body ?? {});
      }
      const r = await fetch(path, init);
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      document.dispatchEvent(new CustomEvent(RES, { detail: { id, ok: r.ok, status: r.status, data, error: r.ok ? '' : `HTTP ${r.status}` } }));
    } catch (error) {
      document.dispatchEvent(new CustomEvent(RES, { detail: { id, ok: false, status: 0, error: String(error?.message || error) } }));
    }
  });
})();
