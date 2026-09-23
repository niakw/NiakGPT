(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PROJECT_MEMORY_132__) return;
  window.__NIAKGPT_PROJECT_MEMORY_132__ = true;

  const CACHE_KEY = 'niakgpt-v08-cache';
  const GOV_KEY = 'niakgpt-governance-v085';
  const PREFS_KEY = 'niakgpt-project-memory-prefs-v132';
  const STATE_KEY = 'niakgpt-project-memory-state-v132';
  const CONTEXT_KEY = 'niakgpt-project-memory-context-v132';
  const QUEUE_KEY = 'niakgpt-project-memory-queue-v132';
  const RETRY_KEY = 'niakgpt-project-memory-chat-retry-v117';
  const MEMORY_LOCK = 'niakgpt-project-memory-sync-v132';
  const CACHE_BOOTSTRAP_LOCK = 'niakgpt-project-memory-cache-bootstrap-v088';
  const MAX_STATE = 18000;
  const CHUNK = 1000000;
  const HISTORY_FETCH_GAP_MS = 20000;
  const BACKGROUND_HISTORY_FETCH_GAP_MS = 4000;
  const PRIORITY_HISTORY_FETCH_GAP_MS = 900;
  const HUMAN_QUIET_MS = 60*1000;
  const ACTIVE_HISTORY_RETRY_MS = 5000;
  const PRIORITY_RETRY_MS = 1000;
  const CHAT_FETCH_RETRIES_PRIORITY = 2;
  const CHAT_FETCH_RETRIES_NORMAL = 2;
  const WAKE_HEARTBEAT_MS = 30000;
  const GITHUB_AUTH_UI_TIMEOUT_MS = 6*60*1000;
  let seq = 0, syncing = false, syncAuto = false, prioritySync = false, priorityKick = false, autoTimer = 0, wakeTimer = 0, routeTimer = 0, domCaptureTimer = 0, lastHistoryFetchAt = 0, lastHumanAt = Date.now();
  let contextProject = '', contextText = '', backgroundHistoryAvailable = null, backgroundHistoryProbeAt = 0;
  let catalogRecoveryPromise = null, lastCatalogRecoveryAt = 0;

  const clean = v => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const one = v => clean(v).replace(/\s+/g, ' ').trim();
  const projectName = v => {
    const raw=one(v);if(!raw)return'';
    let s=raw.replace(/^(?:(?:<\/>|[§€▶◇▣✦◈+◆▤]))+\s*/u,'');
    s=s.replace(/(?:\s*\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\s*(?:\[\d+\])?\s*›?)+\s*$/u,'').trim();
    return s||raw;
  };
  const clip = (v, n) => { const s = clean(v); return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + '…'; };
  const safe = v => one(v).replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 160);
  const parseTime = v => { const n = Number(v); if (Number.isFinite(n) && n > 0) return n > 1e12 ? n : n * 1000; const d = Date.parse(String(v || '')); return Number.isFinite(d) ? d : 0; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const conversationPage = () => /(?:^|\/)c\/[A-Za-z0-9_-]+(?:$|[/?#])/.test(String(location.pathname || ''));
  const quietFor = () => Date.now() - lastHumanAt;
  const remainingQuiet = (floor=1000) => Math.max(floor, HUMAN_QUIET_MS - quietFor() + floor);
  const peerBusy = () => document.documentElement.dataset.ng90PeerBusy === '1';
  const activeHistoryMode = allowConversation => !!allowConversation && conversationPage() && backgroundHistoryAvailable === true;
  const priorityWorkerMode = priority => priority === true && backgroundHistoryAvailable === true;
  const humanQuietRequired = (background,allowConversation=false,priority=prioritySync) => !!background && !activeHistoryMode(allowConversation) && !priorityWorkerMode(priority);
  const backgroundDelay = (allowConversation=false,priority=prioritySync) => peerBusy() ? WAKE_HEARTBEAT_MS : (priorityWorkerMode(priority) ? PRIORITY_RETRY_MS : (activeHistoryMode(allowConversation) ? ACTIVE_HISTORY_RETRY_MS : remainingQuiet()));
  const retryDelay = (allowConversation,priority=prioritySync) => priorityWorkerMode(priority) ? PRIORITY_RETRY_MS : (activeHistoryMode(allowConversation) ? ACTIVE_HISTORY_RETRY_MS : remainingQuiet());
  const backgroundHistoryGap = () => prioritySync ? PRIORITY_HISTORY_FETCH_GAP_MS : BACKGROUND_HISTORY_FETCH_GAP_MS;
  const queueWait = q => Math.max(0,Number(q?.retryAt||0)-Date.now());
  const transientConversationFailure = error => /^conversation_fetch_failed:/.test(String(error?.message||error||''));
  const defaults = { autoSync: true, injectOnNewChat: true };
  let prefsCache = Object.assign({}, defaults), prefsReady = false;

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

  async function backgroundHistoryProbe(force=false) {
    const now=Date.now();
    if(!force&&backgroundHistoryAvailable!==null&&now-backgroundHistoryProbeAt<60*1000)return backgroundHistoryAvailable;
    const result=await send({type:'niakgpt:memory-chatgpt-probe-v132'});
    backgroundHistoryAvailable=!!result?.ok;
    backgroundHistoryProbeAt=now;
    document.documentElement.dataset.ng132HistoryTransport=backgroundHistoryAvailable?'background':'page-only';
    return backgroundHistoryAvailable;
  }

  async function backgroundHistoryFetch(id) {
    const result=await send({type:'niakgpt:memory-chatgpt-fetch-v132',path:'/backend-api/conversation/'+encodeURIComponent(id)});
    if(result?.ok)return result;
    const error=String(result?.error||'');
    if(/chatgpt_session_|chatgpt_memory_http_401|chatgpt_memory_http_403|extension_context_invalidated/i.test(error)){
      backgroundHistoryAvailable=false;backgroundHistoryProbeAt=Date.now();
    }
    return result||{ok:false,status:0,error:'background_history_empty'};
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

  const busy = (background = syncAuto, allowConversation = false, priority = prioritySync) => {
    const interruption=String(document.documentElement.dataset.ng119Interruption||'').toLowerCase();
    const bridgePriorityUntil=Math.max(
      Number(document.documentElement.dataset.ng100NativePriorityUntil||0),
      Number(document.documentElement.dataset.ng100BackgroundPriorityUntil||0)
    );
    return (!allowConversation && conversationPage()) ||
      peerBusy() ||
      document.documentElement.dataset.ng8Running === '1' ||
      ['loading','waiting','thinking','executing'].includes(String(document.documentElement.dataset.ng86Activity || '').toLowerCase()) ||
      document.documentElement.dataset.ng105Verification === '1' ||
      interruption === 'verify' ||
      interruption === 'network' ||
      navigator.onLine === false ||
      Date.now() < bridgePriorityUntil ||
      (humanQuietRequired(background,allowConversation,priority) && quietFor() < HUMAN_QUIET_MS);
  };

  async function waitIdle(limit, allowConversation=false, priority=prioritySync) {
    const start = Date.now(), max = limit || 10 * 60 * 1000;
    while (busy(syncAuto,allowConversation,priority)) {
      if ((!allowConversation&&conversationPage()) || document.hidden || (syncAuto && !autoOwner())) return false;
      if (Date.now() - start > max) return false;
      await sleep(1000);
    }
    if ((!allowConversation&&conversationPage()) || document.hidden || (syncAuto && !autoOwner())) return false;
    return true;
  }

  async function prefs() {
    try { prefsCache = Object.assign({}, defaults, (await chrome.storage.local.get(PREFS_KEY))[PREFS_KEY] || {}); }
    catch { prefsCache = Object.assign({}, defaults); }
    prefsReady = true;
    return Object.assign({}, prefsCache);
  }

  async function setPrefs(next) {
    prefsCache = Object.assign({}, defaults, next || {});
    prefsReady = true;
    await chrome.storage.local.set({ [PREFS_KEY]: prefsCache });
    return Object.assign({}, prefsCache);
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

  async function chatRetryLedger() {
    try {
      const raw=(await chrome.storage.local.get(RETRY_KEY))[RETRY_KEY];
      if(!raw||typeof raw!=='object'||Array.isArray(raw))return{};
      const out={};
      for(const [key,value] of Object.entries(raw)){
        if(!value||typeof value!=='object')continue;
        out[key]={...value,manual:true,nextAt:0};
      }
      return out;
    } catch { return {}; }
  }

  async function saveChatRetryLedger(ledger) {
    const rows=ledger&&typeof ledger==='object'?ledger:{};
    if(Object.keys(rows).length)await chrome.storage.local.set({[RETRY_KEY]:rows});
    else await chrome.storage.local.remove(RETRY_KEY);
    document.dispatchEvent(new CustomEvent('niakgpt:project-memory-retry-pile',{detail:{count:Object.keys(rows).length}}));
  }

  const retryEntryKey = (projectId,chatId) => String(projectId||'')+'::'+String(chatId||'');
  const retryPileRows = ledger => Object.values(ledger&&typeof ledger==='object'?ledger:{}).filter(row=>row&&row.manual===true);
  const retryPileCount = ledger => retryPileRows(ledger).length;

  async function fetchConversationResilient(project,chat,progress={}) {
    const limit=prioritySync?CHAT_FETCH_RETRIES_PRIORITY:CHAT_FETCH_RETRIES_NORMAL;
    let lastError=null;
    for(let attempt=0;attempt<limit;attempt++){
      try{return {ok:true,data:await fetchConversation(chat.id,attempt)};}
      catch(error){
        if(!transientConversationFailure(error))throw error;
        lastError=error;
        if(attempt+1>=limit)break;
        await state({
          mode:'syncing',projectId:project.id,projectName:project.name,chatId:chat.id,chatTitle:chat.title,
          chatDone:Number(progress.chatDone||0),chatTotal:Number(progress.chatTotal||0),prioritySync,
          retryingChat:true,retryAttempt:attempt+2,retryLimit:limit,lastTransientError:String(error?.message||error).slice(0,180)
        });
        await sleep(prioritySync?(attempt===0?1200:3500):4000);
      }
    }
    return {ok:false,deferred:true,error:String(lastError?.message||lastError||'conversation_fetch_failed:0:unknown')};
  }

  function projects(raw) {
    const ps = Array.isArray(raw.projects) ? raw.projects : [];
    const byChat = new Map();
    for (const chat of (Array.isArray(raw.chats) ? raw.chats : [])) {
      if (!chat?.id) continue;
      byChat.set(String(chat.id), Object.assign({}, chat));
    }
    for (const [pid,list] of Object.entries(raw.projectChats || {})) {
      if (!Array.isArray(list)) continue;
      for (const chat of list) {
        if (!chat?.id) continue;
        const id=String(chat.id),old=byChat.get(id)||{};
        byChat.set(id,Object.assign({},old,chat,{projectId:String(chat.projectId||old.projectId||pid)}));
      }
    }
    const chats=[...byChat.values()];
    const indexed = new Set(Array.isArray(raw.indexedProjectIds) ? raw.indexedProjectIds : []);
    return ps.filter(p => String(p && p.id || '').startsWith('g-p-')).map(p => {
      const rows = chats.filter(c => c && c.projectId === p.id);
      return Object.assign({}, p, {
        name:projectName(p?.name||'')||one(p?.name||''),
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

  async function recoverVaultCatalog(force=false) {
    if (catalogRecoveryPromise) return catalogRecoveryPromise;
    const now=Date.now();
    if (!force && now-lastCatalogRecoveryAt < 5*60*1000) return {ok:true,skipped:'cooldown'};
    catalogRecoveryPromise=(async()=>{
      const current=await cache();
      const currentCanonical=projects(current);
      // A complete local/server inventory remains the active authority. Vault recovery is a
      // high-water safety net for reinstall/cold-cache collapse, never a reason to resurrect
      // archived Projects over a healthy current index.
      if (Number(current.serverIndexedAt||0) > 0) {
        lastCatalogRecoveryAt=Date.now();
        return {ok:true,skipped:'healthy-current',projects:currentCanonical.length};
      }
      const status=await send({type:'niakgpt:memory-status-v132'});
      if (!status?.ok || !status.connected || !status.configured) return {ok:true,skipped:'vault-disconnected'};
      const remote=await send({type:'niakgpt:memory-catalog-v132'});
      if (!remote?.ok || !Array.isArray(remote.projects)) return {ok:false,error:String(remote?.error||'vault_catalog_unavailable')};
      const catalog=remote.projects.filter(p=>/^g-p-[A-Za-z0-9_-]+$/.test(String(p?.id||''))&&projectName(p?.name||''));
      if (catalog.length < 2 || catalog.length <= currentCanonical.length) {
        lastCatalogRecoveryAt=Date.now();
        return {ok:true,skipped:'not-better',projects:currentCanonical.length,vaultProjects:catalog.length};
      }
      const merge=latest=>{
        const base=latest&&typeof latest==='object'?latest:{};
        const existing=new Map((Array.isArray(base.projects)?base.projects:[]).filter(p=>p?.id).map(p=>[String(p.id),{...p}]));
        const counts={...(base.counts||{})};
        const indexed=new Set(Array.isArray(base.indexedProjectIds)?base.indexedProjectIds:[]);
        const recovered=[],seen=new Set();
        for(const row of catalog){
          const id=String(row.id),old=existing.get(id)||{},name=projectName(row.name||old.name||'');
          if(!name)continue;
          recovered.push({...old,id,name,href:`/g/${id}/project`,domOnly:false,vaultRecovered:true});
          seen.add(id);
          counts[id]=Math.max(Number(counts[id]||0),Number(row.conversationCount||0),Number(row.knownConversationCount||0));
          if(row.indexed===true)indexed.add(id);
        }
        // Keep a newly discovered local canonical Project that is not in the older vault yet,
        // but put the durable catalog itself back in its stable order.
        for(const [id,row] of existing)if(!seen.has(id))recovered.push(row);
        return {
          ...base,
          schema:Math.max(2,Number(base.schema||0)),
          projects:recovered,
          counts,
          indexedProjectIds:[...indexed],
          vaultCatalogRecoveredAt:Date.now(),
          vaultCatalogCount:catalog.length,
          at:Date.now()
        };
      };
      const bus=window.__NIAKGPT_CACHE_BUS__;
      if(bus?.update)await bus.update(merge);
      else await chrome.storage.local.set({[CACHE_KEY]:merge(current)});

      // Governance can collapse in lockstep with the Project inventory. If its core list exactly
      // mirrored the whole collapsed canonical inventory (the field failure is 1/1) and there is
      // no explicit manual-core marker, preserve that "all visible Projects are core" policy
      // across catalog recovery. Never expand a genuine partial/manual selection.
      try{
        const rawGov=(await chrome.storage.local.get(GOV_KEY))[GOV_KEY]||{};
        const beforeIds=currentCanonical.map(p=>String(p.id||'')).filter(Boolean);
        const beforeSet=new Set(beforeIds),core=[...new Set((rawGov.coreProjectIds||[]).map(String).filter(Boolean))];
        const mirroredCollapsed=beforeIds.length>0&&beforeIds.length<=1&&
          core.length===beforeIds.length&&core.every(id=>beforeSet.has(id))&&
          rawGov.manualCoreSelection!==true;
        if(mirroredCollapsed){
          const hidden=new Set((rawGov.hiddenProjectIds||[]).map(String));
          const recoveredCore=catalog
            .filter(row=>!hidden.has(String(row.id))&&!/^(?:à classer|a classer|hors projet\s*\/\s*a classer|hors projet\s*\/\s*à classer|unclassified|to classify)$/i.test(projectName(row.name||'')))
            .map(row=>String(row.id));
          if(recoveredCore.length>core.length){
            await chrome.storage.local.set({[GOV_KEY]:{
              ...rawGov,seeded:true,manualCoreSelection:false,coreProjectIds:[...new Set(recoveredCore)],
              vaultCatalogRecoveredCoreAt:Date.now()
            }});
          }
        }
      }catch{}
      lastCatalogRecoveryAt=Date.now();
      document.dispatchEvent(new CustomEvent('niakgpt:server-projects-ready',{detail:{source:'project-memory-vault',count:catalog.length}}));
      window.__NIAKGPT_DIAGNOSTICS__?.set('project-memory-catalog',`RÉPARÉ · ${catalog.length} Projects canoniques récupérés du coffre`);
      return {ok:true,recovered:true,projects:catalog.length};
    })().catch(error=>({ok:false,error:String(error?.message||error)})).finally(()=>{catalogRecoveryPromise=null;});
    return catalogRecoveryPromise;
  }

  async function commit(files, message, priority=prioritySync) {
    const maxFiles=priority?28:14,maxBytes=priority?5.5*1024*1024:5*1024*1024,batches=[];
    let batch=[],bytes=0;
    for(const file of files){
      const size=new TextEncoder().encode(String(file?.content||'')).byteLength;
      if(batch.length&&(batch.length>=maxFiles||bytes+size>maxBytes)){batches.push(batch);batch=[];bytes=0;}
      batch.push(file);bytes+=size;
    }
    if(batch.length)batches.push(batch);
    for (let i = 0; i < batches.length; i++) {
      const r = await send({
        type: 'niakgpt:memory-commit-v132',
        files: batches[i],
        priority: priority === true,
        message: message + (batches.length > 1 ? ' (' + (i + 1) + ')' : '')
      });
      if (!r || !r.ok) throw new Error(r && r.error || 'memory_commit_failed');
      if (i + 1 < batches.length) await sleep(priority?40:250);
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

  function buildState(project, index, previousState='') {
    const convs = Object.values(index.conversations || {}).sort((a,b) => Number(b.updated || 0) - Number(a.updated || 0));
    const priorSection=name=>{
      const text=String(previousState||''),start=text.indexOf('## '+name);
      if(start<0)return[];
      const tail=text.slice(start+('## '+name).length),end=tail.search(/\n##\s/),body=end>=0?tail.slice(0,end):tail;
      return body.split('\n').map(line=>line.trim()).filter(line=>line.startsWith('- ')&&!/Aucun signal fiable/i.test(line)).map(line=>line.slice(2));
    };
    const priorRecent=(()=>{
      const text=String(previousState||''),start=text.indexOf('## Recent working context');
      if(start<0)return'';
      const tail=text.slice(start+'## Recent working context'.length),end=tail.indexOf('\n## Conversation inventory');
      return (end>=0?tail.slice(0,end):tail).trim();
    })();
    const tasks = priorSection('Open tasks / next actions'), arch = priorSection('Architecture / invariants / constraints'), decisions = priorSection('Decisions / rules'), recent = [];
    convs.forEach(c => {
      const s = c.signals || {};
      tasks.push(...(s.tasks || [])); arch.push(...(s.architecture || [])); decisions.push(...(s.decisions || []));
      (s.recent || []).forEach(x => recent.push(Object.assign({}, x, { title: c.title, updated: c.updated })));
    });
    const uniq = list => [...new Map(list.map(x => [String(x).toLowerCase(), x])).values()].slice(0, 24);
    recent.sort((a,b) => Number(b.at || b.updated || 0) - Number(a.at || a.updated || 0));
    const section = (name, list) => '## ' + name + '\n\n' + (list.length ? uniq(list).map(x => '- ' + clip(x, 650)).join('\n') : '- Aucun signal fiable.') + '\n';
    const freshRecent = recent.slice(0, 10).map(x => '### ' + String(x.role || 'assistant').toUpperCase() + ' · ' + one(x.title || 'Conversation') + '\n\n' + clip(x.text, 1200)).join('\n\n');
    const recentText = [freshRecent,priorRecent].filter(Boolean).join('\n\n');
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
    const direct=await backgroundHistoryProbe(false);
    if(direct){
      if(!await waitIdle(undefined,true))throw new Error('memory_sync_paused_busy');
      const elapsed=Date.now()-lastHistoryFetchAt;
      const gap=backgroundHistoryGap();
      if(lastHistoryFetchAt&&elapsed<gap)await sleep(gap-elapsed);
      if(!await waitIdle(undefined,true))throw new Error('memory_sync_paused_busy');
      lastHistoryFetchAt=Date.now();
      const background=await backgroundHistoryFetch(id);
      if(background?.ok)return background.data;
      const bgError=String(background?.error||'');
      if(background?.status===429||/chatgpt_memory_http_429/.test(bgError))throw new Error('memory_sync_paused_rate_limit');
      if(conversationPage()){
        if(/chatgpt_session_|chatgpt_memory_http_401|chatgpt_memory_http_403/.test(bgError))throw new Error('memory_sync_paused_network');
        throw new Error('conversation_fetch_failed:'+(background?.status||0)+':'+(bgError||'background_history_failed'));
      }
    }
    if (!await waitIdle()) throw new Error('memory_sync_paused_busy');
    const elapsed=Date.now()-lastHistoryFetchAt;
    if(lastHistoryFetchAt&&elapsed<HISTORY_FETCH_GAP_MS)await sleep(HISTORY_FETCH_GAP_MS-elapsed);
    if (!await waitIdle()) throw new Error('memory_sync_paused_busy');
    lastHistoryFetchAt=Date.now();
    const r = await rpc('/backend-api/conversation/' + encodeURIComponent(id), true);
    if (r && r.ok) return r.data;
    const error=String(r?.error||'');
    if(error==='native_conversation_quiet')throw new Error('memory_sync_paused_conversation');
    if(error==='native_busy'||/fetch_aborted_native_priority|bridge-pause/.test(error))throw new Error('memory_sync_paused_busy');
    if(r?.status===429)throw new Error('memory_sync_paused_rate_limit');
    if(r?.status===0)throw new Error('memory_sync_paused_network');
    throw new Error('conversation_fetch_failed:' + String(r && r.status || 0) + ':' + String(r && r.error || 'unknown'));
  }

  function currentChatId() {
    return String(location.pathname||'').match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  }

  function normalizePid(value){
    const raw=String(value||'').trim(),match=raw.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);
    return match?'g-p-'+match[1]:raw;
  }

  function domMessages() {
    const out=[];
    for(const el of document.querySelectorAll('[data-message-author-role]')){
      const role=one(el.getAttribute('data-message-author-role')||'unknown').toLowerCase();
      if(!['user','assistant','tool','system'].includes(role))continue;
      const text=clean(el.innerText||el.textContent||'');if(!text)continue;
      const turn=el.closest('article,[data-testid^="conversation-turn-"]'),time=turn?.querySelector?.('time[datetime]');
      out.push({role,text,at:parseTime(time?.getAttribute?.('datetime')||0)});
    }
    return out;
  }

  function rowsHash(rows) {
    let h=2166136261;
    const input=(rows||[]).map(row=>String(row.role||'')+'\u0000'+String(row.text||'')).join('\u0001');
    for(const ch of input){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
    return (h>>>0).toString(36);
  }

  const compactProjectConversation = row => {
    const r=row&&typeof row==='object'?row:{};
    return {
      schema:1,id:String(r.id||''),title:one(r.title||'Conversation'),updated:Number(r.updated||0),
      capturedAt:String(r.capturedAt||''),parts:Math.max(0,Number(r.parts||0)),messages:Math.max(0,Number(r.messages||0)),
      canonicalHash:String(r.canonicalHash||''),liveDomHash:String(r.liveDomHash||''),
      bootstrapMetadataOnly:r.bootstrapMetadataOnly===true,historyPartial:r.historyPartial===true,
      complete:r.complete===true,captureSource:String(r.captureSource||'')
    };
  };
  const projectConversationStrength = row => row?.complete===true&&Number(row?.parts||0)>0&&Number(row?.messages||0)>0
    ? 3 : (Number(row?.parts||0)>0&&Number(row?.messages||0)>0 ? 2 : (row?.id?1:0));
  const projectConversationEpoch = row => Math.max(Number(row?.updated||0),Date.parse(String(row?.capturedAt||''))||0);
  function preferProjectConversation(current,incoming){
    if(!current)return incoming;
    if(!incoming)return current;
    const a=projectConversationStrength(current),b=projectConversationStrength(incoming);
    if(a!==b)return b>a?incoming:current;
    return projectConversationEpoch(incoming)>=projectConversationEpoch(current)?incoming:current;
  }
  function compactProjectIndex(index){
    const src=index&&typeof index==='object'?index:{},conversations={};
    for(const [id,row] of Object.entries(src.conversations&&typeof src.conversations==='object'?src.conversations:{})){
      if(id)conversations[id]=compactProjectConversation({...row,id:row?.id||id});
    }
    return {...src,conversations};
  }
  async function reconcileProjectArchive(project,idx){
    const known=Object.entries(idx.conversations||{})
      .filter(([,row])=>row?.complete===true&&Number(row?.parts||0)>0&&Number(row?.messages||0)>0)
      .map(([id])=>id);
    const result=await send({
      type:'niakgpt:memory-project-archive-v132',projectId:project.id,knownArchivedIds:known
    });
    if(!result?.ok)return {idx,recovered:0,directoryCount:known.length,error:String(result?.error||'archive_reconcile_failed')};
    let recovered=0;
    for(const row of (Array.isArray(result.recovered)?result.recovered:[])){
      const id=String(row?.id||'');if(!id)continue;
      const chosen=preferProjectConversation(idx.conversations[id],row);
      if(chosen!==idx.conversations[id]){idx.conversations[id]=chosen;recovered++;}
    }
    return {idx,recovered,directoryCount:Number(result.directoryCount||known.length),error:''};
  }
  function ensureProjectChatMetadata(project,idx){
    for(const chat of (project.chats||[])){
      if(!chat?.id)continue;
      const id=String(chat.id),old=idx.conversations[id];
      if(old)continue;
      idx.conversations[id]={
        schema:1,id,title:one(chat.title||'Conversation'),updated:parseTime(chat.updated||chat.update_time||chat.create_time),
        capturedAt:new Date().toISOString(),parts:0,messages:0,canonicalHash:'',liveDomHash:'',
        bootstrapMetadataOnly:true,historyPartial:false,complete:false,captureSource:''
      };
    }
    return idx;
  }

  async function captureCurrentDomConversation(force=false) {
    if(!conversationPage()||document.hidden)return{ok:true,skipped:'not-visible-conversation'};
    const cid=currentChatId(),rows=domMessages();if(!cid||!rows.length)return{ok:true,skipped:'dom-not-ready'};
    const raw=await cache(),list=projects(raw),pid=normalizePid(currentPid());
    let project=list.find(p=>p.id===pid)||list.find(p=>(p.chats||[]).some(chat=>String(chat.id)===cid));
    if(!project)return{ok:true,skipped:'project-unknown'};
    let chat=(project.chats||[]).find(row=>String(row.id)===cid);
    if(!chat){
      const title=one(document.title||'Conversation').replace(/\s*[|·-]\s*ChatGPT\s*$/i,'')||'Conversation';
      chat={id:cid,title,projectId:project.id,updated:Date.now()};
    }
    let idx=null;
    try{const txt=await read(ppath(project.id,'index.json'));if(txt)idx=JSON.parse(txt);}catch{}
    if(!idx||typeof idx!=='object')idx={schema:1,projectId:project.id,conversations:{}};
    if(!idx.conversations||typeof idx.conversations!=='object')idx.conversations={};
    const old=idx.conversations[cid],hash=rowsHash(rows);
    if(!force&&old&&old.captureSource==='live-dom'&&old.liveDomHash===hash&&Number(old.parts||0)>0)return{ok:true,skipped:'unchanged-dom'};
    const full=transcript(project,chat,rows),chunks=[];
    for(let at=0;at<full.length;at+=CHUNK)chunks.push(full.slice(at,at+CHUNK));
    const base=ppath(project.id,'conversations/'+safe(cid)),files=[];
    chunks.forEach((text,part)=>files.push({path:base+'/part-'+String(part+1).padStart(3,'0')+'.md',content:text}));
    for(let stale=chunks.length;stale<Number(old?.parts||0);stale++)files.push({
      path:base+'/part-'+String(stale+1).padStart(3,'0')+'.md',
      content:'# Superseded\n\nThis chunk is no longer part of the current conversation snapshot. Use Git history for the previous revision.\n'
    });
    const updated=parseTime(chat.updated||chat.update_time||chat.create_time)||Number(old?.updated||0)||Date.now();
    const chatIndex={
      schema:1,id:cid,title:one(chat.title||old?.title||'Conversation'),updated,capturedAt:new Date().toISOString(),
      parts:chunks.length,messages:rows.length,bootstrapMetadataOnly:false,historyPartial:true,complete:false,
      captureSource:'live-dom',liveDomHash:hash,signals:signals(rows)
    };
    idx={...idx,schema:1,projectId:project.id,projectName:projectName(project.name||''),updatedAt:new Date().toISOString(),bootstrapMetadataOnly:false,conversations:{...idx.conversations,[cid]:chatIndex}};
    const compact=buildState(project,idx,await loadContext(project.id));
    files.push(
      {path:base+'/index.json',content:JSON.stringify(chatIndex,null,2)+'\n'},
      {path:ppath(project.id,'project.json'),content:JSON.stringify({
        schema:1,id:project.id,name:projectName(project.name||''),description:clean(project.description||''),instructions:clean(project.instructions||''),
        conversationCount:Object.keys(idx.conversations).length,knownConversationCount:Number(project.count||0),indexed:project.indexed===true,
        bootstrapMetadataOnly:false,updatedAt:idx.updatedAt
      },null,2)+'\n'},
      {path:ppath(project.id,'index.json'),content:JSON.stringify(compactProjectIndex(idx),null,2)+'\n'},
      {path:ppath(project.id,'PROJECT_STATE.md'),content:compact}
    );
    await commit(files,'NiakGPT memory: live DOM '+projectName(project.name||project.id)+' / '+one(chat.title||cid));
    await saveContext(project.id,compact);
    document.documentElement.dataset.ng132DomCapture=cid+':'+rows.length;
    return{ok:true,captured:true,projectId:project.id,chatId:cid,messages:rows.length,parts:chunks.length};
  }

  function scheduleDomCapture(delay=900) {
    clearTimeout(domCaptureTimer);domCaptureTimer=0;
    if(prioritySync||!conversationPage()||document.hidden)return;
    domCaptureTimer=setTimeout(()=>{domCaptureTimer=0;captureCurrentDomConversation(false).catch(()=>{});},Math.max(120,Number(delay)||900));
  }

  async function saveContext(pid, text) {
    let raw = {};
    try { raw = (await chrome.storage.local.get(CONTEXT_KEY))[CONTEXT_KEY] || {}; } catch {}
    raw[pid] = { text: clip(text, MAX_STATE), at: Date.now() };
    try { await chrome.storage.local.set({ [CONTEXT_KEY]: raw }); } catch {}
  }

  async function loadContext(pid) {
    try {
      const raw=(await chrome.storage.local.get(CONTEXT_KEY))[CONTEXT_KEY]||{};
      return String(raw?.[pid]?.text||'');
    } catch { return ''; }
  }

  async function syncProject(project, force, options={}) {
    let idx = null;
    try { const txt = await read(ppath(project.id, 'index.json')); if (txt) idx = JSON.parse(txt); } catch {}
    if (!idx || typeof idx !== 'object') idx = { schema: 1, projectId: project.id, conversations: {} };
    if (!idx.conversations || typeof idx.conversations !== 'object') idx.conversations = {};
    const archiveRecovery=await reconcileProjectArchive(project,idx);
    idx=ensureProjectChatMetadata(project,archiveRecovery.idx);
    if(archiveRecovery.recovered){
      await state({
        mode:'preparing',projectId:project.id,projectName:project.name,
        archiveRecovered:archiveRecovery.recovered,archiveDirectoryCount:archiveRecovery.directoryCount,error:''
      });
    }

    const retryIds=new Set((Array.isArray(options.retryChatIds)?options.retryChatIds:[]).map(String).filter(Boolean));
    const manualRetry=options.manualRetry===true;
    const allChats=project.chats.slice().sort((a,b) => Number(a.updated || 0) - Number(b.updated || 0));
    const chats=retryIds.size?allChats.filter(chat=>retryIds.has(String(chat.id))):allChats;
    const complete = chat => {
      const old=idx.conversations[chat.id],updated=parseTime(chat.updated);
      return !force && !!old && old.complete !== false && Number(old.updated || 0) >= updated && Number(old.parts || 0) > 0;
    };
    let completed = chats.filter(complete).length, changed = 0;
    const failed=[];
    let ledger=await chatRetryLedger();
    const persistLedger=async()=>saveChatRetryLedger(ledger);

    await state({
      mode:manualRetry?'retrying-failed':'syncing',projectId:project.id,projectName:project.name,
      chatId:'',chatTitle:'',chatDone:completed,chatTotal:chats.length,
      prioritySync,projectArchivedBefore:completed,archiveRecovered:archiveRecovery.recovered,
      archiveDirectoryCount:archiveRecovery.directoryCount,failedChats:retryPileCount(ledger),
      retryingChat:false,lastTransientError:''
    });

    for (const chat of chats) {
      if (document.hidden) throw new Error('memory_sync_paused_hidden');
      if (syncAuto && !autoOwner()) throw new Error('memory_sync_paused_owner_change');

      const old=idx.conversations[chat.id],updated=parseTime(chat.updated),retryKey=retryEntryKey(project.id,chat.id);
      if (complete(chat)) {
        if(ledger[retryKey]){delete ledger[retryKey];await persistLedger();}
        continue;
      }

      const prior=ledger[retryKey];
      if(!force&&!manualRetry&&prior?.manual===true){
        failed.push({...prior,projectId:project.id,chatId:chat.id,chatTitle:one(chat.title||prior.chatTitle||'Conversation')});
        continue;
      }

      await state({
        mode:manualRetry?'retrying-failed':'syncing',projectId:project.id,projectName:project.name,
        chatId:chat.id,chatTitle:chat.title,chatDone:completed,chatTotal:chats.length,
        prioritySync,failedChats:retryPileCount(ledger),retryingChat:false,lastTransientError:''
      });

      const fetched=await fetchConversationResilient(project,chat,{chatDone:completed,chatTotal:chats.length});
      if(!fetched.ok){
        const attempts=Math.max(0,Number(prior?.attempts||0))+(prioritySync?CHAT_FETCH_RETRIES_PRIORITY:CHAT_FETCH_RETRIES_NORMAL);
        const row={
          projectId:project.id,projectName:projectName(project.name||''),chatId:chat.id,chatTitle:one(chat.title||'Conversation'),
          manual:true,attempts,firstFailedAt:Number(prior?.firstFailedAt||Date.now()),lastAt:Date.now(),nextAt:0,
          error:String(fetched.error||'conversation_fetch_failed:0:unknown').slice(0,180)
        };
        ledger[retryKey]=row;
        await persistLedger();
        failed.push(row);
        await state({
          mode:manualRetry?'retrying-failed':'syncing',projectId:project.id,projectName:project.name,chatId:chat.id,chatTitle:chat.title,
          chatDone:completed,chatTotal:chats.length,prioritySync,failedChats:retryPileCount(ledger),
          retryingChat:false,lastTransientError:row.error,nextAttemptAt:0
        });
        continue;
      }

      const data=fetched.data,rows=messages(data);
      if(!rows.length){
        const row={
          projectId:project.id,projectName:projectName(project.name||''),chatId:chat.id,chatTitle:one(chat.title||'Conversation'),
          manual:true,attempts:Math.max(0,Number(prior?.attempts||0))+1,
          firstFailedAt:Number(prior?.firstFailedAt||Date.now()),lastAt:Date.now(),nextAt:0,error:'conversation_empty'
        };
        ledger[retryKey]=row;
        await persistLedger();
        failed.push(row);
        continue;
      }

      const canonicalUpdated=Math.max(updated,parseTime(data.update_time))||Date.now();
      const canonicalHash=rowsHash(rows);

      if(!force&&old&&old.complete!==false&&Number(old.parts||0)>0&&old.canonicalHash===canonicalHash){
        const chatIndex={
          ...old,title:one(chat.title||data.title||old.title||'Conversation'),updated:canonicalUpdated,
          capturedAt:new Date().toISOString(),canonicalHash
        };
        idx.conversations[chat.id]=chatIndex;
        idx.projectId=project.id;idx.projectName=projectName(project.name||'');idx.updatedAt=new Date().toISOString();idx.bootstrapMetadataOnly=false;
        await commit([
          {path:ppath(project.id,'conversations/'+safe(chat.id)+'/index.json'),content:JSON.stringify(chatIndex,null,2)+'\n'},
          {path:ppath(project.id,'index.json'),content:JSON.stringify(compactProjectIndex(idx),null,2)+'\n'}
        ],'NiakGPT memory: metadata '+one(project.name||project.id)+' / '+one(chat.title||chat.id),prioritySync);
        if(ledger[retryKey]){delete ledger[retryKey];await persistLedger();}
        completed++;
        await state({
          mode:manualRetry?'retrying-failed':'syncing',projectId:project.id,projectName:project.name,chatId:chat.id,chatTitle:chat.title,
          chatDone:completed,chatTotal:chats.length,prioritySync,failedChats:retryPileCount(ledger),
          retryingChat:false,lastTransientError:''
        });
        continue;
      }

      const full=transcript(project,chat,rows),chunks=[];
      for(let at=0;at<full.length;at+=CHUNK)chunks.push(full.slice(at,at+CHUNK));
      const base=ppath(project.id,'conversations/'+safe(chat.id)),files=[];
      chunks.forEach((text,part)=>files.push({path:base+'/part-'+String(part+1).padStart(3,'0')+'.md',content:text}));
      for(let stale=chunks.length;stale<Number(old&&old.parts||0);stale++)files.push({
        path:base+'/part-'+String(stale+1).padStart(3,'0')+'.md',
        content:'# Superseded\n\nThis chunk is no longer part of the current conversation snapshot. Use Git history for the previous revision.\n'
      });

      const chatIndex={
        schema:1,id:chat.id,title:one(chat.title||data.title||'Conversation'),updated:canonicalUpdated,
        capturedAt:new Date().toISOString(),parts:chunks.length,messages:rows.length,canonicalHash,
        bootstrapMetadataOnly:false,historyPartial:false,complete:true,captureSource:'backend',signals:signals(rows)
      };

      idx.conversations[chat.id]=chatIndex;
      idx.projectId=project.id;idx.projectName=projectName(project.name||'');idx.updatedAt=new Date().toISOString();idx.bootstrapMetadataOnly=false;
      files.push(
        {path:base+'/index.json',content:JSON.stringify(chatIndex,null,2)+'\n'},
        {path:ppath(project.id,'index.json'),content:JSON.stringify(compactProjectIndex(idx),null,2)+'\n'}
      );

      await commit(files,'NiakGPT memory: '+one(project.name||project.id)+' / '+one(chat.title||chat.id),prioritySync);
      if(ledger[retryKey]){delete ledger[retryKey];await persistLedger();}
      changed++;completed++;
      await state({
        mode:manualRetry?'retrying-failed':'syncing',projectId:project.id,projectName:project.name,chatId:chat.id,chatTitle:chat.title,
        chatDone:completed,chatTotal:chats.length,prioritySync,failedChats:retryPileCount(ledger),
        retryingChat:false,retryAttempt:0,retryLimit:0,lastTransientError:''
      });
      await sleep(prioritySync?40:300);
    }

    idx.projectId=project.id;idx.projectName=projectName(project.name||'');idx.updatedAt=new Date().toISOString();
    idx.bootstrapMetadataOnly=!Object.values(idx.conversations||{}).some(row=>Number(row?.parts||0)>0&&Number(row?.messages||0)>0);
    const compact=buildState(project,idx,await loadContext(project.id));
    await commit([
      {path:ppath(project.id,'project.json'),content:JSON.stringify({
        schema:1,id:project.id,name:projectName(project.name||''),description:clean(project.description||''),instructions:clean(project.instructions||''),
        conversationCount:Object.keys(idx.conversations).length,knownConversationCount:Number(project.count||0),cachedConversationCount:(project.chats||[]).length,
        indexed:project.indexed===true,bootstrapMetadataOnly:idx.bootstrapMetadataOnly,updatedAt:idx.updatedAt
      },null,2)+'\n'},
      {path:ppath(project.id,'index.json'),content:JSON.stringify(compactProjectIndex(idx),null,2)+'\n'},
      {path:ppath(project.id,'PROJECT_STATE.md'),content:compact}
    ],'NiakGPT memory: checkpoint '+one(project.name||project.id),prioritySync);
    await saveContext(project.id,compact);

    return {changed,failed,failedChats:retryPileCount(ledger)};
  }

  async function deepInventory() {
    let raw = await cache(), list = projects(raw);
    // "indexed" means the server pass ran, not that the local Project chat inventory is
    // necessarily complete. The field vault exposed exactly that state: indexed=true,
    // knownConversationCount=30, cachedConversationCount=24. Treat a count gap as unresolved
    // or Project Memory can permanently skip conversations that never reached the cache.
    const unresolved=()=>list.filter(p => p.count > 0 && (!p.indexed || Number(p.count||0) > (p.chats||[]).length));
    if (!unresolved().length) return list;
    await state({ mode:'preparing', inventoryPending:unresolved().length, projectDone:0, projectTotal:list.length, error:'' });
    // The active-chat path can archive every conversation already known to the cache through
    // the isolated extension worker. Server inventory repair still belongs to the page broker
    // and remains quarantined on the current chat; the unresolved Project IDs stay queued.
    if(conversationPage()&&await backgroundHistoryProbe(false))return list;
    if (!await waitIdle(15000)) return list;
    const missing=unresolved().map(p=>p.id);
    document.dispatchEvent(new CustomEvent('niakgpt:force-server-index', { detail:{ source:'project-memory-v132',memoryBootstrap:true,projectIds:missing } }));
    // Do not hold the first Project Memory run at 0% for 90 seconds. Give the native index a
    // short bounded window, then persist the inventory already known; later cache/index events
    // schedule another incremental pass for anything discovered afterwards.
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (document.hidden || (syncAuto && !autoOwner())) break;
      if (busy()) { await sleep(750); continue; }
      await sleep(750); raw = await cache(); list = projects(raw);
      if (!unresolved().length) break;
    }
    return list;
  }

  async function saveQueue(ids, force, priority=false, extras={}) {
    const pending=[...new Set((ids||[]).map(String).filter(Boolean))];
    let old={};try{old=(await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||{};}catch{}
    const keepPriority=priority===true||old.priority===true;
    const hold=extras.hold===undefined?old.hold===true:extras.hold===true;
    const holdReason=hold?String(extras.holdReason||old.holdReason||''):'';
    try {
      await chrome.storage.local.set({[QUEUE_KEY]:{
        pending,force:force===true,priority:keepPriority,hold,holdReason,at:Date.now()
      }});
    } catch {}
    return pending;
  }

  async function releaseQueueHold() {
    let q={};try{q=(await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||{};}catch{}
    if(!Array.isArray(q.pending)||!q.pending.length)return[];
    return saveQueue(q.pending,q.force===true,q.priority===true,{hold:false});
  }

  async function primeBootstrapQueue(force=false, priority=false) {
    const raw=await cache(),ids=projects(raw).map(p=>p.id);
    const pending=await saveQueue(ids,force,priority);
    const current=(await chrome.storage.local.get(STATE_KEY))[STATE_KEY]||{};
    await state({
      mode:pending.length?'queued':'connected',
      projectDone:0,
      projectTotal:pending.length,
      queuedProjects:pending.length,
      historyQueueSchema:1,
      prioritySync:priority===true,
      lastSyncAt:Number(current.lastSyncAt||0),
      error:''
    });
    return pending;
  }

  async function ensureBootstrapQueued() {
    const remote=await send({type:'niakgpt:memory-status-v132'});
    if(!remote?.connected)return[];
    let local={};try{local=await chrome.storage.local.get([STATE_KEY,QUEUE_KEY]);}catch{}
    const st=local[STATE_KEY]||{},q=local[QUEUE_KEY]||{};
    const existingPending=Array.isArray(q.pending)?q.pending:[];
    if(existingPending.length&&Number(st.historyQueueSchema||0)>=1)return existingPending;
    const currentList=projects(await cache()),signature=cachedBootstrapSignature(currentList);
    // 0.9.102 could have lastSyncAt set while every remote conversation still contained
    // parts=0/messages=0. Only a full-history completion tied to the current cache signature
    // is proof that the persistent queue may stay empty.
    if(Number(st.historyCompletedAt||0)>0&&String(st.historyCacheSignature||'')===signature)return[];
    return primeBootstrapQueue(false);
  }

  function cachedBootstrapSignature(list) {
    const rows=(list||[]).map(project=>[
      String(project.id||''),projectName(project.name||''),Number(project.count||0),project.indexed?1:0,
      (project.chats||[]).map(chat=>[String(chat.id||''),one(chat.title||''),parseTime(chat.updated||chat.update_time||chat.create_time)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
    ]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    const input=JSON.stringify(rows);let h=2166136261;
    for(const ch of input){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
    return (h>>>0).toString(36);
  }

  async function writeCachedBootstrap(options={}) {
    if(navigator.locks?.request&&options.__lockHeld!==true){
      return navigator.locks.request(CACHE_BOOTSTRAP_LOCK,{mode:'exclusive'},()=>writeCachedBootstrap(Object.assign({},options,{__lockHeld:true})));
    }
    await recoverVaultCatalog(options.force===true);
    const raw=await cache(),list=projects(raw),generatedAt=new Date().toISOString(),signature=cachedBootstrapSignature(list);
    const authoritative=Number(raw.serverIndexedAt||0)>0;
    let current={};try{current=(await chrome.storage.local.get(STATE_KEY))[STATE_KEY]||{};}catch{}
    const bootstrapCurrent=signature&&current.bootstrapCacheSignature===signature&&Number(current.bootstrapCachedAt||0)>0;
    const catalogCurrent=!authoritative||(current.projectCatalogSignature===signature&&Number(current.projectCatalogWrittenAt||0)>0);
    if(options.force!==true&&bootstrapCurrent&&catalogCurrent){
      return {ok:true,skipped:true,projects:list.length,files:Number(current.bootstrapCachedFiles||0),signature};
    }
    const safeProjectRows=list.map(project=>({
      id:project.id,name:projectName(project.name||''),href:String(project.href||''),
      knownConversationCount:Number(project.count||0),cachedConversationCount:(project.chats||[]).length,indexed:project.indexed===true
    }));
    const files=[{
      path:'PROJECTS.json',
      content:JSON.stringify({
        schema:1,kind:'NiakGPTCachedBootstrap',source:'local-cache-only',generatedAt,
        projectCount:list.length,projects:safeProjectRows
      },null,2)+'\n'
    }];
    // PROJECTS.json is intentionally a live/bootstrap snapshot. Persist a separate high-water
    // catalog only after a complete current ChatGPT server index has been published locally.
    // A cold/vault-recovered cache keeps serverIndexedAt=0 and therefore cannot downgrade it.
    if(authoritative){
      files.push({
        path:'PROJECT_CATALOG.json',
        content:JSON.stringify({
          schema:1,kind:'NiakGPTProjectCatalog',source:'server-index-authority',generatedAt,
          serverIndexedAt:Number(raw.serverIndexedAt||0),projectCount:list.length,projects:safeProjectRows
        },null,2)+'\n'
      });
    }
    for(const project of list){
      let previous=null;
      try{const txt=await read(ppath(project.id,'index.json'));if(txt)previous=JSON.parse(txt);}catch{}
      const conversations=previous&&previous.conversations&&typeof previous.conversations==='object'?{...previous.conversations}:{};
      for(const chat of (project.chats||[])){
        if(!chat?.id)continue;
        const id=String(chat.id),updated=parseTime(chat.updated||chat.update_time||chat.create_time),old=conversations[id];
        // Metadata bootstrap must never erase an already archived transcript. Keep the captured
        // revision untouched so the full-history worker can still detect a newer local update.
        if(old&&Number(old.parts||0)>0&&Number(old.messages||0)>0){
          conversations[id]={...old,title:one(chat.title||old.title||'Conversation')};
          continue;
        }
        conversations[id]={
          schema:1,id,title:one(chat.title||old?.title||'Conversation'),updated,
          capturedAt:generatedAt,parts:0,messages:0,bootstrapMetadataOnly:true,
          signals:{tasks:[],architecture:[],decisions:[],recent:[]}
        };
      }
      const hasArchive=Object.values(conversations).some(row=>Number(row?.parts||0)>0&&Number(row?.messages||0)>0);
      const idx={
        ...(previous&&typeof previous==='object'?previous:{}),
        schema:1,projectId:project.id,projectName:projectName(project.name||''),updatedAt:generatedAt,
        bootstrapMetadataOnly:!hasArchive,conversations
      };
      files.push(
        {path:ppath(project.id,'project.json'),content:JSON.stringify({
          schema:1,id:project.id,name:projectName(project.name||''),description:clean(project.description||''),instructions:clean(project.instructions||''),
          conversationCount:Object.keys(conversations).length,knownConversationCount:Number(project.count||0),indexed:project.indexed===true,
          bootstrapMetadataOnly:!hasArchive,updatedAt:generatedAt
        },null,2)+'\n'},
        {path:ppath(project.id,'index.json'),content:JSON.stringify(compactProjectIndex(idx),null,2)+'\n'},
        {path:ppath(project.id,'PROJECT_STATE.md'),content:buildState(project,idx,await loadContext(project.id))}
      );
    }
    await commit(files,'NiakGPT memory: cached bootstrap inventory');
    const statePatch={
      bootstrapCachedAt:Date.now(),bootstrapCachedProjects:list.length,bootstrapCachedFiles:files.length,
      bootstrapCacheSignature:signature,bootstrapSource:'local-cache-only',error:''
    };
    if(authoritative){
      statePatch.projectCatalogWrittenAt=Date.now();
      statePatch.projectCatalogSignature=signature;
      statePatch.projectCatalogServerIndexedAt=Number(raw.serverIndexedAt||0);
    }
    await state(statePatch);
    document.dispatchEvent(new CustomEvent('niakgpt:project-memory-bootstrap-written',{detail:{projects:list.length,files:files.length,signature}}));
    return {ok:true,projects:list.length,files:files.length,signature};
  }

  async function queuedState(reason='') {
    let q={};
    try { q=(await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||{}; } catch {}
    const pending=Array.isArray(q.pending)?q.pending:[];
    const priority=q.priority===true,ledger=await chatRetryLedger();
    const hold=q.hold===true;
    return state({
      mode:'queued',queuedProjects:pending.length,projectTotal:pending.length,prioritySync:priority,error:'',
      pauseReason:hold?(q.holdReason||reason||'manual-hold'):reason,
      queueHold:hold,failedChats:retryPileCount(ledger),
      nextAttemptAt:hold?0:Date.now()+(priority?PRIORITY_RETRY_MS:WAKE_HEARTBEAT_MS)
    });
  }

  const autoOwner = () => {
    const role = String(document.documentElement.dataset.ng8TabRole || '').toLowerCase();
    // Project Memory has its own navigator.lock. It should follow a visible usable tab instead
    // of the heavier general WORKER election, otherwise a hidden WORKER can own the sync lock
    // while waiting forever for visibility.
    return !document.hidden && role !== 'inactive';
  };

  async function currentPageHistoryAllowed() {
    return !conversationPage() || await backgroundHistoryProbe(false);
  }

  async function wakeHeartbeat() {
    clearTimeout(wakeTimer);
    wakeTimer=setTimeout(async()=>{
      try{
        const local=await chrome.storage.local.get([QUEUE_KEY,PREFS_KEY]);
        const q=local[QUEUE_KEY]||{},p=Object.assign({},defaults,local[PREFS_KEY]||{});
        const pending=Array.isArray(q.pending)?q.pending:[];
        document.documentElement.dataset.ng132WakeBeat=String(Date.now());
        if(q.hold===true)return;
        if((p.autoSync!==false||q.priority===true)&&pending.length&&autoOwner()){
          const allowed=await currentPageHistoryAllowed();
          const activeCatchup=conversationPage()&&backgroundHistoryAvailable===true;
          const priorityCatchup=q.priority===true&&backgroundHistoryAvailable===true;
          if(allowed&&(priorityCatchup||activeCatchup||quietFor()>=HUMAN_QUIET_MS)) await resume();
        }
      }catch{}
      wakeHeartbeat();
    },WAKE_HEARTBEAT_MS);
  }

  async function bootstrap(options) {
    const opt = options || {};
    const automatic = opt.auto === true;
    const priorityMode = opt.priority === true;
    const allowConversation=conversationPage()&&await backgroundHistoryProbe(false);
    if (conversationPage()&&!allowConversation) {
      await queuedState('conversation');
      if (automatic) schedule(WAKE_HEARTBEAT_MS);
      return { ok:false, paused:true, error:'memory_sync_paused_conversation' };
    }
    if (document.hidden || (automatic && !autoOwner())) {
      if (automatic) { await queuedState(document.hidden?'hidden':'owner'); schedule(WAKE_HEARTBEAT_MS); }
      return { ok:false, paused:true, error:document.hidden?'memory_sync_paused_hidden':'memory_sync_paused_owner_change' };
    }
    if (busy(automatic,allowConversation,priorityMode)) {
      if (automatic) {
        const quietBlocked=humanQuietRequired(true,allowConversation,priorityMode)&&quietFor()<HUMAN_QUIET_MS;
        await queuedState(quietBlocked?'quiet':'busy');
        schedule(retryDelay(allowConversation,priorityMode));
      }
      return { ok:false, paused:true, error:'memory_sync_paused_busy' };
    }
    if (navigator.locks && navigator.locks.request && opt.__lockHeld !== true) {
      let acquired=false, lockedResult = automatic ? { ok:true, skipped:'sync_owned_by_other_tab' } : { ok:false, error:'memory_sync_owned_by_other_tab' };
      await navigator.locks.request(MEMORY_LOCK,{mode:'exclusive',ifAvailable:true},async lock => {
        if (!lock) return;
        acquired=true;
        lockedResult = await bootstrap(Object.assign({},opt,{__lockHeld:true}));
      });
      if(!acquired&&automatic){ schedule(WAKE_HEARTBEAT_MS); return lockedResult; }
      return lockedResult;
    }
    if (syncing) return automatic ? {ok:true,skipped:'sync_already_running'} : { ok:false, error:'sync_already_running' };
    const st = await send({ type:'niakgpt:memory-status-v132' });
    if (!st || !st.connected) return { ok:false, error:st && st.configured ? 'github_token_missing' : 'not_connected' };
    syncing = true;
    syncAuto = automatic;
    prioritySync = priorityMode || prioritySync;
    try {
      let list = await deepInventory();
      list = list.filter(p => p.count > 0 && (!Array.isArray(opt.projectIds) || opt.projectIds.includes(p.id)));
      await saveQueue(list.map(p => p.id), opt.force, prioritySync,{hold:false});
      const initialLedger=await chatRetryLedger();
      await state({ mode:'syncing', projectDone:0, projectTotal:list.length, chatDone:0, chatTotal:0, prioritySync, failedChats:retryPileCount(initialLedger), error:'' });
      let changed = 0;
      for (let i = 0; i < list.length; i++) {
        if (document.hidden) throw new Error('memory_sync_paused_hidden');
        if (automatic && !autoOwner()) throw new Error('memory_sync_paused_owner_change');
        await saveQueue(list.slice(i).map(p => p.id), opt.force, prioritySync,{hold:false});
        if (!await waitIdle(undefined,allowConversation)) throw new Error(document.hidden?'memory_sync_paused_hidden':(automatic&&!autoOwner()?'memory_sync_paused_owner_change':'memory_sync_idle_timeout'));
        const result=await syncProject(list[i], opt.force === true);
        changed+=Number(result?.changed||0);
        await saveQueue(list.slice(i+1).map(p=>p.id),opt.force,prioritySync,{hold:false});
        await state({
          mode:'syncing',projectDone:i+1,projectTotal:list.length,projectId:list[i].id,projectName:list[i].name,
          chatDone:0,chatTotal:0,prioritySync,failedChats:Number(result?.failedChats||0)
        });
      }
      const afterList=projects(await cache());
      const remainingInventory=afterList.filter(p=>p.count>0&&(!p.indexed||Number(p.count||0)>(p.chats||[]).length)).map(p=>p.id);
      if(remainingInventory.length){
        await saveQueue(remainingInventory,opt.force,prioritySync,{hold:false});
        const ledger=await chatRetryLedger();
        const pendingState=await state({
          mode:'queued',projectDone:list.length,projectTotal:list.length,changed,lastSyncAt:Date.now(),
          queuedProjects:remainingInventory.length,prioritySync,pauseReason:'inventory-incomplete',error:'',
          failedChats:retryPileCount(ledger),nextAttemptAt:Date.now()+120000
        });
        schedule(120000);
        document.dispatchEvent(new CustomEvent('niakgpt:project-memory-partial',{detail:pendingState}));
        return {ok:true,partial:true,projects:list.length,changed,pendingInventory:remainingInventory.length,failedChats:retryPileCount(ledger)};
      }
      try { await chrome.storage.local.remove(QUEUE_KEY); } catch {}
      const historyCacheSignature=cachedBootstrapSignature(projects(await cache()));
      const ledger=await chatRetryLedger();
      const done = await state({ mode:'idle', projectDone:list.length, projectTotal:list.length, changed, lastSyncAt:Date.now(), historyCompletedAt:Date.now(), historyCacheSignature, prioritySync:false, failedChats:retryPileCount(ledger), lastTransientError:'', error:'',pauseReason:'' });
      document.dispatchEvent(new CustomEvent('niakgpt:project-memory-synced', { detail:done }));
      return { ok:true, projects:list.length, changed, failedChats:retryPileCount(ledger) };
    } catch (error) {
      const message=String(error && error.message || error);
      if(/^memory_sync_paused_(?:conversation|hidden|owner_change|busy|rate_limit|network)$/.test(message)){
        const reason=message.replace('memory_sync_paused_','');
        if(reason==='rate_limit'){
          let q={};try{q=(await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||{};}catch{}
          if(Array.isArray(q.pending)&&q.pending.length)await saveQueue(q.pending,q.force===true,q.priority===true,{hold:true,holdReason:'rate-limit-manual'});
          await queuedState('rate-limit-manual');
          clearTimeout(autoTimer);autoTimer=0;
          return {ok:false,paused:true,error:message,manualResume:true};
        }
        await queuedState(reason);
        schedule(reason==='network'?120000:(reason==='conversation'?WAKE_HEARTBEAT_MS:retryDelay(allowConversation,prioritySync)));
        return {ok:false,paused:true,error:message};
      }
      await state({ mode:'error', error:message.slice(0,260) });
      return { ok:false, error:message };
    } finally {
      syncing = false; syncAuto = false;
      try{
        const q=(await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||{};
        if(Array.isArray(q.pending)&&q.pending.length){
          if(q.hold!==true) schedule(backgroundDelay(conversationPage()&&backgroundHistoryAvailable===true,q.priority===true));
        } else prioritySync=false;
      }catch{prioritySync=false;}
    }
  }

  async function resume() {
    if (syncing || !autoOwner()) return;
    try {
      const q = (await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY], p = await prefs();
      if (!q?.pending?.length || q.hold===true || (!p.autoSync && q.priority!==true)) return;
      const allowConversation=conversationPage()&&await backgroundHistoryProbe(false);
      if (conversationPage()&&!allowConversation) { await queuedState('conversation'); schedule(WAKE_HEARTBEAT_MS); return; }
      if (peerBusy()) { await queuedState('peer-busy'); schedule(WAKE_HEARTBEAT_MS); return; }
      const priority=q.priority===true;
      if (busy(true,allowConversation,priority)) { schedule(retryDelay(allowConversation,priority)); return; }
      bootstrap({ force:q.force, projectIds:q.pending, auto:true, priority });
    } catch {}
  }

  async function schedule(delay) {
    clearTimeout(autoTimer);
    if (!autoOwner()) return;
    let initialQueue={};try{initialQueue=(await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||{};}catch{}
    const settings=await prefs();
    if(initialQueue.hold===true)return;
    if(!settings.autoSync&&initialQueue.priority!==true)return;
    const initialDelay=Number(delay ?? backgroundDelay(conversationPage()&&backgroundHistoryAvailable===true));
    autoTimer = setTimeout(async () => {
      if (!autoOwner() || syncing) return;
      let q={};try{q=(await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||{};}catch{}
      if(q.hold===true)return;
      const allowConversation=conversationPage()&&await backgroundHistoryProbe(false);
      if (conversationPage()&&!allowConversation) { await queuedState('conversation'); return schedule(WAKE_HEARTBEAT_MS); }
      if (peerBusy()) { await queuedState('peer-busy'); return schedule(WAKE_HEARTBEAT_MS); }
      const priority=q.priority===true;
      if (busy(true,allowConversation,priority)) return schedule(retryDelay(allowConversation,priority));
      const st = await send({ type:'niakgpt:memory-status-v132' });
      if (!st?.connected) return;
      bootstrap({ force:q.force===true, projectIds:Array.isArray(q.pending)&&q.pending.length?q.pending:undefined, auto:true, priority });
    }, initialDelay);
  }

  function currentPid() {
    const m = location.pathname.match(/\/g\/(g-p-[A-Za-z0-9_-]+)(?:\/project|\/c\/|$)/);
    return m ? normalizePid(m[1]) : '';
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

  function inject(ed) {
    if (!prefsReady || !prefsCache.injectOnNewChat || !contextProject || !contextText || !visible(ed)) return;
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
    if (r && r.ok) {
      await recoverVaultCatalog(true);
      const pending=await primeBootstrapQueue(false);
      let cached;
      try{cached=await writeCachedBootstrap({force:true});}
      catch(error){
        const message='cached_bootstrap_write_failed:'+String(error?.message||error).slice(0,180);
        await state({mode:'error',error:message,queuedProjects:pending.length});
        schedule(backgroundDelay());
        return Object.assign({},r,{bootstrapQueued:true,queuedProjects:pending.length,bootstrapWritten:false,bootstrapError:message});
      }
      await queuedState(conversationPage()?'conversation':peerBusy()?'peer-busy':'quiet');
      schedule(backgroundDelay());
      return Object.assign({},r,{bootstrapQueued:true,queuedProjects:pending.length,bootstrapWritten:true,bootstrapFiles:cached.files,bootstrapProjects:cached.projects});
    }
    return r;
  }

  async function githubLogin() {
    const runtime = chrome?.runtime;
    const authError = error => {
      const message = String(error?.message || error || 'github_auth_port_closed');
      return /Extension context invalidated/i.test(message)
        ? 'extension_context_invalidated_reload_required'
        : message.slice(0,260);
    };
    if (!runtime) return { ok:false, error:'extension_runtime_unavailable' };
    if (!runtime.id) return { ok:false, error:'extension_context_invalidated_reload_required' };
    if (!runtime.connect) {
      const fallback = await send({ type:'niakgpt:memory-github-login-v132' });
      if (fallback && fallback.ok) await state({mode:'github-ready',error:''});
      return fallback;
    }
    const r = await new Promise(resolve => {
      let settled=false,heartbeatTimer=0,deadlineTimer=0,port=null;
      const finish=value=>{
        if(settled)return;
        settled=true;
        clearTimeout(heartbeatTimer);
        clearTimeout(deadlineTimer);
        try{port?.disconnect();}catch{}
        resolve(value||{ok:false,error:'github_auth_port_closed'});
      };
      try{
        port=runtime.connect({name:'niakgpt:memory-github-login-v132'});
      }catch(error){
        finish({ok:false,error:authError(error)});
        return;
      }
      const heartbeat=()=>{
        if(settled)return;
        try{port.postMessage({type:'keepalive'});}
        catch(error){return finish({ok:false,error:authError(error)});}
        heartbeatTimer=setTimeout(heartbeat,20_000);
      };
      port.onMessage.addListener(message=>{if(message?.type==='result')finish(message.result);});
      port.onDisconnect.addListener(()=>{
        if(settled)return;
        let reason='github_auth_port_closed';
        try{reason=runtime.lastError?.message||reason;}catch{}
        finish({ok:false,error:authError(reason)});
      });
      deadlineTimer=setTimeout(()=>finish({ok:false,error:'github_auth_flow_timeout'}),GITHUB_AUTH_UI_TIMEOUT_MS);
      try{
        port.postMessage({type:'start'});
        heartbeatTimer=setTimeout(heartbeat,20_000);
      }catch(error){
        finish({ok:false,error:authError(error)});
      }
    });
    if (r && r.ok) await state({mode:'github-ready',error:''});
    return r;
  }

  async function githubRepositories() {
    return send({ type:'niakgpt:memory-github-repositories-v132' });
  }

  async function githubConnectRepo(options) {
    const r = await send(Object.assign({ type:'niakgpt:memory-github-connect-repo-v132' }, options || {}));
    if (r && r.ok) {
      const pending=await primeBootstrapQueue(false);
      let cached;
      try{cached=await writeCachedBootstrap({force:true});}
      catch(error){
        const message='cached_bootstrap_write_failed:'+String(error?.message||error).slice(0,180);
        await state({mode:'error',error:message,queuedProjects:pending.length});
        schedule(backgroundDelay());
        return Object.assign({},r,{bootstrapQueued:true,queuedProjects:pending.length,bootstrapWritten:false,bootstrapError:message});
      }
      await queuedState(conversationPage()?'conversation':peerBusy()?'peer-busy':'quiet');
      schedule(backgroundDelay());
      return Object.assign({},r,{bootstrapQueued:true,queuedProjects:pending.length,bootstrapWritten:true,bootstrapFiles:cached.files,bootstrapProjects:cached.projects});
    }
    return r;
  }

  async function githubLogout() {
    const r = await send({ type:'niakgpt:memory-github-logout-v132' });
    if (r && r.ok) {
      contextProject = ''; contextText = '';
      try { await chrome.storage.local.remove(QUEUE_KEY); } catch {}
      await state({mode:'disconnected',error:''});
    }
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
    try { local = await chrome.storage.local.get([STATE_KEY,PREFS_KEY,QUEUE_KEY]); } catch {}
    const queue=local[QUEUE_KEY]||{};
    return Object.assign({}, remote, {
      state:local[STATE_KEY] || {},
      prefs:Object.assign({},defaults,local[PREFS_KEY] || {}),
      queue:{
        pending:Array.isArray(queue.pending)?queue.pending.slice():[],force:queue.force===true,priority:queue.priority===true,
        retryAt:Number(queue.retryAt||0),deferredChats:Number(queue.deferredChats||0),at:Number(queue.at||0)
      }
    });
  }

  async function syncPriorityNow() {
    const remote=await send({type:'niakgpt:memory-status-v132'});
    if(!remote?.connected)return {ok:false,error:remote?.configured?'github_token_missing':'not_connected'};
    let pending=[];
    priorityKick=true;
    try{
      let q={};try{q=(await chrome.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||{};}catch{}
      pending=Array.isArray(q.pending)&&q.pending.length
        ? await saveQueue(q.pending,false,true)
        : await primeBootstrapQueue(false,true);
      prioritySync=true;
      await state({mode:'queued',prioritySync:true,priorityStartedAt:Date.now(),queuedProjects:pending.length,projectTotal:pending.length,pauseReason:'priority',error:''});
    } finally {
      priorityKick=false;
    }
    if(syncing)return {ok:true,priority:true,joined:true,queuedProjects:pending.length};
    // Explicit priority is a long-lived queue mode, not a long UI call. Let the normal
    // owner/lock scheduler start it once; this avoids a manual bootstrap racing the
    // storage-change resume path and keeps the settings button responsive.
    schedule(0);
    return {ok:true,priority:true,started:true,queuedProjects:pending.length};
  }

  async function syncNow(options={}) {
    const force=options.force===true;
    if(document.documentElement.dataset.ng90PeerBusy==='1'){
      const pending=await primeBootstrapQueue(force);
      try{
        const cached=await writeCachedBootstrap({force});
        await queuedState('peer-busy');schedule(backgroundDelay());
        return {ok:true,cachedOnly:true,historyDeferred:true,projects:cached.projects,files:cached.files,queuedProjects:pending.length};
      }catch(error){
        const message='cached_bootstrap_write_failed:'+String(error?.message||error).slice(0,180);
        await state({mode:'error',error:message,queuedProjects:pending.length});
        return {ok:false,error:message,cachedOnly:true,historyDeferred:true};
      }
    }
    if(conversationPage()){
      const pending=await primeBootstrapQueue(force);
      let cached,dom;
      try{
        cached=await writeCachedBootstrap({force});
        dom=await captureCurrentDomConversation(force);
      }catch(error){
        const message='cached_bootstrap_write_failed:'+String(error?.message||error).slice(0,180);
        await state({mode:'error',error:message,queuedProjects:pending.length});
        return {ok:false,error:message,cachedOnly:true,historyDeferred:true};
      }
      if(!await backgroundHistoryProbe(true)){
        await queuedState('conversation');schedule(backgroundDelay());
        return {ok:true,cachedOnly:true,historyDeferred:true,domCaptured:dom?.captured===true,projects:cached.projects,files:cached.files,queuedProjects:pending.length};
      }
      const full=await bootstrap({force,auto:false});
      return {...full,domCaptured:dom?.captured===true,cachedBootstrapFiles:cached.files,queuedProjects:pending.length};
    }
    return bootstrap({force,auto:false});
  }

  window.__NIAKGPT_PROJECT_MEMORY__ = {
    connect,
    githubLogin,
    githubRepositories,
    githubConnectRepo,
    githubLogout,
    disconnect,
    status,
    syncNow,
    syncPriorityNow,
    getPrefs:prefs,
    setPrefs,
    refreshContext,
    recoverVaultCatalog
  };

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

  const ownSurface = target => target instanceof Element && !!target.closest('#ng8-panel,#ng8-rail,#ng90-control,#ng100-command,#ng100-onboarding');
  const noteHuman = event => {
    if (event?.isTrusted === false || ownSurface(event?.target)) return;
    lastHumanAt=Date.now();
    if (syncAuto) clearTimeout(autoTimer);
  };
  document.addEventListener('pointerdown',noteHuman,true);
  document.addEventListener('keydown',noteHuman,true);
  document.addEventListener('wheel',noteHuman,{capture:true,passive:true});
  document.addEventListener('touchstart',noteHuman,{capture:true,passive:true});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CACHE_KEY]) ensureBootstrapQueued().catch(()=>[]).finally(()=>schedule(backgroundDelay(conversationPage()&&backgroundHistoryAvailable===true)));
    if (area === 'local' && changes[CONTEXT_KEY]) refreshContext();
    if (area === 'local' && changes[QUEUE_KEY]) {
      if(changes[QUEUE_KEY].newValue?.priority===true){
        prioritySync=true;
        if(!priorityKick&&autoOwner())schedule(0);
      } else if(autoOwner())resume();
    }
  });
  document.addEventListener('niakgpt:activity-changed', event => {
    const allowConversation=conversationPage()&&backgroundHistoryAvailable===true;
    if (event.detail?.active === true || busy(false,allowConversation)) { lastHumanAt=Date.now(); clearTimeout(autoTimer); schedule(backgroundDelay()); return; }
    scheduleDomCapture(650);
    schedule(backgroundDelay(allowConversation));
  });
  document.addEventListener('niakgpt:tab-role-changed', event => {
    if (event.detail && event.detail.role !== 'inactive' && !document.hidden) { resume(); schedule(backgroundDelay()); }
    else clearTimeout(autoTimer);
  });
  async function repairCachedBootstrapIfVisible() {
    if(document.hidden)return {ok:true,skipped:'hidden'};
    let pending=[];
    try{pending=await ensureBootstrapQueued();}catch{}
    if(!pending.length){scheduleDomCapture(700);return {ok:true,skipped:'empty'};}
    try{
      const cached=await writeCachedBootstrap();
      if(conversationPage())scheduleDomCapture(500);
      return cached;
    }
    catch(error){
      const message='cached_bootstrap_write_failed:'+String(error?.message||error).slice(0,180);
      await state({mode:'error',error:message,queuedProjects:pending.length});
      return {ok:false,error:message};
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      lastHumanAt=Date.now(); refreshContext();
      repairCachedBootstrapIfVisible().finally(()=>{resume();schedule(backgroundDelay());});
    }
  });

  function route() { clearTimeout(routeTimer); lastHumanAt=Date.now(); routeTimer = setTimeout(()=>{refreshContext();scheduleDomCapture(900);resume();schedule(backgroundDelay());},120); }
  window.addEventListener('popstate',route);
  if (window.navigation && window.navigation.addEventListener) window.navigation.addEventListener('navigatesuccess',route);
  window.addEventListener('pageshow',() => { lastHumanAt=Date.now(); refreshContext(); scheduleDomCapture(1200); resume(); schedule(backgroundDelay()); });

  prefs().finally(async() => {
    refreshContext();
    try{await recoverVaultCatalog(false);}catch{}
    let pending=[],bootstrapFailed=false;
    try{pending=await ensureBootstrapQueued();}catch{}
    if(pending.length&&!document.hidden){
      const repaired=await repairCachedBootstrapIfVisible();
      bootstrapFailed=repaired?.ok===false;
    }
    if(!bootstrapFailed){
      if (conversationPage()) await queuedState('conversation');
      else if(peerBusy())await queuedState('peer-busy');
    }
    scheduleDomCapture(1200);
    resume();
    schedule(backgroundDelay());
    wakeHeartbeat();
  });
})();