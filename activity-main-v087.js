(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_ACTIVITY_MAIN_087__) return;
  window.__NIAKGPT_ACTIVITY_MAIN_087__ = true;

  const previousFetch = window.fetch.bind(window);
  const SEND_RX = /^\/backend-api\/(?:f\/)?conversation\/?$/i;

  function parseRequest(input, init) {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
    let url;
    try { url = new URL(raw, location.origin); } catch { return null; }
    if (url.origin !== location.origin || !SEND_RX.test(url.pathname)) return null;
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    if (method !== 'POST') return null;
    const chatId = location.pathname.match(/\/c\/([0-9a-f-]{20,})/i)?.[1] || '';
    return { url:url.toString(), chatId };
  }

  function emit(phase, info, extra = {}) {
    try {
      document.dispatchEvent(new CustomEvent('niakgpt:activity-network', {
        detail:{ phase, chatId:info?.chatId || '', at:Date.now(), ...extra }
      }));
    } catch {}
  }

  window.fetch = async function niakgptActivityAwareFetch(input, init) {
    const info = parseRequest(input, init);
    if (!info) return previousFetch(input, init);

    emit('request', info);
    try {
      const response = await previousFetch(input, init);
      emit(response.ok ? 'headers' : 'error', info, { status:response.status, ok:response.ok });
      return response;
    } catch (error) {
      emit('error', info, { status:0, ok:false, message:String(error?.message || error || 'network') });
      throw error;
    }
  };
})();
