(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_FOLDER_SCROLL_ANCHOR_124__)return;
  window.__NIAKGPT_FOLDER_SCROLL_ANCHOR_124__=true;

  const orderByProject=new Map(),scrollByProject=new Map();
  let anchor=null,observer=null,boot=null,raf=0,timers=[];
  const normalizePid=v=>{const s=String(v||'').trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  const drawerFor=pid=>[...document.querySelectorAll('#ng8-pins .ng96-pin-drawer')].find(d=>normalizePid(d.dataset.pid)===normalizePid(pid))||null;
  function snapshot(drawer=document.querySelector('#ng8-pins .ng96-pin-drawer')){
    const list=drawer?.querySelector('.ng96-folder-list'),pid=normalizePid(drawer?.dataset.pid||'');if(!(list instanceof HTMLElement)||!pid)return null;
    const ids=[...list.querySelectorAll(':scope>.ng96-chat-entry')].map(row=>row.dataset.chatEntry).filter(Boolean);if(ids.length&&!orderByProject.has(pid))orderByProject.set(pid,ids);
    if(list.scrollTop>0||!scrollByProject.has(pid))scrollByProject.set(pid,list.scrollTop);
    return{pid,top:scrollByProject.get(pid)||0};
  }
  function stabilizeOrder(pid){
    const drawer=drawerFor(pid),list=drawer?.querySelector('.ng96-folder-list');if(!(list instanceof HTMLElement))return;
    const rows=[...list.querySelectorAll(':scope>.ng96-chat-entry')],current=rows.map(row=>row.dataset.chatEntry).filter(Boolean);if(!current.length)return;
    const previous=orderByProject.get(pid);if(!previous){orderByProject.set(pid,current);return;}
    const rowById=new Map(rows.map(row=>[row.dataset.chatEntry,row])),present=new Set(current),known=previous.filter(id=>present.has(id)),fresh=current.filter(id=>!previous.includes(id)),desired=[...fresh,...known];
    for(const id of desired){const row=rowById.get(id);if(row)list.appendChild(row);}orderByProject.set(pid,desired);
  }
  function restore(pid=anchor?.pid){
    pid=normalizePid(pid||'');if(!pid)return;if(anchor&&pid===anchor.pid&&performance.now()>anchor.until)anchor=null;
    const drawer=drawerFor(pid),list=drawer?.querySelector('.ng96-folder-list');if(!(list instanceof HTMLElement)||!list.isConnected)return;
    stabilizeOrder(pid);const wanted=anchor?.pid===pid?anchor.top:scrollByProject.get(pid);if(!Number.isFinite(Number(wanted)))return;const max=Math.max(0,list.scrollHeight-list.clientHeight),next=Math.min(Math.max(0,Number(wanted)),max);if(max>0&&Math.abs(list.scrollTop-next)>1)list.scrollTop=next;if(max>0)scrollByProject.set(pid,next);
  }
  function schedule(pid=anchor?.pid){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{restore(pid);raf=requestAnimationFrame(()=>restore(pid));});}
  function arm(){
    const state=snapshot();if(!state)return;anchor={...state,until:performance.now()+1400};
    for(const t of timers)clearTimeout(t);timers=[];schedule(state.pid);for(const delay of [0,20,50,100,180,300,500,800,1200])timers.push(setTimeout(()=>restore(state.pid),delay));
  }
  function bind(){
    const box=document.getElementById('ng8-pins');if(!box)return false;observer?.disconnect();observer=new MutationObserver(()=>{const state=snapshot();if(state)schedule(state.pid);});observer.observe(box,{childList:true,subtree:true});return true;
  }
  document.addEventListener('scroll',event=>{const list=event.target instanceof Element?event.target.closest?.('#ng8-pins .ng96-folder-list'):null,drawer=list?.closest?.('.ng96-pin-drawer'),pid=normalizePid(drawer?.dataset.pid||'');if(pid&&list?.isConnected)scrollByProject.set(pid,list.scrollTop);},true);
  document.addEventListener('pointerdown',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('#ng123-action-menu .ng123-move-list button'))arm();else snapshot();},true);
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('#ng123-action-menu .ng123-move-list button')){if(!anchor)arm();schedule();}},true);
  document.addEventListener('niakgpt:folder-rendered',event=>{const pid=normalizePid(event.detail?.projectId||'');if(pid){stabilizeOrder(pid);schedule(pid);}});
  document.addEventListener('niakgpt:pins-rendered',()=>{bind();const state=snapshot();if(state)schedule(state.pid);});
  if(!bind()){boot=new MutationObserver(()=>{if(bind()){boot.disconnect();boot=null;}});boot.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{boot?.disconnect();boot=null;},20000);}
  window.addEventListener('pagehide',()=>{observer?.disconnect();boot?.disconnect();cancelAnimationFrame(raf);for(const t of timers)clearTimeout(t);},{once:true});
})();
