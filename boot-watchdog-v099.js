(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_BOOT_WATCHDOG_099__)return;
  window.__NIAKGPT_BOOT_WATCHDOG_099__=true;

  const root=document.documentElement;
  const errors=[];
  root.dataset.ng99Sentinel='1';

  const text=value=>String(value?.message||value?.reason?.message||value?.reason||value||'Erreur inconnue').replace(/\s+/g,' ').slice(0,240);
  function remember(kind,value){
    const message=`${kind}: ${text(value)}`;
    if(!errors.includes(message))errors.unshift(message);
    errors.splice(8);
    try{sessionStorage.setItem('niakgpt-last-boot-errors-v099',JSON.stringify(errors));}catch{}
  }
  window.addEventListener('error',event=>remember('JS',event.error||event.message),true);
  window.addEventListener('unhandledrejection',event=>remember('PROMISE',event.reason),true);

  function node(tag,label,className=''){
    const el=document.createElement(tag);if(label!=null)el.textContent=label;if(className)el.className=className;return el;
  }
  function button(label,aria){const b=node('button',label);b.type='button';if(aria)b.setAttribute('aria-label',aria);return b;}
  function style(el,values){Object.assign(el.style,values);return el;}

  function ensureFallbackShell(){
    if(!document.body||document.body.classList.contains('ng8-ready'))return false;
    root.dataset.ng99Bootstrap='fallback';
    document.body.classList.add('ng8-ready');

    let rail=document.getElementById('ng8-rail');
    if(!rail){
      rail=node('aside');rail.id='ng8-rail';rail.setAttribute('aria-label','Outils NiakGPT · secours bootstrap');
      const explorer=button('▤','Explorer');explorer.dataset.tab='explorer';
      const toc=button('☷','Sommaire');toc.dataset.tab='toc';
      const diag=button('◉','Diagnostic bootstrap');diag.dataset.tab='diag';
      const spacer=node('span');const quick=button('⌘','Quick Open');quick.dataset.q='1';
      rail.append(explorer,toc,diag,spacer,quick);document.body.appendChild(rail);
      diag.addEventListener('click',()=>{
        let panel=document.getElementById('ng8-panel');if(!panel){panel=node('aside');panel.id='ng8-panel';document.body.appendChild(panel);}panel.replaceChildren();
        panel.append(node('h3','NIAKGPT · BOOT DIAGNOSTIC'));
        panel.append(node('p','Le shell principal n’a pas terminé son bootstrap. Le mode secours a pris le relais.'));
        const list=node('div');for(const err of errors.length?errors:['Aucune exception capturée — injection app-v090 absente ou interrompue avant erreur.'])list.append(node('pre',err));panel.append(list);
        style(panel,{display:'block',position:'fixed',right:'46px',top:'70px',zIndex:'2147483646',width:'420px',maxWidth:'calc(100vw - 70px)',maxHeight:'70vh',overflow:'auto',padding:'14px',background:'#091018',color:'#d7e3ee',border:'1px solid #c84b4b',fontFamily:'Consolas,monospace'});
      });
    }

    let status=document.getElementById('ng8-status');
    if(!status){
      status=node('div');status.id='ng8-status';
      const version=node('span','NiakGPT 0.9.9','ng8-version');const project=node('span','BOOT SECOURS','ng8-status-project');const mark=node('strong','BY SKYNET');const state=node('span','RUNTIME INCOMPLET','ng8-core-state');
      status.append(version,project,mark,state);document.body.appendChild(status);
    }

    let pins=document.getElementById('ng8-pins');
    const sidebar=document.querySelector('[data-testid="conversation-sidebar"],[data-testid="sidebar"],nav,aside');
    if(!pins&&sidebar){
      pins=node('section');pins.id='ng8-pins';pins.dataset.ng99Fallback='1';
      const projects=[...document.querySelectorAll('a[href*="/g/"]')].filter(a=>/g-p-/i.test(a.getAttribute('href')||'')).slice(0,12);
      const chats=[...document.querySelectorAll('a[href*="/c/"]')].slice(0,30);
      pins.append(node('div',`PROJECTS · ${projects.length} · CHATS · ${chats.length}`,'ng8-pin-head'));
      for(const source of projects){const a=node('a',(source.textContent||source.getAttribute('aria-label')||'Project').trim().slice(0,80));a.href=source.getAttribute('href')||'#';a.dataset.ng8Pin='1';pins.append(a);}
      sidebar.appendChild(pins);
    }
    return true;
  }

  function verify(){
    if(!document.body){setTimeout(verify,200);return;}
    if(document.body.classList.contains('ng8-ready')){root.dataset.ng99Bootstrap='ready';return;}
    ensureFallbackShell();
  }
  setTimeout(verify,5000);
})();
