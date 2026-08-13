(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_CHRONO_090__) return;
  window.__NIAKGPT_CHRONO_090__ = true;

  const CACHE_KEY='niakgpt-v08-cache';
  const CHAT_SEL='a[href*="/c/"]';
  const OWN='#ng8-pins,#ng8-panel,#ng8-quick,#ng8-rail,#ng8-status,#ng8-coach,#ng90-control';
  let chats=new Map(),counts=new Map(),latestByProject=new Map(),observer=null,observedRoot=null,timer=0,sorting=false,pendingRoots=new Set();

  const parseTime=v=>{if(typeof v==='number'&&Number.isFinite(v))return v>1e12?v:v*1000;if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n))return n>1e12?n:n*1000;const d=Date.parse(v);return Number.isFinite(d)?d:0;}return 0;};
  const cid=h=>String(h||'').match(/\/c\/([0-9a-f-]{20,})/i)?.[1]||'';
  const pid=h=>String(h||'').match(/\/g\/(g-p-[^/]+)\/(?:project|c\/)/i)?.[1]||'';
  const formatDate=ms=>{if(!ms)return'—';const d=new Date(ms),now=new Date();if(Number.isNaN(d.getTime()))return'—';const dd=String(d.getDate()).padStart(2,'0'),mm=String(d.getMonth()+1).padStart(2,'0');return d.getFullYear()===now.getFullYear()?`${dd}/${mm}`:`${dd}/${mm}/${String(d.getFullYear()).slice(-2)}`;};

  function navRoot(){return document.querySelector('[data-testid="conversation-sidebar"]')||document.querySelector('[data-testid="sidebar"]')||[...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(CHAT_SEL))||document.querySelector('nav');}
  function mergeChat(chat,projectId=''){if(!chat?.id)return;const updated=parseTime(chat.updated||chat.update_time||chat.create_time),old=chats.get(chat.id);const next={...old,...chat,projectId:chat.projectId||projectId||old?.projectId||'',updated:Math.max(old?.updated||0,updated)};chats.set(chat.id,next);if(next.projectId&&next.updated>(latestByProject.get(next.projectId)||0))latestByProject.set(next.projectId,next.updated);}

  async function readCache(){
    try{
      const raw=(await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY]||{};chats=new Map();counts=new Map(Object.entries(raw.counts||{}));latestByProject=new Map();
      for(const chat of raw.chats||[])mergeChat(chat);
      for(const [projectId,list] of Object.entries(raw.projectChats||{}))for(const chat of list||[])mergeChat(chat,projectId);
      scheduleApply(document,40);
    }catch(e){console.warn('[NiakGPT chronology]',e);}
  }

  function decorateChat(link){
    if(!(link instanceof HTMLElement)||link.closest(OWN))return;const id=cid(link.getAttribute('href')),chat=chats.get(id);if(!id||!chat?.updated)return;
    link.dataset.ng8Updated=String(chat.updated);let date=link.querySelector(':scope > .ng8-chat-date');if(!date){date=document.createElement('span');date.className='ng8-chat-date';link.appendChild(date);}date.textContent=formatDate(chat.updated);date.title=`Dernier échange : ${new Date(chat.updated).toLocaleString('fr-FR')}`;
  }
  function decorateProjectMeta(root=document){
    for(const link of root.querySelectorAll?.('#ng8-pins a[data-ng8-pin="1"],.ng8-project-table a')||[]){const projectId=pid(link.getAttribute('href'));if(!projectId)continue;const count=counts.has(projectId)?counts.get(projectId):null,latest=latestByProject.get(projectId)||0,meta=link.querySelector('small,b:last-child');if(!meta)continue;meta.classList.add('ng8-project-meta');meta.textContent=`${formatDate(latest)}  [${count==null?'…':count}]`;meta.title=latest?`Dernier échange du Project : ${new Date(latest).toLocaleString('fr-FR')}`:'Aucune date disponible';}
  }
  function wrapperFor(link){const row=link.closest('li,[data-testid]');return row&&row!==link&&row.querySelectorAll(CHAT_SEL).length===1?row:link;}
  function sortContainer(parent){
    if(!parent||sorting)return;const links=[...parent.querySelectorAll(`:scope > ${CHAT_SEL},:scope > li ${CHAT_SEL},:scope > [data-testid] ${CHAT_SEL}`)].filter(a=>!a.closest(OWN));if(links.length<2)return;
    const rows=[];for(const link of links){const updated=chats.get(cid(link.getAttribute('href')))?.updated||0;if(!updated)continue;const wrapper=wrapperFor(link);if(wrapper.parentElement===parent)rows.push({wrapper,updated});}
    const unique=[...new Map(rows.map(x=>[x.wrapper,x])).values()];if(unique.length<2)return;const elements=[...parent.children].filter(x=>x instanceof HTMLElement).length;if(elements>unique.length+2)return;
    const sorted=[...unique].sort((a,b)=>b.updated-a.updated);if(unique.every((x,i)=>x.wrapper===sorted[i]?.wrapper))return;sorting=true;try{const frag=document.createDocumentFragment();for(const x of sorted)frag.appendChild(x.wrapper);parent.appendChild(frag);}finally{sorting=false;}
  }
  function applyRoot(root){
    if(!(root instanceof Document||root instanceof Element))return;const side=navRoot();if(side){if(root===document||root===side){side.querySelectorAll(CHAT_SEL).forEach(decorateChat);}else{if(root.matches?.(CHAT_SEL))decorateChat(root);root.querySelectorAll?.(CHAT_SEL).forEach(decorateChat);}const parents=new Set();for(const link of (root===document||root===side?[...side.querySelectorAll(CHAT_SEL)]:[...(root.querySelectorAll?.(CHAT_SEL)||[])])){const w=wrapperFor(link);if(w.parentElement)parents.add(w.parentElement);}for(const p of parents)sortContainer(p);}decorateProjectMeta(root===document?document:root);
  }
  function scheduleApply(root=document,delay=180){pendingRoots.add(root);clearTimeout(timer);timer=setTimeout(()=>{const roots=[...pendingRoots];pendingRoots.clear();for(const r of roots)applyRoot(r);},delay);}

  function bindSidebar(){
    const root=navRoot();if(!root||root===observedRoot)return;observer?.disconnect();observedRoot=root;observer=new MutationObserver(records=>{if(sorting)return;for(const record of records)for(const node of record.addedNodes)if(node instanceof Element)scheduleApply(node,activityDelay());});observer.observe(root,{childList:true,subtree:true});scheduleApply(root,40);
  }
  function activityDelay(){return document.documentElement.dataset.ng8Running==='1'?900:180;}

  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[CACHE_KEY])readCache();});
  document.addEventListener('niakgpt:rpc-response',()=>scheduleApply(navRoot()||document,500));
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('nav,[data-testid*="sidebar" i],#ng8-pins'))setTimeout(bindSidebar,80);},true);
  window.addEventListener('popstate',()=>setTimeout(bindSidebar,80));
  readCache();bindSidebar();
})();
