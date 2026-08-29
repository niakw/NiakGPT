(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PROJECT_MEMORY_132__) return;
  window.__NIAKGPT_PROJECT_MEMORY_132__ = true;

  const CACHE_KEY = 'niakgpt-v08-cache';
  const PREFS_KEY = 'niakgpt-project-memory-prefs-v132';
  const STATE_KEY = 'niakgpt-project-memory-state-v132';
  const CONTEXT_KEY = 'niakgpt-project-memory-context-v132';
  const QUEUE_KEY = 'niakgpt-project-memory-queue-v132';
  const MAX_STATE = 18000;
  const CHUNK = 360000;
  let seq = 0, syncing = false, autoTimer = 0, routeTimer = 0;
  let contextProject = '', contextText = '';

  const clean = v => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const one = v => clean(v).replace(/\s+/g, ' ').trim();
  const clip = (v, n) => { const s = clean(v); return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + '…'; };
  const safe = v => one(v).replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 160);
  const parseTime = v => { const n = Number(v); if (Number.isFinite(n) && n > 0) return n > 1e12 ? n : n * 1000; const d = Date.parse(String(v || '')); return Number.isFinite(d) ? d : 0; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const defaults = { autoSync: true, injectOnNewChat: true };

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(response || { ok: false, error: 'empty_response' });
        });
      } catch (error) { resolve({ ok: false, error: String(error && error.message || error) }); }
    });
  }

  function rpc(path, memoryBootstrap) {
    const id = 'ng132-memory-' + Date.now() + '-' + (++seq);
    return new Promise(resolve => {
      const timer = setTimeout(() => { off(); resolve({ ok: false, status: 0, error: 'rpc_timeout' }); }, 45000);
      const handler = event => { if (event.detail && event.detail.id === id) { off(); resolve(event.detail); } };
      const off = () => { clearTimeout(timer); document.removeEventListener('niakgpt:rpc-response', handler); };
      document.addEventListener('niakgpt:rpc-response', handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request', {
        detail: { id, path, method: 'GET', body: null, governance: true, memoryBootstrap: memoryBootstrap === true }
      }));
    });
  }

  const busy = () => document.documentElement.dataset.ng8Running === '1' ||
    ['loading','waiting','thinking','executing'].includes(String(document.documentElement.dataset.ng86Activity || '').toLowerCase()) ||
    document.documentElement.dataset.ng105Verification === '1';

  async function waitIdle(limit) {
    const start = Date.now(), max = limit || 10 * 60 * 1000;
    while (busy() || document.hidden) {
      if (Date.now() - start > max) return false;
      await sleep(1000);
    }
    return true;
  }

  async function prefs() {
    try { return Object.assign({}, defaults, (await chrome.storage.local.get(PREFS_KEY))[PREFS_KEY] || {}); }
    catch { return Object.assign({}, defaults); }
  }

  async function setPrefs(next) {
    const value = Object.assign({}, defaults, next || {});
    await chrome.storage.local.set({ [PREFS_KEY]: value });
    return value;
  }

  async function state(patch) {
    let old = {};
    try { old = (await chrome.storage.local.get(STATE_KEY))[STATE_KEY] || {}; } catch {}
    const next = Object.assign({}, old, patch, { at: Date.now() });
    try { await chrome.storage.local.set({ [STATE_KEY]: next }); } catch {}
    document.dispatchEvent(new CustomEvent('niakgpt:project-memory-state', { detail: next }));
    return next;
  }

  async function cache() {
    try { return (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {}; } catch { return {}; }
  }

  function projects(raw) {
    const ps = Array.isArray(raw.projects) ? raw.projects : [];
    const chats = Array.isArray(raw.chats) ? raw.chats : [];
    const indexed = new Set(Array.isArray(raw.indexedProjectIds) ? raw.indexedProjectIds : []);
    return ps.filter(p => String(p && p.id || '').startsWith('g-p-')).map(p => {
      const rows = chats.filter(c => c && c.projectId === p.id);
      return Object.assign({}, p, {
        chats: rows,
        count: Math.max(Number(raw.counts && raw.counts[p.id] || 0), rows.length),
        indexed: indexed.has(p.id)
      });
    });
  }

  function ppath(pid, tail) {
    const id = safe(pid);
    if (!id) throw new Error('invalid_project_id');
    return 'projects/' + id + (tail ? '/' + tail : '');
  }

  async function read(path) {
    const r = await send({ type: 'niakgpt:memory-read-v132', path });
    if (r && r.ok) return r.content;
    if (/404|not_found/i.test(String(r && r.error || ''))) return null;
    throw new Error(r && r.error || 'memory_read_failed');
  }

  async function commit(files, message) {
    for (let i = 0; i < files.length; i += 14) {
      const r = await send({
        type: 'niakgpt:memory-commit-v132',
        files: files.slice(i, i + 14),
        message: message + (files.length > 14 ? ' (' + (Math.floor(i / 14) + 1) + ')' : '')
      });
      if (!r || !r.ok) throw new Error(r && r.error || 'memory_commit_failed');
      if (i + 14 < files.length) await sleep(250);
    }
  }

  function partText(part) {
    if (typeof part === 'string') return part;
    if (!part || typeof part !== 'object') return '';
    if (typeof part.text === 'string') return part.text;
    if (typeof part.content === 'string') return part.content;
    return part.content_type ? '[attachment:' + one(part.content_type) + ']' : '';
  }

  function msgText(m) {
    if (!m || !m.content) return '';
    if (Array.isArray(m.content.parts)) return clean(m.content.parts.map(partText).filter(Boolean).join('\n'));
    if (typeof m.content.text === 'string') return clean(m.content.text);
    return '';
  }

  function messages(data) {
    const mapping = data && data.mapping && typeof data.mapping === 'object' ? data.mapping : {};
    let cursor = String(data && data.current_node || ''), chain = [], seen = new Set();
    while (cursor && mapping[cursor] && !seen.has(cursor)) {
      seen.add(cursor); chain.push(mapping[cursor]); cursor = String(mapping[cursor].parent || '');
    }
    if (chain.length) chain.reverse(); else chain = Object.values(mapping);
    return chain.map(node => {
      const m = node && node.message, text = msgText(m);
      if (!m || !text) return null;
      return { role: one(m.author && m.author.role || 'unknown').toLowerCase(), text, at: parseTime(m.create_time) };
    }).filter(Boolean);
  }

  function signals(rows) {
    const tasks = [], arch = [], decisions = [];
    const taskRx = /(?:^|\b)(?:todo|à faire|a faire|reste|remaining|next|continue|corriger|terminer|finaliser|vérifier|tester|relancer|optimiser|implement|implémenter|fix|finish|verify|retry)(?:\b|\s*:)/i;
    const archRx = /\b(?:architecture|archi|structure|invariant|pipeline|workflow|schema|schéma|module|core|lab|learning|runtime|provider|bridge|cache|queue|contract|contrat|source de vérité|source of truth)\b/i;
    const decisionRx = /\b(?:décid|decision|décision|retenu|règle|rule|doit|must|toujours|always|jamais|never|ne pas|priority|priorité|verrou|lock|canonique|canonical)\b/i;
    for (const m of rows) {
      for (const line0 of clean(m.text).split('\n')) {
        const line = one(line0); if (!line) continue;
        const tagged = (m.role === 'user' ? 'USER: ' : 'ASSISTANT: ') + clip(line, 500);
        if (/^\s*(?:[-*]\s*)?\[[ xX]\]/.test(line) || taskRx.test(line)) tasks.push(tagged);
        if (archRx.test(line)) arch.push(tagged);
        if (decisionRx.test(line)) decisions.push(tagged);
      }
    }
    const dedupe = list => [...new Map(list.map(x => [x.toLowerCase(), x])).values()].slice(0, 28);
    return {
      tasks: dedupe(tasks), architecture: dedupe(arch), decisions: dedupe(decisions),
      recent: rows.slice(-8).map(m => ({ role: m.role, at: m.at || 0, text: clip(m.text, 1200) }))
    };
  }

  function transcript(project, chat, rows) {
    const out = [
      '# ' + one(chat.title || 'Conversation'), '',
      '- Project: ' + one(project.name || project.id), '- Project ID: ' + project.id,
      '- Conversation ID: ' + chat.id, '- Captured by: NiakGPT Project Memory v132', ''
    ];
    rows.forEach(m => {
      out.push('## ' + String(m.role || 'unknown').toUpperCase() + (m.at ? ' · ' + new Date(m.at).toISOString() : ''), '', clean(m.text), '');
    });
    return out.join('\n').trim() + '\n';
  }

  function buildState(project, index) {
    const convs = Object.values(index.conversations || {}).sort((a,b) => Number(b.updated || 0) - Number(a.updated || 0));
    const tasks = [], arch = [], decisions = [], recent = [];
    convs.forEach(c => {
      const s = c.signals || {};
      tasks.push(...(s.tasks || [])); arch.push(...(s.architecture || [])); decisions.push(...(s.decisions || []));
      (s.recent || []).forEach(x => recent.push(Object.assign({}, x, { title: c.title, updated: c.updated })));
    });
    const uniq = list => [...new Map(list.map(x => [String(x).toLowerCase(), x])).values()].slice(0, 24);
    recent.sort((a,b) => Number(b.at || b.updated || 0) - Number(a.at || a.updated || 0));
    const section = (name, list) => '## ' + name + '\n\n' + (list.length ? uniq(list).map(x => '- ' + clip(x, 650)).join('\n') : '- Aucun signal fiable.') + '\n';
    const recentText = recent.slice(0, 10).map(x => '### ' + String(x.role || 'assistant').toUpperCase() + ' · ' + one(x.title || 'Conversation') + '\n\n' + clip(x.text, 1200)).join('\n\n');
    const inventory = convs.slice(0, 100).map(c => '- ' + one(c.title || c.id) + ' — ' + (c.updated ? new Date(Number(c.updated)).toISOString() : 'unknown')).join('\n');
    return clip(
      '# NiakGPT Project Memory — ' + one(project.name || project.id) + '\n\n' +
      '> Checkpoint compact de continuité. L’historique complet reste dans conversations/ et n’est pas injecté à chaque prompt.\n\n' +
      '- Project ID: ' + project.id + '\n- Generated: ' + new Date().toISOString() + '\n- Conversations indexed: ' + convs.length + '\n\n' +
      '## Project context\n\n' +
      (project.description ? '**Description**\n\n' + clip(project.description, 2200) + '\n\n' : '') +
      (project.instructions ? '**Instructions**\n\n' + clip(project.instructions, 4200) + '\n\n' : '') +
      section('Open tasks / next actions', tasks) + '\n' +
      section('Architecture / invariants / constraints', arch) + '\n' +
      section('Decisions / rules', decisions) + '\n' +
      '## Recent working context\n\n' + (recentText || 'Aucun contexte récent.') + '\n\n' +
      '## Conversation inventory\n\n' + (inventory || '- Aucun fil indexé.') + '\n',
      MAX_STATE
    ) + '\n';
  }

  async function fetchConversation(id, attempt) {
    if (!await waitIdle()) throw new Error('memory_sync_idle_timeout');
    const r = await rpc('/backend-api/conversation/' + encodeURIComponent(id), true);
    if (r && r.ok) return r.data;
    const n = Number(attempt || 0);
    if (n < 4 && (r && (r.error === 'native_busy' || r.status === 429 || r.status === 0))) {
      await sleep(Math.max(900, Number(r.retry_after_ms || 0), 900 * (n + 1)));
      return fetchConversation(id, n + 1);
    }
    throw new Error('conversation_fetch_failed:' + String(r && r.status || 0) + ':' + String(r && r.error || 'unknown'));
  }

  async function saveContext(pid, text) {
    let raw = {};
    try { raw = (await chrome.storage.local.get(CONTEXT_KEY))[CONTEXT_KEY] || {}; } catch {}
    raw[pid] = { text: clip(text, MAX_STATE), at: Date.now() };
    try { await chrome.storage.local.set({ [CONTEXT_KEY]: raw }); } catch {}
  }

  async function syncProject(project, force) {
    let idx = null;
    try { const txt = await read(ppath(project.id, 'index.json')); if (txt) idx = JSON.parse(txt); } catch {}
    if (!idx || typeof idx !== 'object') idx = { schema: 1, projectId: project.id, conversations: {} };
    if (!idx.conversations || typeof idx.conversations !== 'object') idx.conversations = {};

    const chats = project.chats.slice().sort((a,b) => Number(a.updated || 0) - Number(b.updated || 0));
    let changed = 0;
    for (let i = 0; i < chats.length; i++) {
      const chat = chats[i], old = idx.conversations[chat.id], updated = parseTime(chat.updated);
      if (!force && old && Number(old.updated || 0) >= updated && Number(old.parts || 0) > 0) continue;
      await state({ mode:'syncing', projectId:project.id, projectName:project.name, chatId:chat.id, chatTitle:chat.title, chatDone:i, chatTotal:chats.length });
      const data = await fetchConversation(chat.id, 0), rows = messages(data);
      if (!rows.length) continue;
      const full = transcript(project, chat, rows), chunks = [];
      for (let at = 0; at < full.length; at += CHUNK) chunks.push(full.slice(at, at + CHUNK));
      const base = ppath(project.id, 'conversations/' + safe(chat.id)), files = [];
      chunks.forEach((text, part) => files.push({ path: base + '/part-' + String(part + 1).padStart(3,'0') + '.md', content:text }));
      const sig = signals(rows);
      files.push({ path: base + '/index.json', content: JSON.stringify({ schema:1, id:chat.id, title:one(chat.title || data.title || 'Conversation'), updated:Math.max(updated, parseTime(data.update_time), Date.now()), parts:chunks.length, messages:rows.length, signals:sig }, null, 2) + '\n' });
      await commit(files, 'NiakGPT memory: ' + one(project.name || project.id) + ' / ' + one(chat.title || chat.id));
      idx.conversations[chat.id] = { id:chat.id, title:one(chat.title || data.title || 'Conversation'), updated:Math.max(updated, parseTime(data.update_time), Date.now()), parts:chunks.length, messages:rows.length, signals:sig };
      changed++;
      await sleep(300);
    }

    idx.projectId = project.id; idx.projectName = one(project.name || ''); idx.updatedAt = new Date().toISOString();
    const compact = buildState(project, idx);
    await commit([
      { path:ppath(project.id,'project.json'), content:JSON.stringify({ schema:1, id:project.id, name:one(project.name || ''), description:clean(project.description || ''), instructions:clean(project.instructions || ''), conversationCount:Object.keys(idx.conversations).length, updatedAt:idx.updatedAt }, null, 2) + '\n' },
      { path:ppath(project.id,'index.json'), content:JSON.stringify(idx, null, 2) + '\n' },
      { path:ppath(project.id,'PROJECT_STATE.md'), content:compact }
    ], 'NiakGPT memory: checkpoint ' + one(project.name || project.id));
    await saveContext(project.id, compact);
    return changed;
  }

  async function deepInventory() {
    let raw = await cache(), list = projects(raw);
    if (!list.some(p => p.count > 0 && !p.indexed)) return list;
    document.dispatchEvent(new CustomEvent('niakgpt:force-server-index', { detail:{ source:'project-memory-v132' } }));
    const end = Date.now() + 90000;
    while (Date.now() < end && !busy()) {
      await sleep(1000); raw = await cache(); list = projects(raw);
      if (!list.some(p => p.count > 0 && !p.indexed)) break;
    }
    return list;
  }

  async function saveQueue(ids, force) {
    try { await chrome.storage.local.set({ [QUEUE_KEY]:{ pending:ids, force:force === true, at:Date.now() } }); } catch {}
  }

  async function bootstrap(options) {
    if (syncing) return { ok:false, error:'sync_already_running' };
    const opt = options || {}, st = await send({ type:'niakgpt:memory-status-v132' });
    if (!st || !st.connected) return { ok:false, error:st && st.configured ? 'github_token_missing' : 'not_connected' };
    syncing = true;
    try {
      let list = await deepInventory();
      list = list.filter(p => p.count > 0 && (!Array.isArray(opt.projectIds) || opt.projectIds.includes(p.id)));
      await saveQueue(list.map(p => p.id), opt.force);
      await state({ mode:'syncing', projectDone:0, projectTotal:list.length, error:'' });
      let changed = 0;
      for (let i = 0; i < list.length; i++) {
        await saveQueue(list.slice(i).map(p => p.id), opt.force);
        if (!await waitIdle()) throw new Error('memory_sync_idle_timeout');
        changed += await syncProject(list[i], opt.force === true);
        await state({ mode:'syncing', projectDone:i+1, projectTotal:list.length, projectId:list[i].id, projectName:list[i].name });
      }
      try { await chrome.storage.local.remove(QUEUE_KEY); } catch {}
      const done = await state({ mode:'idle', projectDone:list.length, projectTotal:list.length, changed, lastSyncAt:Date.now(), error:'' });
      document.dispatchEvent(new CustomEvent('niakgpt:project-memory-synced', { detail:done }));
      return { ok:true, projects:list.length, changed };
    } catch (error) {
      await state({ mode:'error', error:String(error && error.message || error).slice(0,260) });
      return { ok:false, error:String(error && error.message || error) };
    } finally { syncing = false; }
  }

  async function resume() {
    if (syncing) return;
    try {
      const q = (await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY], p = await prefs();
      if (q && q.pending && q.pending.length && p.autoSync) bootstrap({ force:q.force, projectIds:q.pending });
    } catch {}
  }

  async function schedule(delay) {
    clearTimeout(autoTimer);
    if (!(await prefs()).autoSync) return;
    autoTimer = setTimeout(async () => {
      if (busy() || document.hidden) return schedule(15000);
      const st = await send({ type:'niakgpt:memory-status-v132' });
      if (st && st.connected) bootstrap({ force:false });
    }, delay || 12000);
  }

  function currentPid() {
    const m = location.pathname.match(/\/g\/(g-p-[A-Za-z0-9_-]+)(?:\/project|\/c\/|$)/);
    return m ? m[1] : '';
  }

  async function refreshContext() {
    const pid = currentPid();
    if (!pid) { contextProject = ''; contextText = ''; return; }
    if (pid === contextProject && contextText) return;
    contextProject = pid; contextText = '';
    try {
      const raw = (await chrome.storage.local.get(CONTEXT_KEY))[CONTEXT_KEY] || {};
      if (raw[pid] && raw[pid].text) contextText = raw[pid].text;
    } catch {}
    if (!contextText) {
      try { contextText = await read(ppath(pid,'PROJECT_STATE.md')) || ''; if (contextText) await saveContext(pid, contextText); } catch {}
    }
  }

  const editorText = ed => String(ed ? ('value' in ed ? ed.value : ed.innerText || ed.textContent || '') : '');
  const visible = el => el instanceof Element && el.isConnected && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
  const editorFor = target => target instanceof Element ? (target.matches('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]') ? target : target.closest('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')) : null;

  function setEditor(ed, value) {
    try {
      if ('value' in ed) {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ed),'value')?.set;
        setter ? setter.call(ed,value) : (ed.value=value);
      } else { ed.focus({preventScroll:true}); ed.textContent=value; }
      ed.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));
      return true;
    } catch { return false; }
  }

  async function inject(ed) {
    const p = await prefs();
    if (!p.injectOnNewChat || !contextProject || !contextText || !visible(ed)) return;
    if (document.querySelector('[data-message-author-role="user"]')) return;
    const raw = editorText(ed); if (!raw.trim() || raw.startsWith('NIAKGPT PROJECT MEMORY —')) return;
    const key = 'niakgpt-memory-v132:' + contextProject + ':' + location.pathname;
    try { if (sessionStorage.getItem(key) === '1') return; } catch {}
    const capsule = 'NIAKGPT PROJECT MEMORY — CHECKPOINT RÉCUPÉRÉ\n' +
      'Contexte privé restauré par NiakGPT. Utilise-le uniquement pour conserver les tâches, décisions, contraintes et l’architecture déjà établies. La demande utilisateur après ce bloc reste prioritaire. Ne répète pas inutilement ce checkpoint.\n\n' +
      '--- DÉBUT CONTEXTE PROJET ---\n' + clip(contextText, MAX_STATE) + '\n--- FIN CONTEXTE PROJET ---\n\nDEMANDE UTILISATEUR COURANTE\n\n' + raw;
    if (setEditor(ed,capsule)) {
      try { sessionStorage.setItem(key,'1'); } catch {}
      document.documentElement.dataset.ng132MemoryInjected = contextProject;
    }
  }

  async function connect(options) {
    const r = await send(Object.assign({ type:'niakgpt:memory-connect-v132' }, options || {}));
    if (r && r.ok) { await state({mode:'connected',error:''}); bootstrap({force:false}); }
    return r;
  }

  async function disconnect(forgetConfig) {
    const r = await send({ type:'niakgpt:memory-disconnect-v132', forgetConfig:forgetConfig === true });
    contextProject = ''; contextText = '';
    try { await chrome.storage.local.remove(QUEUE_KEY); } catch {}
    await state({mode:'disconnected',error:''});
    return r;
  }

  async function status() {
    const remote = await send({type:'niakgpt:memory-status-v132'});
    let local = {};
    try { local = await chrome.storage.local.get([STATE_KEY,PREFS_KEY]); } catch {}
    return Object.assign({}, remote, { state:local[STATE_KEY] || {}, prefs:Object.assign({},defaults,local[PREFS_KEY] || {}) });
  }

  window.__NIAKGPT_PROJECT_MEMORY__ = { connect, disconnect, status, syncNow:o => bootstrap({force:o && o.force === true}), getPrefs:prefs, setPrefs, refreshContext };

  document.addEventListener('click', event => {
    const btn = event.target instanceof Element ? event.target.closest('button') : null;
    if (!btn) return;
    const label = (btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('data-testid') || '') + ' ' + (btn.title || '');
    if (!/(?:^|\b)(?:send|envoyer|submit)(?:\b|$)/i.test(label)) return;
    const scope = btn.closest('form,[data-type*="composer" i],[class*="composer" i]');
    const ed = [...(scope || document).querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')].filter(visible).at(-1);
    if (ed) inject(ed);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const ed = editorFor(event.target); if (ed) inject(ed);
  }, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CACHE_KEY]) schedule(12000);
    if (area === 'local' && changes[CONTEXT_KEY]) refreshContext();
  });
  document.addEventListener('niakgpt:activity-changed', () => { if (!busy()) schedule(5000); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshContext(); resume(); } });

  function route() { clearTimeout(routeTimer); routeTimer = setTimeout(refreshContext,120); }
  window.addEventListener('popstate',route);
  if (window.navigation && window.navigation.addEventListener) window.navigation.addEventListener('navigatesuccess',route);
  window.addEventListener('pageshow',() => { refreshContext(); resume(); schedule(15000); });

  refreshContext(); resume(); schedule(18000);
})();