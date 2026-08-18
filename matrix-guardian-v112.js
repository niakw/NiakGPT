(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_MATRIX_GUARDIAN_112__)return;
  window.__NIAKGPT_MATRIX_GUARDIAN_112__=true;
  let timer=0,observer=null,fallback=null,ctx=null,loop=0,cols=[],w=0,h=0;
  const enabled=()=>document.documentElement.dataset.ng90Safe!=='1'&&document.documentElement.dataset.ng90Matrix!=='off';
  const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function native(){return document.querySelector('main>#ng8-matrix,#ng8-matrix');}
  function stopFallback(){clearTimeout(loop);loop=0;if(fallback){fallback.remove();fallback=null;ctx=null;cols=[];}}
  function sizeFallback(){if(!fallback)return;const dpr=Math.min(1.5,devicePixelRatio||1),cw=innerWidth,ch=innerHeight;w=fallback.width=Math.max(1,Math.floor(cw*dpr*.42));h=fallback.height=Math.max(1,Math.floor(ch*dpr*.42));fallback.style.width=`${cw}px`;fallback.style.height=`${ch}px`;cols=Array(Math.ceil(w/11)).fill(0).map(()=>Math.random()*h);}
  function drawFrame(staticOnly=false){
    if(!fallback||!ctx||!enabled())return stopFallback();const mode=document.documentElement.dataset.ng90Matrix||'subtle';ctx.fillStyle=staticOnly?'rgba(2,8,5,.34)':'rgba(2,8,5,.15)';ctx.fillRect(0,0,w,h);ctx.font='9px Consolas,monospace';const chars='01アイウエオカキクケコ<>[]{}▓░λΣ∞';
    for(let i=0;i<cols.length;i++){ctx.fillStyle=Math.random()>.982?'rgba(215,255,222,.78)':'rgba(28,255,88,.46)';ctx.fillText(chars[(Math.random()*chars.length)|0],i*11,cols[i]);if(!staticOnly){cols[i]+=7.2;if(cols[i]>h&&Math.random()>.97)cols[i]=0;}}
    if(staticOnly)return;const active=document.documentElement.dataset.ng86Activity!=='ready',heavy=document.documentElement.dataset.ng8Heavy==='1';const gap=heavy?(active?1800:1200):active?850:(mode==='normal'?160:300);loop=setTimeout(()=>drawFrame(false),gap);
  }
  function ensureFallback(){
    if(!enabled())return stopFallback();if(native())return stopFallback();if(fallback?.isConnected)return;
    fallback=document.createElement('canvas');fallback.id='ng112-matrix-fallback';fallback.setAttribute('aria-hidden','true');(document.querySelector('main')||document.body).prepend(fallback);ctx=fallback.getContext('2d',{alpha:true});sizeFallback();drawFrame(reduce());
    window.__NIAKGPT_DIAGNOSTICS__?.set('matrix-guard','FALLBACK · canvas restauré');
  }
  function repair(){
    timer=0;if(!enabled()){stopFallback();return;}
    const c=native();if(c){stopFallback();c.dataset.ng112MatrixGuard='1';c.style.removeProperty('display');c.style.removeProperty('visibility');window.__NIAKGPT_DIAGNOSTICS__?.set('matrix-guard','OK · canvas natif visible');return;}
    ensureFallback();
  }
  function schedule(delay=30){clearTimeout(timer);timer=setTimeout(repair,delay);}
  function start(){observer?.disconnect();observer=new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length||r.removedNodes.length))schedule(45);});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-ng90-matrix','data-ng90-safe']});for(const d of[0,180,700,1800,3500])setTimeout(()=>schedule(0),d);}
  window.addEventListener('resize',()=>{if(fallback){sizeFallback();drawFrame(reduce());}schedule(60);},{passive:true});document.addEventListener('niakgpt:settings-changed',()=>schedule(20));window.addEventListener('popstate',()=>schedule(40));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(40));window.addEventListener('pagehide',()=>{observer?.disconnect();stopFallback();});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();