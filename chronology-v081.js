(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_CHRONO_081__) return;
  window.__NIAKGPT_CHRONO_081__ = true;

  const CACHE_KEY = 'niakgpt-v08-cache';
  const CHAT_SEL = 'a[href*="/c/"]';
  const PROJECT_SEL = 'a[href^="/g/g-p-"][href*="/project"]';
  const OWN = '#ng8-pins,#ng8-panel,#ng8-quick,#ng8-rail,#ng8-status,#ng8-coach';

  let chats = new Map();
  let projects = new Map();
  let counts = new Map();
  let latestByProject = new Map();
  let timer = 0;
  let sorting = false;

  const parseTime = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value > 1e12 ? value : value * 1000;
    if (typeof value === 'string') {
      const n = Number(value);
      if (Number.isFinite(n)) return n > 1e12 ? n : n * 1000;
      const d = Date.parse(value);
      return Number.isFinite(d) ? d : 0;
    }
    return 0;
  };

  const cidFromHref = href => String(href || '').match(/\/c\/([0-9a-f-]{20,})/i)?.[1] || '';
  const pidFromHref = href => String(href || '').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1] || '';

  function formatDate(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const now = new Date();
    return d.getFullYear() === now.getFullYear() ? `${dd}/${mm}` : `${dd}/${mm}/${String(d.getFullYear()).slice(-2)}`;
  }

  async function readCache() {
    try {
      const raw = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
      chats = new Map();
      projects = new Map();
      counts = new Map(Object.entries(raw.counts || {}));
      latestByProject = new Map();

      for (const project of raw.projects || []) if (project?.id) projects.set(project.id, project);
      for (const chat of raw.chats || []) {
        if (!chat?.id) continue;
        const updated = parseTime(chat.updated || chat.update_time || chat.create_time);
        const normalized = { ...chat, updated };
        chats.set(chat.id, normalized);
        if (chat.projectId && updated > (latestByProject.get(chat.projectId) || 0)) latestByProject.set(chat.projectId, updated);
      }

      for (const [pid, list] of Object.entries(raw.projectChats || {})) {
        for (const chat of list || []) {
          if (!chat?.id) continue;
          const updated = parseTime(chat.updated || chat.update_time || chat.create_time);
          const old = chats.get(chat.id);
          if (!old || updated > old.updated) chats.set(chat.id, { ...old, ...chat, projectId: chat.projectId || pid, updated });
          if (updated > (latestByProject.get(pid) || 0)) latestByProject.set(pid, updated);
        }
      }
      scheduleApply(40);
    } catch (error) {
      console.warn('[NiakGPT chronology] cache read failed', error);
    }
  }

  function navRoot() {
    return document.querySelector('[data-testid="conversation-sidebar"]')
      || document.querySelector('[data-testid="sidebar"]')
      || [...document.querySelectorAll('nav,aside')].find(x => x.querySelector(CHAT_SEL))
      || document.querySelector('nav');
  }

  function addChatDates(root) {
    for (const link of root.querySelectorAll(CHAT_SEL)) {
      if (link.closest(OWN)) continue;
      const id = cidFromHref(link.getAttribute('href'));
      const chat = chats.get(id);
      if (!id || !chat?.updated) continue;

      link.dataset.ng8Updated = String(chat.updated);
      let date = link.querySelector(':scope > .ng8-chat-date');
      if (!date) {
        date = document.createElement('span');
        date.className = 'ng8-chat-date';
        link.appendChild(date);
      }
      date.textContent = formatDate(chat.updated);
      date.title = `Dernier échange : ${new Date(chat.updated).toLocaleString('fr-FR')}`;
    }
  }

  function decorateProjectMeta(root = document) {
    for (const link of root.querySelectorAll('#ng8-pins a[data-ng8-pin="1"], .ng8-project-table a')) {
      const pid = pidFromHref(link.getAttribute('href'));
      if (!pid) continue;
      const count = counts.has(pid) ? counts.get(pid) : null;
      const latest = latestByProject.get(pid) || 0;
      const meta = link.querySelector('small, b:last-child');
      if (!meta) continue;
      meta.classList.add('ng8-project-meta');
      meta.textContent = `${formatDate(latest)}  [${count == null ? '…' : count}]`;
      meta.title = latest ? `Dernier échange du Project : ${new Date(latest).toLocaleString('fr-FR')}` : 'Aucune date disponible';
    }
  }

  function wrapperFor(link) {
    const row = link.closest('li,[data-testid]');
    if (row && row !== link && row.querySelectorAll(CHAT_SEL).length === 1) return row;
    return link;
  }

  function sortVisibleRecentRows(root) {
    if (sorting) return;
    const links = [...root.querySelectorAll(CHAT_SEL)].filter(a => !a.closest(OWN));
    if (links.length < 2) return;

    const groups = new Map();
    for (const link of links) {
      const id = cidFromHref(link.getAttribute('href'));
      const updated = chats.get(id)?.updated || 0;
      if (!updated) continue;
      const wrapper = wrapperFor(link);
      const parent = wrapper.parentElement;
      if (!parent) continue;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push({ wrapper, updated });
    }

    sorting = true;
    try {
      for (const [parent, rows] of groups) {
        if (rows.length < 2) continue;
        const unique = [...new Map(rows.map(x => [x.wrapper, x])).values()];
        if (unique.length < 2) continue;

        // Only reorder containers that are overwhelmingly chat rows.
        const chatChildren = unique.length;
        const elementChildren = [...parent.children].filter(x => x instanceof HTMLElement).length;
        if (elementChildren > chatChildren + 2) continue;

        const sorted = [...unique].sort((a, b) => b.updated - a.updated);
        const alreadySorted = unique.every((x, i) => x.wrapper === sorted[i]?.wrapper);
        if (alreadySorted) continue;

        const frag = document.createDocumentFragment();
        for (const item of sorted) frag.appendChild(item.wrapper);
        parent.appendChild(frag);
      }
    } finally {
      sorting = false;
    }
  }

  function apply() {
    const root = navRoot();
    if (root) {
      addChatDates(root);
      sortVisibleRecentRows(root);
    }
    decorateProjectMeta(document);
  }

  function scheduleApply(delay = 220) {
    clearTimeout(timer);
    timer = setTimeout(apply, delay);
  }

  function bind() {
    const root = navRoot();
    if (root) {
      const observer = new MutationObserver(() => {
        if (!sorting) scheduleApply(300);
      });
      observer.observe(root, { childList: true, subtree: true });
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[CACHE_KEY]) readCache();
    });

    document.addEventListener('niakgpt:rpc-response', () => scheduleApply(700));
    setInterval(() => scheduleApply(0), 15000);
  }

  readCache();
  bind();
})();
