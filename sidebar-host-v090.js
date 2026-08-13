(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_SIDEBAR_HOST_090__) return;
  window.__NIAKGPT_SIDEBAR_HOST_090__ = true;

  const PROJECT_SEL='a[href^="/g/g-p-"][href*="/project"]';
  let bootstrapObserver=null,bootstrapTimer=0,repairTimer=0;

  function navRoot(){
    return document.querySelector('[data-testid="conversation-sidebar"]') ||
      document.querySelector('[data-testid="sidebar"]') ||
      [...document.querySelectorAll('nav,aside')].find(x=>x.querySelector(PROJECT_SEL)||x.querySelector('a[href*="/c/"]')) ||
      document.querySelector('nav');
  }

  function topChild(root,node){
    if(!root||!node)return null;
    let current=node;
    while(current.parentElement&&current.parentElement!==root)current=current.parentElement;
    return current.parentElement===root?current:null;
  }

  function repair(){
    clearTimeout(repairTimer);repairTimer=0;
    const root=navRoot();if(!root)return false;
    const boxes=[...document.querySelectorAll('#ng8-pins')];
    let host=boxes.find(box=>root.contains(box))||boxes[0]||null;

    if(!host){host=document.createElement('section');host.id='ng8-pins';}
    if(!root.contains(host)){
      const firstProject=root.querySelector(PROJECT_SEL),anchor=topChild(root,firstProject);
      root.insertBefore(host,anchor||root.firstElementChild||null);
    }

    for(const box of boxes){if(box!==host)box.remove();}
    host.dataset.ng90SidebarHost='1';
    document.documentElement.dataset.ng90ProjectHosts='1';
    return true;
  }

  function schedule(delay=60){clearTimeout(repairTimer);repairTimer=setTimeout(repair,delay);}
  function bootstrap(){
    if(repair()){
      bootstrapObserver?.disconnect();bootstrapObserver=null;clearTimeout(bootstrapTimer);return;
    }
    if(!document.documentElement)return;
    bootstrapObserver=new MutationObserver(()=>{if(repair()){bootstrapObserver?.disconnect();bootstrapObserver=null;clearTimeout(bootstrapTimer);}});
    bootstrapObserver.observe(document.documentElement,{childList:true,subtree:true});
    bootstrapTimer=setTimeout(()=>{bootstrapObserver?.disconnect();bootstrapObserver=null;},15000);
  }

  document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(target?.closest('nav,[data-testid*="sidebar"]'))schedule(80);},true);
  window.addEventListener('popstate',()=>schedule(100));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(120);});

  bootstrap();
})();
