(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_RECLASSIFY_DEEP_112__)return;
  window.__NIAKGPT_RECLASSIFY_DEEP_112__=true;

  const CACHE_KEY='niakgpt-v08-cache',GOV_KEY='niakgpt-governance-v085',BASE_STATE='niakgpt-reclassify-v101-state',STATE_KEY='niakgpt-reclassify-deep-v112-state',LOCK='niakgpt-data-mutation-v100';
  const ANALYSIS_REQ='niakgpt:analysis-request-v112',ANALYSIS_RES='niakgpt:analysis-response-v112';
  const MAX_PER_RUN=2,MAX_HEAVY=1,RETRY_MS=6*60*60*1000,RECENT_MS=7*24*60*60*1000;
  let busy=false,timer=0,seq=0;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'");
  const hash=v=>{let h=2166136261;for(const c of String(v||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(36);};
  const tokens=v=>norm(v).split(/[^a-z0-9à-ÿ_-]+/i).filter(x=>x.length>3&&!/^(avec|sans|dans|pour|cette|chat|conversation|projet|project|nouveau|nouvelle|faire|plus|moins|probleme|problème|suite)$/.test(x));
  const currentCid=()=>location.pathname.match(/\/c\/([A-Za-z0-9_-]+)/)?.[1]||'';
  const heavy=()=>document.documentElement.dataset.ng8Heavy==='1';
  const conversationQuiet=()=>/(?:^|\/)c\/[A-Za-z0-9_-]+(?:$|[/?#])/.test(String(location.pathname||''))||document.documentElement.dataset.ng90PeerChatActive==='1';
  const can=()=>!conversationQuiet()&&!document.hidden&&document.documentElement.dataset.ng90Safe!=='1'&&document.documentElement.dataset.ng8Running!=='1'&&!['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'')&&Number(document.documentElement.dataset.ng100RateLimitedUntil||0)<=Date.now();
  const projectHrefPid=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)/i)?.[1]||'';
  const updatedMs=c=>{const n=Number(c?.updated||c?.update_time||c?.create_time||0);return n>1e12?n:n>1e9?n*1000:0;};
  const canonical=p=>p&&String(p.id||'').startsWith('g-p-')&&!p.domOnly&&clean(p.name);

  const ALIASES=[
    [/media|vid[eé]o|stream|provider|scrap|stremio/,['media','video','vidéo','tv','stream','streaming','provider','providers','manifest','stremio','scraper','source','vf','vostfr','device','desktop','mobile','android','television']],
    [/film|cin[eé]ma|s[eé]rie|anime|manga/,['film','cinema','cinéma','serie','série','anime','manga','acteur','actrice','episode','épisode','saison','spielberg','imdb']],
    [/tech|d[eé]veloppement|code|informatique/,['code','dev','github','action','workflow','javascript','typescript','python','php','api','chrome','extension','runtime','bug','test','tests','ci','css','html']],
    [/business|commerce|entreprise|boutique|e-?commerce|shop/,['business','shopify','ecommerce','e-commerce','boutique','commerce','marque','produit','marketing','seo','client']],
    [/jurid|admin|droit|prud/,['juridique','administratif','droit','justice','avocat','prudhom','licenciement','france travail','assurance','tribunal','recours']],
    [/maison|logement|habitat/,['maison','logement','appartement','travaux','toiture','devis','syndic','copropriété']],
    [/auto|voiture|automobile/,['voiture','auto','opel','moteur','courroie','garage','pneu','prêt auto']],
    [/perso|vie pratique|sant[eé]|famille/,['perso','famille','relation','santé','fatigue','chat','animal','maison']]
  ];
  function aliasKeys(project){const semantic=norm(`${project?.name||''} ${project?.description||''} ${project?.instructions||''}`);const out=[];for(const[rx,list]of ALIASES)if(rx.test(semantic))out.push(...list);return out;}
  function allChats(raw){const map=new Map();const add=(c,p='')=>{if(!c?.id)return;const old=map.get(c.id)||{};map.set(c.id,{...old,...c,projectId:p||c.projectId||old.projectId||projectHrefPid(c.href)||''});};for(const c of raw?.chats||[])add(c);for(const[p,list]of Object.entries(raw?.projectChats||{}))for(const c of list||[])add(c,p);return[...map.values()];}
  function profiles(projects,chats){
    const out=new Map(projects.map(p=>[p.id,new Map()]));
    const bump=(id,text,w)=>{const m=out.get(id);if(!m)return;for(const t of tokens(text))m.set(t,(m.get(t)||0)+w);};
    for(const p of projects)bump(p.id,`${p.name||''} ${p.description||''} ${p.instructions||''}`,6);
    for(const c of chats){bump(c.projectId,c.title||'',3);bump(c.projectId,c.snippet||'',1);}
    return out;
  }
  function scoreText(text,project,profile){
    const n=norm(text),pn=norm(project.name),tt=new Set(tokens(text));let score=0;
    if(pn.length>3&&n.includes(pn))score+=520;
    for(const t of tokens(project.name))if(tt.has(t))score+=95;
    let aliases=0;for(const key of aliasKeys(project))if(n.includes(norm(key)))aliases++;if(aliases)score+=110+Math.min(260,(aliases-1)*52);
    let learned=0;for(const t of tt)learned+=Math.min(45,profile?.get(t)||0);score+=Math.min(280,learned);
    return score;
  }
  function rank(text,projects,prof){const r=projects.map(p=>({project:p,score:scoreText(text,p,prof.get(p.id))})).sort((a,b)=>b.score-a.score),a=r[0],b=r[1];return a?{...a,margin:a.score-(b?.score||0),second:b?.score||0}:null;}
  function confident(hit,depth){if(!hit)return false;const minScore=depth===0?150:depth===1?125:110,minMargin=depth===0?42:depth===1?34:28;return hit.score>=minScore&&hit.margin>=minMargin;}

  function normalRpc(path,{method='GET',body=null,timeout=15000}={}){const id=`ng112d-${Date.now()}-${++seq}`;return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));});}
  function analysisRpc(chatId,timeout=22000){const id=`ng112a-${Date.now()}-${++seq}`;return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'analysis_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener(ANALYSIS_RES,h);};document.addEventListener(ANALYSIS_RES,h);document.dispatchEvent(new CustomEvent(ANALYSIS_REQ,{detail:{id,path:`/backend-api/conversation/${encodeURIComponent(chatId)}`,purpose:'classification'}}));});}
  async function move(chatId,target){const r=await normalRpc(`/backend-api/conversation/${encodeURIComponent(chatId)}`,{method:'PATCH',body:{gizmo_id:target||null}});return !!r.ok;}
  function apply(raw,chatId,target){
    raw.chats=Array.isArray(raw.chats)?raw.chats:[];const row=raw.chats.find(c=>c?.id===chatId);const from=row?.projectId||'';if(row)row.projectId=target||'';
    if(raw.projectChats&&typeof raw.projectChats==='object'){
      let item=row?{...row}:null;for(const[pid,list]of Object.entries(raw.projectChats)){const i=(list||[]).findIndex(c=>c?.id===chatId);if(i>=0){item={...list[i],projectId:target||''};list.splice(i,1);}raw.counts??={};raw.counts[pid]=(list||[]).length;}
      if(item&&target){raw.projectChats[target]??=[];if(!raw.projectChats[target].some(c=>c?.id===chatId))raw.projectChats[target].push(item);raw.counts[target]=raw.projectChats[target].length;}
    }else if(raw.counts){if(from&&raw.counts[from]!=null)raw.counts[from]=Math.max(0,(Number(raw.counts[from])||0)-1);if(target&&target!==from&&raw.counts[target]!=null)raw.counts[target]=(Number(raw.counts[target])||0)+1;}
    raw.at=Date.now();
  }
  function continuationPendingFor(chatId){
    try{const p=JSON.parse(sessionStorage.getItem('niakgpt-continuity-pending-v100')||'null');if(!p||Date.now()-Number(p.createdAt||0)>30*60*1000)return false;return chatId===currentCid()&&chatId!==p.chatId&&!!p.projectId;}catch{return false;}
  }
  function candidateText(chat){return clean(`${chat.title||''}\n${chat.snippet||''}`);}
  function progressive(chat,summary,projects,prof){
    let text=candidateText(chat),hit=rank(text,projects,prof);if(confident(hit,0))return{hit,depth:0,textChars:text.length};
    const messages=Array.isArray(summary?.messages)?summary.messages:[],ordered=[...messages];const firstUser=ordered.findIndex(m=>m?.role==='user');if(firstUser>0){const m=ordered.splice(firstUser,1)[0];ordered.unshift(m);}
    let depth=0;for(const m of ordered.slice(0,7)){const body=clean(m?.text);if(!body)continue;depth++;text=`${text}\n${m.role==='user'?'USER':'ASSISTANT'}: ${body}`.slice(0,9000);hit=rank(text,projects,prof);if(confident(hit,depth))return{hit,depth,textChars:text.length};}
    return{hit,depth,textChars:text.length};
  }
  async function persist(raw,state){
    try{const bus=window.__NIAKGPT_CACHE_BUS__;if(bus?.update)await bus.update(()=>raw);else await chrome.storage.local.set({[CACHE_KEY]:raw});await chrome.storage.local.set({[STATE_KEY]:state});}catch{}
  }
  async function run(){
    if(busy||!can())return;busy=true;
    try{
      const got=await chrome.storage.local.get([CACHE_KEY,GOV_KEY,BASE_STATE,STATE_KEY]),raw=got[CACHE_KEY];if(!raw)return;const gov=got[GOV_KEY]||{};if(gov.autoResync===false)return;
      const projects=(raw.projects||[]).filter(canonical),byId=new Map(projects.map(p=>[p.id,p])),core=(gov.coreProjectIds||[]).map(id=>byId.get(id)).filter(Boolean),targets=core.length?core:projects;if(!targets.length)return;
      const chats=allChats(raw),base=got[BASE_STATE]||{},attempts=base.attempts||{},locks=gov.locks||{},prof=profiles(targets,chats);let state=got[STATE_KEY];if(!state||state.schema!==2)state={schema:2,checked:{}};state.checked=state.checked||{};
      const now=Date.now();
      const queue=chats.filter(c=>{
        if(!c?.id||locks[c.id]||continuationPendingFor(c.id))return false;
        const previous=state.checked[c.id];if(previous?.status==='orphan-detached'&&now-Number(previous.at||0)<RETRY_MS)return false;
        const pid=clean(c.projectId),orphan=!!pid&&!byId.has(pid),ambiguous=attempts[c.id]?.status==='ambiguous'||previous?.status==='ambiguous',recent=!pid&&updatedMs(c)&&now-updatedMs(c)<=RECENT_MS;
        return orphan||ambiguous||recent;
      }).sort((a,b)=>{const ao=!!a.projectId&&!byId.has(a.projectId),bo=!!b.projectId&&!byId.has(b.projectId);return Number(bo)-Number(ao)||updatedMs(b)-updatedMs(a);});
      let processed=0,moved=0,detached=0,ambiguous=0,analysisCalls=0;const limit=heavy()?MAX_HEAVY:MAX_PER_RUN;
      for(const chat of queue){
        if(processed>=limit||!can())break;
        const orphan=!!chat.projectId&&!byId.has(chat.projectId),sig=hash(`${chat.id}|${chat.title||''}|${chat.snippet||''}|${targets.map(p=>`${p.id}:${p.name}`).join('|')}`),prev=state.checked[chat.id];
        if(prev?.sig===sig&&prev.status==='ambiguous'&&now-Number(prev.at||0)<RETRY_MS){ambiguous++;continue;}
        processed++;
        let hit=rank(candidateText(chat),targets,prof),depth=0;
        if(!confident(hit,0)){
          const ar=await analysisRpc(chat.id);analysisCalls++;
          if(ar.ok){const p=progressive(chat,ar.data,targets,prof);hit=p.hit;depth=p.depth;}else if(ar.error==='analysis_paused_busy'){break;}
        }
        if(confident(hit,depth)&&can()&&await move(chat.id,hit.project.id)){
          apply(raw,chat.id,hit.project.id);delete state.checked[chat.id];moved++;
        }else if(orphan&&can()&&await move(chat.id,'')){
          apply(raw,chat.id,'');state.checked[chat.id]={sig,at:Date.now(),status:'orphan-detached',score:hit?.score||0,margin:hit?.margin||0,depth};detached++;
        }else{
          state.checked[chat.id]={sig,at:Date.now(),status:'ambiguous',score:hit?.score||0,margin:hit?.margin||0,depth};ambiguous++;
        }
      }
      if(processed||moved||detached)await persist(raw,state);
      const remaining=allChats(raw).filter(c=>{const pid=clean(c.projectId),orphan=!!pid&&!byId.has(pid),unassignedAmbiguous=!pid&&(attempts[c.id]?.status==='ambiguous'||state.checked[c.id]?.status==='ambiguous');return orphan||unassignedAmbiguous;}).length;
      window.__NIAKGPT_DIAGNOSTICS__?.set('deep-classement',moved||detached?`OK · ${moved} classé(s) · ${detached} orphelin(s) détaché(s) · ${analysisCalls} analyse(s) profonde(s)`:`${remaining?'ATTENTE':'OK'} · ${remaining} ambigu/orphelin · ${analysisCalls} analyse(s) profonde(s)`);
      if(queue.length>processed&&can())schedule(heavy()?5500:2600);
    }catch(error){window.__NIAKGPT_DIAGNOSTICS__?.set('deep-classement',`ERREUR · ${String(error?.message||error).slice(0,80)}`);}finally{busy=false;}
  }
  async function lockedRun(){if(navigator.locks?.request){let acquired=false;await navigator.locks.request(LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)return;acquired=true;await run();});if(!acquired&&can())schedule(1400);return;}return run();}
  function schedule(delay=1800){clearTimeout(timer);timer=setTimeout(()=>lockedRun(),delay);}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes[CACHE_KEY]||changes[BASE_STATE]||changes[GOV_KEY]))schedule(1500);});
  document.addEventListener('niakgpt:activity-changed',e=>{if(e.detail?.active===false||document.documentElement.dataset.ng86Activity==='ready')schedule(1900);});
  document.addEventListener('niakgpt:server-index-complete',()=>schedule(1200));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(2200);});
  schedule(3200);
})();