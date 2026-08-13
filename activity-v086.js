(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_ACTIVITY_086__) return;
  window.__NIAKGPT_ACTIVITY_086__ = true;

  const VERSION = '0.8.6';
  const CHANNEL = 'niakgpt-activity-v086';
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  const states = new Map();
  let localState = 'ready';
  let localSince = Date.now();
  let pendingTimer = 0;
  let lastPath = location.pathname;
  let lastAssistantLen = 0;
  let lastAssistantGrowthAt = 0;
  let lastStopSeenAt = 0;

  const CHAT_SEL = 'a[href*="/c/"]';
  const PROJECT_SEL = 'a[href^="/g/g-p-"][href*="/project"]';

  const cidFromHref = h => String(h || '').match(/\/c\/([0-9a-f-]{20,})/i)?.[1] || '';
  const pidFromHref = h => String(h || '').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1] || '';
  const currentChatId = () => cidFromHref(location.pathname);
  const currentProjectId = () => pidFromHref(location.pathname) || pidFromHref([...document.querySelectorAll(CHAT_SEL)].find(a => cidFromHref(a.getAttribute('href')) === currentChatId())?.getAttribute('href'));

  function setState(state, extra = {}) {
    const cid = currentChatId();
    const pid = currentProjectId();
    if (localState === state && !extra.force) return;
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
    const candidates = document.querySelectorAll('[data-testid*="thinking"],[class*="thinking"],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]');
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
      if (!txt || /thinking|réflexion|reflexion|analyse|analyzing|reasoning|raisonnement|working|travail/i.test(txt)) return true;
    }
    return false;
  }

  function detectErrorMarker() {
    const candidates = document.querySelectorAll('[role="alert"],[data-testid*="error" i],[class*="error" i]');
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const txt = (el.textContent || el.getAttribute('aria-label') || '').trim();
      if (/something went wrong|une erreur|erreur réseau|network error|failed|échec/i.test(txt)) return true;
    }
    return false;
  }

  function assistantLength() {
    const turns = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const last = turns.at(-1);
    return (last?.innerText || last?.textContent || '').length;
  }

  function conversationMounted() {
    return !!document.querySelector('[data-message-author-role],article[data-testid^="conversation-turn-"]') && !!document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');
  }

  function inferState() {
    const cid = currentChatId();
    if (!cid) return;

    if (detectErrorMarker()) {
      if (localState !== 'error') setState('error');
      return;
    }

    const stop = detectStopButton();
    const thinking = detectThinkingMarker();
    const len = assistantLength();

    if (stop) lastStopSeenAt = Date.now();

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
      const recentlyGrowing = Date.now() - lastAssistantGrowthAt < 2200;
      const wanted = recentlyGrowing ? 'executing' : (Date.now() - localSince > 1200 ? 'thinking' : 'waiting');
      if (localState !== wanted) setState(wanted);
      return;
    }

    // A freshly sent prompt may wait several seconds before ChatGPT exposes a Stop button.
    // Do NOT report READY just because the DOM has not caught up yet.
    if (localState === 'waiting') {
      if (Date.now() - localSince > 120000) setState('error');
      return;
    }

    if (localState === 'loading') {
      if (conversationMounted()) setState('ready');
      else if (Date.now() - localSince > 30000) setState('error');
      return;
    }

    if (localState === 'thinking' || localState === 'executing') {
      const quietFor = Date.now() - Math.max(lastAssistantGrowthAt, lastStopSeenAt, localSince);
      if (quietFor > 1200) setState('ready');
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
      pendingTimer = setTimeout(() => inferState(), 1000);
    }
  }

  function markPendingFromKeyboard(event) {
    const target = event.target;
    const composer = target instanceof Element && (target.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea') || target.isContentEditable);
    if (!composer || event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    clearTimeout(pendingTimer);
    setState('waiting');
    pendingTimer = setTimeout(() => inferState(), 1000);
  }

  function markLoadingOnRoute() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    lastAssistantLen = 0;
    lastAssistantGrowthAt = 0;
    lastStopSeenAt = 0;
    if (currentChatId()) setState('loading');
    else setState('ready');
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

    const first = bar.firstElementChild;
    if (first && /NiakGPT/i.test(first.textContent || '')) first.innerHTML = `<b>NiakGPT</b> ${VERSION}`;

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

    for (const child of [...bar.children]) {
      if (child === stateEl) continue;
      if (/^(PRÊT|PRET|EXÉCUTION|EXECUTION|DIAGNOSTIC|ATTENTE|CHARGEMENT|RÉFLEXION|REFLEXION)$/i.test((child.textContent || '').trim())) child.classList.add('ng86-old-state');
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

  setState(currentChatId() ? 'loading' : 'ready', { force:true });
})();
