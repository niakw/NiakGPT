import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..'),OUT=path.resolve('artifacts/sidebar-session-v123');
const jsNames=['sidebar-projects-v121.js','pin-folders-v096.js','sidebar-actions-v123.js','project-memory-ui-v132.js'];
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
      window.__memoryFailureCalls=0;
      window.__NIAKGPT_PROJECT_MEMORY__={
        status:async()=>({ok:true,connected:false,configured:false,tokenAvailable:false,config:null,state:{mode:'disconnected'},prefs:{autoSync:false,injectOnNewChat:true}}),
        connect:async()=>{window.__memoryFailureCalls++;return{ok:false,error:'synthetic_github_failure'};},
        disconnect:async()=>({ok:true}),
        syncNow:async()=>({ok:false,error:'synthetic_github_failure'}),
        setPrefs:async value=>value
      };
    },{cache,P1,P2});
    const html=`<!doctype html><html data-ng86-activity="ready"><head><style>*{box-sizing:border-box}html,body{margin:0;background:#05090d;color:#dce7f1;font-family:Arial}aside{position:fixed;left:0;top:0;bottom:0;width:310px;overflow:auto;background:#071019}nav{padding:8px}.native{padding:8px}.native a{display:block;padding:7px;color:white}main{margin-left:310px;min-height:100vh;padding:30px}</style></head><body><aside data-testid="conversation-sidebar"><nav><a href="/">Nouveau chat</a><div class="native"><h3>Projects</h3><a href="/g/${P1}/project">Studio</a><a href="/g/${P2}/project">Research Lab</a></div><h3>Récents</h3><a href="/c/${cid(0)}">Recent</a><section id="ng8-pins"></section></nav></aside><main><article><div data-message-author-role="assistant">Session UX</div></article><button id="ng90-settings-btn" type="button">Réglages</button><div id="ng90-control" class="open" style="display:none;position:fixed;right:20px;top:20px;z-index:9999;background:#111;padding:12px;width:520px"><div class="ng90-card"><div class="ng90-grid"></div></div></div></main></body></html>`;
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

    // Project Memory must fail visibly without damaging the core Projects UX.
    await page.evaluate(()=>{document.getElementById('ng90-control').style.display='block';});
    await page.locator('#ng90-settings-btn').click();
    await page.locator('[data-ng132-memory]').waitFor({state:'visible',timeout:3000});
    await page.locator('[data-ng132-connect]').evaluate(button=>{button.dataset.ngLabStable='1';});
    await page.waitForTimeout(240);
    assert(await page.locator('[data-ng132-connect]').getAttribute('data-ng-lab-stable')==='1',`${engine}: mounted Project Memory form was replaced after settings open`);
    await page.locator('[data-ng132-repo]').fill('niakw/private-memory-lab');
    await page.locator('[data-ng132-branch]').fill('main');
    await page.locator('[data-ng132-root]').fill('.niakgpt-memory');
    await page.locator('[data-ng132-token]').fill('synthetic-token-value');
    await page.locator('[data-ng132-connect]').click();
    await page.waitForFunction(()=>window.__memoryFailureCalls===1,null,{timeout:3000});
    await page.waitForFunction(()=>/Connexion refusée/.test(document.querySelector('.ng132-memory-status')?.innerText||''),null,{timeout:5000});
    assert(await page.locator('[data-ng132-repo]').inputValue()==='niakw/private-memory-lab',`${engine}: failed Project Memory connect erased repository`);
    assert(await page.locator('[data-ng132-token]').inputValue()==='synthetic-token-value',`${engine}: failed Project Memory connect erased token`);
    await page.evaluate(()=>{document.getElementById('ng90-control').style.display='none';});
    assert(await page.locator('#ng8-pins a[data-ng121-pid="'+P1+'"]').count()===1,`${engine}: Project Memory failure removed Projects catalog`);
    const projectRows=await page.evaluate(()=>{
      return [...document.querySelectorAll('#ng8-pins .ng96-pin-entry')].map(entry=>{
        const link=entry.querySelector(':scope>a[data-ng8-pin]'),button=entry.querySelector(':scope>.ng113-native-actions-project');
        const er=entry.getBoundingClientRect(),lr=link?.getBoundingClientRect(),br=button?.getBoundingClientRect();
        const hit=(x,y)=>document.elementFromPoint(x,y);
        return {
          id:entry.dataset.pid||'',entry:{left:er.left,right:er.right,top:er.top,bottom:er.bottom,width:er.width,height:er.height},
          link:lr&&{left:lr.left,right:lr.right,top:lr.top,bottom:lr.bottom,width:lr.width,height:lr.height},
          button:br&&{left:br.left,right:br.right,top:br.top,bottom:br.bottom,width:br.width,height:br.height},
          linkHit:!!(lr&&hit((lr.left+lr.right)/2,(lr.top+lr.bottom)/2)?.closest('a[data-ng8-pin]')),
          buttonHit:!!(br&&hit((br.left+br.right)/2,(br.top+br.bottom)/2)?.closest('.ng113-native-actions-project')),
          centerVisible:(()=>{const list=entry.closest('.ng8-pin-list'),vr=list?.getBoundingClientRect();if(!lr||!br||!vr)return false;const ly=(lr.top+lr.bottom)/2,by=(br.top+br.bottom)/2;return ly>=vr.top&&ly<=vr.bottom&&by>=vr.top&&by<=vr.bottom&&ly>=0&&ly<=innerHeight&&by>=0&&by<=innerHeight;})(),
          overflowX:entry.scrollWidth-entry.clientWidth
        };
      });
    });
    for(const row of projectRows){
      assert(row.link&&row.button,`${engine}: Project row lost title or action button ${row.id}`);
      assert(row.link.right<=row.button.left+0.5,`${engine}: Project title/action overlap ${row.id}: ${JSON.stringify(row)}`);
      assert(row.button.right<=row.entry.right+0.5&&row.button.left>=row.entry.left,`${engine}: Project action escaped row ${row.id}`);
      assert(Math.abs((row.link.top+row.link.bottom)/2-(row.button.top+row.button.bottom)/2)<=3,`${engine}: Project action dropped to another visual line ${row.id}`);
      assert(row.overflowX<=1,`${engine}: Project row has horizontal overflow ${row.id}`);
      if(row.centerVisible)assert(row.linkHit&&row.buttonHit,`${engine}: center-visible Project row geometry is not actually hit-testable ${row.id}: ${JSON.stringify(row)}`);
    }
    for(const sample of [0,Math.floor(projects.length/2),projects.length-1]){
      const row=page.locator('#ng8-pins .ng96-pin-entry').nth(sample);await row.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await page.waitForTimeout(80);
      const hitState=await row.evaluate(entry=>{const link=entry.querySelector(':scope>a[data-ng8-pin]'),button=entry.querySelector(':scope>.ng113-native-actions-project'),list=entry.closest('.ng8-pin-list'),side=entry.closest('[data-testid="conversation-sidebar"]'),lr=link.getBoundingClientRect(),br=button.getBoundingClientRect(),vr=list?.getBoundingClientRect(),sr=side?.getBoundingClientRect(),at=r=>document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2),node=n=>n?{tag:n.tagName,id:n.id||'',cls:String(n.className||'').slice(0,160)}:null,hl=at(lr),hb=at(br);return{link:!!hl?.closest('a[data-ng8-pin]'),button:!!hb?.closest('.ng113-native-actions-project'),hitLink:node(hl),hitButton:node(hb),linkRect:{left:lr.left,right:lr.right,top:lr.top,bottom:lr.bottom},buttonRect:{left:br.left,right:br.right,top:br.top,bottom:br.bottom},listRect:vr&&{left:vr.left,right:vr.right,top:vr.top,bottom:vr.bottom},sidebarRect:sr&&{left:sr.left,right:sr.right,top:sr.top,bottom:sr.bottom},scrollTop:list?.scrollTop||0};});
      assert(hitState.link&&hitState.button,`${engine}: human-scrolled Project row is not hit-testable at sample ${sample}: ${JSON.stringify(hitState)}`);
    }
    await page.evaluate(()=>{const side=document.querySelector('[data-testid="conversation-sidebar"]'),main=document.querySelector('main');side.style.width='270px';main.style.marginLeft='270px';});
    await page.waitForTimeout(120);
    const compactRows=await page.evaluate(()=>[...document.querySelectorAll('#ng8-pins .ng96-pin-entry')].map(entry=>{const link=entry.querySelector(':scope>a[data-ng8-pin]'),button=entry.querySelector(':scope>.ng113-native-actions-project'),er=entry.getBoundingClientRect(),lr=link?.getBoundingClientRect(),br=button?.getBoundingClientRect(),hit=(x,y)=>document.elementFromPoint(x,y);return{id:entry.dataset.pid||'',entryW:er.width,link:lr&&{left:lr.left,right:lr.right,top:lr.top,bottom:lr.bottom,width:lr.width},button:br&&{left:br.left,right:br.right,top:br.top,bottom:br.bottom,width:br.width,height:br.height},linkHit:!!(lr&&hit((lr.left+lr.right)/2,(lr.top+lr.bottom)/2)?.closest('a[data-ng8-pin]')),buttonHit:!!(br&&hit((br.left+br.right)/2,(br.top+br.bottom)/2)?.closest('.ng113-native-actions-project')),centerVisible:(()=>{const list=entry.closest('.ng8-pin-list'),vr=list?.getBoundingClientRect();if(!lr||!br||!vr)return false;const ly=(lr.top+lr.bottom)/2,by=(br.top+br.bottom)/2;return ly>=vr.top&&ly<=vr.bottom&&by>=vr.top&&by<=vr.bottom&&ly>=0&&ly<=innerHeight&&by>=0&&by<=innerHeight;})(),overflowX:entry.scrollWidth-entry.clientWidth};}));
    for(const row of compactRows){assert(row.link&&row.button&&row.link.right<=row.button.left+0.5,`${engine}: compact sidebar Project overlap ${row.id}: ${JSON.stringify(row)}`);assert(row.button.width>=28&&row.button.height>=28&&row.overflowX<=1,`${engine}: compact sidebar Project action geometry broken ${row.id}: ${JSON.stringify(row)}`);if(row.centerVisible)assert(row.linkHit&&row.buttonHit,`${engine}: center-visible compact Project row is not hit-testable ${row.id}: ${JSON.stringify(row)}`);}
    for(const sample of [0,Math.floor(projects.length/2),projects.length-1]){
      const row=page.locator('#ng8-pins .ng96-pin-entry').nth(sample);await row.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await page.waitForTimeout(80);
      const hitState=await row.evaluate(entry=>{const link=entry.querySelector(':scope>a[data-ng8-pin]'),button=entry.querySelector(':scope>.ng113-native-actions-project'),list=entry.closest('.ng8-pin-list'),side=entry.closest('[data-testid="conversation-sidebar"]'),lr=link.getBoundingClientRect(),br=button.getBoundingClientRect(),vr=list?.getBoundingClientRect(),sr=side?.getBoundingClientRect(),at=r=>document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2),node=n=>n?{tag:n.tagName,id:n.id||'',cls:String(n.className||'').slice(0,160)}:null,hl=at(lr),hb=at(br);return{link:!!hl?.closest('a[data-ng8-pin]'),button:!!hb?.closest('.ng113-native-actions-project'),hitLink:node(hl),hitButton:node(hb),linkRect:{left:lr.left,right:lr.right,top:lr.top,bottom:lr.bottom},buttonRect:{left:br.left,right:br.right,top:br.top,bottom:br.bottom},listRect:vr&&{left:vr.left,right:vr.right,top:vr.top,bottom:vr.bottom},sidebarRect:sr&&{left:sr.left,right:sr.right,top:sr.top,bottom:sr.bottom},scrollTop:list?.scrollTop||0};});
      assert(hitState.link&&hitState.button,`${engine}: compact human-scrolled Project row is not hit-testable at sample ${sample}: ${JSON.stringify(hitState)}`);
    }

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
    const recoveredRows=await page.evaluate(()=>[...document.querySelectorAll('#ng8-pins .ng96-pin-entry')].map(entry=>{const link=entry.querySelector(':scope>a[data-ng8-pin]'),button=entry.querySelector(':scope>.ng113-native-actions-project'),er=entry.getBoundingClientRect(),lr=link?.getBoundingClientRect(),br=button?.getBoundingClientRect(),hit=(x,y)=>document.elementFromPoint(x,y);return{id:entry.dataset.pid||'',entry:{left:er.left,right:er.right,top:er.top,bottom:er.bottom,width:er.width,height:er.height},link:lr&&{left:lr.left,right:lr.right,top:lr.top,bottom:lr.bottom,width:lr.width,height:lr.height},button:br&&{left:br.left,right:br.right,top:br.top,bottom:br.bottom,width:br.width,height:br.height},linkHit:!!(lr&&hit((lr.left+lr.right)/2,(lr.top+lr.bottom)/2)?.closest('a[data-ng8-pin]')),buttonHit:!!(br&&hit((br.left+br.right)/2,(br.top+br.bottom)/2)?.closest('.ng113-native-actions-project')),centerVisible:(()=>{const list=entry.closest('.ng8-pin-list'),vr=list?.getBoundingClientRect();if(!lr||!br||!vr)return false;const ly=(lr.top+lr.bottom)/2,by=(br.top+br.bottom)/2;return ly>=vr.top&&ly<=vr.bottom&&by>=vr.top&&by<=vr.bottom&&ly>=0&&ly<=innerHeight&&by>=0&&by<=innerHeight;})(),overflowX:entry.scrollWidth-entry.clientWidth};}));
    for(const row of recoveredRows){assert(row.link&&row.button,`${engine}: remount lost Project title/action ${row.id}`);assert(row.link.right<=row.button.left+0.5,`${engine}: remount Project title/action overlap ${row.id}`);assert(Math.abs((row.link.top+row.link.bottom)/2-(row.button.top+row.button.bottom)/2)<=3,`${engine}: remount action dropped to another visual line ${row.id}`);assert(row.overflowX<=1,`${engine}: remount Project row overflow ${row.id}: ${JSON.stringify(row)}`);if(row.centerVisible)assert(row.linkHit&&row.buttonHit,`${engine}: remount center-visible Project row not hit-testable ${row.id}: ${JSON.stringify(row)}`);}
    for(const sample of [0,Math.floor(projects.length/2),projects.length-1]){
      const row=page.locator('#ng8-pins .ng96-pin-entry').nth(sample);await row.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await page.waitForTimeout(80);
      const hitState=await row.evaluate(entry=>{const link=entry.querySelector(':scope>a[data-ng8-pin]'),button=entry.querySelector(':scope>.ng113-native-actions-project'),list=entry.closest('.ng8-pin-list'),side=entry.closest('[data-testid="conversation-sidebar"]'),lr=link.getBoundingClientRect(),br=button.getBoundingClientRect(),vr=list?.getBoundingClientRect(),sr=side?.getBoundingClientRect(),at=r=>document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2),node=n=>n?{tag:n.tagName,id:n.id||'',cls:String(n.className||'').slice(0,160)}:null,hl=at(lr),hb=at(br);return{link:!!hl?.closest('a[data-ng8-pin]'),button:!!hb?.closest('.ng113-native-actions-project'),hitLink:node(hl),hitButton:node(hb),linkRect:{left:lr.left,right:lr.right,top:lr.top,bottom:lr.bottom},buttonRect:{left:br.left,right:br.right,top:br.top,bottom:br.bottom},listRect:vr&&{left:vr.left,right:vr.right,top:vr.top,bottom:vr.bottom},sidebarRect:sr&&{left:sr.left,right:sr.right,top:sr.top,bottom:sr.bottom},scrollTop:list?.scrollTop||0};});
      assert(hitState.link&&hitState.button,`${engine}: remount human-scrolled Project row is not hit-testable at sample ${sample}: ${JSON.stringify(hitState)}`);
    }

    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,'sidebar-session.png'),fullPage:true});await fs.writeFile(path.join(dir,'sidebar-session.json'),JSON.stringify({engine,placement,before,stable,projectRows,compactRows,projectMenuGeometry,chatMenuState,recovered,recoveredRows},null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`sidebar-session-ux-v123: ${Object.keys(engines).join(',')} PASS`);
