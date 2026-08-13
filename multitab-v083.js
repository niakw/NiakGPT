(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_MULTITAB_083__) return;
  window.__NIAKGPT_MULTITAB_083__ = true;

  const VERSION = '0.8.3';
  const CACHE_KEY = 'niakgpt-v08-cache';
  const LOCK_NAME = 'niakgpt-worker-v083';
  const CHANNEL_NAME = 'niakgpt-tabs-v083';
  const LEASE_KEY = '__niakgpt_worker_lease_v083';
  const tabId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const startedAt = performance.now();

  const nativeRIC = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback.bind(window) : null;
  const nativeCIC = typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback.bind(window) : null;
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCAF = window.cancelAnimationFrame.bind(window);

  let role = 'ELECTING';
  let acquiring = false;
  let releaseLock = null;
  let cooldownUntil = 0;
  let fallbackWorker = false;
  let taskSeq = 0;
  let activeIdle = false;
  let virtualRafSeq = 2000000;
  let heavySince = 0;

  const idleTasks = new Map();
  const rafTasks = new Map();
  const peers = new Map();
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;

  function isGenerating() {
    return [...document.querySelectorAll('button,[data-testid]')]
      .filter(el => el instanceof HTMLElement && el.getBoundingClientRect().width > 0)
      .some(el => /stop|arrêter|arreter/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''}`));
  }

  function turnCount() {
    return document.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]').length;
  }

  function loadState() {
    const turns = turnCount();
    const generating = isGenerating();
    return { turns, generating, heavy: turns >= 60 || generating };
  }

  function canRunWorkerIdle() {
    if (role !== 'WORKER') return false;
    if (performance.now() - startedAt < 2800) return false;
    const s = loadState();
    return !s.generating && s.turns < 60;
  }

  function updateRoleDOM() {
    document.documentElement.dataset.ng8TabRole = role.toLowerCase();
    document.documentElement.dataset.ng8TabId = tabId.slice(0, 8);
    const status = document.getElementById('ng8-status');
    if (status) {
      status.dataset.tabRole = role;
      status.title = `${status.title ? `${status.title} · ` : ''}NiakGPT ${VERSION} · ${role}`;
    }
  }

  function setRole(next) {
    if (role === next) return;
    role = next;
    updateRoleDOM();
    broadcast();
    if (role === 'WORKER') pumpIdle();
    patchDiagnostic();
  }

  function runIdleTask(taskId) {
    const task = idleTasks.get(taskId);
    if (!task || activeIdle || !canRunWorkerIdle()) return;
    activeIdle = true;

    const done = deadline => {
      const current = idleTasks.get(taskId);
      idleTasks.delete(taskId);
      activeIdle = false;
      if (current) {
        try { current.cb(deadline); } catch (error) { console.error('[NiakGPT worker idle]', error); }
      }
      setTimeout(pumpIdle, 220);
    };

    if (nativeRIC) {
      task.nativeId = nativeRIC(done, task.options || { timeout: 2500 });
    } else {
      task.nativeId = setTimeout(() => done({ didTimeout:true, timeRemaining:() => 16 }), 420);
    }
  }

  function pumpIdle() {
    if (activeIdle || !canRunWorkerIdle()) return;
    const first = idleTasks.keys().next();
    if (!first.done) runIdleTask(first.value);
  }

  window.requestIdleCallback = function niakgptCoordinatedIdle(cb, options) {
    const id = ++taskSeq;
    idleTasks.set(id, { cb, options, nativeId:null });
    pumpIdle();
    return id;
  };

  window.cancelIdleCallback = function niakgptCancelCoordinatedIdle(id) {
    const task = idleTasks.get(id);
    if (!task) {
      if (nativeCIC) nativeCIC(id);
      return;
    }
    idleTasks.delete(id);
    if (task.nativeId != null) {
      if (nativeCIC) nativeCIC(task.nativeId);
      else clearTimeout(task.nativeId);
    }
  };

  window.requestAnimationFrame = function niakgptCoordinatedRAF(cb) {
    if (role === 'WORKER' && !loadState().heavy && !document.hidden) return nativeRAF(cb);

    const id = ++virtualRafSeq;
    const gap = document.hidden ? 1200 : role === 'CLIENT' ? 420 : 220;
    const timeout = setTimeout(() => {
      const real = nativeRAF(time => {
        rafTasks.delete(id);
        cb(time);
      });
      rafTasks.set(id, { kind:'raf', id:real });
    }, gap);
    rafTasks.set(id, { kind:'timeout', id:timeout });
    return id;
  };

  window.cancelAnimationFrame = function niakgptCancelCoordinatedRAF(id) {
    const task = rafTasks.get(id);
    if (!task) return nativeCAF(id);
    rafTasks.delete(id);
    if (task.kind === 'timeout') clearTimeout(task.id);
    else nativeCAF(task.id);
  };

  function broadcast() {
    const s = loadState();
    bc?.postMessage({ type:'heartbeat', id:tabId, role, visible:!document.hidden, heavy:s.heavy, turns:s.turns, ts:Date.now() });
  }

  bc?.addEventListener('message', event => {
    const m = event.data;
    if (!m || m.id === tabId) return;
    if (m.type === 'heartbeat') peers.set(m.id, m);
  });

  function cleanPeers() {
    const now = Date.now();
    for (const [id, peer] of peers) if (now - (peer.ts || 0) > 9000) peers.delete(id);
  }

  function maybeYieldHeavyWorker() {
    if (role !== 'WORKER') return;
    cleanPeers();
    const s = loadState();
    if (!s.heavy) {
      heavySince = 0;
      return;
    }
    if (!heavySince) heavySince = Date.now();
    if (Date.now() - heavySince < 4500) return;

    const candidate = [...peers.values()].find(p => !p.heavy);
    if (!candidate) return;

    cooldownUntil = Date.now() + 7500;
    if (releaseLock) {
      const release = releaseLock;
      releaseLock = null;
      release();
    } else if (fallbackWorker) {
      fallbackWorker = false;
      try {
        const lease = JSON.parse(localStorage.getItem(LEASE_KEY) || '{}');
        if (lease.id === tabId) localStorage.removeItem(LEASE_KEY);
      } catch {}
      setRole('CLIENT');
    }
  }

  function fallbackAttempt() {
    if (Date.now() < cooldownUntil) return setRole('CLIENT');
    const now = Date.now();
    try {
      const current = JSON.parse(localStorage.getItem(LEASE_KEY) || '{}');
      if (!current.id || current.expires < now || current.id === tabId) {
        localStorage.setItem(LEASE_KEY, JSON.stringify({ id:tabId, expires:now + 10000 }));
        const verify = JSON.parse(localStorage.getItem(LEASE_KEY) || '{}');
        if (verify.id === tabId) {
          fallbackWorker = true;
          setRole('WORKER');
          return;
        }
      }
    } catch {}
    fallbackWorker = false;
    setRole('CLIENT');
  }

  function heartbeatFallbackLease() {
    if (!fallbackWorker || role !== 'WORKER') return;
    try { localStorage.setItem(LEASE_KEY, JSON.stringify({ id:tabId, expires:Date.now() + 10000 })); } catch {}
  }

  function tryAcquireWorker() {
    if (acquiring || role === 'WORKER' || Date.now() < cooldownUntil) return;

    if (!navigator.locks?.request) {
      fallbackAttempt();
      return;
    }

    acquiring = true;
    navigator.locks.request(LOCK_NAME, { mode:'exclusive', ifAvailable:true }, async lock => {
      acquiring = false;
      if (!lock) {
        setRole('CLIENT');
        return;
      }

      setRole('WORKER');
      await new Promise(resolve => { releaseLock = resolve; });
      releaseLock = null;
      if (role === 'WORKER') setRole('CLIENT');
    }).catch(() => {
      acquiring = false;
      fallbackAttempt();
    });
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function parseTime(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v > 1e12 ? v : v * 1000;
    if (typeof v === 'string') {
      const n = Number(v);
      if (Number.isFinite(n)) return n > 1e12 ? n : n * 1000;
      const d = Date.parse(v);
      return Number.isFinite(d) ? d : 0;
    }
    return 0;
  }

  function formatDate(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  async function openClientQuick() {
    if (role !== 'CLIENT') return false;
    document.getElementById('ng8-quick')?.remove();

    let raw = {};
    try { raw = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {}; } catch {}
    const projects = Array.isArray(raw.projects) ? raw.projects : [];
    const chats = Array.isArray(raw.chats) ? raw.chats : [];
    const counts = raw.counts || {};
    const projectById = new Map(projects.map(p => [p.id, p]));

    const modal = document.createElement('div');
    modal.id = 'ng8-quick';
    modal.classList.add('ng8-client-quick');
    modal.innerHTML = `<div><input autofocus placeholder="Quick Open — cache partagé"><section></section><footer>CLIENT · ${projects.length} Projects · ${chats.length} chats · aucune requête réseau</footer></div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector('input');
    const list = modal.querySelector('section');
    let items = [];
    let selected = 0;
    const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

    const paint = () => {
      const q = norm(input.value.trim());
      const ps = projects
        .filter(p => !q || norm(p.name).includes(q))
        .map(p => ({ type:'PROJECT', title:p.name, sub:`${formatDate(Math.max(0, ...chats.filter(c => c.projectId === p.id).map(c => parseTime(c.updated))))} · [${counts[p.id] ?? '…'}]`, href:p.href || `/g/${p.id}/project`, color:p.color || '#4fc1ff' }));
      const cs = chats
        .filter(c => {
          const p = projectById.get(c.projectId);
          return !q || norm(`${c.title} ${p?.name || ''}`).includes(q);
        })
        .sort((a,b) => parseTime(b.updated) - parseTime(a.updated))
        .slice(0, q ? 120 : 80)
        .map(c => {
          const p = projectById.get(c.projectId);
          return { type:'CHAT', title:c.title, sub:`${formatDate(parseTime(c.updated))} · ${p?.name || 'Hors projet'}`, href:c.href || (c.projectId ? `/g/${c.projectId}/c/${c.id}` : `/c/${c.id}`), color:p?.color || '#607080' };
        });

      items = [...ps, ...cs].slice(0, 140);
      selected = Math.min(selected, Math.max(0, items.length - 1));
      list.innerHTML = items.map((x,i) => `<button class="${i === selected ? 'sel' : ''}" data-i="${i}"><i style="--ng-project:${x.color}"></i><span>${esc(x.title)}</span><small>${esc(x.sub)}</small><em>${x.type}</em></button>`).join('');
      list.querySelectorAll('button').forEach(button => {
        button.onclick = () => { location.href = items[Number(button.dataset.i)].href; };
      });
    };

    input.oninput = () => { selected = 0; paint(); };
    input.onkeydown = event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); selected = Math.min(selected + 1, items.length - 1); paint(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(0, selected - 1); paint(); }
      else if (event.key === 'Enter' && items[selected]) { event.preventDefault(); location.href = items[selected].href; }
      else if (event.key === 'Escape') modal.remove();
    };
    modal.onmousedown = e => { if (e.target === modal) modal.remove(); };
    paint();
    setTimeout(() => input.focus(), 0);
    return true;
  }

  function toast(text) {
    let node = document.getElementById('ng8-tab-toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'ng8-tab-toast';
      document.body.appendChild(node);
    }
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(node._hideTimer);
    node._hideTimer = setTimeout(() => node.classList.remove('show'), 2400);
  }

  function patchDiagnostic() {
    updateRoleDOM();
    const diag = document.querySelector('#ng8-panel .ng8-diag');
    if (!diag) return;

    let roleRow = diag.querySelector(':scope > .ng8-tab-diagnostic');
    if (!roleRow) {
      roleRow = document.createElement('div');
      roleRow.className = 'ng8-tab-diagnostic';
      diag.prepend(roleRow);
    }
    roleRow.innerHTML = `<span>onglet</span><b class="ok">${role === 'WORKER' ? 'WORKER · tâches partagées' : role === 'CLIENT' ? 'CLIENT · délégation active' : 'ÉLECTION'}</b>`;

    for (const row of diag.querySelectorAll(':scope > div:not(.ng8-tab-diagnostic)')) {
      const key = (row.querySelector('span')?.textContent || '').trim().toLowerCase();
      const value = row.querySelector('b');
      if (!value) continue;
      const current = (value.textContent || '').trim();

      if (role === 'CLIENT' && ['bridge','projects','data','organizer','pins'].includes(key) && /^(ATTENTE|CACHE|INDEX)/i.test(current)) {
        value.textContent = 'DÉLÉGUÉ · WORKER';
        value.className = 'wait';
      }
      if (role === 'CLIENT' && key === 'quick' && /^ATTENTE/i.test(current)) {
        value.textContent = 'CACHE PARTAGÉ · Alt+K';
        value.className = 'ok';
      }
      if (role === 'WORKER' && ['bridge','projects'].includes(key) && /^ATTENTE/i.test(current)) {
        value.textContent = 'DÉMARRAGE · WORKER';
        value.className = 'wait';
      }
      if (key === 'coach' && /^ATTENTE/i.test(current)) {
        const composer = document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]');
        value.textContent = composer ? 'LOCAL · PRÊT' : 'INACTIF · COMPOSER';
        value.className = composer ? 'ok' : 'wait';
      }
      if (key === 'toc' && /^ATTENTE/i.test(current)) {
        const n = turnCount();
        value.textContent = n ? `LOCAL · ${n} blocs` : 'VIDE · 0 blocs';
        value.className = n ? 'ok' : 'wait';
      }
    }
  }

  document.addEventListener('keydown', event => {
    if (role !== 'CLIENT' || !event.altKey || event.key.toLowerCase() !== 'k') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openClientQuick();
  }, true);

  document.addEventListener('click', event => {
    if (role !== 'CLIENT') return;
    const q = event.target.closest?.('#ng8-rail [data-q],#ng8-status [data-q]');
    if (q) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openClientQuick();
      return;
    }
    const heavyAction = event.target.closest?.('[data-repair],[data-refresh]');
    if (heavyAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast('Tâche lourde déléguée à l’onglet WORKER');
    }
  }, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CACHE_KEY] && role === 'CLIENT') {
      document.dispatchEvent(new CustomEvent('niakgpt:shared-cache-updated'));
      patchDiagnostic();
    }
  });

  document.addEventListener('visibilitychange', () => {
    broadcast();
    if (!document.hidden) pumpIdle();
  });
  window.addEventListener('pagehide', () => {
    if (releaseLock) releaseLock();
    if (fallbackWorker) {
      try {
        const lease = JSON.parse(localStorage.getItem(LEASE_KEY) || '{}');
        if (lease.id === tabId) localStorage.removeItem(LEASE_KEY);
      } catch {}
    }
    bc?.close();
  }, { once:true });

  setRole('ELECTING');
  tryAcquireWorker();
  setInterval(() => {
    cleanPeers();
    broadcast();
    heartbeatFallbackLease();
    maybeYieldHeavyWorker();
    if (role !== 'WORKER') tryAcquireWorker();
    else pumpIdle();
    patchDiagnostic();
  }, 2600);
})();
