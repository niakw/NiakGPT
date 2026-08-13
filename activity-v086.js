(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_ACTIVITY_086__) return;
  window.__NIAKGPT_ACTIVITY_086__ = true;

  const CHANNEL = 'niakgpt-activity-v086';
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  const states = new Map();
  let localState = 'ready';
  let localSince = Date.now();
  let pendingTimer = 0;
  let lastPath = location.pathname;
  let lastAssistantLen = 0;
  let lastAssistantGrowthAt = 0;

  const CHAT_SEL = 'a[href*="/c/"]';
  const PROJECT_SEL = 'a[href^="/g/g-p-"][href*="/project"]';

  const cidFromHref = h => String(h || '').match(/\/c\/([0-9a-f-]{20,})/i)?.[1] || '';
  const pidFromHref = h => String(h || '').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1] || '';
  const currentChatId = () => cidFromHref(location.pathname);
  const currentProjectId = () => pidFromHref(location.pathname) || pidFromHref([...document.querySelectorAll(CHAT_SEL)].find(a => cidFromHref(a.getAttribute('href')) === currentChatId())?.getAttribute('href'));

  function setState(state, extra = {}) {
    const cid = currentChatId();
    const pid = currentProjectId();
    localState = state;
    localSince = Date.now();
    document.documentElement.dataset.ng86Activity = state;
    document.documentElement.dataset.ng8Running = ['waiting','thinking','executing','loading'].includes(state) ? '1' : '0';
    if (cid) {
      states.set(cid, { state, projectId: pid, at: localSince, ...extra });
      bc?.postMessage({ type: 'activity', chatId: cid, projectId: pid, state, at: localSince, ...extra });
    }
    render();
  }

  function detectStopButton() {
    return [...document.querySelectorAll('button,[data-testid]')].some(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      return /stop|arrêter|arreter/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''} ${el.textContent || ''}`);
    });
  }

  function detectThinkingMarker() {
    const candidates = document.querySelectorAll('[data-testid*="thinking"],[class*="thinking"],[data-state],button,span');
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
      if (/^(thinking|réflexion|reflexion|analyse|analyzing|reasoning|raisonnement)/i.test(txt)) return true;
    }
    return false;
  }

  function assistantLength() {
    const turns = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const last = turns.at(-1);
    return (last?.innerText || last?.textContent || '').length;
  }

  function inferState() {
    const cid = currentChatId();
    if (!cid) return;

    const stop = detectStopButton();
    const thinking = detectThinkingMarker();
    const len = assistantLength();
    if (len > lastAssistantLen) {
      lastAssistantLen = len;
      lastAssistantGrowthAt = Date.now();
      if (localState !== 'executing') setState('executing');
      return;
    }

    if (thinking && localState !== 'thinking') {
      setState('thinking');
      return;
    }

    if (stop) {
      const recentlyGrowing = Date.now() - lastAssistantGrowthAt < 1800;
      const wanted = recentlyGrowing ? 'executing' : (Date.now() - localSince > 1200 ? 'thinking' : 'waiting');
      if (localState !== wanted) setState(wanted);
      return;
    }

    if (['waiting','thinking','executing','loading'].includes(localState)) {
      if (Date.now() - localSince > 700) setState('ready');
    }
  }

  function markPendingFromComposer(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const send = target.closest('button');
    const label = `${send?.getAttribute('aria-label') || ''} ${send?.getAttribute('data-testid') || ''} ${send?.title || ''}`;
    if (/send|envoyer|submit/i.test(label)) {
      clearTimeout(pendingTimer);
      setState('waiting');
      pendingTimer = setTimeout(() => { if (localState === 'waiting') inferState(); }, 1300);
    }
  }

  function markPendingFromKeyboard(event) {
    const target = event.target;
    const composer = target instanceof Element && (target.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea') || target.isContentEditable);
    if (!composer || event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    clearTimeout(pendingTimer);
    setState('waiting');
    pendingTimer = setTimeout(() => { if (localState === 'waiting') inferState(); }, 1300);
  }

  function markLoadingOnRoute() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    lastAssistantLen = 0;
    lastAssistantGrowthAt = 0;
    if (currentChatId()) {
      setState('loading');
      setTimeout(() => { if (localState === 'loading') setState('ready'); }, 1800);
    }
  }

  function renderSidebar() {
    const activeByProject = new Map();
    for (const [chatId, info] of states) {
      if (!info || Date.now() - info.at > 30 * 60 * 1000) { states.delete(chatId); continue; }
      if (info.projectId && info.state !== 'ready') activeByProject.set(info.projectId, info.state);
    }

    for (const a of document.querySelectorAll(CHAT_SEL)) {
      if (a.closest('#ng8-quick,#ng85-governance')) continue;
      const id = cidFromHref(a.getAttribute('href'));
      const info = states.get(id);
      const state = info?.state || (id === currentChatId() ? localState : 'ready');
      a.dataset.ng86Activity = state;
      a.classList.toggle('ng86-active-chat', state !== 'ready');
      a.classList.toggle('ng86-current-chat', id === currentChatId());
    }

    for (const a of document.querySelectorAll(PROJECT_SEL)) {
      if (a.closest('#ng8-quick,#ng85-governance')) continue;
      const pid = pidFromHref(a.getAttribute('href'));
      const state = activeByProject.get(pid) || (pid && pid === currentProjectId() ? localState : 'ready');
      a.dataset.ng86Activity = state;
      a.classList.toggle('ng86-active-project', state !== 'ready');
    }
  }

  function renderStatus() {
    const bar = document.getElementById('ng8-status');
    if (!bar) return;
    bar.dataset.ng86Activity = localState;
    let stateEl = bar.querySelector('.ng86-status-state');
    if (!stateEl) {
      stateEl = document.createElement('span');
      stateEl.className = 'ng86-status-state';
      bar.appendChild(stateEl);
    }
    const labels = {
      loading: 'CHARGEMENT',
      waiting: 'ATTENTE',
      thinking: 'RÉFLEXION / ANALYSE',
      executing: 'EXÉCUTION',
      error: 'ERREUR',
      ready: 'PRÊT'
    };
    stateEl.textContent = labels[localState] || 'PRÊT';

    // Hide the old status word so there is a single source of truth.
    for (const child of [...bar.children]) {
      if (child === stateEl) continue;
      if (/^(PRÊT|PRET|EXÉCUTION|EXECUTION|DIAGNOSTIC)$/i.test((child.textContent || '').trim())) child.classList.add('ng86-old-state');
    }
  }

  function render() {
    renderSidebar();
    renderStatus();
  }

  bc?.addEventListener('message', event => {
    const d = event.data;
    if (!d || d.type !== 'activity' || !d.chatId) return;
    states.set(d.chatId, { state: d.state || 'ready', projectId: d.projectId || '', at: d.at || Date.now() });
    renderSidebar();
  });

  document.addEventListener('click', markPendingFromComposer, true);
  document.addEventListener('keydown', markPendingFromKeyboard, true);

  setInterval(() => {
    markLoadingOnRoute();
    inferState();
    render();
  }, 700);

  setState(currentChatId() ? 'loading' : 'ready');
  setTimeout(() => { if (localState === 'loading') setState('ready'); }, 1600);
})();
