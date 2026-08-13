(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_MANUAL_LOCK_MAIN_085__) return;
  window.__NIAKGPT_MANUAL_LOCK_MAIN_085__ = true;

  const PATCH_RX = /^\/backend-api\/conversation\/([0-9a-f-]{20,})$/i;
  const previousFetch = window.fetch.bind(window);

  function requestInfo(input, init) {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let url;
    try { url = new URL(raw, location.origin); } catch { return null; }
    if (url.origin !== location.origin) return null;
    const match = url.pathname.match(PATCH_RX);
    if (!match) return null;
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    if (method !== 'PATCH') return null;
    return { id:match[1], url:url.toString() };
  }

  async function readPatchBody(input, init) {
    const raw = init?.body;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return null; }
    }
    if (raw && typeof raw === 'object' && !(raw instanceof FormData) && !(raw instanceof Blob) && !(raw instanceof ArrayBuffer)) {
      return raw;
    }
    if (input instanceof Request) {
      try {
        const clone = input.clone();
        const text = await clone.text();
        return text ? JSON.parse(text) : null;
      } catch {}
    }
    return null;
  }

  window.fetch = async function niakgptManualMoveAwareFetch(input, init) {
    const info = requestInfo(input, init);
    if (!info) return previousFetch(input, init);

    const body = await readPatchBody(input, init);
    const hasProjectMutation = body && Object.prototype.hasOwnProperty.call(body, 'gizmo_id');
    const response = await previousFetch(input, init);

    // The NiakGPT RPC bridge captured the original fetch before this script runs,
    // so calls made by NiakGPT itself never reach this detector. Anything here is
    // a native page action initiated by ChatGPT/the user.
    if (hasProjectMutation) {
      document.dispatchEvent(new CustomEvent('niakgpt:manual-project-move', {
        detail: {
          id:info.id,
          projectId:typeof body.gizmo_id === 'string' ? body.gizmo_id : '',
          detached:body.gizmo_id == null || body.gizmo_id === '',
          status:response.status,
          ok:response.ok,
          at:Date.now()
        }
      }));
    }
    return response;
  };
})();
