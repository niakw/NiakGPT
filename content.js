(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT__) return;
  window.__NIAKGPT__ = true;

  const VERSION = '0.3.1';
  const STORAGE_KEY = 'niakgpt_settings_v031';
  const VISITS_KEY = 'niakgpt_visits_v031';
  const STOP = new Set('le la les un une des de du d et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from'.split(/\s+/));
  const GENERIC_PROJECTS = new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc']);

  const DEFAULTS = {
    explorer: true,
    promptCoach: true,
    toc: true,
    performance: true,
    autoOrganize: true,
    nativePin: true,
    maxPinnedProjects: 8,
    maxMovesPerPass: 6,
    keepRecentTurns: 6,
    perfRootMargin: 1100
  };

  const state = {
    settings: { ...DEFAULTS },
    projects: [],
    projectById: new Map(),
    chats: [],
    chatById: new Map(),
    profiles: new Map(),
    activeTab: 'explorer',
    panelOpen: true,
    currentChatId: '',
    currentProjectId: '',
    turns: [],
    visits: [],
    audit: [],
    prefetched: new Set(),
    observer: null,
    io: null,
    scanTimer: 0,
    coachTimer: 0,
    pinRunning: false,
    health: { bridge:'warn', projects:'warn', organizer:'warn', coach:'warn', toc:'warn', performance:'warn', pins:'warn' }
  };

  function normalize(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  }
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function tokens(v) {
    return normalize(v).replace(/[^a-z0-9à-ÿ_-]+/gi, ' ').split(/\s+/).filter(x => x.length > 2 && !STOP.has(x));
  }
  function colorFor(name) {
    const colors = ['#4EC9B0','#569CD6','#C586C0','#DCDCAA','#CE9178','#9CDCFE','#D7BA7D','#B5CEA8','#D16969','#F14C4C'];
    let h = 0; for (const c of String(name)) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
    return colors[Math.abs(h) % colors.length];
  }
  function storageGet(key, fallback) {
    return new Promise(resolve => chrome.storage.local.get({ [key]: fallback }, x => resolve(x[key])));
  }
  function storageSet(key, value) { return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve)); }

  let rpcSeq = 0;
  function rpc(path, { method='GET', body=null, timeout=12000 } = {}) {
    const id = `ng-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => { cleanup(); resolve({ ok:false, status:0, error:'timeout' }); }, timeout);
      const handler = ev => {
        if (ev.detail?.id !== id) return;
        cleanup(); resolve(ev.detail);
      };
      const cleanup = () => { clearTimeout(timer); document.removeEventListener('niakgpt:rpc-response', handler); };
      document.addEventListener('niakgpt:rpc-response', handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request', { detail:{ id, path, method, body } }));
    });
  }

  function toast(message) {
    let el = document.getElementById('ng-toast');
    if (!el) { el = document.createElement('div'); el.id = 'ng-toast'; document.documentElement.appendChild(el); }
    el.textContent = message; el.classList.add('show');
    clearTimeout(el.__t); el.__t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function parseCurrent() {
    const path = location.pathname;
    state.currentChatId = path.match(/\/c\/([^/?#]+)/)?.[1] || '';
    state.currentProjectId = path.match(/\/g\/(g-p-[^/?#]+)/)?.[1] || '';
  }

  function extractProjects(payload) {
    const out = new Map();
    const seen = new WeakSet();
    function walk(x) {
      if (!x || typeof x !== 'object') return;
      if (seen.has(x)) return; seen.add(x);
      const candidates = [x, x.gizmo, x.gizmo?.gizmo].filter(Boolean);
      for (const c of candidates) {
        const id = String(c.id || c.short_url || '');
        const name = String(c.display?.name || c.name || '').trim();
        if (id.startsWith('g-p-') && name) out.set(id, { id, name, color:colorFor(name) });
      }
      if (Array.isArray(x)) x.forEach(walk); else Object.values(x).forEach(walk);
    }
    walk(payload);
    return [...out.values()];
  }

  function normalizeChat(x) {
    return {
      id: String(x?.id || x?.conversation_id || ''),
      title: String(x?.title || x?.conversation_title || 'Conversation sans titre'),
      projectId: String(x?.gizmo_id || x?.conversation_mode?.gizmo_id || ''),
      updated: Number(x?.update_time || x?.create_time || 0),
      raw: x
    };
  }

  async function refreshData() {
    const p = await rpc('/backend-api/gizmos/snorlax/sidebar');
    if (p.ok) {
      state.projects = extractProjects(p.data);
      state.projectById = new Map(state.projects.map(x => [x.id, x]));
      state.health.bridge = 'ok'; state.health.projects = state.projects.length ? 'ok' : 'warn';
    } else state.health.bridge = 'error';

    const chats = [];
    let offset = 0, total = 0;
    for (let page=0; page<12; page++) {
      const r = await rpc(`/backend-api/conversations?offset=${offset}&limit=100&order=updated&expand=true`);
      if (!r.ok || !Array.isArray(r.data?.items)) break;
      chats.push(...r.data.items.map(normalizeChat).filter(x => x.id));
      total = Number(r.data.total || chats.length);
      offset += r.data.items.length;
      if (!r.data.items.length || offset >= total) break;
    }
    state.chats = chats;
    state.chatById = new Map(chats.map(x => [x.id, x]));
    buildProfiles();
    renderPanel();
    renderStatus();
    if (state.settings.nativePin) scheduleNativePins();
    if (state.settings.autoOrganize) setTimeout(autoOrganize, 1200);
  }

  function buildProfiles() {
    const map = new Map();
    for (const project of state.projects) {
      const freq = new Map();
      for (const t of tokens(project.name)) freq.set(t, (freq.get(t)||0) + 8);
      map.set(project.id, freq);
    }
    for (const chat of state.chats) {
      const freq = map.get(chat.projectId); if (!freq) continue;
      for (const t of tokens(chat.title)) freq.set(t, (freq.get(t)||0) + 1);
    }
    state.profiles = map;
  }

  function scoreProject(chat, project) {
    const title = normalize(chat.title);
    const pname = normalize(project.name);
    if (pname.length >= 3 && title.includes(pname)) return { score:100, reasons:['nom du projet dans le titre'] };
    const freq = state.profiles.get(project.id) || new Map();
    let score = 0; const reasons = [];
    for (const t of new Set(tokens(chat.title))) {
      const w = freq.get(t) || 0;
      if (w) { score += Math.min(7, w); reasons.push(t); }
    }
    return { score, reasons: reasons.slice(0,5) };
  }

  function classify(chat, { allowCurrent=false } = {}) {
    if (chat.projectId && !allowCurrent) return null;
    const ranked = state.projects.map(project => ({ project, ...scoreProject(chat, project) })).sort((a,b)=>b.score-a.score);
    const a = ranked[0], b = ranked[1];
    if (!a || a.score < 10 || a.score - (b?.score || 0) < 4) return null;
    return { ...a, margin:a.score-(b?.score||0) };
  }

  async function moveChat(chat, project) {
    if (!chat?.id || !project?.id) return false;
    const patch = await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`, { method:'PATCH', body:{ gizmo_id:project.id } });
    const verify = await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`);
    const got = String(verify.data?.gizmo_id || verify.data?.conversation_mode?.gizmo_id || '');
    const ok = got === project.id;
    if (ok) { chat.projectId = project.id; buildProfiles(); }
    return ok || patch.ok;
  }

  async function autoOrganize() {
    if (!state.projects.length || !state.chats.length) return;
    let moved = 0;
    for (const chat of state.chats) {
      if (moved >= state.settings.maxMovesPerPass) break;
      if (chat.projectId) continue; // Règle de sécurité : ne jamais sortir automatiquement un chat déjà rangé.
      const c = classify(chat);
      if (!c) continue;
      if (await moveChat(chat, c.project)) moved++;
      await sleep(220);
    }
    state.health.organizer = 'ok';
    if (moved) { toast(`${moved} conversation${moved>1?'s':''} classée${moved>1?'s':''}`); await refreshData(); }
    else { renderPanel(); renderStatus(); }
  }

  function runAudit() {
    const out = [];
    for (const chat of state.chats) {
      if (!chat.projectId || !state.projectById.has(chat.projectId)) continue;
      const current = state.projectById.get(chat.projectId);
      const ranked = state.projects.map(project => ({ project, ...scoreProject(chat, project) })).sort((a,b)=>b.score-a.score);
      const best = ranked[0];
      const currentScore = ranked.find(x=>x.project.id===current.id)?.score || 0;
      if (best && best.project.id !== current.id && best.score >= 18 && best.score-currentScore >= 8) out.push({ chat, from:current, to:best.project, score:best.score, margin:best.score-currentScore });
    }
    state.audit = out.slice(0,100);
    state.activeTab = 'audit'; state.panelOpen = true; renderPanel();
  }

  async function applyAudit(index) {
    const item = state.audit[index]; if (!item) return;
    const ok = await moveChat(item.chat, item.to);
    toast(ok ? `Déplacé vers ${item.to.name}` : 'Déplacement non confirmé');
    if (ok) { state.audit.splice(index,1); renderPanel(); }
  }

  function projectStats() {
    const m = new Map(state.projects.map(p=>[p.id,{count:0,recent:0}]));
    for (const c of state.chats) {
      const s = m.get(c.projectId); if (!s) continue;
      s.count++; s.recent = Math.max(s.recent, c.updated || 0);
    }
    return m;
  }

  function activeProjectsForPin() {
    const stats = projectStats();
    return state.projects.filter(p => !GENERIC_PROJECTS.has(normalize(p.name)) && (stats.get(p.id)?.count||0)>0)
      .sort((a,b)=>{
        const sa=stats.get(a.id), sb=stats.get(b.id);
        return (sb.count-sa.count) || (sb.recent-sa.recent);
      }).slice(0, state.settings.maxPinnedProjects);
  }

  function visibleProjectLinks() {
    return [...document.querySelectorAll('a[href*="/g/g-p-"]')].filter(a => a.getBoundingClientRect().width && a.getBoundingClientRect().height);
  }
  function isPinnedLink(link) {
    let n=link;
    for (let i=0;i<5 && n;i++,n=n.parentElement) {
      const text = normalize(n.parentElement?.innerText || '');
      if (/\b(epingles|pinned)\b/.test(text) && text.length < 1200) return true;
    }
    return false;
  }
  function findProjectLink(project) {
    return visibleProjectLinks().find(a => (a.getAttribute('href')||'').includes(project.id) && normalize(a.textContent).includes(normalize(project.name))) || visibleProjectLinks().find(a => (a.getAttribute('href')||'').includes(project.id));
  }
  async function tryNativePin(project) {
    const link = findProjectLink(project); if (!link) return false;
    if (isPinnedLink(link)) return true;
    const row = link.closest('li,[data-testid],div');
    row?.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
    await sleep(120);
    const buttons = [...(row || link.parentElement).querySelectorAll('button')];
    const menu = buttons.find(b => /more|options|menu|plus|davantage/i.test(`${b.getAttribute('aria-label')||''} ${b.title||''}`)) || buttons.at(-1);
    if (!menu) return false;
    menu.click(); await sleep(180);
    const items = [...document.querySelectorAll('[role="menuitem"], [role="option"]')].filter(x=>x.getBoundingClientRect().width);
    const pin = items.find(x => /^(epingler|pin)(\b|\s)/i.test(normalize(x.textContent)));
    if (!pin) { document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); return false; }
    pin.click(); await sleep(260); return true;
  }
  function scheduleNativePins() {
    if (state.pinRunning) return;
    state.pinRunning = true;
    setTimeout(async()=>{
      let ok=0, tried=0;
      for (const p of activeProjectsForPin()) { tried++; if (await tryNativePin(p)) ok++; await sleep(350); }
      state.health.pins = !tried ? 'warn' : (ok ? 'ok' : 'warn'); state.pinRunning=false; renderStatus();
    }, 1300);
  }

  function findEditor() {
    const list = [...document.querySelectorAll('textarea, [contenteditable="true"]')].filter(el => el.getBoundingClientRect().width>200 && el.getBoundingClientRect().height>20);
    return list.sort((a,b)=>b.getBoundingClientRect().top-a.getBoundingClientRect().top)[0] || null;
  }
  function editorText(el) { return el instanceof HTMLTextAreaElement ? el.value : (el?.innerText || el?.textContent || ''); }
  function insertEditor(el, text) {
    if (!el) return;
    const addition = `${editorText(el).trim() ? '\n\n' : ''}${text}`;
    el.focus();
    if (el instanceof HTMLTextAreaElement) {
      const end=el.value.length; el.setRangeText(addition,end,end,'end'); el.dispatchEvent(new Event('input',{bubbles:true}));
    } else {
      const sel=window.getSelection(), range=document.createRange(); range.selectNodeContents(el); range.collapse(false); sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('insertText',false,addition); el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:addition}));
    }
  }
  function suggestions(text) {
    const s=normalize(text); const out=[];
    const add=(title,text)=>{ if(!out.some(x=>x.text===text)) out.push({title,text}); };
    if (/compar|versus| vs /.test(` ${s} `)) {
      add('Tableau','Compare-les dans un tableau avec critères, avantages, inconvénients, coût et cas d’usage.');
      add('Vérifier','Vérifie les informations susceptibles d’avoir changé avant de conclure.');
      add('Décision','Termine par une recommandation claire adaptée aux contraintes données.');
    }
    if (/code|bug|erreur|sql|javascript|typescript|php|python|api|github/.test(s)) {
      add('Cause racine','Commence par identifier la cause racine, puis propose le correctif minimal et robuste.');
      add('Patch','Donne le patch exact, puis explique brièvement pourquoi il corrige le problème.');
      add('Tests','Ajoute les cas limites et les tests à faire pour éviter une régression.');
    }
    if (/analyse|analy|document|contrat|dossier/.test(s)) {
      add('Structure','Sépare les faits, les points incertains, les risques et les actions recommandées.');
      add('Contradictions','Cherche explicitement les incohérences, contradictions ou éléments manquants.');
    }
    if (/cherche|trouve|actuel|recent|prix|tarif|loi|regle/.test(s)) {
      add('Sources récentes','Utilise des sources récentes et prioritise les sources officielles ou primaires.');
      add('Date','Indique clairement la date des informations qui peuvent évoluer.');
    }
    if (/seo|shopify|e-?commerce|produit|conversion/.test(s)) {
      add('Impact','Priorise les recommandations par impact attendu, effort et risque.');
      add('Concret','Donne les modifications concrètes à appliquer, pas seulement des principes généraux.');
    }
    if (/jurid|tribunal|avocat|licenci|prud|contrat/.test(s)) {
      add('Droit','Distingue clairement le droit applicable, les faits établis et les hypothèses.');
      add('Preuves','Liste les preuves utiles et les points qui nécessitent une source officielle.');
    }
    if (!out.length) {
      add('Préciser','Structure la réponse avec objectif, contraintes, options et recommandation finale.');
      add('Efficace','Commence par la réponse utile en quelques lignes, puis détaille seulement ce qui apporte de la valeur.');
      add('Angles morts','Signale les angles morts ou hypothèses qui peuvent changer la conclusion.');
    }
    return out.slice(0,4);
  }
  function ensureCoach() {
    if (!state.settings.promptCoach) { document.getElementById('ng-coach')?.remove(); return; }
    const editor=findEditor(); if (!editor) { state.health.coach='warn'; return; }
    let box=document.getElementById('ng-coach');
    if (!box) { box=document.createElement('div'); box.id='ng-coach'; document.documentElement.appendChild(box); }
    const text=editorText(editor); const items=suggestions(text);
    box.innerHTML=`<div class="ng-coach-title"><span>NiakGPT · suggestions</span><kbd>Tab</kbd></div><div class="ng-coach-items">${items.map((x,i)=>`<button data-ng-sug="${i}" title="Ajouter au prompt"><strong>${esc(x.title)}</strong><span>${esc(x.text)}</span></button>`).join('')}</div>`;
    box.querySelectorAll('[data-ng-sug]').forEach(btn=>btn.addEventListener('click',()=>insertEditor(editor,items[Number(btn.dataset.ngSug)].text)));
    positionCoach(editor,box); state.health.coach='ok';
  }
  function positionCoach(editor,box) {
    const r=editor.getBoundingClientRect(); const width=Math.min(Math.max(r.width,420),820);
    box.style.width=`${width}px`; box.style.left=`${Math.max(8,Math.min(innerWidth-width-58,r.left+(r.width-width)/2))}px`; box.style.bottom=`${Math.max(64,innerHeight-r.top+10)}px`;
  }

  function getTurns() {
    const selectors=['article[data-testid^="conversation-turn-"]','[data-testid^="conversation-turn-"]'];
    const set=new Set(); selectors.forEach(s=>document.querySelectorAll(s).forEach(x=>set.add(x)));
    return [...set].filter(x=>x instanceof HTMLElement && x.textContent?.trim()).sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_PRECEDING?1:-1);
  }
  function turnRole(turn) { return turn.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role') || ''; }
  function turnPreview(turn) {
    const t=String(turn.innerText||turn.textContent||'').replace(/\s+/g,' ').trim(); return t.length>100?t.slice(0,97)+'…':t;
  }
  function scanTurns() {
    const turns=getTurns(); state.turns=turns;
    turns.forEach((turn,i)=>{ turn.dataset.ngTurn=String(i); enhanceCode(turn); });
    state.health.toc=turns.length?'ok':'warn';
    applyPerformance(turns); if (state.activeTab==='toc') renderPanel(); renderStatus();
  }

  function enhanceCode(root=document) {
    root.querySelectorAll?.('pre').forEach(pre=>{
      if (pre.dataset.ngCode) return; pre.dataset.ngCode='1';
      const code=pre.querySelector('code'); const cls=code?.className||''; const lang=(cls.match(/language-([\w+-]+)/)?.[1]||'code').toUpperCase();
      const lines=(code?.innerText||pre.innerText||'').split('\n').length;
      const bar=document.createElement('div'); bar.className='ng-codebar'; bar.innerHTML=`<span>${esc(lang)} · ${lines} lignes</span><button>Copier</button>`;
      bar.querySelector('button').addEventListener('click',async()=>{ await navigator.clipboard.writeText(code?.innerText||pre.innerText||''); toast('Code copié'); });
      pre.prepend(bar);
    });
  }

  function applyPerformance(turns) {
    if (!state.settings.performance) { turns.forEach(t=>t.classList.remove('ng-perf','ng-offscreen')); state.io?.disconnect(); state.health.performance='warn'; return; }
    state.io?.disconnect();
    const keep=Math.max(2,state.settings.keepRecentTurns); const boundary=Math.max(0,turns.length-keep);
    state.io=new IntersectionObserver(entries=>{
      for (const e of entries) {
        const i=Number(e.target.dataset.ngTurn||0); const protectedRecent=i>=boundary;
        e.target.classList.toggle('ng-offscreen',!e.isIntersecting&&!protectedRecent);
      }
    },{root:null,rootMargin:`${state.settings.perfRootMargin}px 0px`});
    turns.forEach((t,i)=>{ t.classList.add('ng-perf'); if(i<boundary) state.io.observe(t); t.querySelectorAll('img,video').forEach(m=>{ if(m.tagName==='IMG') m.loading='lazy'; }); });
    state.health.performance='ok';
  }

  function visitUrl(chat) {
    if (!chat?.id) return '#';
    return chat.projectId?.startsWith('g-p-') ? `/g/${chat.projectId}/c/${chat.id}` : `/c/${chat.id}`;
  }
  function recordVisit(chat) {
    if (!chat) return; state.visits=[chat.id,...state.visits.filter(x=>x!==chat.id)].slice(0,30); storageSet(VISITS_KEY,state.visits);
  }
  async function prefetch(chat) {
    if (!chat?.id||state.prefetched.has(chat.id)) return; state.prefetched.add(chat.id); await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{timeout:8000});
  }

  function openQuick() {
    let modal=document.getElementById('ng-quick'); if(modal) modal.remove();
    modal=document.createElement('div'); modal.id='ng-quick'; modal.innerHTML=`<div class="ng-quick-box"><input autofocus placeholder="Rechercher une conversation…"><div class="ng-quick-list"></div><div class="ng-quick-hint">Alt+K · ↑↓ naviguer · Entrée ouvrir · Échap fermer</div></div>`; document.documentElement.appendChild(modal);
    const input=modal.querySelector('input'), list=modal.querySelector('.ng-quick-list'); let selected=0, current=[];
    const paint=()=>{ const q=normalize(input.value); current=state.chats.filter(c=>!q||normalize(c.title).includes(q)||normalize(state.projectById.get(c.projectId)?.name).includes(q)).sort((a,b)=>b.updated-a.updated).slice(0,40); selected=Math.min(selected,Math.max(0,current.length-1)); list.innerHTML=current.map((c,i)=>`<button class="${i===selected?'sel':''}" data-i="${i}"><span class="ng-dot" style="--ng-color:${colorFor(state.projectById.get(c.projectId)?.name||'chat')}"></span><span class="ng-q-title">${esc(c.title)}</span><small>${esc(state.projectById.get(c.projectId)?.name||'Hors projet')}</small></button>`).join(''); list.querySelectorAll('button').forEach(b=>{ const c=current[Number(b.dataset.i)]; b.onmouseenter=()=>prefetch(c); b.onclick=()=>{recordVisit(c);location.href=visitUrl(c);}; }); };
    input.addEventListener('input',()=>{selected=0;paint();}); input.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'){e.preventDefault();selected=Math.min(selected+1,current.length-1);paint();} if(e.key==='ArrowUp'){e.preventDefault();selected=Math.max(0,selected-1);paint();} if(e.key==='Enter'&&current[selected]){recordVisit(current[selected]);location.href=visitUrl(current[selected]);} if(e.key==='Escape')modal.remove(); });
    modal.addEventListener('mousedown',e=>{if(e.target===modal)modal.remove();}); paint(); setTimeout(()=>input.focus(),0);
  }

  const ICONS={explorer:'◫',toc:'☷',audit:'✓',prompt:'✦',perf:'⌁',settings:'⚙',diag:'◉'};
  function ensureShell() {
    if (document.getElementById('ng-activity')) return;
    const bar=document.createElement('aside'); bar.id='ng-activity';
    bar.innerHTML=`<button data-tab="explorer" title="Explorateur">${ICONS.explorer}</button><button data-tab="toc" title="Sommaire">${ICONS.toc}</button><button data-tab="audit" title="Audit">${ICONS.audit}</button><button data-tab="prompt" title="Prompts">${ICONS.prompt}</button><button data-tab="perf" title="Performance">${ICONS.perf}</button><span class="ng-spacer"></span><button data-tab="settings" title="Réglages">${ICONS.settings}</button><button data-tab="diag" title="Diagnostic">${ICONS.diag}</button>`;
    document.documentElement.appendChild(bar);
    const panel=document.createElement('aside'); panel.id='ng-panel'; document.documentElement.appendChild(panel);
    const status=document.createElement('div'); status.id='ng-status'; document.documentElement.appendChild(status);
    bar.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{ const tab=btn.dataset.tab; state.panelOpen=state.activeTab===tab?!state.panelOpen:true; state.activeTab=tab; renderPanel(); }));
  }

  function renderExplorer() {
    const stats=projectStats(); const active=state.projects.filter(p=>(stats.get(p.id)?.count||0)>0&&!GENERIC_PROJECTS.has(normalize(p.name))).sort((a,b)=>(stats.get(b.id)?.count||0)-(stats.get(a.id)?.count||0));
    const legacy=state.projects.filter(p=>GENERIC_PROJECTS.has(normalize(p.name))||(stats.get(p.id)?.count||0)===0);
    const unassigned=state.chats.filter(c=>!c.projectId).length;
    return `<div class="ng-head"><div><small>EXPLORATEUR</small><strong>NiakGPT</strong></div><button data-ng-close>×</button></div><div class="ng-actions"><button data-ng-organize>Organiser</button><button data-ng-audit>Auditer</button><button data-ng-refresh>↻</button></div><div class="ng-section-title">PROJETS ACTIFS <span>${active.length}</span></div><div class="ng-projects">${active.map(p=>`<a href="/g/${p.id}/project"><i style="--ng-color:${p.color}"></i><span>${esc(p.name)}</span><b>${stats.get(p.id)?.count||0}</b></a>`).join('')||'<p class="ng-empty">Aucun Project détecté.</p>'}</div><div class="ng-inbox"><span>Hors projet</span><b>${unassigned}</b></div>${legacy.length?`<details><summary>Secondaires / vides <span>${legacy.length}</span></summary><div class="ng-projects ng-muted">${legacy.map(p=>`<a href="/g/${p.id}/project"><i style="--ng-color:${p.color}"></i><span>${esc(p.name)}</span><b>${stats.get(p.id)?.count||0}</b></a>`).join('')}</div></details>`:''}`;
  }
  function renderToc() {
    const userTurns=state.turns.map((t,i)=>({t,i,role:turnRole(t),preview:turnPreview(t)})).filter(x=>x.role==='user'||!x.role);
    return `<div class="ng-head"><div><small>SOMMAIRE</small><strong>${userTurns.length} interventions</strong></div><button data-ng-close>×</button></div><input id="ng-toc-search" class="ng-search" placeholder="Filtrer le fil…"><div class="ng-toc-list">${userTurns.map((x,j)=>`<button data-turn="${x.i}"><span>${String(j+1).padStart(2,'0')}</span><p>${esc(x.preview)}</p></button>`).join('')||'<p class="ng-empty">Aucun message détecté.</p>'}</div>`;
  }
  function renderAudit() {
    return `<div class="ng-head"><div><small>AUDIT</small><strong>Réorganisation contrôlée</strong></div><button data-ng-close>×</button></div><p class="ng-note">NiakGPT ne déplace jamais automatiquement un chat déjà présent dans un Project. L’audit propose seulement les incohérences fortes.</p><button class="ng-primary" data-ng-run-audit>Analyser les Projects</button><div class="ng-audit-list">${state.audit.map((x,i)=>`<div><span><b>${esc(x.chat.title)}</b><small>${esc(x.from.name)} → ${esc(x.to.name)}</small></span><button data-audit="${i}">Déplacer</button></div>`).join('')||'<p class="ng-empty">Aucune proposition actuellement.</p>'}</div>`;
  }
  function renderPrompt() {
    return `<div class="ng-head"><div><small>COACH FR</small><strong>Suggestions contextuelles</strong></div><button data-ng-close>×</button></div><p class="ng-note">Les suggestions apparaissent automatiquement au-dessus du champ de saisie et s’adaptent à ce que tu écris. Elles restent locales : aucun prompt n’est envoyé ailleurs.</p><div class="ng-card"><b>Astuce</b><p>Utilise les suggestions comme briques : vérification des sources, tableau comparatif, patch de code, tests, angles morts…</p></div>`;
  }
  function renderPerf() {
    const off=state.turns.filter(t=>t.classList.contains('ng-offscreen')).length;
    return `<div class="ng-head"><div><small>PERFORMANCE</small><strong>Longues discussions</strong></div><button data-ng-close>×</button></div><div class="ng-metrics"><div><b>${state.turns.length}</b><span>blocs</span></div><div><b>${off}</b><span>hors écran optimisés</span></div><div><b>${state.settings.keepRecentTurns}</b><span>récents gardés actifs</span></div></div><p class="ng-note">Les anciens blocs hors écran utilisent content-visibility et containment. Les derniers tours restent pleinement actifs pour ne pas gêner la génération.</p>`;
  }
  function renderSettings() {
    const rows=[['promptCoach','Coach de prompts'],['toc','Sommaire'],['performance','Mode performance'],['autoOrganize','Classement automatique prudent'],['nativePin','Épinglage natif des Projects actifs']];
    return `<div class="ng-head"><div><small>RÉGLAGES</small><strong>NiakGPT ${VERSION}</strong></div><button data-ng-close>×</button></div><div class="ng-settings">${rows.map(([k,l])=>`<label><span>${l}</span><input type="checkbox" data-setting="${k}" ${state.settings[k]?'checked':''}></label>`).join('')}<label><span>Projects épinglés max.</span><input type="number" min="1" max="15" data-setting="maxPinnedProjects" value="${state.settings.maxPinnedProjects}"></label></div>`;
  }
  function renderDiag() {
    return `<div class="ng-head"><div><small>DIAGNOSTIC</small><strong>État des modules</strong></div><button data-ng-close>×</button></div><div class="ng-diag">${Object.entries(state.health).map(([k,v])=>`<div><span>${esc(k)}</span><b class="${v}">${v==='ok'?'OK':v==='error'?'ERREUR':'ATTENTE'}</b></div>`).join('')}</div><div class="ng-card"><b>Confidentialité</b><p>Exécution limitée à chatgpt.com. Aucun domaine externe, aucune analytics, aucune identité ou nom de projet personnel intégré au code.</p></div>`;
  }
  function renderPanel() {
    ensureShell(); const panel=document.getElementById('ng-panel'); if(!panel)return;
    panel.classList.toggle('open',state.panelOpen); document.body?.classList.toggle('ng-panel-open',state.panelOpen);
    if (!state.panelOpen) return;
    const html=state.activeTab==='toc'?renderToc():state.activeTab==='audit'?renderAudit():state.activeTab==='prompt'?renderPrompt():state.activeTab==='perf'?renderPerf():state.activeTab==='settings'?renderSettings():state.activeTab==='diag'?renderDiag():renderExplorer(); panel.innerHTML=html;
    document.querySelectorAll('#ng-activity [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.activeTab&&state.panelOpen));
    panel.querySelector('[data-ng-close]')?.addEventListener('click',()=>{state.panelOpen=false;renderPanel();});
    panel.querySelector('[data-ng-refresh]')?.addEventListener('click',refreshData); panel.querySelector('[data-ng-organize]')?.addEventListener('click',autoOrganize); panel.querySelector('[data-ng-audit]')?.addEventListener('click',runAudit); panel.querySelector('[data-ng-run-audit]')?.addEventListener('click',runAudit);
    panel.querySelectorAll('[data-audit]').forEach(b=>b.addEventListener('click',()=>applyAudit(Number(b.dataset.audit))));
    panel.querySelectorAll('[data-turn]').forEach(b=>b.addEventListener('click',()=>state.turns[Number(b.dataset.turn)]?.scrollIntoView({behavior:'smooth',block:'center'})));
    const q=panel.querySelector('#ng-toc-search'); if(q) q.addEventListener('input',()=>{const s=normalize(q.value);panel.querySelectorAll('[data-turn]').forEach(b=>b.hidden=s&&!normalize(b.textContent).includes(s));});
    panel.querySelectorAll('[data-setting]').forEach(inp=>inp.addEventListener('change',async()=>{const k=inp.dataset.setting; state.settings[k]=inp.type==='checkbox'?inp.checked:Number(inp.value); await storageSet(STORAGE_KEY,state.settings); scanTurns(); ensureCoach(); if(k==='nativePin'&&inp.checked)scheduleNativePins();}));
  }
  function renderStatus() {
    ensureShell(); const el=document.getElementById('ng-status'); if(!el)return;
    const p=state.currentProjectId?state.projectById.get(state.currentProjectId)?.name:'Hors projet';
    const bad=Object.values(state.health).filter(x=>x==='error').length;
    el.innerHTML=`<span><b>NiakGPT</b> ${VERSION}</span><span>${esc(p||'ChatGPT')}</span><button data-ng-quick>⌘ Alt+K</button><span>${state.turns.length} blocs</span><span class="${bad?'bad':'good'}">${bad?'Diagnostic requis':'Prêt'}</span>`;
    el.querySelector('[data-ng-quick]')?.addEventListener('click',openQuick);
  }

  function scheduleScan() {
    clearTimeout(state.scanTimer); state.scanTimer=setTimeout(()=>{ parseCurrent(); scanTurns(); ensureCoach(); renderStatus(); },180);
  }

  async function init() {
    state.settings={...DEFAULTS,...await storageGet(STORAGE_KEY,{})}; state.visits=await storageGet(VISITS_KEY,[]);
    parseCurrent(); ensureShell(); renderPanel(); renderStatus(); ensureCoach(); scanTurns();
    state.observer=new MutationObserver(scheduleScan); state.observer.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('input',e=>{if(e.target===findEditor()||e.target?.isContentEditable){clearTimeout(state.coachTimer);state.coachTimer=setTimeout(ensureCoach,110);}} ,true);
    addEventListener('resize',ensureCoach,{passive:true}); addEventListener('scroll',()=>{const ed=findEditor(),box=document.getElementById('ng-coach');if(ed&&box)positionCoach(ed,box);},{passive:true,capture:true});
    document.addEventListener('keydown',e=>{
      if(e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();openQuick();}
      if(e.altKey&&['1','2','3','4'].includes(e.key)){e.preventDefault();state.activeTab={1:'explorer',2:'toc',3:'prompt',4:'perf'}[e.key];state.panelOpen=true;renderPanel();}
    },true);
    await refreshData();
  }
  init();
})();
