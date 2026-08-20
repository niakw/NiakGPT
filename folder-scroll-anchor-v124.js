(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_FOLDER_SCROLL_ANCHOR_124__)return;
  window.__NIAKGPT_FOLDER_SCROLL_ANCHOR_124__=true;

  let anchor=null,observer=null,boot=null,raf=0,timers=[];
  const normalizePid=v=>{const s=String(v||'').trim(),m=s.match(/^g-p-([A-Za-z0-9]+)(?:-.+)?$/);return m?`g-p-${m[1]}`:s;};
  function current(){
    const drawer=document.querySelector('#ng8-pins .ng96-pin-drawer'),list=drawer?.querySelector('.ng96-folder-list'),pid=normalizePid(drawer?.dataset.pid||'');
    return drawer&&list&&pid?{pid,top:list.scrollTop}:null;
  }
  function restore(){
    if(!anchor||performance.now()>anchor.until)return;
    const drawers=[...document.querySelectorAll('#ng8-pins .ng96-pin-drawer')],drawer=drawers.find(d=>normalizePid(d.dataset.pid)===anchor.pid),list=drawer?.querySelector('.ng96-folder-list');
    if(!(list instanceof HTMLElement)||!list.isConnected)return;
    const max=Math.max(0,list.scrollHeight-list.clientHeight),next=Math.min(anchor.top,max);if(max>0&&Math.abs(list.scrollTop-next)>1)list.scrollTop=next;
  }
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{restore();raf=requestAnimationFrame(restore);});}
  function arm(){
    const state=current();if(!state)return;anchor={...state,until:performance.now()+1400};
    for(const t of timers)clearTimeout(t);timers=[];schedule();for(const delay of [0,20,50,100,180,300,500,800,1200])timers.push(setTimeout(restore,delay));
  }
  function bind(){
    const box=document.getElementById('ng8-pins');if(!box)return false;observer?.disconnect();observer=new MutationObserver(()=>{if(anchor&&performance.now()<=anchor.until)schedule();});observer.observe(box,{childList:true,subtree:true});return true;
  }
  document.addEventListener('pointerdown',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('#ng123-action-menu .ng123-move-list button'))arm();},true);
  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('#ng123-action-menu .ng123-move-list button')){if(!anchor)arm();schedule();}},true);
  document.addEventListener('niakgpt:folder-rendered',schedule);
  document.addEventListener('niakgpt:pins-rendered',()=>{bind();schedule();});
  if(!bind()){boot=new MutationObserver(()=>{if(bind()){boot.disconnect();boot=null;}});boot.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{boot?.disconnect();boot=null;},20000);}
  window.addEventListener('pagehide',()=>{observer?.disconnect();boot?.disconnect();cancelAnimationFrame(raf);for(const t of timers)clearTimeout(t);},{once:true});
})();
