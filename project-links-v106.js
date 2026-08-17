(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_PROJECT_LINKS_106__)return;
  window.__NIAKGPT_PROJECT_LINKS_106__=true;

  let observer=null,box=null,timer=0,suspended=false;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();

  function ensureProjectsHome(){
    const pins=document.getElementById('ng8-pins');
    const head=pins?.querySelector(':scope > .ng8-pin-head');
    if(!head)return false;
    let link=head.querySelector(':scope > a.ng106-projects-home');
    if(link){
      if(link.getAttribute('href')!=='/projects')link.setAttribute('href','/projects');
      return true;
    }
    const label=[...head.children].find(el=>/^(projects?|projets?)$/i.test(clean(el.textContent)));
    if(!label)return false;
    link=document.createElement('a');
    link.className='ng106-projects-home';
    link.href='/projects';
    link.textContent='PROJECTS';
    link.title='Ouvrir tous les Projects ChatGPT';
    link.setAttribute('aria-label','Ouvrir tous les Projects ChatGPT');
    label.replaceWith(link);
    return true;
  }

  function verifyDrawerLinks(){
    const pins=document.getElementById('ng8-pins');if(!pins)return;
    for(const link of pins.querySelectorAll('.ng96-folder-list > a[data-chat]')){
      const pid=link.closest('.ng96-pin-drawer')?.dataset.pid||'';
      const cid=link.dataset.chat||'';
      if(pid&&cid&&!/\/c\//.test(link.getAttribute('href')||''))link.setAttribute('href',`/g/${pid}/c/${cid}`);
    }
  }

  function repair(){if(suspended)return;ensureProjectsHome();verifyDrawerLinks();}
  function schedule(delay=16){if(suspended)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;repair();},delay);}

  function bind(){
    const next=document.getElementById('ng8-pins');
    if(!next||next===box)return;
    observer?.disconnect();box=next;
    observer=new MutationObserver(()=>schedule(12));
    observer.observe(box,{childList:true,subtree:true});
    schedule(0);
  }
  function start(){
    suspended=false;bind();
    if(!box){
      const boot=new MutationObserver(()=>{bind();if(box)boot.disconnect();});
      boot.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(()=>boot.disconnect(),15000);
    }
    schedule(0);
  }
  function stop(){suspended=true;clearTimeout(timer);timer=0;observer?.disconnect();observer=null;box=null;}

  document.addEventListener('niakgpt:pins-rendered',()=>{bind();schedule(0);});
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
