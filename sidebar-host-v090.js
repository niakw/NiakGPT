(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_SIDEBAR_HOST_090__) return;
  window.__NIAKGPT_SIDEBAR_HOST_090__ = true;

  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  const CHAT_SEL='a[href*="/c/"]';
  const CACHE_KEY='niakgpt-v08-cache';
  const REBUILD_KEY='niakgpt-auto-rebuild-v0911';
  const BACKUP_KEY='niakgpt-auto-rebuild-backup-v0911';
  const GENERIC=new Set(['design','ai','ia','coding','code','development','web development','technology','tech','social','social media','writing','general knowledge','general','e-commerce','ecommerce','seo','marketing','business','creative','research','productivity','other','misc','work','education','health','finance','home','cars','gaming','movies','food','personal development','studio','research lab']);
  const STOP=new Set(('le la les un une des de du et ou en sur pour avec sans dans au aux ce cet cette ces mon ma mes ton ta tes son sa ses nos vos leur leurs je tu il elle on nous vous ils elles est sont avoir etre être besoin faire fais peux peut comment pourquoi quoi cette ceci cela plus moins nouveau nouvelle chat conversation projet project site app application dossier aide test tests suite resultats résultats probleme problème erreur question réponse reponse').split(/\s+/));
  const BASE=[
    {name:'Business & Projets',keys:['business','entreprise','société','societe','client','clients','ecommerce','e-commerce','shopify','vente','commercial','marketing','seo','sea','ads','publicité','publicite','marketplace','budget','ca','marge','produit','marque']},
    {name:'Tech & Développement',keys:['code','dev','développement','developpement','github','api','chrome','extension','javascript','typescript','python','php','sql','docker','tauri','provider','plugin','bug','runtime','serveur','hosting','hébergement','hebergement']},
    {name:'Administratif & Juridique',keys:['juridique','justice','avocat','prudhom','prud’hom','plainte','contrat','droit','assurance','impôt','impot','france travail','chômage','chomage','licenciement','administratif','copropriété','copropriete','syndic']},
    {name:'Création & Contenu',keys:['image','visuel','design','logo','vidéo','video','youtube','vimeo','texte','rédaction','redaction','description','titre','affiche','photo','contenu']},
    {name:'Perso & Vie pratique',keys:['famille','mariage','voiture','auto','santé','sante','fatigue','chat','chats','maison','crédit','credit','mutuelle','voyage','relation','personnel']},
    {name:'Recherche & Références',keys:['recherche','comparatif','alternative','documentation','source','étude','etude','analyse','prix','tarif','avis','film','cinéma','cinema','anime','blu ray','bluray']},
    {name:'À classer',keys:[]}
  ];

  let bootstrapObserver=null,bootstrapTimer=0,repairTimer=0,dataTimer=0,dataObserver=null,dataRoot=null,lastDataSignature='',panelObserver=null,rpcSeq=0,rebuildBusy=false;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const cid=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function localPid(name){let h=0;for(const c of norm(name))h=(Math.imul(h,31)+c.charCodeAt(0))|0;return`dom-p-${(h>>>0).toString(36)}`;}

  function rpc(path,{method='GET',body=null,timeout=18000}={}){
    const id=`ng911-${Date.now()}-${++rpcSeq}`;
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{cleanup();resolve({ok:false,status:0,error:'rpc_timeout'});},timeout);
      const handler=e=>{if(e.detail?.id!==id)return;cleanup();resolve(e.detail);};
      const cleanup=()=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);};
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method,body,governance:true}}));
    });
  }

  function navRoot(){
    return document.querySelector('[data-testid="conversation-sidebar"]') ||
      document.querySelector('[data-testid="sidebar"]') ||
      [...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(PROJECT_SEL)||x.querySelector(CHAT_SEL)) ||
      document.querySelector('nav');
  }

  function topChild(root,node){
    if(!root||!node)return null;
    let current=node;
    while(current.parentElement&&current.parentElement!==root)current=current.parentElement;
    return current.parentElement===root?current:null;
  }

  function chatTitle(anchor,old){
    if(old?.title)return old.title;
    const clone=anchor.cloneNode(true);clone.querySelectorAll('small,.ng8-chat-project').forEach(x=>x.remove());
    return clean(anchor.getAttribute('aria-label')||clone.textContent)||'Conversation';
  }
  function projectLabel(anchor,title){
    const small=clean(anchor.querySelector('small')?.textContent);if(small&&norm(small)!==norm(title))return small;
    const leaves=[...anchor.querySelectorAll('span')].filter(x=>!x.querySelector('span')).map(x=>clean(x.textContent)).filter(x=>x&&norm(x)!==norm(title)&&x.length<60);
    return leaves.at(-1)||'';
  }

  async function indexVisible(root){
    dataTimer=0;if(!root?.isConnected)return;
    let raw={};try{raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};}catch{}
    const projects=new Map((raw.projects||[]).map(p=>[p.id,{...p}]));
    const byName=new Map([...projects.values()].filter(p=>p.name).map(p=>[norm(p.name),p]));
    const chats=new Map((raw.chats||[]).map(c=>[c.id,{...c}]));
    const counts={...(raw.counts||{})},visible=new Map();

    for(const a of root.querySelectorAll(PROJECT_SEL)){
      if(a.closest('#ng8-pins'))continue;const id=pid(a.getAttribute('href')),name=clean(a.getAttribute('aria-label')||a.textContent);if(!id||!name)continue;
      const p={...(projects.get(id)||{}),id,name,href:a.getAttribute('href')||`/g/${id}/project`,domOnly:false};projects.set(id,p);byName.set(norm(name),p);
    }
    for(const a of root.querySelectorAll(CHAT_SEL)){
      if(a.closest('#ng8-pins,#ng8-quick'))continue;const href=a.getAttribute('href')||'',id=cid(href);if(!id)continue;
      const old=chats.get(id)||{},title=chatTitle(a,old),label=projectLabel(a,title);let projectId=pid(href)||old.projectId||'';
      if(label){let p=byName.get(norm(label));if(!p){const id=localPid(label);p={id,name:label,href,domOnly:true};projects.set(id,p);byName.set(norm(label),p);}projectId=p.id;}
      chats.set(id,{...old,id,title,projectId,href:href||old.href||''});if(projectId)visible.set(projectId,(visible.get(projectId)||0)+1);
    }
    for(const [id,n] of visible)if(counts[id]==null||id.startsWith('dom-p-'))counts[id]=n;
    const next={schema:2,at:Date.now(),projects:[...projects.values()],chats:[...chats.values()],counts,indexedProjectIds:Array.isArray(raw.indexedProjectIds)?raw.indexedProjectIds:[]};
    const signature=JSON.stringify([next.projects.map(p=>[p.id,p.name]),next.chats.map(c=>[c.id,c.projectId,c.title]),counts]);if(signature===lastDataSignature)return;lastDataSignature=signature;
    try{await chrome.storage.local.set({[CACHE_KEY]:next});window.__NIAKGPT_DIAGNOSTICS__?.set('domindex',`OK · ${next.projects.length} Projects · ${next.chats.length} chats`);}catch(e){window.__NIAKGPT_DIAGNOSTICS__?.set('domindex',`ERREUR · ${String(e?.message||e).slice(0,60)}`);}
  }
  function scheduleData(root,delay=100){clearTimeout(dataTimer);dataTimer=setTimeout(()=>indexVisible(root),delay);}
  function watchData(root){if(root===dataRoot)return;dataObserver?.disconnect();dataRoot=root;if(!root)return;dataObserver=new MutationObserver(()=>scheduleData(root,160));dataObserver.observe(root,{childList:true,subtree:true,characterData:true});scheduleData(root,0);}

  async function fetchProjectsFresh(){
    const found=new Map(),seen=new Set();let cursor=null;
    for(let page=0;page<100;page++){
      const qs=new URLSearchParams({conversations_per_gizmo:'0'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/snorlax/sidebar?${qs}`);if(!r.ok)throw new Error(`Projects ${r.status||0} · ${r.error||'erreur'}`);
      const items=Array.isArray(r.data?.items)?r.data.items:Array.isArray(r.data?.projects)?r.data.projects:[];
      for(const raw of items){
        const g=raw?.gizmo?.gizmo||raw?.gizmo||raw,id=clean(g?.id||raw?.id),name=clean(g?.display?.name||g?.name||raw?.display?.name);
        if(id.startsWith('g-p-')&&name)found.set(id,{id,name,href:`/g/${id}/project`});
      }
      const next=r.data?.cursor??r.data?.next_cursor??r.data?.nextCursor??null;if(next==null||next==='')break;const key=String(next);if(seen.has(key))break;seen.add(key);cursor=next;
    }
    return[...found.values()];
  }
  async function fetchProjectChatsFresh(project){
    const out=new Map(),seen=new Set();let cursor=null;
    for(let page=0;page<250;page++){
      const qs=new URLSearchParams({limit:'20'});if(cursor!=null&&cursor!=='')qs.set('cursor',String(cursor));
      const r=await rpc(`/backend-api/gizmos/${encodeURIComponent(project.id)}/conversations?${qs}`);if(!r.ok)throw new Error(`${project.name}: inventaire impossible (${r.status||0})`);
      const items=Array.isArray(r.data?.items)?r.data.items:Array.isArray(r.data?.conversations)?r.data.conversations:[];
      for(const raw of items){const id=clean(raw?.id||raw?.conversation_id);if(id)out.set(id,{id,title:clean(raw?.title||raw?.conversation_title)||'Conversation',snippet:clean(raw?.snippet||''),projectId:project.id,updated:Number(raw?.update_time||raw?.create_time||0)});}
      const next=r.data?.cursor??r.data?.next_cursor??r.data?.nextCursor??null;if(!items.length||next==null||next==='')break;const key=String(next);if(seen.has(key))break;seen.add(key);cursor=next;await sleep(60);
    }
    return[...out.values()];
  }
  async function fetchGeneralFresh(){
    const out=new Map();let offset=0;
    for(let page=0;page<100;page++){
      const qs=new URLSearchParams({offset:String(offset),limit:'100',order:'updated'});
      const r=await rpc(`/backend-api/conversations?${qs}`);if(!r.ok)throw new Error(`Conversations générales ${r.status||0} · ${r.error||'erreur'}`);
      const items=Array.isArray(r.data?.items)?r.data.items:Array.isArray(r.data?.conversations)?r.data.conversations:[];
      for(const raw of items){const id=clean(raw?.id||raw?.conversation_id);if(id)out.set(id,{id,title:clean(raw?.title||raw?.conversation_title)||'Conversation',snippet:clean(raw?.snippet||''),projectId:clean(raw?.gizmo_id||raw?.conversation_mode?.gizmo_id||''),updated:Number(raw?.update_time||raw?.create_time||0)});}
      if(!items.length)break;offset+=items.length;if(!(r.data?.has_more===true||r.data?.hasMore===true)&&items.length<100)break;await sleep(70);
    }
    return[...out.values()];
  }

  function namedCandidates(projects,chats){
    const projectCounts=new Map(),mentions=new Map(),label=new Map();
    for(const c of chats)if(c.projectId)projectCounts.set(c.projectId,(projectCounts.get(c.projectId)||0)+1);
    for(const p of projects){
      const k=norm(p.name);if(!k||GENERIC.has(k)||k.length<4)continue;
      label.set(k,p.name);const count=projectCounts.get(p.id)||0;if(count)mentions.set(k,(mentions.get(k)||0)+count*3);
    }
    for(const c of chats){
      const text=clean(`${c.title||''} ${c.snippet||''}`),seen=new Set();
      for(const hit of text.matchAll(/\b[\p{Lu}][\p{L}\p{N}._-]{3,}\b/gu)){
        const raw=hit[0],k=norm(raw);if(STOP.has(k)||GENERIC.has(k)||/^\d/.test(k))continue;seen.add(k);if(!label.has(k))label.set(k,raw);
      }
      for(const k of seen)mentions.set(k,(mentions.get(k)||0)+1);
    }
    return[...mentions].filter(([,score])=>score>=3).sort((a,b)=>b[1]-a[1]||b[0].length-a[0].length).slice(0,12).map(([k,score])=>({name:label.get(k)||k,key:k,score}));
  }
  function classifyChat(chat,named){
    const text=norm(`${chat.title||''} ${chat.snippet||''}`),current=norm(chat.projectName||'');
    const hit=named.filter(n=>text.includes(n.key)||current===n.key).sort((a,b)=>b.key.length-a.key.length)[0];if(hit)return hit.name;
    let best=null,bestScore=0;
    for(const base of BASE.slice(0,-1)){let score=0;for(const key of base.keys)if(text.includes(norm(key)))score++;if(score>bestScore){bestScore=score;best=base.name;}}
    return best||'À classer';
  }
  function buildPlan(projects,chats){
    const pById=new Map(projects.map(p=>[p.id,p]));for(const c of chats)c.projectName=pById.get(c.projectId)?.name||'';
    const named=namedCandidates(projects,chats),target=[...named.map(x=>({name:x.name,type:'récurrent'})),...BASE.map(x=>({name:x.name,type:'base'}))];
    const seen=new Set(),targets=[];for(const t of target){const k=norm(t.name);if(!k||seen.has(k))continue;seen.add(k);targets.push({...t,key:k,count:0});}
    const assignments=[];for(const c of chats){const targetName=classifyChat(c,named);assignments.push({id:c.id,title:c.title,targetName,fromId:c.projectId||''});const t=targets.find(x=>norm(x.name)===norm(targetName));if(t)t.count++;}
    return{createdAt:Date.now(),oldProjects:projects,chats:chats.map(c=>({id:c.id,title:c.title,projectId:c.projectId||''})),targets,assignments,named};
  }

  async function prepareAutoPlan(){
    setRebuildStatus('INVENTAIRE · Projects');const projects=await fetchProjectsFresh(),all=new Map();
    for(let i=0;i<projects.length;i++){setRebuildStatus(`INVENTAIRE · ${i+1}/${projects.length} · ${projects[i].name}`);const list=await fetchProjectChatsFresh(projects[i]);for(const c of list)all.set(c.id,c);}
    setRebuildStatus('INVENTAIRE · chats hors Projects');for(const c of await fetchGeneralFresh()){const old=all.get(c.id);all.set(c.id,{...c,projectId:old?.projectId||c.projectId||'',snippet:c.snippet||old?.snippet||''});}
    const plan=buildPlan(projects,[...all.values()]);await chrome.storage.local.set({[BACKUP_KEY]:{at:Date.now(),projects,chats:[...all.values()]}});return plan;
  }

  function ensureAutoStyle(){
    if(document.getElementById('ng911-style'))return;
    const s=document.createElement('style');s.id='ng911-style';s.textContent=`#ng911-auto{position:fixed;inset:0;z-index:2147483645;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:24px;font:13px Inter,system-ui,sans-serif;color:#e8f7ed}#ng911-auto .card{width:min(980px,96vw);max-height:88vh;overflow:auto;background:#08110d;border:1px solid #1e6d3d;border-radius:14px;box-shadow:0 26px 80px #000;padding:18px}#ng911-auto header{display:flex;align-items:start;gap:12px;border-bottom:1px solid #183527;padding-bottom:12px}#ng911-auto header div{flex:1}#ng911-auto h2{margin:2px 0 4px;font-size:20px}#ng911-auto small{color:#69d98f}#ng911-auto button{background:#10241a;color:#dff7e7;border:1px solid #285c3c;border-radius:7px;padding:8px 11px;cursor:pointer}#ng911-auto button.primary{background:#176b38;border-color:#35a75c;font-weight:700}#ng911-auto button.danger{background:#4b1515;border-color:#b74444}#ng911-auto button:disabled{opacity:.45;cursor:not-allowed}#ng911-auto .warn{margin:14px 0;padding:12px;border:1px solid #8b5d20;background:#251a09;border-radius:9px;color:#ffdca6}#ng911-auto .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}#ng911-auto section{border:1px solid #173426;border-radius:9px;padding:12px;background:#0a1510}#ng911-auto section h3{margin:0 0 8px;color:#8bedaa;font-size:13px}#ng911-auto .row{display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #10281b}#ng911-auto .row span{flex:1}#ng911-auto .row em{font-style:normal;color:#85a990}#ng911-auto footer{display:flex;gap:8px;align-items:center;margin-top:14px}#ng911-auto footer span{flex:1}#ng911-auto input.confirm{width:180px;background:#06100b;color:#fff;border:1px solid #35654a;border-radius:7px;padding:8px}#ng911-progress{margin:12px 0;color:#9eeab8}.ng911-auto-button{border-color:#2d8d50!important;color:#9ff0b8!important}@media(max-width:800px){#ng911-auto .grid{grid-template-columns:1fr}}`;
    document.documentElement.appendChild(s);
  }
  function modalNode(){return document.getElementById('ng911-auto');}function closeAuto(){modalNode()?.remove();}
  function setRebuildStatus(text){window.__NIAKGPT_DIAGNOSTICS__?.set('autorebuild',text);const n=document.getElementById('ng911-progress');if(n)n.textContent=text;}
  function renderPlan(plan){
    ensureAutoStyle();let modal=modalNode();if(!modal){modal=document.createElement('div');modal.id='ng911-auto';document.body.appendChild(modal);}
    const named=plan.named.map(n=>`<div class="row"><span>${esc(n.name)}</span><em>récurrent · score ${n.score}</em></div>`).join('')||'<div class="row"><span>Aucun nom récurrent suffisamment solide</span></div>';
    const targets=plan.targets.map(t=>`<div class="row"><span>${esc(t.name)}</span><em>${t.count} chats · ${t.type}</em></div>`).join('');
    modal.innerHTML=`<div class="card"><header><div><small>AUTO REBUILD · 0.9.11</small><h2>Reconstruction automatique complète</h2><span>${plan.chats.length} chats · ${plan.oldProjects.length} Projects actuels · ${plan.targets.length} Projects cibles</span></div><button data-close>×</button></header><div class="warn"><b>Séquence sûre :</b> tous les chats sont d'abord sortis et vérifiés. Ensuite seulement les anciens Projects vides sont supprimés. <b>Les fichiers et instructions propres aux anciens Projects seront définitivement perdus.</b></div><div class="grid"><section><h3>PROJETS RÉCURRENTS DÉTECTÉS</h3>${named}</section><section><h3>STRUCTURE CIBLE</h3>${targets}</section></div><div id="ng911-progress">APERÇU · aucune modification effectuée</div><footer><button data-close>Annuler</button><span></span><input class="confirm" data-confirm placeholder="Tape RECONSTRUIRE"><button class="danger" data-execute disabled>RECONSTRUCTION AUTO</button></footer></div>`;
    modal.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeAuto));const input=modal.querySelector('[data-confirm]'),exec=modal.querySelector('[data-execute]');input.addEventListener('input',()=>exec.disabled=input.value.trim().toUpperCase()!=='RECONSTRUIRE');exec.addEventListener('click',()=>startAutoRebuild(plan));
  }
  function renderProgress(state){
    ensureAutoStyle();let modal=modalNode();if(!modal){modal=document.createElement('div');modal.id='ng911-auto';document.body.appendChild(modal);}
    modal.innerHTML=`<div class="card"><header><div><small>AUTO REBUILD · EN COURS</small><h2>Ne ferme pas ChatGPT</h2><span>La reconstruction reprend automatiquement après les navigations.</span></div></header><div id="ng911-progress">${esc(state.message||state.phase)}</div><div class="warn">En cas d'erreur, NiakGPT s'arrête. Une suppression de Project n'est autorisée qu'après vérification qu'il ne contient plus aucun chat.</div><footer><span></span><button data-abort>Arrêter après l'étape courante</button></footer></div>`;
    modal.querySelector('[data-abort]')?.addEventListener('click',async()=>{state.active=false;state.message='ARRÊT MANUEL · chats conservés';await saveState(state);setRebuildStatus(state.message);renderProgress(state);});
  }
  async function openAuto(){
    if(rebuildBusy)return;rebuildBusy=true;ensureAutoStyle();let modal=modalNode();if(!modal){modal=document.createElement('div');modal.id='ng911-auto';document.body.appendChild(modal);}modal.innerHTML='<div class="card"><header><div><small>AUTO REBUILD</small><h2>Analyse complète…</h2></div><button data-close>×</button></header><div id="ng911-progress">Préparation de l’inventaire</div></div>';modal.querySelector('[data-close]')?.addEventListener('click',closeAuto);
    try{const plan=await prepareAutoPlan();renderPlan(plan);setRebuildStatus(`PRÊT · ${plan.chats.length} chats · ${plan.targets.length} cibles`);}catch(e){setRebuildStatus(`ERREUR · ${String(e?.message||e).slice(0,110)}`);modal.querySelector('.card').insertAdjacentHTML('beforeend',`<div class="warn"><b>Analyse interrompue :</b> ${esc(String(e?.message||e))}<br>Aucune modification n’a été effectuée.</div>`);}finally{rebuildBusy=false;}
  }

  async function saveState(state){await chrome.storage.local.set({[REBUILD_KEY]:state});}async function readState(){try{return(await chrome.storage.local.get(REBUILD_KEY))[REBUILD_KEY]||null;}catch{return null;}}
  async function startAutoRebuild(plan){if(rebuildBusy)return;const state={schema:1,active:true,phase:'detach',index:0,plan,created:{},message:'DÉTACHEMENT · préparation',startedAt:Date.now(),failures:[]};await saveState(state);renderProgress(state);resumeAuto();}
  async function verifyChatProject(id,expected){for(let i=0;i<4;i++){const r=await rpc(`/backend-api/conversation/${encodeURIComponent(id)}`,{timeout:14000});if(r.ok){const got=clean(r.data?.gizmo_id||r.data?.conversation_mode?.gizmo_id||'');if(got===expected)return true;}await sleep(260*(i+1));}return false;}
  async function moveChat(id,targetId){const r=await rpc(`/backend-api/conversation/${encodeURIComponent(id)}`,{method:'PATCH',body:{gizmo_id:targetId||null},timeout:16000});if(!r.ok)return false;return verifyChatProject(id,targetId||'');}
  async function projectIsEmpty(project){try{return(await fetchProjectChatsFresh(project)).length===0;}catch{return false;}}
  function visible(el){return !!(el instanceof HTMLElement&&el.getClientRects().length);}function textMatches(el,re){return visible(el)&&re.test(norm(el.textContent||el.getAttribute?.('aria-label')||el.getAttribute?.('title')||''));}function firstControl(re,root=document){return[...root.querySelectorAll('button,[role="button"],[role="menuitem"],a')].find(el=>textMatches(el,re))||null;}
  function moreButton(projectName=''){
    const heading=[...document.querySelectorAll('h1,h2,h3,[role="heading"]')].find(el=>visible(el)&&norm(el.textContent)===norm(projectName)),local=heading?(heading.closest('header')||heading.parentElement):null,candidates=[...(local||document).querySelectorAll('button,[role="button"]')].filter(visible);
    const semantic=candidates.find(el=>/(plus d.options|more options|menu du projet|project menu|actions du projet|project actions|options|menu)/i.test(norm(`${el.getAttribute('aria-label')||''} ${el.getAttribute('title')||''}`)));if(semantic)return semantic;const dots=candidates.find(el=>clean(el.textContent)==='…'||clean(el.textContent)==='⋯');if(dots)return dots;if(local)return null;
    return[...document.querySelectorAll('button,[role="button"]')].filter(visible).find(el=>/(menu du projet|project menu|actions du projet|project actions)/i.test(norm(`${el.getAttribute('aria-label')||''} ${el.getAttribute('title')||''}`)))||null;
  }
  async function waitFor(fn,timeout=9000,step=120){const end=Date.now()+timeout;while(Date.now()<end){const v=await Promise.resolve(fn());if(v)return v;await sleep(step);}return null;}
  async function deleteCurrentProject(project){
    if(!(await projectIsEmpty(project)))throw new Error(`BLOCAGE SÉCURITÉ · ${project.name} contient encore des chats`);const menu=await waitFor(()=>moreButton(project.name),8000);if(!menu)throw new Error(`Menu Project introuvable · ${project.name}`);menu.click();
    const del=await waitFor(()=>firstControl(/^(supprimer le projet|delete project)$/i),5000);if(!del)throw new Error(`Action Supprimer le projet introuvable · ${project.name}`);del.click();const dialog=await waitFor(()=>[...document.querySelectorAll('[role="dialog"],[data-radix-dialog-content]')].find(visible),5000);if(!dialog)throw new Error(`Confirmation de suppression absente · ${project.name}`);
    const dt=norm(dialog.textContent);if(!/(projet|project)/.test(dt)||!/(supprim|delete|permanent|définit|definit)/.test(dt))throw new Error(`Confirmation ambiguë · ${project.name}`);const confirm=[...dialog.querySelectorAll('button,[role="button"]')].filter(visible).find(el=>/^(supprimer|delete|supprimer le projet|delete project)$/i.test(norm(el.textContent)));if(!confirm)throw new Error(`Bouton de confirmation introuvable · ${project.name}`);confirm.click();
  }
  function setNativeInput(input,value){const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  async function createProjectDOM(name){
    const existing=(await fetchProjectsFresh()).find(p=>norm(p.name)===norm(name));if(existing)return existing;const create=firstControl(/^(nouveau projet|new project|créer un projet|creer un projet|create project)$/i);if(!create)throw new Error(`Bouton Nouveau projet introuvable · ${name}`);create.click();
    const dialog=await waitFor(()=>[...document.querySelectorAll('[role="dialog"],[data-radix-dialog-content]')].find(visible),5000);if(!dialog)throw new Error(`Dialogue création introuvable · ${name}`);const input=await waitFor(()=>[...dialog.querySelectorAll('input[type="text"],input:not([type]),textarea')].find(visible),3000);if(!input)throw new Error(`Champ nom introuvable · ${name}`);setNativeInput(input,name);
    const submit=[...dialog.querySelectorAll('button,[role="button"]')].filter(visible).find(el=>/^(créer|creer|create|continuer|continue)$/i.test(norm(el.textContent)));if(!submit)throw new Error(`Bouton Créer introuvable · ${name}`);submit.click();const made=await waitFor(async()=>{try{return(await fetchProjectsFresh()).find(p=>norm(p.name)===norm(name))||null;}catch{return null;}},9000,400);if(!made)throw new Error(`Project non vérifié après création · ${name}`);return made;
  }
  async function failState(state,error){state.active=false;state.phase='error';state.message=`ERREUR · ${String(error?.message||error).slice(0,160)}`;state.failures.push({at:Date.now(),message:String(error?.message||error)});await saveState(state);setRebuildStatus(state.message);renderProgress(state);rebuildBusy=false;}

  async function resumeAuto(){
    if(rebuildBusy)return;const state=await readState();if(!state?.active)return;rebuildBusy=true;renderProgress(state);
    try{
      if(state.phase==='detach'){
        for(let i=state.index;i<state.plan.chats.length;i++){const c=state.plan.chats[i];state.index=i;state.message=`SÉCURISATION · ${i+1}/${state.plan.chats.length} · ${c.title}`;await saveState(state);setRebuildStatus(state.message);if(c.projectId&&!(await moveChat(c.id,'')))throw new Error(`Impossible de sortir le chat ${c.title}`);}
        for(const p of state.plan.oldProjects)if(!(await projectIsEmpty(p)))throw new Error(`BLOCAGE SÉCURITÉ · ${p.name} n’est pas vide`);state.phase='delete';state.index=0;state.message='SUPPRESSION · Projects vides';await saveState(state);
      }
      if(state.phase==='delete'){
        while(state.index<state.plan.oldProjects.length){const p=state.plan.oldProjects[state.index],fresh=await fetchProjectsFresh();if(!fresh.some(x=>x.id===p.id)){state.index++;await saveState(state);continue;}if(!location.pathname.includes(`/g/${p.id}/`)){state.message=`OUVERTURE · ${p.name}`;await saveState(state);location.assign(p.href);rebuildBusy=false;return;}state.message=`SUPPRESSION · ${state.index+1}/${state.plan.oldProjects.length} · ${p.name}`;await saveState(state);setRebuildStatus(state.message);await deleteCurrentProject(p);const gone=await waitFor(async()=>{try{return!(await fetchProjectsFresh()).some(x=>x.id===p.id);}catch{return false;}},9000,450);if(!gone)throw new Error(`Suppression non vérifiée · ${p.name}`);state.index++;await saveState(state);}
        state.phase='create';state.index=0;state.message='CRÉATION · structure cible';await saveState(state);
      }
      if(state.phase==='create'){
        if(!/^\/projects\/?$/.test(location.pathname)){location.assign('/projects');rebuildBusy=false;return;}while(state.index<state.plan.targets.length){const t=state.plan.targets[state.index];state.message=`CRÉATION · ${state.index+1}/${state.plan.targets.length} · ${t.name}`;await saveState(state);setRebuildStatus(state.message);const made=await createProjectDOM(t.name);state.created[t.name]=made.id;state.index++;await saveState(state);await sleep(350);}state.phase='assign';state.index=0;state.message='CLASSEMENT · conversations';await saveState(state);
      }
      if(state.phase==='assign'){
        for(let i=state.index;i<state.plan.assignments.length;i++){const a=state.plan.assignments[i],target=state.created[a.targetName];if(!target)throw new Error(`Project cible absent · ${a.targetName}`);state.index=i;state.message=`CLASSEMENT · ${i+1}/${state.plan.assignments.length} · ${a.title} → ${a.targetName}`;await saveState(state);setRebuildStatus(state.message);if(!(await moveChat(a.id,target)))throw new Error(`Déplacement non vérifié · ${a.title}`);}
        state.phase='done';state.active=false;state.message=`TERMINÉ · ${state.plan.assignments.length} chats · ${state.plan.targets.length} Projects`;state.finishedAt=Date.now();await saveState(state);setRebuildStatus(state.message);try{await chrome.storage.local.remove(CACHE_KEY);}catch{}renderProgress(state);
      }
    }catch(e){await failState(state,e);return;}finally{if((await readState())?.active!==true)rebuildBusy=false;}
  }

  function patchAutoButton(){const panel=document.getElementById('ng8-panel');if(!panel)return;const actions=panel.querySelector('.ng8-actions');if(actions&&!actions.querySelector('[data-ng911-auto]')){const b=document.createElement('button');b.type='button';b.dataset.ng911Auto='1';b.className='ng911-auto-button';b.textContent='AUTO REBUILD';b.title='Analyser tous les chats puis reconstruire automatiquement les Projects';b.addEventListener('click',openAuto);actions.appendChild(b);}}
  function watchPanel(){const panel=document.getElementById('ng8-panel');if(!panel)return;if(panelObserver?._host===panel){patchAutoButton();return;}panelObserver?.disconnect();panelObserver=new MutationObserver(patchAutoButton);panelObserver._host=panel;panelObserver.observe(panel,{childList:true,subtree:true});patchAutoButton();}
  function repair(){
    clearTimeout(repairTimer);repairTimer=0;const root=navRoot();if(!root)return false;watchData(root);watchPanel();const boxes=[...document.querySelectorAll('#ng8-pins')];let host=boxes.find(box=>root.contains(box))||boxes[0]||null;if(!host){host=document.createElement('section');host.id='ng8-pins';}if(!root.contains(host)){const firstProject=root.querySelector(PROJECT_SEL),anchor=topChild(root,firstProject);root.insertBefore(host,anchor||root.firstElementChild||null);}for(const box of boxes){if(box!==host)box.remove();}host.dataset.ng90SidebarHost='1';document.documentElement.dataset.ng90ProjectHosts='1';scheduleData(root,40);return true;
  }
  function schedule(delay=60){clearTimeout(repairTimer);repairTimer=setTimeout(repair,delay);}function bootstrap(){if(repair()){bootstrapObserver?.disconnect();bootstrapObserver=null;clearTimeout(bootstrapTimer);resumeAuto();return;}if(!document.documentElement)return;bootstrapObserver=new MutationObserver(()=>{if(repair()){bootstrapObserver?.disconnect();bootstrapObserver=null;clearTimeout(bootstrapTimer);resumeAuto();}});bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});bootstrapTimer=setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);}

  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('nav,[data-testid*="sidebar"],#ng8-rail,#ng8-panel'))schedule(80);},true);window.addEventListener('popstate',()=>schedule(100));document.addEventListener('visibilitychange',()=>{if(!document.hidden){schedule(120);resumeAuto();}});window.addEventListener('pagehide',()=>{clearTimeout(dataTimer);dataObserver?.disconnect();panelObserver?.disconnect();},{once:true});bootstrap();
})();
