import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..'),OUT=path.resolve('artifacts/sidebar-session-v123');
const jsNames=['sidebar-projects-v121.js','pin-folders-v096.js','sidebar-actions-v123.js'];
const cssNames=['theme-v08.css','sidebar-ux-v119.css','pin-folders-v096.css','native-actions-v113.css','sidebar-actions-v123.css'];
const loaded=Object.fromEntries(await Promise.all([...jsNames,...cssNames].map(async n=>[n,await fs.readFile(path.join(ROOT,n),'utf8')])));
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P1='g-p-aaaaaaaaaaaaaaaa',P2='g-p-bbbbbbbbbbbbbbbb';
const pid=i=>i===0?P1:i===1?P2:`g-p-${i.toString(36).padStart(16,'0')}`;
const cid=i=>`${(i+1).toString(16).padStart(8,'0')}-0000-4000-8000-${(i+1).toString(16).padStart(12,'0')}`;
const projects=Array.from({length:28},(_,i)=>({id:pid(i),name:i===0?'Studio':i===1?'Research Lab':`UX Project ${String(i+1).padStart(2,'0')}`,href:`/g/${pid(i)}/project`}));
const chats=Array.from({length:58},(_,i)=>({id:cid(i),title:`Studio chat ${String(i+1).padStart(2,'0')}`,projectId:P1,updated:Date.now()-i*60000,href:`/g/${P1}/c/${cid(i)}`}));
const cache={schema:2,at:Date.now(),projects,chats,projectChats:{[P1]:chats},counts:{[P1]:chats.length,[P2]:0},indexedProjectIds:[P1,P2]};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1180,height:760},colorScheme:'dark',reducedMotion:'reduce'}),page=await context.newPage();
  try{
    await page.addInitScript(({cache,P1,P2})=>{
      let data=structuredClone(cache);const subs=[],storageListeners=[];const publish=next=>{data=structuredClone(next);for(const fn of subs)fn(structuredClone(data));for(const fn of storageListeners)fn({'niakgpt-v08-cache':{newValue:structuredClone(data),oldValue:null}},'local');};
      window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.70'})},storage:{local:{get:async keys=>{if(typeof keys==='string')return{[keys]:keys==='niakgpt-v08-cache'?structuredClone(data):{}};return{'niakgpt-v08-cache':structuredClone(data),'niakgpt-governance-v085':{coreProjectIds:[],hiddenProjectIds:[]}};},set:async obj=>{if(obj['niakgpt-v08-cache'])publish(obj['niakgpt-v08-cache']);}},onChanged:{addListener:fn=>storageListeners.push(fn)}}};
      window.__NIAKGPT_CACHE_BUS__={get:async()=>structuredClone(data),subscribe(fn){subs.push(fn);fn(structuredClone(data));return()=>{};},async update(mutator){const next=await mutator(structuredClone(data));publish(next);return structuredClone(data);}};
      window.__publishHumanCache=mutatorSource=>{const fn=(0,eval)(`(${mutatorSource})`);publish(fn(structuredClone(data)));};window.__humanCache=()=>structuredClone(data);
      document.addEventListener('niakgpt:rpc-request',event=>{const d=event.detail||{},m=String(d.path||'').match(/\/backend-api\/conversation\/([^/?]+)/);if(!m)return;let next=structuredClone(data),row=next.chats.find(c=>c.id===m[1]);if(row&&d.body&&Object.prototype.hasOwnProperty.call(d.body,'title'))row.title=String(d.body.title);if(row&&d.body&&Object.prototype.hasOwnProperty.call(d.body,'gizmo_id'))row.projectId=d.body.gizmo_id||'';setTimeout(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{id:m[1],title:row?.title||'',gizmo_id:row?.projectId||P1}}})),5);});
      window.__P1=P1;window.__P2=P2;
    },{cache,P1,P2});
    const html=`<!doctype html><html data-ng86-activity="ready"><head><style>*{box-sizing:border-box}html,body{margin:0;background:#05090d;color:#dce7f1;font-family:Arial}aside{position:fixed;left:0;top:0;bottom:0;width:310px;overflow:auto;background:#071019}nav{padding:8px}.native{padding:8px}.native a{display:block;padding:7px;color:white}main{margin-left:310px;min-height:100vh;padding:30px}</style></head><body><aside data-testid="conversation-sidebar"><nav><a href="/">Nouveau chat</a><div class="native"><h3>Projects</h3><a href="/g/${P1}/project">Studio</a><a href="/g/${P2}/project">Research Lab</a></div><h3>Récents</h3><a href="/c/${cid(0)}">Recent</a><section id="ng8-pins"></section></nav></aside><main><article><div data-message-author-role="assistant">Session UX</div></article></main></body></html>`;
    await page.route('https://chatgpt.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://chatgpt.com/c/'+cid(0),{waitUntil:'domcontentloaded'});
    for(const n of cssNames)await page.addStyleTag({content:loaded[n]});for(const n of jsNames)await page.addScriptTag({content:loaded[n]});
    await page.waitForFunction(count=>document.querySelectorAll('#ng8-pins a[data-ng8-pin="1"]').length===count,projects.length,{timeout:6000});
    const placement=await page.evaluate(()=>{const box=document.getElementById('ng8-pins'),nav=box?.parentElement,native=nav?.querySelector('.native'),primary=nav?.querySelector(':scope>a[href="/"]'),children=nav?[...nav.children]:[];return{mode:box?.dataset.ng121Placement||'',boxIndex:children.indexOf(box),nativeIndex:children.indexOf(native),primaryIndex:children.indexOf(primary),first:children[0]===box};});
    assert(placement.mode==='native-projects',`${engine}: Projects block did not lock to the native Projects slot (${placement.mode})`);assert(placement.primaryIndex>=0&&placement.primaryIndex<placement.boxIndex&&placement.boxIndex<placement.nativeIndex&&!placement.first,`${engine}: Projects block drifted above native primary/logo area`);
    await page.locator(`#ng8-pins a[data-ng121-pid="${P1}"]`).click();await page.waitForFunction(count=>document.querySelectorAll('#ng8-pins .ng96-chat-entry').length===count,chats.length,{timeout:5000});
    const before=await page.evaluate(()=>{const box=document.getElementById('ng8-pins'),head=box.querySelector('.ng8-pin-head'),outer=box.querySelector(':scope>.ng8-pin-list'),inner=box.querySelector('.ng96-folder-list');box.dataset.token='box';head.dataset.token='head';document.querySelector(`#ng8-pins a[data-ng121-pid="${window.__P1}"]`).dataset.token='studio';outer.scrollTop=Math.floor((outer.scrollHeight-outer.clientHeight)*.52);inner.scrollTop=Math.floor((inner.scrollHeight-inner.clientHeight)*.61);return{outer:outer.scrollTop,inner:inner.scrollTop,order:[...box.querySelectorAll('a[data-ng8-pin]')].map(a=>a.dataset.ng121Pid),border:getComputedStyle(box).borderTopWidth+' '+getComputedStyle(box).borderTopStyle+' '+getComputedStyle(box).borderTopColor};});
    assert(before.outer>30&&before.inner>40,`${engine}: scroll fixtures are not actually scrollable`);
    for(let i=0;i<24;i++){await page.evaluate(i=>window.__publishHumanCache(`raw=>({...raw,at:Date.now(),chats:(raw.chats||[]).map((c,j)=>({...c,updated:Number(c.updated||0)+${i+1}+j}))})`),i);await page.evaluate(i=>{const n=document.createElement('span');n.textContent='churn'+i;document.querySelector('main').appendChild(n);n.remove();},i);await sleep(18);}
    const stable=await page.evaluate(()=>{const box=document.getElementById('ng8-pins'),outer=box.querySelector(':scope>.ng8-pin-list'),inner=box.querySelector('.ng96-folder-list');return{box:box.dataset.token,head:box.querySelector('.ng8-pin-head')?.dataset.token,studio:box.querySelector(`a[data-ng121-pid="${window.__P1}"]`)?.dataset.token,outer:outer.scrollTop,inner:inner.scrollTop,order:[...box.querySelectorAll('a[data-ng8-pin]')].map(a=>a.dataset.ng121Pid),border:getComputedStyle(box).borderTopWidth+' '+getComputedStyle(box).borderTopStyle+' '+getComputedStyle(box).borderTopColor};});
    assert(stable.box==='box'&&stable.head==='head'&&stable.studio==='studio',`${engine}: stable Projects nodes were replaced during benign churn`);assert(Math.abs(stable.outer-before.outer)<=3,`${engine}: Projects scroll snapped ${before.outer}->${stable.outer}`);assert(Math.abs(stable.inner-before.inner)<=3,`${engine}: chat scroll snapped ${before.inner}->${stable.inner}`);assert(JSON.stringify(stable.order)===JSON.stringify(before.order),`${engine}: Projects reordered during chat activity`);assert(stable.border===before.border,`${engine}: PROJECTS frame changed during churn`);

    const projectButton=page.locator(`#ng8-pins .ng96-pin-entry[data-pid="${P1}"]>.ng113-native-actions-project`);
    await projectButton.scrollIntoViewIfNeeded();
    const targetSize=await projectButton.evaluate(b=>{const r=b.getBoundingClientRect();return{w:r.width,h:r.height};});
    assert(targetSize.w>=24&&targetSize.h>=24,`${engine}: Project action target is below WCAG 2.5.8 minimum`);
    const clickUntil=async predicate=>{
      for(let attempt=0;attempt<4;attempt++){
        await projectButton.scrollIntoViewIfNeeded();
        await projectButton.click({timeout:5000});
        try{await page.waitForFunction(predicate,null,{timeout:2200});return true;}
        catch{if(attempt<3)await sleep(160);}
      }
      return false;
    };
    let projectMenuGeometry=null;
    for(let i=0;i<5;i++){
      assert(await clickUntil(()=>!!document.querySelector('#ng123-action-menu[data-kind="project"]')),`${engine}: Project menu did not open after bounded human retries (cycle ${i+1})`);
      let state=await page.evaluate(()=>{const m=document.getElementById('ng123-action-menu'),side=document.querySelector('[data-testid="conversation-sidebar"]'),r=m.getBoundingClientRect(),s=side.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return{body:m.parentElement===document.body,fixed:getComputedStyle(m).position==='fixed',hit:!!hit?.closest('#ng123-action-menu'),outside:r.left>=s.right+2,text:m.innerText};});
      projectMenuGeometry=state;
      assert(state.body&&state.fixed&&state.hit&&state.outside,`${engine}: Project menu is clipped/inside sidebar/not hit-testable`);
      assert(state.text.includes('Actualiser')&&!state.text.includes('Déplacer vers'),`${engine}: Project action menu has chat actions`);
      assert(await clickUntil(()=>!document.getElementById('ng123-action-menu')),`${engine}: Project menu did not close after bounded human retries (cycle ${i+1})`);
    }
    const chatButton=page.locator('#ng8-pins .ng96-chat-entry>.ng113-native-actions-chat').nth(12);await chatButton.scrollIntoViewIfNeeded();await chatButton.click();await page.waitForFunction(()=>!!document.querySelector('#ng123-action-menu[data-kind="chat"]'));const chatMenuState=await page.evaluate(()=>{const m=document.getElementById('ng123-action-menu'),side=document.querySelector('[data-testid="conversation-sidebar"]'),r=m.getBoundingClientRect(),s=side.getBoundingClientRect(),hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return{text:m.innerText,body:m.parentElement===document.body,fixed:getComputedStyle(m).position==='fixed',hit:!!hit?.closest('#ng123-action-menu'),outside:r.left>=s.right+2};});assert(chatMenuState.text.includes('Renommer')&&chatMenuState.text.includes('Déplacer vers')&&!chatMenuState.text.includes('Actualiser'),`${engine}: Chat menu identity mixed with Project menu`);assert(chatMenuState.body&&chatMenuState.fixed&&chatMenuState.hit&&chatMenuState.outside,`${engine}: Chat menu is clipped/inside sidebar/not hit-testable`);await chatButton.click();await page.waitForFunction(()=>!document.getElementById('ng123-action-menu'));

    // Remount the entire native sidebar without carrying NiakGPT nodes. v121 must bootstrap again.
    await page.evaluate(()=>{const old=document.querySelector('[data-testid="conversation-sidebar"]'),fresh=old.cloneNode(true);fresh.querySelector('#ng8-pins')?.remove();old.remove();setTimeout(()=>document.body.prepend(fresh),80);});await page.waitForFunction(count=>document.querySelectorAll('#ng8-pins a[data-ng8-pin]').length===count,projects.length,{timeout:4000});
    const recovered=await page.evaluate(()=>{const box=document.getElementById('ng8-pins'),nav=box?.parentElement,native=nav?.querySelector('.native'),primary=nav?.querySelector(':scope>a[href="/"]'),children=nav?[...nav.children]:[];return{actions:document.querySelectorAll('#ng8-pins .ng113-native-actions-project').length,head:document.querySelector('#ng8-pins .ng8-pin-head')?.textContent||'',menus:document.querySelectorAll('#ng123-action-menu').length,placement:box?.dataset.ng121Placement||'',boxIndex:children.indexOf(box),nativeIndex:children.indexOf(native),primaryIndex:children.indexOf(primary)};});assert(recovered.actions===projects.length&&/PROJECTS/.test(recovered.head)&&recovered.menus===0,`${engine}: sidebar remount did not recover a complete interactive catalog`);assert(recovered.placement==='native-projects'&&recovered.primaryIndex<recovered.boxIndex&&recovered.boxIndex<recovered.nativeIndex,`${engine}: sidebar remount recovered Projects at the wrong position`);

    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,'sidebar-session.png'),fullPage:true});await fs.writeFile(path.join(dir,'sidebar-session.json'),JSON.stringify({engine,placement,before,stable,projectMenuGeometry,chatMenuState,recovered},null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-session-ux-v123: ${Object.keys(engines).join(',')} PASS`);
