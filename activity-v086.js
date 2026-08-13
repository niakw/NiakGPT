(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_ACTIVITY_086__) return;
  window.__NIAKGPT_ACTIVITY_086__ = true;

  const VERSION = (() => { try { return chrome.runtime.getManifest().version || '0.8.7'; } catch { return '0.8.7'; } })();
  const CHANNEL = 'niakgpt-activity-v087';
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null;
  const states = new Map();
  const ACTIVE = new Set(['loading','waiting','thinking','executing']);
  const PRIORITY = { ready:0, loading:1, waiting:2, thinking:3, executing:4, error:5 };

  let localState = 'ready';
  let localSince = Date.now();
  let pendingTimer = 0;
  let lastPath = location.pathname;
  let lastAssistantLen = 0;
  let lastAssistantGrowthAt = 0;
  let lastStopSeenAt = 0;
  let lastSidebarRenderAt = 0;
  let lastHeartbeatAt = 0;
  let tickTimer = 0;

  const CHAT_SEL = 'a[href*="/c/"]';
  const PROJECT_SEL = 'a[href^="/g/g-p-"][href*="/project"]';
  const cidFromHref = h => String(h || '').match(/\/c\/([0-9a-f-]{20,})/i)?.[1] || '';
  const pidFromHref = h => String(h || '').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1] || '';
  const currentChatId = () => cidFromHref(location.pathname);

  function sidebarRoot() {
    return document.querySelector('[data-testid="conversation-sidebar"]') || document.querySelector('[data-testid="sidebar"]') || document.querySelector('nav');
  }

  function currentProjectId() {
    const pathProject = pidFromHref(location.pathname);
    if (pathProject) return pathProject;
    const cid = currentChatId();
    if (!cid) return '';
    const root = sidebarRoot();
    const link = root?.querySelector(`a[href$="/c/${cid}"],a[href="/c/${cid}"]`);
    return pidFromHref(link?.getAttribute('href'));
  }

  function broadcast(chatId, state, projectId = '', at = Date.now()) {
    if (!chatId) return;
    bc?.postMessage({ type:'activity', chatId, projectId, state, at });
  }

  function remember(chatId, state, projectId = '', at = Date.now()) {
    if (!chatId) return;
    states.set(chatId, { state, projectId, at });
  }

  function setState(state, extra = {}) {
    const cid = currentChatId();
    const pid = currentProjectId();
    if (localState === state && !extra.force) return;
    localState = state;
    localSince = Date.now();
    document.documentElement.dataset.ng86Activity = state;
    document.documentElement.dataset.ng8Running = ACTIVE.has(state) ? '1' : '0';
    if (cid) {
      remember(cid, state, pid, localSince);
      broadcast(cid, state, pid, localSince);
    }
    render();
  }

  function setRemoteState(chatId, state, projectId = '', at = Date.now()) {
    if (!chatId) return;
    remember(chatId, state, projectId, at);
    renderSidebar();
  }

  function visible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function mainRoot() {
    return document.querySelector('main') || document.body;
  }

  function detectStopButton() {
    const selectors = [
      'button[data-testid*="stop" i]',
      'button[aria-label*="Stop" i]',
      'button[aria-label*="Arrêter" i]',
      'button[aria-label*="Arreter" i]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (visible(el)) return true;
    }
    return false;
  }

  function detectThinkingMarker() {
    const root = mainRoot();
    const candidates = root.querySelectorAll('[data-testid*="thinking" i],[data-state="thinking"],[data-state="loading"],[aria-busy="true"]');
    for (const el of candidates) {
      if (!visible(el)) continue;
      const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
      if (!txt || /thinking|réflexion|reflexion|analyse|analyzing|reasoning|raisonnement|working|travail/i.test(txt)) return true;
    }
    return false;
  }

  function detectErrorMarker() {
    const root = mainRoot();
    const candidates = root.querySelectorAll('[role="alert"],[data-testid*="error" i]');
    for (const el of candidates) {
      if (!visible(el)) continue;
      const txt = (el.textContent || el.getAttribute('aria-label') || '').trim();
      if (/something went wrong|une erreur|erreur réseau|network error|failed|échec/i.test(txt)) return true;
    }
    return false;
  }

  function assistantLength() {
    const root = mainRoot();
    const turns = root.querySelectorAll('[data-message-author-role="assistant"]');
    const last = turns.item(turns.length - 1);
    return (last?.innerText || last?.textContent || '').length;
  }

  function conversationMounted() {
    const root = mainRoot();
    return !!root.querySelector('[data-message-author-role],article[data-testid^="conversation-turn-"]') && !!document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');
  }

  function inferState() {
    const cid = currentChatId();
    if (!cid || localState === 'ready' || localState === 'error') return;

    if (detectErrorMarker()) {
      setState('error');
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
      const recentlyGrowing = Date.now() - lastAssistantGrowthAt < 2400;
      const wanted = recentlyGrowing ? 'executing' : (Date.now() - localSince > 1200 ? 'thinking' : 'waiting');
      if (localState !== wanted) setState(wanted);
      return;
    }

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
      if (quietFor > 2200) setState('ready');
    }
  }

  function markPendingFromComposer(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const send = target.closest('button');
    const label = `${send?.getAttribute('aria-label') || ''} ${send?.getAttribute('data-testid') || ''} ${send?.title || ''}`;
    if (/send|envoyer|submit/i.test(label)) {
      clearTimeout(pendingTimer);
      setState('waiting', { force:true });
      pendingTimer = setTimeout(inferState, 900);
    }
  }

  function markPendingFromKeyboard(event) {
    const target = event.target;
    const composer = target instanceof Element && (target.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea') || target.isContentEditable);
    if (!composer || event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    clearTimeout(pendingTimer);
    setState('waiting', { force:true });
    pendingTimer = setTimeout(inferState, 900);
  }

  function markNavigationClick(event) {
    const a = event.target instanceof Element ? event.target.closest('a[href*="/c/"]') : null;
    const id = cidFromHref(a?.getAttribute('href'));
    if (!id || id === currentChatId()) return;
    const pid = pidFromHref(a.getAttribute('href'));
    remember(id, 'loading', pid, Date.now());
    broadcast(id, 'loading', pid);
    renderSidebar();
  }

  function markLoadingOnRoute() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    lastAssistantLen = 0;
    lastAssistantGrowthAt = 0;
    lastStopSeenAt = 0;
    if (currentChatId()) setState('loading', { force:true });
    else setState('ready', { force:true });
  }

  function renderSidebar() {
    lastSidebarRenderAt = Date.now();
    const root = sidebarRoot();
    if (!root) return;
    const now = Date.now();
    const activeByProject = new Map();

    for (const [chatId, info] of states) {
      if (!info || now - info.at > 20 * 60 * 1000) {
        states.delete(chatId);
        continue;
      }
      if (!info.projectId || info.state === 'ready') continue;
      const previous = activeByProject.get(info.projectId);
      if (!previous || (PRIORITY[info.state] || 0) > (PRIORITY[previous] || 0)) activeByProject.set(info.projectId, info.state);
    }

    for (const a of root.querySelectorAll(CHAT_SEL)) {
      if (a.closest('#ng8-quick,#ng85-governance')) continue;
      const id = cidFromHref(a.getAttribute('href'));
      const info = states.get(id);
      const state = info?.state || (id === currentChatId() ? localState : 'ready');
      a.dataset.ng86Activity = state;
      a.classList.toggle('ng86-active-chat', state !== 'ready');
      a.classList.toggle('ng86-current-chat', id === currentChatId());
    }

    for (const a of root.querySelectorAll(PROJECT_SEL)) {
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
      loading:'CHARGEMENT', waiting:'ATTENTE', thinking:'RÉFLEXION / ANALYSE', executing:'EXÉCUTION', error:'ERREUR', ready:'PRÊT'
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

  function snapshot() {
    const rows = [];
    for (const [chatId, info] of states) rows.push({ chatId, ...info });
    const cid = currentChatId();
    if (cid && !rows.some(x => x.chatId === cid)) rows.push({ chatId:cid, state:localState, projectId:currentProjectId(), at:Date.now() });
    return rows.slice(-80);
  }

  bc?.addEventListener('message', event => {
    const d = event.data;
    if (!d) return;
    if (d.type === 'hello') {
      bc.postMessage({ type:'snapshot', entries:snapshot(), at:Date.now() });
      return;
    }
    if (d.type === 'snapshot' && Array.isArray(d.entries)) {
      for (const row of d.entries) {
        if (!row?.chatId) continue;
        const old = states.get(row.chatId);
        if (!old || (row.at || 0) >= (old.at || 0)) remember(row.chatId, row.state || 'ready', row.projectId || '', row.at || Date.now());
      }
      renderSidebar();
      return;
    }
    if (d.type !== 'activity' || !d.chatId) return;
    setRemoteState(d.chatId, d.state || 'ready', d.projectId || '', d.at || Date.now());
  });

  document.addEventListener('niakgpt:activity-network', event => {
    const d = event.detail || {};
    const cid = d.chatId || currentChatId();
    if (d.phase === 'request') {
      if (!d.chatId || d.chatId === currentChatId()) setState('waiting', { force:true });
      else setRemoteState(cid, 'waiting', '', d.at || Date.now());
      return;
    }
    if (d.phase === 'headers') {
      if (!d.chatId || d.chatId === currentChatId()) setState('thinking', { force:true });
      else setRemoteState(cid, 'thinking', '', d.at || Date.now());
      return;
    }
    if (d.phase === 'error') {
      if (!d.chatId || d.chatId === currentChatId()) setState('error', { force:true });
      else setRemoteState(cid, 'error', '', d.at || Date.now());
    }
  });

  document.addEventListener('click', markPendingFromComposer, true);
  document.addEventListener('click', markNavigationClick, true);
  document.addEventListener('keydown', markPendingFromKeyboard, true);

  window.addEventListener('pagehide', () => {
    const cid = currentChatId();
    if (cid) broadcast(cid, 'ready', currentProjectId(), Date.now());
  }, { once:true });

  function tick() {
    clearTimeout(tickTimer);
    markLoadingOnRoute();
    if (ACTIVE.has(localState)) inferState();

    const now = Date.now();
    const renderEvery = ACTIVE.has(localState) ? 1500 : 4200;
    if (now - lastSidebarRenderAt > renderEvery) renderSidebar();
    renderStatus();

    if (ACTIVE.has(localState) && now - lastHeartbeatAt > 20000) {
      lastHeartbeatAt = now;
      const cid = currentChatId();
      if (cid) broadcast(cid, localState, currentProjectId(), now);
    }

    tickTimer = setTimeout(tick, ACTIVE.has(localState) ? 650 : 2200);
  }

  setState(currentChatId() ? 'loading' : 'ready', { force:true });
  bc?.postMessage({ type:'hello', at:Date.now() });
  tick();
})();
