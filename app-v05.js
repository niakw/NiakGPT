(() => {
  'use strict';

  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_V051__) return;
  window.__NIAKGPT_V051__ = true;

  const VERSION = '0.5.1';
  const GENERIC = new Set([
    'design','ai','ia','coding','code','development','web development','technology','tech',
    'social','social media','writing','general knowledge','general','e-commerce','ecommerce',
    'seo','marketing','business','creative','research','productivity','other','misc','work',
    'education','health','finance','home','cars','gaming','movies','food'
  ]);
  const STOP = new Set(
    ('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces ' +
    'mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles ' +
    'est sont a à the and or of to for in on with from chat conversation projet project faire ' +
    'fais moi peux peut comment pourquoi quoi cela cette ceci avoir être etre').split(/\s+/)
  );
  const PALETTE = [
    '#4FC1FF','#4EC9B0','#C586C0','#DCDCAA','#CE9178','#9CDCFE',
    '#D7BA7D','#B5CEA8','#D16969','#E06CAA','#569CD6','#6A9955'
  ];

  const state = {
    projects: [], chats: [], projectById: new Map(), profiles: new Map(),
    health: {
      bridge:'ATTENTE', projects:'ATTENTE', organizer:'ATTENTE', coach:'ATTENTE',
      toc:'ATTENTE', performance:'ATTENTE', pins:'ATTENTE', matrix:'ATTENTE', ui:'ATTENTE'
    },
    turns: [], generation:false, organizerRunning:false, nativePins:0,
    panelOpen:false, tab:'explorer', scanTimer:0, coachTimer:0, routeTimer:0,
    lastPath:location.pathname, observer:null, io:null, matrix:null, matrixRAF:0,
    lastFrame:0, prefetched:new Set(), refreshRunning:false
  };

  const norm = v => String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const words = v => norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi, ' ').split(/\s+/)
    .filter(x => x.length > 2 && !STOP.has(x));

  function colorFor(name) {
    let h = 0;
    for (const c of String(name)) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
    return PALETTE[Math.abs(h) % PALETTE.length];
  }

  function iconFor(name) {
    const s = norm(name);
    if (/code|dev|tech|web|api|github|program/.test(s)) return '</>';
    if (/legal|jurid|droit|prud|tribunal|justice/.test(s)) return '§';
    if (/finance|argent|budget|banque|credit|compta/.test(s)) return '€';
    if (/film|cinema|movie|serie|anime|video/.test(s)) return '▶';
    if (/design|logo|image|creative|graph/.test(s)) return '◇';
    if (/shop|commerce|store|product|produit|vente/.test(s)) return '▣';
    if (/(^|\s)(ai|ia|gpt)(\s|$)|intelligence artificielle/.test(s)) return '✦';
    if (/auto|car|voiture|vehicule/.test(s)) return '◈';
    if (/health|sante|medical/.test(s)) return '+';
    if (/game|gaming|jeu/.test(s)) return '◆';
    return '▤';
  }

  function setHealth(key, value) {
    state.health[key] = value;
    renderStatus();
    if (state.panelOpen && state.tab === 'diag') renderPanel();
  }

  let rpcSeq = 0;
  function rpc(path, { method='GET', body=null, timeout=16000 } = {}) {
    const id = `ng51-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        cleanup();
        resolve({ ok:false, status:0, error:'timeout' });
      }, timeout);

      const handler = event => {
        if (event.detail?.id !== id) return;
        cleanup();
        resolve(event.detail);
      };

      const cleanup = () => {
        clearTimeout(timer);
        document.removeEventListener('niakgpt:rpc-response', handler);
      };

      document.addEventListener('niakgpt:rpc-response', handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request', {
        detail:{ id, path, method, body }
      }));
    });
  }

  function extractProjects(payload) {
    const out = new Map();
    const seen = new WeakSet();

    function walk(x) {
      if (!x || typeof x !== 'object' || seen.has(x)) return;
      seen.add(x);

      for (const g of [x, x.gizmo, x.gizmo?.gizmo].filter(Boolean)) {
        const id = String(g.id || '');
        const name = String(g.display?.name || g.name || '').trim();
        if (!id.startsWith('g-p-') || !name) continue;
        out.set(id, {
          id, name,
          description:String(g.display?.description || ''),
          instructions:String(g.instructions || ''),
          color:colorFor(name), icon:iconFor(name)
        });
      }

      if (Array.isArray(x)) x.forEach(walk);
      else Object.values(x).forEach(walk);
    }

    walk(payload);
    return [...out.values()];
  }

  function normalizeChat(x) {
    return {
      id:String(x?.id || x?.conversation_id || ''),
      title:String(x?.title || x?.conversation_title || 'Conversation sans titre'),
      projectId:String(x?.gizmo_id || x?.conversation_mode?.gizmo_id || ''),
      snippet:String(x?.snippet || ''),
      updated:Number(x?.update_time || x?.create_time || 0)
    };
  }

  function isPrimaryProject(project) {
    return !!project && !GENERIC.has(norm(project.name));
  }

  function primaryProjects() {
    return state.projects.filter(isPrimaryProject);
  }

  async function loadData({ quiet=false } = {}) {
    if (state.refreshRunning) return false;
    state.refreshRunning = true;

    try {
      const p = await rpc('/backend-api/gizmos/snorlax/sidebar?conversations_per_gizmo=0');
      if (!p.ok) {
        setHealth('bridge', `ERREUR ${p.status || p.error || ''}`.trim());
        return false;
      }

      setHealth('bridge', 'OK');
      state.projects = extractProjects(p.data);
      state.projectById = new Map(state.projects.map(project => [project.id, project]));
      setHealth('projects', state.projects.length ? `OK · ${state.projects.length}` : 'ERREUR · 0');

      const chats = [];
      let offset = 0;
      for (let page = 0; page < 20; page++) {
        const r = await rpc(`/backend-api/conversations?offset=${offset}&limit=100&order=updated&expand=true`);
        if (!r.ok || !Array.isArray(r.data?.items)) break;
        chats.push(...r.data.items.map(normalizeChat).filter(chat => chat.id));
        offset += r.data.items.length;
        if (!r.data.items.length || offset >= Number(r.data.total || offset)) break;
      }

      state.chats = chats;
      await buildProfiles();

      if (!quiet) {
        renderPinnedProjects();
        decorateSidebar();
        renderPanel();
        renderStatus();
      }

      if (state.health.organizer === 'ATTENTE') setHealth('organizer', 'PRÊT');
      return true;
    } finally {
      state.refreshRunning = false;
    }
  }

  async function buildProfiles() {
    const profiles = new Map();

    for (const project of state.projects) {
      const freq = new Map();
      const add = (text, weight) => {
        for (const token of words(text)) freq.set(token, (freq.get(token) || 0) + weight);
      };
      add(project.name, 26);
      add(project.description, 9);
      add(project.instructions, 7);
      profiles.set(project.id, freq);
    }

    for (const chat of state.chats) {
      const freq = profiles.get(chat.projectId);
      if (!freq) continue;
      for (const token of words(`${chat.title} ${chat.snippet}`)) {
        freq.set(token, (freq.get(token) || 0) + 2);
      }
    }

    for (const project of primaryProjects().slice(0, 36)) {
      const r = await rpc(
        `/backend-api/gizmos/${encodeURIComponent(project.id)}/conversations?cursor=0&limit=50`,
        { timeout:9000 }
      );
      if (r.ok && Array.isArray(r.data?.items)) {
        const freq = profiles.get(project.id);
        for (const item of r.data.items) {
          for (const token of words(`${item?.title || ''} ${item?.snippet || ''}`)) {
            freq.set(token, (freq.get(token) || 0) + 3);
          }
        }
      }
      await sleep(15);
    }

    state.profiles = profiles;
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function scoreText(text, project) {
    const normalizedText = norm(text);
    const normalizedName = norm(project.name);
    let score = 0;

    if (normalizedName.length >= 3 && normalizedText.includes(normalizedName)) score += 220;
    for (const token of words(project.name)) {
      if (new RegExp(`\\b${escapeRegex(token)}\\b`, 'i').test(normalizedText)) score += 34;
    }

    const profile = state.profiles.get(project.id) || new Map();
    for (const token of new Set(words(text))) score += Math.min(15, profile.get(token) || 0);
    return score;
  }

  function bestTarget(chat, extraText='') {
    const text = `${chat.title} ${chat.snippet} ${extraText}`;
    const ranked = primaryProjects()
      .map(project => ({ project, score:scoreText(text, project) }))
      .sort((a,b) => b.score - a.score);

    const first = ranked[0];
    const second = ranked[1];
    if (!first) return null;
    return { project:first.project, score:first.score, margin:first.score - (second?.score || 0) };
  }

  function conversationText(data) {
    const out = [];
    const mapping = data?.mapping || {};
    for (const node of Object.values(mapping)) {
      const message = node?.message;
      if (!message || !['user','assistant'].includes(message?.author?.role)) continue;
      const parts = message?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) if (typeof part === 'string') out.push(part);
      }
      if (out.join(' ').length > 9000) break;
    }
    return out.join(' ').slice(0, 9000);
  }

  async function moveChat(chat, project) {
    const patch = await rpc(
      `/backend-api/conversation/${encodeURIComponent(chat.id)}`,
      { method:'PATCH', body:{ gizmo_id:project.id } }
    );
    if (!patch.ok) return false;

    const verify = await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`);
    const got = String(verify.data?.gizmo_id || verify.data?.conversation_mode?.gizmo_id || '');
    if (got === project.id) {
      chat.projectId = project.id;
      return true;
    }
    return false;
  }

  async function repairOrganization({ manual=false } = {}) {
    if (state.organizerRunning) return;
    state.organizerRunning = true;
    setHealth('organizer', 'EN COURS');

    let moved = 0, analysed = 0, deep = 0, failed = 0;

    try {
      const candidates = state.chats
        .filter(chat => {
          if (!chat.projectId) return true;
          const current = state.projectById.get(chat.projectId);
          return !!current && GENERIC.has(norm(current.name));
        })
        .sort((a,b) => b.updated - a.updated);

      const limit = manual ? 220 : 100;
      for (const chat of candidates.slice(0, limit)) {
        analysed++;
        const current = state.projectById.get(chat.projectId);
        const fromGeneric = !!current && GENERIC.has(norm(current.name));
        let best = bestTarget(chat);
        let threshold = fromGeneric ? 52 : 34;
        let margin = fromGeneric ? 18 : 12;

        if (!best || best.score < threshold || best.margin < margin) {
          if (deep < (manual ? 80 : 42)) {
            const detail = await rpc(
              `/backend-api/conversation/${encodeURIComponent(chat.id)}`,
              { timeout:9000 }
            );
            deep++;
            if (detail.ok) {
              best = bestTarget(chat, conversationText(detail.data));
              threshold = fromGeneric ? 82 : 60;
              margin = fromGeneric ? 24 : 17;
            }
          }
        }

        if (!best || best.score < threshold || best.margin < margin) continue;
        if (await moveChat(chat, best.project)) {
          moved++;
          await sleep(85);
        } else {
          failed++;
        }
      }

      await buildProfiles();
      renderPinnedProjects();
      decorateSidebar();
      renderPanel();
      setHealth(
        'organizer',
        failed
          ? `OK · ${moved} déplacé${moved > 1 ? 's' : ''} · ${failed} échec${failed > 1 ? 's' : ''}`
          : `OK · ${moved} déplacé${moved > 1 ? 's' : ''} / ${analysed}`
      );
    } catch (error) {
      setHealth('organizer', `ERREUR · ${String(error?.message || error).slice(0, 80)}`);
    } finally {
      state.organizerRunning = false;
    }
  }

  function navRoot() {
    return document.querySelector('nav')
      || [...document.querySelectorAll('aside')].find(el => el.querySelector('a[href*="/c/"]'))
      || null;
  }

  function findPinnedHeading(root) {
    return [...root.querySelectorAll('div,span,h2,h3')]
      .find(el => /^(épinglés|epingles|pinned)$/i.test((el.textContent || '').trim()));
  }

  function nativePinnedProjectIds() {
    const root = navRoot();
    const heading = root && findPinnedHeading(root);
    if (!root || !heading) return new Set();

    let container = heading.parentElement;
    for (let i = 0; i < 4 && container; i++, container = container.parentElement) {
      const ids = new Set();
      for (const link of container.querySelectorAll('a[href*="/g/"]')) {
        const href = link.getAttribute('href') || '';
        const project = state.projects.find(p => href.includes(p.id));
        if (project) ids.add(project.id);
      }
      if (ids.size) return ids;
    }
    return new Set();
  }

  function renderPinnedProjects() {
    const root = navRoot();
    const projects = primaryProjects();
    if (!root || !projects.length) return;

    document.getElementById('ng5-pinned-projects')?.remove();
    const nativeIds = nativePinnedProjectIds();
    const missing = projects.filter(project => !nativeIds.has(project.id));
    const box = document.createElement('div');
    box.id = 'ng5-pinned-projects';
    box.innerHTML = `
      <div class="ng5-pinned-label"><span>PROJETS</span><b>${projects.length}</b></div>
      ${missing.map(project => `
        <a href="/g/${encodeURIComponent(project.id)}/project"
           data-ng5-managed-project="1"
           style="--ng-project:${project.color}"
           title="${esc(project.name)}">
          <span class="ng5-proj-icon">${esc(project.icon)}</span><span>${esc(project.name)}</span>
        </a>
      `).join('')}
    `;

    const heading = findPinnedHeading(root);
    if (heading) (heading.parentElement || heading).insertAdjacentElement('afterend', box);
    else root.prepend(box);

    setHealth('pins', `OK · ${projects.length}/${projects.length} accessibles · ${nativeIds.size}/${projects.length} natifs`);
  }

  function projectPageRow(project) {
    const candidates = [...document.querySelectorAll('main [role="row"],main li,main > div div')]
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width && rect.height && rect.height <= 120 && norm(el.textContent).includes(norm(project.name));
      });
    return candidates.sort((a,b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0] || null;
  }

  async function pinFromProjectsPage(project) {
    const row = projectPageRow(project);
    if (!row) return false;
    const buttons = [...row.querySelectorAll('button')];
    if (buttons.find(button => /désépingler|desepingler|unpin/i.test(`${button.getAttribute('aria-label') || ''} ${button.title || ''}`))) return true;
    const pin = buttons.find(button => /épingler|epingler|\bpin\b/i.test(`${button.getAttribute('aria-label') || ''} ${button.title || ''}`));
    if (!pin) return false;
    pin.click();
    await sleep(140);
    return true;
  }

  async function pinFromSidebar(project) {
    const root = navRoot();
    if (!root) return false;
    const link = [...root.querySelectorAll('a[href*="/g/"]')]
      .filter(a => !a.closest('#ng5-pinned-projects'))
      .find(a => (a.getAttribute('href') || '').includes(project.id));
    if (!link) return false;

    let node = link;
    for (let i = 0; i < 5 && node; i++, node = node.parentElement) {
      if (/épinglés|epingles|pinned/i.test(node.parentElement?.innerText || '')) return true;
    }

    const row = link.closest('li,[data-testid]') || link.parentElement;
    if (!row) return false;
    row.dispatchEvent(new MouseEvent('mouseenter', { bubbles:true }));
    row.dispatchEvent(new MouseEvent('mouseover', { bubbles:true }));
    await sleep(90);

    const buttons = [...row.querySelectorAll('button')];
    const menu = buttons.find(button => /more|options|menu|davantage|plus/i.test(`${button.getAttribute('aria-label') || ''} ${button.title || ''}`)) || buttons.at(-1);
    if (!menu) return false;
    menu.click();
    await sleep(120);

    const item = [...document.querySelectorAll('[role="menuitem"],[role="option"]')]
      .find(el => /^(épingler|epingler|pin)\b/i.test((el.textContent || '').trim()));
    if (!item) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
      return false;
    }
    item.click();
    await sleep(140);
    return true;
  }

  async function tryNativePins() {
    const projects = primaryProjects();
    if (!projects.length) {
      setHealth('pins', 'OK · aucun Project principal');
      return;
    }

    let ok = 0;
    for (const project of projects) {
      const success = location.pathname.includes('/projects')
        ? (await pinFromProjectsPage(project) || await pinFromSidebar(project))
        : await pinFromSidebar(project);
      if (success) ok++;
      await sleep(100);
    }

    state.nativePins = ok;
    renderPinnedProjects();
    const nativeIds = nativePinnedProjectIds();
    setHealth('pins', `OK · ${projects.length}/${projects.length} accessibles · ${Math.max(ok, nativeIds.size)}/${projects.length} natifs`);
  }

  function currentChatId() {
    return location.pathname.match(/\/c\/([^/?#]+)/)?.[1] || '';
  }

  function currentProject() {
    const slug = location.pathname.match(/\/g\/(g-p-[^/?#]+)/)?.[1] || '';
    return state.projects.find(project => slug.startsWith(project.id)) || null;
  }

  function decorateSidebar() {
    const root = navRoot();
    if (!root) return;
    const chats = [...root.querySelectorAll('a[href*="/c/"]')].filter(a => !a.closest('#ng5-pinned-projects'));
    chats.forEach((link,index) => {
      const id = (link.getAttribute('href') || '').match(/\/c\/([^/?#]+)/)?.[1] || '';
      const chat = state.chats.find(item => item.id === id);
      const project = chat ? state.projectById.get(chat.projectId) : null;
      link.dataset.ng5Chat = '1';
      link.dataset.ng5Zebra = String(index % 2);
      link.style.setProperty('--ng-project', project?.color || '#607080');
      link.classList.toggle('ng5-current', id === currentChatId());
    });

    [...root.querySelectorAll('a[href*="/g/"]')].filter(a => !a.closest('#ng5-pinned-projects')).forEach(link => {
      const project = state.projects.find(p => (link.getAttribute('href') || '').includes(p.id));
      if (!project) return;
      link.dataset.ng5Project = '1';
      link.dataset.ng5Icon = project.icon;
      link.style.setProperty('--ng-project', project.color);
      link.classList.toggle('ng5-legacy-project', GENERIC.has(norm(project.name)));
    });
  }

  function getTurns() {
    const set = new Set();
    document.querySelectorAll('article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]').forEach(el => set.add(el));
    return [...set].filter(el => el instanceof HTMLElement && el.textContent?.trim());
  }

  function roleOf(turn) {
    return turn.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role') || '';
  }

  function enhanceCode(root) {
    root.querySelectorAll('pre').forEach(pre => {
      if (pre.dataset.ng5Code) return;
      pre.dataset.ng5Code = '1';
      const code = pre.querySelector('code');
      const cls = code?.className || '';
      const language = (cls.match(/language-([\w+-]+)/)?.[1] || 'code').toUpperCase();
      const lines = (code?.innerText || pre.innerText || '').split('\n').length;
      const bar = document.createElement('div');
      bar.className = 'ng5-codebar';
      bar.innerHTML = `<span>${esc(language)} · ${lines} lignes</span><button type="button">COPIER</button>`;
      bar.querySelector('button').addEventListener('click', async () => {
        await navigator.clipboard.writeText(code?.innerText || pre.innerText || '');
      });
      pre.prepend(bar);
    });
  }

  function decorateTurns() {
    state.turns = getTurns();
    state.turns.forEach((turn,index) => {
      turn.dataset.ng5Turn = String(index);
      turn.dataset.ng5Role = roleOf(turn) || 'unknown';
      turn.dataset.ng5Zebra = String(index % 2);
      enhanceCode(turn);
    });
    setHealth('toc', state.turns.length ? `OK · ${state.turns.length}` : 'ATTENTE');
    applyPerformance();
    if (state.panelOpen && state.tab === 'toc') renderPanel();
  }

  function applyPerformance() {
    state.io?.disconnect();
    state.io = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.classList.toggle('ng5-offscreen', !entry.isIntersecting);
    }, { rootMargin:'1100px 0px' });

    const cutoff = Math.max(0, state.turns.length - 8);
    state.turns.forEach((turn,index) => {
      turn.classList.add('ng5-perf');
      if (index < cutoff) state.io.observe(turn);
      turn.querySelectorAll('img').forEach(img => { img.loading = 'lazy'; });
    });
    setHealth('performance', 'OK');
  }

  function findComposer() {
    const editors = [...document.querySelectorAll('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')]
      .filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 240 && rect.height > 18;
      });
    const editor = editors.sort((a,b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
    if (!editor) return null;
    const form = editor.closest('form') || editor.closest('[data-type="unified-composer"]') || editor.closest('[class*="composer"]') || editor.parentElement;
    return { editor, form, shell:form?.parentElement || form };
  }

  function editorText(editor) {
    return editor instanceof HTMLTextAreaElement ? editor.value : (editor.innerText || editor.textContent || '');
  }

  function recentContext() {
    return state.turns.slice(-4).map(turn => turn.innerText || turn.textContent || '').join(' ').slice(-5500);
  }

  function subjectFrom(prompt) {
    const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
    if (!clean) return 'ce point';
    const clauses = clean.split(/[.!?;\n]+/).map(x => x.trim()).filter(Boolean);
    let clause = clauses.at(-1) || clean;
    if (clause.length > 70) clause = clause.slice(0, 67) + '…';
    return clause;
  }

  function suggestionSet(prompt) {
    const context = norm(`${prompt} ${recentContext()}`);
    const promptNorm = norm(prompt);
    const subject = subjectFrom(prompt);
    const projectName = currentProject()?.name || '';
    const scope = projectName ? ` dans « ${projectName} »` : '';
    const out = [];
    const add = (kind,title,text) => { if (!out.some(item => item.text === text)) out.push({ kind,title,text }); };

    if (/bug|erreur|marche pas|fonctionne pas|chevauch|overlap|dom|extension|javascript|css|code/.test(context)) {
      add('code','Cause racine',`Pour « ${subject} », inspecte d’abord le DOM et la cause racine${scope} avant de modifier le code.`);
      add('test','Tests UI',`Teste « ${subject} » avec long fil, redimensionnement, navigation SPA et pièces jointes.`);
      add('perf','Régression',`Vérifie que le correctif de « ${subject} » ne crée ni double injection, ni observer en boucle, ni reflow coûteux.`);
    }
    if (/image|photo|fichier|piece jointe|upload|attachment/.test(context)) {
      add('ux','Pièces jointes',`Pour « ${subject} », garde les suggestions dans le flux : elles doivent se déplacer naturellement avec les fichiers et images.`);
    }
    if (/design|da|couleur|fond|interface|ux|ui|styl|icone/.test(context)) {
      add('design','DA complète',`Pour « ${subject} », traite couleurs, contrastes, fonds, icônes, hover, actif et états d’exécution comme un seul système.`);
      add('ux','Lisibilité',`Sur « ${subject} », conserve une hiérarchie visuelle nette avant tout effet décoratif.`);
    }
    if (/projet|project|class|rang|dossier|organis|epingle|pin/.test(context)) {
      add('organize','Organisation',`Pour « ${subject} », protège les vrais Projects et ne répare automatiquement que les chats hors projet ou dans des catégories génériques.`);
      add('test','Vérification',`Après chaque déplacement lié à « ${subject} », vérifie par l’API que le Project cible est réellement appliqué.`);
    }
    if (/cherche|verifie|actuel|recent|prix|tarif|loi|regle|source/.test(context)) {
      add('research','Sources',`Pour « ${subject} », vérifie les informations actuelles avec des sources primaires et date ce qui peut évoluer.`);
    }
    if (/compar| vs |versus/.test(` ${context} `)) {
      add('table','Tableau',`Compare « ${subject} » dans un tableau dense : critères, avantages, limites, coût, risque et recommandation.`);
    }
    if (/long|resume|synthese|trop long/.test(context)) {
      add('summary','Synthèse',`Pour « ${subject} », commence par une synthèse courte puis garde uniquement les détails qui changent la décision.`);
    }
    if (!out.length && promptNorm.length > 3) {
      add('focus','Objectif',`Traite précisément « ${subject} »${scope}, puis détaille uniquement ce qui apporte une valeur concrète.`);
      add('blind','Angles morts',`Sur « ${subject} », signale les hypothèses et angles morts capables de changer la conclusion.`);
      add('action','Action',`Termine « ${subject} » par la prochaine action concrète la plus utile.`);
    }
    return out.slice(0,4);
  }

  function appendPrompt(editor, text) {
    editor.focus();
    if (editor instanceof HTMLTextAreaElement) {
      const separator = editor.value.trim() ? '\n\n' : '';
      const start = editor.selectionStart ?? editor.value.length;
      const end = editor.selectionEnd ?? editor.value.length;
      editor.setRangeText(`${separator}${text}`, start, end, 'end');
      editor.dispatchEvent(new Event('input', { bubbles:true }));
      return;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    const separator = editorText(editor).trim() ? '\n\n' : '';
    document.execCommand('insertText', false, `${separator}${text}`);
    editor.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText' }));
  }

  function ensureCoach() {
    const composer = findComposer();
    if (!composer?.editor || !composer.shell) {
      setHealth('coach', 'ATTENTE');
      return;
    }

    let box = document.getElementById('ng5-coach');
    if (box && box.parentElement !== composer.shell) {
      box.remove();
      box = null;
    }
    if (!box) {
      box = document.createElement('div');
      box.id = 'ng5-coach';
      const before = composer.form && composer.form.parentElement === composer.shell ? composer.form : composer.shell.firstChild;
      composer.shell.insertBefore(box, before || null);
    }

    const prompt = editorText(composer.editor);
    const items = suggestionSet(prompt);
    const attachments = composer.shell.querySelectorAll('img,[data-testid*="attachment"],[class*="attachment"],[data-testid*="file"]').length;
    box.classList.toggle('compact', attachments > 0 || composer.shell.getBoundingClientRect().height > 180);
    box.dataset.attachments = String(attachments);
    box.hidden = prompt.trim().length < 4 || !items.length;
    box.innerHTML = items.map((item,index) => `
      <button type="button" data-i="${index}" class="ng5-sug ng5-${item.kind}">
        <b>${esc(item.title)}</b><span>${esc(item.text)}</span>
      </button>
    `).join('');
    box.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => appendPrompt(composer.editor, items[Number(button.dataset.i)].text));
    });
    setHealth('coach', 'OK');
  }

  function ensureMatrix() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHealth('matrix', 'OFF');
      return;
    }

    const host = document.querySelector('main') || document.body;
    if (state.matrix?.isConnected && state.matrix.parentElement === host) return;
    state.matrix?.remove();
    if (state.matrixRAF) cancelAnimationFrame(state.matrixRAF);

    const canvas = document.createElement('canvas');
    canvas.id = 'ng5-matrix';
    host.prepend(canvas);
    state.matrix = canvas;
    const ctx = canvas.getContext('2d', { alpha:true });
    let columns = [], width = 0, height = 0;

    const resize = () => {
      const scale = 0.48;
      width = canvas.width = Math.max(1, Math.floor(innerWidth * scale));
      height = canvas.height = Math.max(1, Math.floor(innerHeight * scale));
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      columns = Array(Math.ceil(width / 11)).fill(0).map(() => Math.random() * height);
    };
    resize();

    const chars = '01アイウエオカキクケコｱｲｳｴｵ<>[]{}▓░';
    const draw = time => {
      state.matrixRAF = requestAnimationFrame(draw);
      if (document.hidden || time - state.lastFrame < 55) return;
      state.lastFrame = time;
      ctx.fillStyle = 'rgba(7,12,16,.14)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = '9px monospace';
      for (let i = 0; i < columns.length; i++) {
        ctx.fillStyle = Math.random() > 0.985 ? 'rgba(205,255,215,.46)' : 'rgba(49,190,99,.28)';
        ctx.fillText(chars[(Math.random() * chars.length) | 0], i * 11, columns[i]);
        columns[i] += 8;
        if (columns[i] > height && Math.random() > 0.975) columns[i] = 0;
      }
    };
    state.matrixRAF = requestAnimationFrame(draw);
    setHealth('matrix', 'OK');
  }

  function botSVG() {
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10h28l8 11-3 25-9 8H22l-9-8-3-25z" fill="#87919b" stroke="#c4ccd2" stroke-width="2"/><path d="M18 19h28l4 7-5 10H19l-5-10z" fill="#20262d"/><circle cx="24" cy="28" r="4" fill="#ef4444"/><circle cx="40" cy="28" r="4" fill="#ef4444"/><path d="M24 41h16v10H24z" fill="#343b43"/><path d="M27 43v6m5-6v6m5-6v6" stroke="#aab1b8" stroke-width="2"/></svg>`;
  }

  function ensureBots() {
    if (document.getElementById('ng5-bot-a')) return;
    const first = document.createElement('div');
    first.id = 'ng5-bot-a';
    first.className = 'ng5-bot';
    first.innerHTML = botSVG();
    first.title = "I'll be back.";
    document.body.appendChild(first);
    const second = first.cloneNode(true);
    second.id = 'ng5-bot-b';
    second.title = 'Skynet online.';
    document.body.appendChild(second);
  }

  function brand() {
    if (document.title.includes('ChatGPT')) document.title = document.title.replace(/ChatGPT/g, 'NiakGPT');
    const candidates = [...document.querySelectorAll('header a,header button,header span,a,button,span')].filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.top < 90 && rect.left < 340 && rect.width && rect.height && /^chatgpt$/i.test((el.textContent || '').trim());
    });
    if (candidates[0]) {
      candidates[0].textContent = 'NiakGPT';
      candidates[0].dataset.ng5Brand = '1';
    }
  }

  function isGenerating() {
    return [...document.querySelectorAll('button,[data-testid]')]
      .filter(el => el.getBoundingClientRect().width)
      .some(el => /stop|arrêter|arreter/i.test(`${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''}`));
  }

  function markRunning() {
    state.generation = isGenerating();
    document.documentElement.dataset.ng5Running = state.generation ? '1' : '0';
    const project = currentProject();
    const chatId = currentChatId();
    document.querySelectorAll('[data-ng5-managed-project="1"],[data-ng5-project="1"]').forEach(link => {
      link.classList.toggle('ng5-running', !!state.generation && !!project && (link.getAttribute('href') || '').includes(project.id));
    });
    document.querySelectorAll('[data-ng5-chat="1"]').forEach(link => {
      link.classList.toggle('ng5-running', !!state.generation && (link.getAttribute('href') || '').includes(chatId));
    });
    renderStatus();
  }

  function ensureShell() {
    if (document.getElementById('ng5-rail')) return;
    const rail = document.createElement('aside');
    rail.id = 'ng5-rail';
    rail.innerHTML = `<button data-tab="explorer" title="Explorer">▤</button><button data-tab="toc" title="Sommaire">☷</button><button data-tab="diag" title="Diagnostic">◉</button><span></span><button data-action="quick" title="Quick Open · Alt+K">⌘</button>`;
    document.body.appendChild(rail);
    const panel = document.createElement('aside');
    panel.id = 'ng5-panel';
    document.body.appendChild(panel);
    const status = document.createElement('div');
    status.id = 'ng5-status';
    document.body.appendChild(status);

    rail.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        state.panelOpen = !(state.panelOpen && state.tab === tab);
        state.tab = tab;
        renderPanel();
      });
    });
    rail.querySelector('[data-action="quick"]').addEventListener('click', openQuick);
    setHealth('ui', 'OK');
  }

  function renderStatus() {
    const status = document.getElementById('ng5-status');
    if (!status) return;
    const project = currentProject();
    const hasError = Object.values(state.health).some(value => String(value).startsWith('ERREUR'));
    status.classList.toggle('running', state.generation);
    status.innerHTML = `<span><b>NiakGPT</b> ${VERSION}</span><span>${esc(project?.name || 'Hors projet')}</span><button data-q>⌘ Alt+K</button><strong>BY SKYNET</strong><span class="ng5-health">${state.generation ? 'EXÉCUTION' : hasError ? 'DIAGNOSTIC' : 'PRÊT'}</span>`;
    status.querySelector('[data-q]').addEventListener('click', openQuick);
  }

  function projectCounts() {
    const counts = new Map(state.projects.map(project => [project.id, 0]));
    state.chats.forEach(chat => { if (counts.has(chat.projectId)) counts.set(chat.projectId, counts.get(chat.projectId) + 1); });
    return counts;
  }

  function renderPanel() {
    const panel = document.getElementById('ng5-panel');
    if (!panel) return;
    panel.classList.toggle('open', state.panelOpen);
    document.body.classList.toggle('ng5-panel-open', state.panelOpen);
    document.querySelectorAll('#ng5-rail [data-tab]').forEach(button => {
      button.classList.toggle('active', state.panelOpen && button.dataset.tab === state.tab);
    });
    if (!state.panelOpen) return;

    if (state.tab === 'diag') {
      panel.innerHTML = `<header><div><small>DIAGNOSTIC</small><b>État des modules</b></div><button>×</button></header><div class="ng5-diag">${Object.entries(state.health).map(([key,value]) => `<div><span>${esc(key)}</span><b class="${String(value).startsWith('OK') ? 'ok' : String(value).startsWith('ERREUR') ? 'err' : 'wait'}">${esc(value)}</b></div>`).join('')}</div><div class="ng5-private-joke">☠ SYSTEM // SKYNET</div>`;
    } else if (state.tab === 'toc') {
      panel.innerHTML = `<header><div><small>SOMMAIRE</small><b>${state.turns.length} blocs</b></div><button>×</button></header><input id="ng5-toc-search" placeholder="Filtrer le fil…"><div class="ng5-toc">${state.turns.map((turn,index) => `<button data-turn="${index}"><i>${String(index + 1).padStart(2, '0')}</i><span>${esc((turn.innerText || turn.textContent || '').replace(/\s+/g, ' ').slice(0, 120))}</span></button>`).join('')}</div>`;
    } else {
      const counts = projectCounts();
      const primary = primaryProjects();
      const legacy = state.projects.filter(project => !isPrimaryProject(project));
      panel.innerHTML = `<header><div><small>EXPLORER</small><b>Projects</b></div><button>×</button></header><div class="ng5-actions"><button data-repair>Réparer le classement</button><button data-refresh>Rafraîchir</button></div><div class="ng5-project-table"><div class="head"><span>Projet</span><span>Chats</span></div>${primary.map(project => `<a href="/g/${project.id}/project" style="--ng-project:${project.color}"><i>${esc(project.icon)}</i><span>${esc(project.name)}</span><b>${counts.get(project.id) || 0}</b></a>`).join('')}</div>${legacy.length ? `<details class="ng5-legacy"><summary>LEGACY / À NETTOYER <b>${legacy.length}</b></summary><div class="ng5-project-table">${legacy.map(project => `<a href="/g/${project.id}/project" style="--ng-project:${project.color}"><i>${esc(project.icon)}</i><span>${esc(project.name)}</span><b>${counts.get(project.id) || 0}</b></a>`).join('')}</div></details>` : ''}`;
    }

    panel.querySelector('header button')?.addEventListener('click', () => { state.panelOpen = false; renderPanel(); });
    panel.querySelector('[data-repair]')?.addEventListener('click', () => repairOrganization({ manual:true }));
    panel.querySelector('[data-refresh]')?.addEventListener('click', async () => { await loadData(); await tryNativePins(); });
    panel.querySelectorAll('[data-turn]').forEach(button => {
      button.addEventListener('click', () => state.turns[Number(button.dataset.turn)]?.scrollIntoView({ behavior:'smooth', block:'center' }));
    });
    const search = panel.querySelector('#ng5-toc-search');
    if (search) search.addEventListener('input', () => {
      const query = norm(search.value);
      panel.querySelectorAll('[data-turn]').forEach(button => { button.hidden = !!query && !norm(button.textContent).includes(query); });
    });
  }

  function nativeConversationLink(chatId) {
    return [...document.querySelectorAll(`a[href*="/c/${CSS.escape(chatId)}"]`)]
      .find(link => !link.closest('#ng5-quick,#ng5-panel,#ng5-pinned-projects')) || null;
  }

  function navigateChat(chat) {
    const native = nativeConversationLink(chat.id);
    if (native) { native.click(); return; }
    location.href = chat.projectId ? `/g/${chat.projectId}/c/${chat.id}` : `/c/${chat.id}`;
  }

  async function prefetch(chat) {
    if (!chat?.id || state.prefetched.has(chat.id)) return;
    state.prefetched.add(chat.id);
    await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`, { timeout:6000 });
  }

  function openQuick() {
    document.getElementById('ng5-quick')?.remove();
    const modal = document.createElement('div');
    modal.id = 'ng5-quick';
    modal.innerHTML = `<div><input autofocus placeholder="Quick Open — conversations & Projects"><section></section><footer>Alt+K · ↑↓ · Entrée · Échap</footer></div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector('input');
    const list = modal.querySelector('section');
    let items = [], selected = 0;

    const paint = () => {
      const query = norm(input.value);
      items = state.chats.filter(chat => !query || norm(`${chat.title} ${state.projectById.get(chat.projectId)?.name || ''}`).includes(query)).sort((a,b) => b.updated - a.updated).slice(0,50);
      selected = Math.min(selected, Math.max(0, items.length - 1));
      list.innerHTML = items.map((chat,index) => {
        const project = state.projectById.get(chat.projectId);
        return `<button class="${index === selected ? 'sel' : ''}" data-i="${index}"><i style="--ng-project:${project?.color || '#607080'}"></i><span>${esc(chat.title)}</span><small>${esc(project?.name || 'Hors projet')}</small></button>`;
      }).join('');
      list.querySelectorAll('button').forEach(button => {
        const chat = items[Number(button.dataset.i)];
        button.addEventListener('mouseenter', () => prefetch(chat));
        button.addEventListener('click', () => navigateChat(chat));
      });
    };

    input.addEventListener('input', () => { selected = 0; paint(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); selected = Math.min(selected + 1, items.length - 1); paint(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(0, selected - 1); paint(); }
      if (event.key === 'Enter' && items[selected]) { event.preventDefault(); navigateChat(items[selected]); }
      if (event.key === 'Escape') modal.remove();
    });
    modal.addEventListener('mousedown', event => { if (event.target === modal) modal.remove(); });
    paint();
    setTimeout(() => input.focus(), 0);
  }

  function scan() {
    ensureShell();
    brand();
    ensureMatrix();
    ensureBots();
    decorateTurns();
    decorateSidebar();
    renderPinnedProjects();
    ensureCoach();
    markRunning();
    renderStatus();
  }

  function scheduleScan(delay=220) {
    clearTimeout(state.scanTimer);
    state.scanTimer = setTimeout(scan, delay);
  }

  function scheduleRouteRefresh() {
    clearTimeout(state.routeTimer);
    state.routeTimer = setTimeout(async () => {
      const ok = await loadData();
      if (ok) {
        await repairOrganization({ manual:false });
        await tryNativePins();
      }
    }, 8500);
  }

  async function init() {
    ensureShell();
    ensureMatrix();
    ensureBots();
    brand();
    decorateTurns();
    ensureCoach();

    const ok = await loadData();
    if (ok) {
      renderPinnedProjects();
      setTimeout(() => repairOrganization({ manual:false }), 1500);
      setTimeout(tryNativePins, 3200);
    }

    state.observer = new MutationObserver(() => {
      if (location.pathname !== state.lastPath) {
        state.lastPath = location.pathname;
        scheduleScan(80);
        scheduleRouteRefresh();
      } else {
        scheduleScan();
      }
    });
    state.observer.observe(document.documentElement, { subtree:true, childList:true });

    document.addEventListener('input', event => {
      if (event.target?.matches?.('#prompt-textarea,[data-testid="prompt-textarea"],textarea') || event.target?.isContentEditable) {
        clearTimeout(state.coachTimer);
        state.coachTimer = setTimeout(ensureCoach, 90);
      }
    }, true);

    document.addEventListener('keydown', event => {
      if (event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openQuick();
      }
    }, true);

    addEventListener('resize', () => scheduleScan(80), { passive:true });
    setInterval(markRunning, 650);
    setInterval(() => {
      loadData({ quiet:true }).then(success => { if (success) repairOrganization({ manual:false }); });
    }, 10 * 60 * 1000);
  }

  init();
})();
