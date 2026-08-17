(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_RECLASSIFY_101__)return;
  window.__NIAKGPT_RECLASSIFY_101__=true;
  const CACHE_KEY='niakgpt-v08-cache',GOV_KEY='niakgpt-governance-v085',STATE_KEY='niakgpt-reclassify-v101-state',LOCK_NAME='niakgpt-data-mutation-v100';
  const QUEUE_NAMES=new Set(['a classer','hors projet / a classer','hors projet/a classer','unclassified','to classify']);
  const BASE=[
    ['Business & Projets',['business','entreprise','société','societe','client','ecommerce','e-commerce','shopify','vente','commercial','marketing','seo','sea','ads','publicité','marketplace','budget','marge','produit','marque']],
    ['Tech & Développement',['code','dev','développement','developpement','github','api','chrome','extension','javascript','typescript','python','php','sql','docker','provider','plugin','bug','runtime','serveur','hébergement','chatgpt']],
    ['Administratif & Juridique',['juridique','justice','avocat','prudhom','plainte','contrat','droit','assurance','impôt','france travail','chômage','licenciement','administratif','copropriété','syndic']],
    ['Création & Contenu',['image','visuel','design','logo','vidéo','youtube','vimeo','texte','rédaction','description','titre','affiche','photo','contenu']],
    ['Perso & Vie pratique',['famille','mariage','voiture','auto','santé','fatigue','maison','crédit','mutuelle','voyage','relation','personnel','animal','animaux','félin']],
    ['Recherche & Références',['recherche','comparatif','alternative','documentation','source','étude','analyse','prix','tarif','avis','film','cinéma','anime','blu ray','bluray']]
  ];
  const BATCH=8,CONFIDENCE=58,MARGIN=16,ENRICH_CONFIDENCE=24,ENRICH_MARGIN=5,AMBIG_COOLDOWN=60*1000,FAIL_COOLDOWN=45*1000,MATURITY_MS=8000,RECENT_CATCHUP_MS=72*60*60*1000,STATE_SCHEMA=7;let busy=false,timer=0,rpcSeq=0;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim(),norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'");
  const rxesc=v=>String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),hasTerm=(text,key)=>{const k=norm(key);return !!k&&new RegExp(`(^|[^\\p{L}\\p{N}])${rxesc(k)}(?=$|[^\\p{L}\\p{N}])`,'u').test(text);};
  const LEARN_STOP=new Set('avec sans dans pour sur sous entre vers chez mais donc car que qui quoi dont comme cette cette ceci cela les des une un du de la le et ou au aux mon ma mes ton ta tes son sa ses nos vos leur leurs est sont ete être etre avoir faire fait plus moins tres très chat chats conversation conversations projet projects project nouveau nouvelle question reponse réponse aide besoin probleme problemes problème problèmes'.split(/\s+/).map(norm));
  const stemToken=v=>{let t=norm(v).replace(/[^a-z0-9_-]+/g,'');if(t.length>5&&/[sx]$/.test(t))t=t.slice(0,-1);return t;};
  const learnTokens=v=>new Set(norm(v).split(/[^a-z0-9_-]+/).map(stemToken).filter(t=>t.length>3&&!LEARN_STOP.has(t)));
  function buildLearnedProfiles(targets,chats){
    const ids=new Set(targets.map(p=>p.id)),raw=new Map(targets.map(p=>[p.id,new Map()]));
    const bump=(id,text,weight)=>{const m=raw.get(id);if(!m)return;for(const t of learnTokens(text))m.set(t,(m.get(t)||0)+weight);};
    for(const p of targets)bump(p.id,`${p.name||''} ${p.description||''} ${p.instructions||''}`,4);
    for(const c of chats){if(!ids.has(c.projectId))continue;bump(c.projectId,c.title||'',3);bump(c.projectId,c.snippet||'',1);}
    const df=new Map();for(const [id,m] of raw)for(const token of m.keys()){let set=df.get(token);if(!set)df.set(token,set=new Set());set.add(id);}
    const profiles=new Map();for(const [id,m] of raw){const out=new Map();for(const [token,freq] of m){const n=df.get(token)?.size||1,idf=n===1?22:n===2?12:n===3?7:3;out.set(token,Math.min(52,idf+Math.min(6,freq)*5));}profiles.set(id,out);}return profiles;
  }

  const PROJECT_ALIASES=[
    [/niakvio|nuvio|stream|provider/,['niakvio','nuvio','provider','providers','stream','streaming','manifest','manifeste','vf','vostfr','scraper','scraping','source','flux','addon','stremio']],
    [/film|cin[eé]ma|s[eé]rie|anime|manga|comics?|marvel|dc/,['film','films','cinema','cinéma','serie','série','series','séries','anime','manga','acteur','actrice','realisateur','réalisateur','marvel','dc','comics','episode','épisode','saison']],
    [/analys|r[eé]flexion|philo|cogn|science|soci[eé]t[eé]/,['analyse','analyser','réflexion','reflexion','philosophie','psychologie','cognition','cognitif','science','société','societe','histoire','humanité','humanite','maslow','intelligence']],
    [/tech|d[eé]veloppement|code|informatique/,['script','scripts','code','dev','développement','developpement','javascript','typescript','python','php','sql','css','html','github','api','chrome','extension','bug','runtime','provider','plugin','android','ios','mac','windows','bluetooth','ordinateur','pc','web','serveur','hébergement','hebergement']],
    [/business|projet|commerce|entreprise/,['business','projet','projets','entreprise','ecommerce','e-commerce','shopify','site','marque','produit','vente','marketing','seo','client','miorra','eitty','elias']],
    [/jurid|admin|droit|prud/,['juridique','administratif','droit','justice','avocat','prudhom','prud’homme',"prud'homme",'licenciement','contrat','france travail','chomage','chômage','assurance','banque','impot','impôt','plainte','tribunal','recours']],
    [/cr[eé]ation|contenu|design/,['création','creation','contenu','design','logo','image','visuel','photo','video','vidéo','rédaction','redaction','texte','affiche']],
    [/recherche|r[eé]f[eé]rence|documentation/,['recherche','référence','reference','source','sources','documentation','comparatif','étude','etude','prix','tarif','avis']],
    [/perso|vie pratique|sant[eé]|famille/,['perso','personnel','vie','famille','relation','amour','amitié','amitie','santé','sante','psy','fatigue','animal','animaux','félin','felin','mariage']],
    [/maison|logement|habitat/,['maison','logement','appartement','copropriété','copropriete','syndic','travaux','bricolage','meuble','mobilier','jardin','électricité','electricite','eau','énergie','energie']],
    [/^(auto|automobile|voiture)(?:\b|\s|&)/,['voiture','auto','automobile','opel','peugeot','citroen','citroën','renault','moteur','courroie','garage','pneu','pneus','entretien','vidange','carburant']],
    [/^(travail|emploi|carri[eè]re)(?:\b|\s|&)/,['travail','emploi','boulot','bureau','collègue','collegue','collègues','collegues','patron','manager','carrière','carriere','cv','recrutement','entretien professionnel','poste','salaire']]
  ];
  function aliasKeys(project){const pn=norm(project?.name);const out=[];for(const [rx,keys] of PROJECT_ALIASES)if(rx.test(pn))out.push(...keys);return out;}
  const ratePaused=()=>Number(document.documentElement.dataset.ng100RateLimitedUntil||0)>Date.now();
  const heavy=()=>document.documentElement.dataset.ng8Heavy==='1';const can=()=>!ratePaused()&&!document.hidden&&!document.documentElement.dataset.ng100Recovery&&document.documentElement.dataset.ng8Running!=='1'&&!['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity||'')&&document.documentElement.dataset.ng90Safe!=='1';
  const isQueue=p=>QUEUE_NAMES.has(norm(p?.name));const sleep=ms=>new Promise(r=>setTimeout(r,ms));const hash=v=>{let h=2166136261;for(const c of String(v||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(36);};
  function rpc(path,{method='GET',body=null,timeout=15000}={}){const id=`ng101r-${Date.now()}-${++rpcSeq}`;return new Promise(resolve=>{const t=setTimeout(()=>{off();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout),h=e=>{if(e.detail?.id!==id)return;off();resolve(e.detail);},off=()=>{clearTimeout(t);document.removeEventListener('niakgpt:rpc-response',h);};document.addEventListener('niakgpt:rpc-response',h);document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));});}
  function allChats(raw){const map=new Map();const add=(c,p='')=>{if(!c?.id)return;const old=map.get(c.id)||{};map.set(c.id,{...old,...c,projectId:p||c.projectId||old.projectId||''});};for(const c of raw.chats||[])add(c);for(const [p,list] of Object.entries(raw.projectChats||{}))for(const c of list||[])add(c,p);return[...map.values()];}
  const projectIdFromHref=h=>String(h||'').match(/\/g\/(g-p-[^/?#]+)\/c\//i)?.[1]||'';
  const chatUpdatedMs=c=>{const raw=Number(c?.updated||c?.update_time||c?.create_time||0);return raw>1e12?raw:(raw>1e9?raw*1000:0);};
  const recentUnassigned=c=>{if(clean(c?.projectId)||projectIdFromHref(c?.href))return false;const at=chatUpdatedMs(c);return !!at&&Date.now()-at>=0&&Date.now()-at<=RECENT_CATCHUP_MS;};
  const needsClassification=(c,queueIds)=>queueIds.has(c?.projectId)||recentUnassigned(c);
  function score(chat,project,profile){const text=norm(`${chat.title||''} ${chat.snippet||''}`),pn=norm(project.name);let s=0;if(pn.length>3&&text.includes(pn))s+=320;const base=BASE.find(([n])=>norm(n)===pn);let h=0;if(base)for(const k of base[1])if(hasTerm(text,k))h++;for(const k of aliasKeys(project))if(hasTerm(text,k))h++;if(h)s+=92+Math.min(210,(h-1)*34);const titleTokens=learnTokens(chat.title||''),tokens=learnTokens(`${chat.title||''} ${chat.snippet||''}`);for(const t of learnTokens(project.name||''))if(tokens.has(t))s+=64;let learned=0;for(const t of tokens){const w=profile?.get(t)||0;if(w)learned+=w*(titleTokens.has(t)?1.35:1);}s+=Math.min(190,Math.round(learned));return s;}
  function pick(chat,targets,profiles){const ranked=targets.map(p=>({p,s:score(chat,p,profiles.get(p.id))})).sort((a,b)=>b.s-a.s),a=ranked[0],b=ranked[1];return a?{project:a.p,score:a.s,margin:a.s-(b?.s||0)}:null;}
  const placeholder=chat=>/^(nouveau chat|new chat|chargement|loading|untitled|sans titre|conversation)$/i.test(clean(chat?.title||''))||!String(`${chat?.title||''} ${chat?.snippet||''}`).trim();
  function ackProject(data){if(data&&Object.prototype.hasOwnProperty.call(data,'gizmo_id'))return clean(data.gizmo_id);return clean(data?.conversation_mode?.gizmo_id||'');}
  async function move(id,target){const r=await rpc(`/backend-api/conversation/${encodeURIComponent(id)}`,{method:'PATCH',body:{gizmo_id:target}});if(!r.ok)return false;const got=ackProject(r.data);return !got||got===target;}
  function apply(raw,id,target){const c=(raw.chats||[]).find(x=>x.id===id);if(c)c.projectId=target;let found=false;raw.projectChats??={};for(const [pid,list] of Object.entries(raw.projectChats||{})){const idx=(list||[]).findIndex(x=>x.id===id);if(idx<0)continue;found=true;const item={...list[idx],projectId:target};list.splice(idx,1);raw.projectChats[target]??=[];if(!raw.projectChats[target].some(x=>x.id===id))raw.projectChats[target].push(item);raw.counts??={};raw.counts[pid]=list.length;raw.counts[target]=raw.projectChats[target].length;}if(!found&&c){raw.projectChats[target]??=[];if(!raw.projectChats[target].some(x=>x.id===id))raw.projectChats[target].push({...c,projectId:target});raw.counts??={};raw.counts[target]=raw.projectChats[target].length;}}
  async function run(){
    if(busy||!can())return;busy=true;
    try{
      const got=await chrome.storage.local.get([CACHE_KEY,GOV_KEY,STATE_KEY]),raw=got[CACHE_KEY];if(!raw)return;
      let gov=got[GOV_KEY]||{};if(gov.autoResync===false)return;
      const queueIds=new Set((raw.projects||[]).filter(isQueue).map(p=>p.id));
      const filtered=(gov.coreProjectIds||[]).filter(id=>!queueIds.has(id));if(filtered.length!==(gov.coreProjectIds||[]).length){gov={...gov,coreProjectIds:filtered};await chrome.storage.local.set({[GOV_KEY]:gov});}
      const projects=new Map((raw.projects||[]).map(p=>[p.id,p]));
      const targets=(filtered.length?filtered:[...projects.keys()]).map(id=>projects.get(id)).filter(p=>p&&p.id.startsWith('g-p-')&&!p.domOnly&&!isQueue(p));
      const locks=gov.locks||{},chats=allChats(raw),queue=chats.filter(c=>needsClassification(c,queueIds)&&!locks[c.id]);
      if(!targets.length){window.__NIAKGPT_DIAGNOSTICS__?.set('reclassement','ATTENTE · aucun Project cible');return;}
      if(!queue.length){window.__NIAKGPT_DIAGNOSTICS__?.set('reclassement','OK · file + rattrapage récent vides ou protégés');return;}
      const targetSig=hash(targets.map(p=>`${p.id}:${p.name}:${raw.counts?.[p.id]??''}`).sort().join('|')),profiles=buildLearnedProfiles(targets,chats);
      let state=got[STATE_KEY];if(!state||state.schema!==STATE_SCHEMA)state={schema:STATE_SCHEMA,attempts:{},firstSeen:{}};state.attempts=state.attempts||{};state.firstSeen=state.firstSeen||{};
      let done=0,moved=0,changed=false,eligibleRemaining=0,coolingCount=0,ambiguousCount=0,nextWake=Infinity;const movedIds=new Set(),snippetIds=new Set(),batchLimit=heavy()?3:BATCH;
      for(const chat of queue){
        if(placeholder(chat))continue;
        const updatedMs=chatUpdatedMs(chat);
        const seenAt=state.firstSeen[chat.id]||(state.firstSeen[chat.id]=updatedMs&&Date.now()-updatedMs<MATURITY_MS?updatedMs:Date.now()-MATURITY_MS);
        if(Date.now()-seenAt<MATURITY_MS){nextWake=Math.min(nextWake,seenAt+MATURITY_MS);continue;}
        const sig=hash(`${targetSig}|${chat.id}|${chat.title||''}|${String(chat.snippet||'').slice(0,1200)}`),prev=state.attempts[chat.id];
        const cooldown=prev?.status==='move-failed'?FAIL_COOLDOWN:AMBIG_COOLDOWN,wake=(prev?.at||0)+cooldown;
        const cooling=prev?.sig===sig&&Date.now()<wake;
        if(cooling){coolingCount++;nextWake=Math.min(nextWake,wake);continue;}
        if(done>=batchLimit){eligibleRemaining++;continue;}
        if(!can())break;done++;
        const working=chat,candidate=pick(working,targets,profiles);
        const finalSig=hash(`${targetSig}|${working.id}|${working.title||''}|${String(working.snippet||'').slice(0,1200)}`);
        const eligible=!!(candidate&&candidate.score>=CONFIDENCE&&candidate.margin>=MARGIN);
        let movedNow=false;
        if(eligible&&can())movedNow=await move(chat.id,candidate.project.id);
        if(!movedNow&&ratePaused()){nextWake=Math.min(nextWake,Number(document.documentElement.dataset.ng100RateLimitedUntil||Date.now()+4000));break;}
        if(movedNow){apply(raw,chat.id,candidate.project.id);movedIds.add(chat.id);delete state.attempts[chat.id];delete state.firstSeen[chat.id];moved++;changed=true;}
        else{const status=eligible?'move-failed':'ambiguous';state.attempts[chat.id]={sig:finalSig,at:Date.now(),score:candidate?.score||0,margin:candidate?.margin||0,status};if(status==='ambiguous')ambiguousCount++;nextWake=Math.min(nextWake,Date.now()+(status==='move-failed'?FAIL_COOLDOWN:AMBIG_COOLDOWN));}
        await sleep(heavy()?260:120);
      }
      const stillQueued=new Set(allChats(raw).filter(c=>needsClassification(c,queueIds)).map(c=>c.id));for(const id of Object.keys(state.attempts))if(!stillQueued.has(id))delete state.attempts[id];for(const id of Object.keys(state.firstSeen))if(!stillQueued.has(id))delete state.firstSeen[id];
      await chrome.storage.local.set({[STATE_KEY]:state});
      if(changed){
        const bus=window.__NIAKGPT_CACHE_BUS__;
        if(bus?.update)await bus.update(latest=>{
          latest=latest&&typeof latest==='object'?latest:{};
          const rawMap=new Map((raw.chats||[]).filter(c=>c?.id).map(c=>[c.id,c])),merged=new Map((latest.chats||[]).filter(c=>c?.id).map(c=>[c.id,{...c}]));
          for(const id of new Set([...movedIds,...snippetIds])){const incoming=rawMap.get(id);if(!incoming)continue;const old=merged.get(id)||{};merged.set(id,{...old,...incoming,projectId:movedIds.has(id)?incoming.projectId:(old.projectId||incoming.projectId||''),snippet:incoming.snippet||old.snippet||'',updated:Math.max(Number(old.updated)||0,Number(incoming.updated)||0)});}
          const counts={};for(const c of merged.values())if(c.projectId)counts[c.projectId]=(counts[c.projectId]||0)+1;
          return{...latest,chats:[...merged.values()],counts:{...(latest.counts||{}),...counts}};
        });
        else await chrome.storage.local.set({[CACHE_KEY]:{...raw,at:Date.now()}});
      }
      const remaining=allChats(raw).filter(c=>needsClassification(c,queueIds)&&!locks[c.id]).length;
      const waiting=ambiguousCount+coolingCount;
      const unresolved=Object.values(state.attempts).filter(x=>x?.status==='ambiguous').sort((a,b)=>(b.score||0)-(a.score||0))[0];
      const evidence=unresolved?` · max ${unresolved.score||0}/${unresolved.margin||0}`:'';
      window.__NIAKGPT_DIAGNOSTICS__?.set('reclassement',moved?`OK · ${moved} reclassé${moved>1?'s':''} · ${remaining} restant${remaining>1?'s':''}`:waiting?`ATTENTE · ${remaining} à classer/rattraper · ${waiting} ambigu${waiting>1?'s':''}${evidence}`:`ATTENTE · ${remaining} à classer/rattraper`);
      if(eligibleRemaining>0&&can())schedule(heavy()?3200:1400);else if(Number.isFinite(nextWake)&&remaining>0&&can())schedule(Math.max(800,Math.min(AMBIG_COOLDOWN+250,nextWake-Date.now()+250)));
    }catch(e){window.__NIAKGPT_DIAGNOSTICS__?.set('reclassement',`ERREUR · ${String(e?.message||e).slice(0,80)}`);}finally{busy=false;}
  }
  async function lockedRun(){
    if(navigator.locks?.request){let acquired=false;await navigator.locks.request(LOCK_NAME,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)return;acquired=true;await run();});if(!acquired&&can())schedule(900);return;}
    return run();
  }
  function schedule(delay=900){clearTimeout(timer);timer=setTimeout(lockedRun,delay);}
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes[CACHE_KEY]||changes[GOV_KEY]))schedule(1200);});document.addEventListener('niakgpt:cache-guard-ready',()=>schedule(300));document.addEventListener('niakgpt:server-indexed',async()=>{try{await chrome.storage.local.remove(STATE_KEY);}catch{}schedule(250);});document.addEventListener('niakgpt:recovery-complete',async()=>{try{await chrome.storage.local.remove(STATE_KEY);}catch{}schedule(400);});document.addEventListener('niakgpt:activity-changed',()=>schedule(1000));document.addEventListener('niakgpt:rate-limit-cleared',()=>schedule(350));window.addEventListener('popstate',()=>schedule(1400));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(1200);});setTimeout(()=>schedule(0),2200);
})();
