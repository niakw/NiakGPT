(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_RECLASSIFY_101__) return;
  window.__NIAKGPT_RECLASSIFY_101__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const GOV_KEY='niakgpt-governance-v085';
  const STATE_KEY='niakgpt-reclassify-v101-state';
  const LOCK_NAME='niakgpt-reclassify-v101';
  const QUEUE_NAMES=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  const LEGACY=new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc','work','education','health','finance','home','cars','gaming','movies','food','personal development','studio','research lab']);
  const SUSPECT=/^(test|tests|demo|sandbox|temp|temporary|tmp|untitled|nouveau projet|new project)(\b|\s|[-_])/i;
  const STOP=new Set(('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont a à the and or of to for in on with from chat conversation projet project faire fais moi peux peut comment pourquoi quoi cela cette ceci avoir etre être besoin voudrais veux faudrait faut problème probleme question réponse reponse nouveau nouvelle').split(/\s+/));
  const BASE=[
    {name:'Business & Projets',keys:['business','entreprise','société','societe','client','clients','ecommerce','e-commerce','shopify','vente','commercial','marketing','seo','sea','ads','publicité','publicite','marketplace','budget','marge','produit','marque']},
    {name:'Tech & Développement',keys:['code','dev','développement','developpement','github','api','chrome','extension','javascript','typescript','python','php','sql','docker','tauri','provider','plugin','bug','runtime','serveur','hosting','hébergement','hebergement']},
    {name:'Administratif & Juridique',keys:['juridique','justice','avocat','prudhom','prud’hom','plainte','contrat','droit','assurance','impôt','impot','france travail','chômage','chomage','licenciement','administratif','copropriété','copropriete','syndic']},
    {name:'Création & Contenu',keys:['image','visuel','design','logo','vidéo','video','youtube','vimeo','texte','rédaction','redaction','description','titre','affiche','photo','contenu']},
    {name:'Perso & Vie pratique',keys:['famille','mariage','voiture','auto','santé','sante','fatigue','maison','crédit','credit','mutuelle','voyage','relation','personnel','animal','animaux','félin','felin']},
    {name:'Recherche & Références',keys:['recherche','comparatif','alternative','documentation','source','étude','etude','analyse','prix','tarif','avis','film','cinéma','cinema','anime','blu ray','bluray']}
  ];
  const BATCH=8;
  const COOLDOWN=30*60*1000;

  let timer=0,busy=false,rpcSeq=0;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'");
  const words=v=>norm(v).replace(/[^a-z0-9à-ÿ_-]+/gi,' ').split(/\s+/).filter(x=>x.length>2&&!STOP.has(x));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const role=()=>document.documentElement.dataset.ng8TabRole||'unknown';
  const running=()=>document.documentElement.dataset.ng8Running==='1'||['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'');
  const canAutomate=()=>role()==='worker'&&!document.hidden&&!running()&&document.documentElement.dataset.ng8Heavy!=='1'&&document.documentElement.dataset.ng90Safe!=='1';
  const isQueue=p=>!!p&&QUEUE_NAMES.has(norm(p.name));
  const hash=value=>{let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(36);};

  function rpc(path,{method='GET',body=null,timeout=16000}={}){
    const id=`ng101-reclass-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timeoutId=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const handler=event=>{if(event.detail?.id!==id)return;cleanup();resolve(event.detail);};
      const cleanup=()=>{clearTimeout(timeoutId);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }

  async function loadCache(){
    try{const bus=window.__NIAKGPT_CACHE_BUS__,raw=bus?await bus.get():(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];return raw&&typeof raw==='object'?structuredClone(raw):null;}catch{return null;}
  }
  async function loadGovernance(){try{return (await chrome.storage.local.get(GOV_KEY))[GOV_KEY]||{};}catch{return {};}}
  async function loadState(){try{return (await chrome.storage.local.get(STATE_KEY))[STATE_KEY]||{attempts:{}};}catch{return{attempts:{}};}}
  async function saveState(state){try{await chrome.storage.local.set({[STATE_KEY]:state});}catch{}}
  function uniqueChats(raw){
    const map=new Map();
    const ingest=(c,pid='')=>{if(!c?.id)return;const old=map.get(c.id)||{};map.set(c.id,{...old,...c,projectId:pid||c.projectId||old.projectId||''});};
    for(const c of raw?.chats||[])ingest(c);
    for(const [pid,list] of Object.entries(raw?.projectChats||{}))for(const c of list||[])ingest(c,pid);
    return[...map.values()];
  }
  function candidateIds(raw,gov,queueIds){
    const projects=new Map((raw.projects||[]).map(p=>[p.id,p]));
    const valid=id=>{const p=projects.get(id),name=norm(p?.name);return !!p&&!queueIds.has(id)&&!LEGACY.has(name)&&!SUSPECT.test(name);};
    const configured=(gov.coreProjectIds||[]).filter(valid);
    return configured.length?configured:[...projects.values()].filter(p=>valid(p.id)).map(p=>p.id);
  }
  function buildProfiles(raw,ids){
    const projects=new Map((raw.projects||[]).map(p=>[p.id,p])),profiles=new Map();
    const add=(profile,text,weight)=>{for(const token of words(text))profile.set(token,(profile.get(token)||0)+weight);};
    for(const id of ids){const p=projects.get(id);if(!p)continue;const profile=new Map();add(profile,p.name,40);add(profile,p.description,12);add(profile,p.instructions,10);profiles.set(id,profile);}
    for(const c of uniqueChats(raw)){const profile=profiles.get(c.projectId);if(profile)add(profile,`${c.title||''} ${c.snippet||''}`,3);}
    return{projects,profiles};
  }
  function baseBoost(text,project){
    const target=BASE.find(base=>norm(base.name)===norm(project.name));if(!target)return 0;
    let hits=0;for(const key of target.keys)if(text.includes(norm(key)))hits++;
    return hits?80+Math.min(160,(hits-1)*32):0;
  }
  function scoreChat(chat,project,profile){
    const text=norm(`${chat.title||''} ${chat.snippet||''}`);if(!text)return 0;
    const pn=norm(project.name),tokens=new Set(words(text));let score=baseBoost(text,project);
    if(pn.length>=4&&text.includes(pn))score+=320;
    for(const token of words(project.name))if(tokens.has(token))score+=58;
    for(const token of tokens)score+=Math.min(28,profile?.get(token)||0);
    return score;
  }
  function bestTarget(chat,ids,model){
    const ranked=[];for(const id of ids){const project=model.projects.get(id);if(!project)continue;ranked.push({project,score:scoreChat(chat,project,model.profiles.get(id))});}
    ranked.sort((a,b)=>b.score-a.score);const first=ranked[0],second=ranked[1];return first?{...first,margin:first.score-(second?.score||0)}:null;
  }
  function extractConversationText(data){
    const chunks=[];
    for(const node of Object.values(data?.mapping||{})){
      const message=node?.message;if(!message)continue;const roleName=message.author?.role||'';if(roleName!=='user')continue;
      for(const part of message.content?.parts||[]){if(typeof part==='string')chunks.push(part);else if(typeof part?.text==='string')chunks.push(part.text);}
    }
    return clean(chunks.join(' ')).slice(0,4500);
  }
  async function enrich(chat){
    const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chat.id)}`,{timeout:14000});if(!r.ok)return chat;
    const text=extractConversationText(r.data);return text?{...chat,snippet:text}:chat;
  }
  async function verifyDestination(chatId,targetId){
    for(let i=0;i<3;i++){const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{timeout:12000});if(r.ok){const got=clean(r.data?.gizmo_id||r.data?.conversation_mode?.gizmo_id||'');if(got===targetId)return true;}await sleep(260*(i+1));}return false;
  }
  async function move(chatId,targetId){
    const r=await rpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{gizmo_id:targetId},timeout:14000});return !!r.ok&&verifyDestination(chatId,targetId);
  }
  function updateCachedChat(raw,id,patch){
    const chat=(raw.chats||[]).find(c=>c.id===id);if(chat)Object.assign(chat,patch);
    for(const list of Object.values(raw.projectChats||{})){const item=(list||[]).find(c=>c.id===id);if(item)Object.assign(item,patch);}
  }
  function applyMove(raw,chatId,targetId){
    const chat=(raw.chats||[]).find(c=>c.id===chatId),from=chat?.projectId||'';if(chat)chat.projectId=targetId;
    if(raw.projectChats&&typeof raw.projectChats==='object'){
      let found=chat?{...chat}:null;
      for(const [pid,list] of Object.entries(raw.projectChats)){const idx=(list||[]).findIndex(c=>c.id===chatId);if(idx>=0){found={...list[idx],projectId:targetId};list.splice(idx,1);}raw.counts??={};raw.counts[pid]=(list||[]).length;}
      if(found){raw.projectChats[targetId]??=[];if(!raw.projectChats[targetId].some(c=>c.id===chatId))raw.projectChats[targetId].push({...found,projectId:targetId});raw.counts[targetId]=raw.projectChats[targetId].length;}
    }else{
      raw.counts??={};if(from&&Number.isFinite(Number(raw.counts[from])))raw.counts[from]=Math.max(0,Number(raw.counts[from])-1);if(targetId&&targetId!==from&&Number.isFinite(Number(raw.counts[targetId])))raw.counts[targetId]=Number(raw.counts[targetId])+1;
    }
  }
  async function sanitizeGovernance(gov,queueIds){
    const before=gov.coreProjectIds||[],after=before.filter(id=>!queueIds.has(id));if(after.length===before.length)return gov;
    const next={...gov,coreProjectIds:after};try{await chrome.storage.local.set({[GOV_KEY]:next});}catch{}return next;
  }
  function diagnostic(text,error=false){
    window.__NIAKGPT_DIAGNOSTICS__?.set('reclassement',text);
    document.documentElement.dataset.ng101Reclassify=error?'error':'ok';
  }

  async function runOnce(){
    if(busy||!canAutomate())return;busy=true;
    try{
      const raw=await loadCache();if(!raw)return;
      const queueIds=new Set((raw.projects||[]).filter(isQueue).map(p=>p.id));if(!queueIds.size){diagnostic('OK · aucune file À classer');return;}
      let gov=await loadGovernance();gov=await sanitizeGovernance(gov,queueIds);
      const ids=candidateIds(raw,gov,queueIds);if(!ids.length){diagnostic('ATTENTE · aucun Project cible');return;}
      const model=buildProfiles(raw,ids),locks=gov.locks||{},queue=uniqueChats(raw).filter(c=>queueIds.has(c.projectId)&&!locks[c.id]);
      if(!queue.length){diagnostic('OK · À classer vide ou protégé');return;}

      const state=await loadState();state.attempts=state.attempts||{};
      const modelSig=hash(ids.map(id=>`${id}:${model.projects.get(id)?.name||''}:${raw.counts?.[id]||0}`).join('|'));
      let processed=0,moved=0,cacheChanged=false;

      for(const chat of queue){
        if(processed>=BATCH||!canAutomate())break;
        const initialSig=hash(`${modelSig}|${chat.id}|${chat.title||''}|${String(chat.snippet||'').slice(0,1200)}`),previous=state.attempts[chat.id];
        if(previous?.sig===initialSig&&Date.now()-(previous.at||0)<COOLDOWN)continue;
        processed++;

        let candidate=bestTarget(chat,ids,model),working=chat;
        if(!candidate||candidate.score<62||candidate.margin<18){
          working=await enrich(chat);
          if(working.snippet&&working.snippet!==chat.snippet){updateCachedChat(raw,chat.id,{snippet:working.snippet.slice(0,1200)});cacheChanged=true;}
          candidate=bestTarget(working,ids,model);
        }
        const finalSig=hash(`${modelSig}|${working.id}|${working.title||''}|${String(working.snippet||'').slice(0,1200)}`);
        state.attempts[chat.id]={sig:finalSig,at:Date.now(),score:candidate?.score||0,margin:candidate?.margin||0};

        if(candidate&&candidate.score>=62&&candidate.margin>=18&&canAutomate()){
          if(await move(chat.id,candidate.project.id)){applyMove(raw,chat.id,candidate.project.id);delete state.attempts[chat.id];moved++;cacheChanged=true;}
        }
        await sleep(120);
      }

      const stillQueued=new Set(uniqueChats(raw).filter(c=>queueIds.has(c.projectId)).map(c=>c.id));
      for(const id of Object.keys(state.attempts))if(!stillQueued.has(id))delete state.attempts[id];
      state.updatedAt=Date.now();await saveState(state);
      if(cacheChanged){raw.at=Date.now();await chrome.storage.local.set({[CACHE_KEY]:raw});}
      const remaining=uniqueChats(raw).filter(c=>queueIds.has(c.projectId)).length;
      diagnostic(`OK · ${moved} reclassé${moved===1?'':'s'} · ${remaining} restant${remaining===1?'':'s'}`);
      if(processed>=BATCH&&remaining) schedule(2400);
    }catch(error){diagnostic(`ERREUR · ${String(error?.message||error).slice(0,100)}`,true);}
    finally{busy=false;}
  }

  async function runLocked(){
    if(!canAutomate())return;
    if(!navigator.locks?.request){await runOnce();return;}
    await navigator.locks.request(LOCK_NAME,{mode:'exclusive',ifAvailable:true},async lock=>{if(lock)await runOnce();});
  }
  function schedule(delay=1400){clearTimeout(timer);if(document.documentElement.dataset.ng90Safe==='1')return;timer=setTimeout(()=>{timer=0;runLocked();},delay);}

  const stateObserver=new MutationObserver(records=>{if(records.some(r=>['data-ng8-tab-role','data-ng8-running','data-ng8-heavy','data-ng90-safe','data-ng86-activity'].includes(r.attributeName)))schedule(1700);});
  stateObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-ng8-tab-role','data-ng8-running','data-ng8-heavy','data-ng90-safe','data-ng86-activity']});
  document.addEventListener('niakgpt:tab-role-changed',()=>schedule(1000));
  document.addEventListener('niakgpt:settings-changed',()=>schedule(1800));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(1200);});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes[CACHE_KEY]||changes[GOV_KEY]))schedule(2200);});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);stateObserver.disconnect();},{once:true});
  schedule(6500);
})();
