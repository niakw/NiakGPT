const {test,expect,chromium}=require('@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const FIXTURE=fs.readFileSync(path.join(ROOT,'visual-lab','runtime-fixture.html'),'utf8');
const VERSION=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.json'),'utf8')).version;
const EXECUTABLE=process.env.NIAKGPT_EXECUTABLE_PATH||undefined;
const LABEL=process.env.NIAKGPT_BROWSER_LABEL||'chromium';
const HEADLESS=process.env.NIAKGPT_HEADLESS!=='0';
const P1='g-p-aaaaaaaaaaaaaaaa';
const P2='g-p-bbbbbbbbbbbbbbbb';
const C1='11111111-1111-4111-8111-111111111111';
const OUT=path.join(ROOT,'visual-lab','artifacts','user-journey-v130',LABEL.replace(/[^a-z0-9._-]+/gi,'-'));

const projectRaw=(id,name)=>({gizmo:{gizmo:{id,display:{name,description:`${name} fixture`},instructions:''}}});
const chat=(projectId,i)=>({id:`${String(i).padStart(8,'0')}-0000-4000-8000-${String(i).padStart(12,'0')}`,title:`${projectId===P1?'Studio':'Research'} chat ${i}`,gizmo_id:projectId,update_time:(Date.now()-i*1000)/1000});

async function worker(context){
  return context.serviceWorkers().find(w=>w.url().includes('background-v100.js'))||context.waitForEvent('serviceworker',{predicate:w=>w.url().includes('background-v100.js'),timeout:15000});
}

async function boundedClose(context,dir,timeout=8000){
  let timer=0;
  try{
    await Promise.race([
      context.close().catch(()=>{}),
      new Promise(resolve=>{timer=setTimeout(resolve,timeout);})
    ]);
  }finally{
    clearTimeout(timer);
    try{fs.rmSync(dir,{recursive:true,force:true});}catch{}
  }
}

async function launch(){
  fs.mkdirSync(OUT,{recursive:true});
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`niakgpt-user-journey-${LABEL}-`));
  const launchOptions={
    headless:HEADLESS,
    viewport:{width:1440,height:900},
    colorScheme:'dark',
    reducedMotion:'reduce',
    args:[`--disable-extensions-except=${ROOT}`,`--load-extension=${ROOT}`,'--disable-background-mode','--no-first-run','--no-default-browser-check']
  };
  if(EXECUTABLE)launchOptions.executablePath=EXECUTABLE;else launchOptions.channel='chromium';
  const context=await chromium.launchPersistentContext(dir,launchOptions);
  const sw=await worker(context);
  await sw.evaluate(async v=>chrome.storage.local.set({'niakgpt-onboarding-v100':{status:'done',version:v,at:Date.now()}}),VERSION);

  const studio=Array.from({length:36},(_,i)=>chat(P1,i+1));
  const research=Array.from({length:26},(_,i)=>chat(P2,i+101));
  const all=[...studio,...research];
  const traffic={projectCalls:[],inFlight:0,maxInFlight:0,general:0,sidebar:0};

  await context.route('https://chatgpt.com/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(req.resourceType()==='document')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:FIXTURE});
    if(url.pathname==='/api/auth/session')return json({accessToken:'ux-v130-token'});
    if(url.pathname==='/backend-api/gizmos/snorlax/sidebar'){
      traffic.sidebar++;
      return json({items:[projectRaw(P1,'Studio'),projectRaw(P2,'Research Lab')],cursor:null});
    }
    const pm=url.pathname.match(/^\/backend-api\/gizmos\/(g-p-[A-Za-z0-9_-]+)\/conversations$/);
    if(pm){
      traffic.inFlight++;traffic.maxInFlight=Math.max(traffic.maxInFlight,traffic.inFlight);
      traffic.projectCalls.push({pid:pm[1],query:url.search,at:Date.now()});
      await new Promise(r=>setTimeout(r,170));
      traffic.inFlight--;
      const source=pm[1]===P1?studio:research;
      const cursor=Number(url.searchParams.get('cursor')||0)||0;
      const items=source.slice(cursor,cursor+20);
      const next=cursor+items.length<source.length?String(cursor+items.length):null;
      return json({items,cursor:next});
    }
    if(url.pathname==='/backend-api/conversations'){
      traffic.general++;
      const offset=Number(url.searchParams.get('offset')||0)||0,limit=Number(url.searchParams.get('limit')||100)||100;
      const items=all.slice(offset,offset+limit);
      return json({items,has_more:offset+items.length<all.length,total:all.length});
    }
    if(/^\/backend-api\/conversation\//.test(url.pathname))return json({id:url.pathname.split('/').pop(),title:'UX conversation',gizmo_id:P1,mapping:{}});
    if(url.pathname==='/backend-api/conversation')return json({conversation_id:C1});
    return route.fulfill({status:204,body:''});
  });

  const page=context.pages()[0]||await context.newPage();
  const pageErrors=[],consoleErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.goto(`https://chatgpt.com/c/${C1}`,{waitUntil:'commit'});
  if(!HEADLESS)await page.bringToFront();
  await expect(page.locator('#ng8-status')).toContainText(VERSION,{timeout:20000});
  await expect(page.locator('#ng8-pins a[data-ng8-pin="1"]')).toHaveCount(2,{timeout:20000});

  // Test-only RPC helper: it uses the exact public event contract used by runtime modules.
  await page.evaluate(()=>{
    window.__uxRpcSeq=0;
    window.__uxRpc=(path,timeout=2500)=>new Promise(resolve=>{
      const id=`ux130-${Date.now()}-${++window.__uxRpcSeq}`;
      const done=result=>{clearTimeout(timer);document.removeEventListener('niakgpt:rpc-response',handler);resolve(result);};
      const handler=e=>{if(e.detail?.id===id)done(e.detail);};
      const timer=setTimeout(()=>{document.removeEventListener('niakgpt:rpc-response',handler);resolve({ok:false,error:'ux_timeout'});},timeout);
      document.addEventListener('niakgpt:rpc-response',handler);
      document.dispatchEvent(new CustomEvent('niakgpt:rpc-request',{detail:{id,path,method:'GET'}}));
    });
  });

  return{
    context,page,traffic,pageErrors,consoleErrors,
    close:()=>boundedClose(context,dir)
  };
}

const pin=(page,pid)=>page.locator(`#ng8-pins a[data-ng8-pin="1"][data-ng121-pid="${pid}"]`);
const drawer=(page,pid)=>page.locator(`#ng8-pins .ng96-pin-drawer[data-pid="${pid}"]`);
const action=(page,pid)=>page.locator(`#ng8-pins .ng96-pin-entry[data-pid="${pid}"]>.ng113-native-actions-project`);

async function shot(page,name){await page.screenshot({path:path.join(OUT,name),fullPage:true});}

async function assertSingleOpen(page,expectedPid){
  await expect(drawer(page,expectedPid)).toHaveCount(1,{timeout:7000});
  const other=expectedPid===P1?P2:P1;
  await expect(drawer(page,other)).toHaveCount(0);
  await expect(pin(page,expectedPid)).toHaveAttribute('aria-expanded','true');
  await expect(pin(page,other)).toHaveAttribute('aria-expanded','false');
}

test.setTimeout(180000);

test(`issue #55 automated Project-switch user journey + visual evidence (${LABEL})`,async()=>{
  const rt=await launch();
  try{
    const {page}=rt;
    const initialUrl=page.url();
    await shot(page,'01-ready.png');

    await test.step('rapid Project switching stays local, single-owner and responsive',async()=>{
      for(let i=0;i<5;i++){
        await pin(page,P1).click();
        await page.waitForTimeout(28);
        await pin(page,P2).click();
        await page.waitForTimeout(28);
      }
      await assertSingleOpen(page,P2);
      expect(page.url()).toBe(initialUrl);
      const pins=await page.locator('#ng8-pins a[data-ng8-pin="1"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-ng121-pid')));
      expect(new Set(pins).size).toBe(pins.length);
      await shot(page,'02-rapid-switch-final.png');
    });

    await test.step('busy transition blocks backend work without freezing Project UX',async()=>{
      // Prime the bridge so the next request has to wait for the network gap.
      const prime=await page.evaluate(()=>window.__uxRpc('/backend-api/conversations?offset=0&limit=100'));
      expect(prime.ok).toBeTruthy();
      const before=rt.traffic.projectCalls.length;
      const blocked=await page.evaluate(async pid=>{
        document.documentElement.dataset.ng86Activity='ready';
        const pending=window.__uxRpc(`/backend-api/gizmos/${pid}/conversations?limit=20&cursor=777`);
        setTimeout(()=>{document.documentElement.dataset.ng86Activity='thinking';document.documentElement.dataset.ng8Running='1';},35);
        return pending;
      },P1);
      expect(blocked.ok).toBeFalsy();
      expect(blocked.error).toBe('native_busy');
      expect(rt.traffic.projectCalls.length).toBe(before);

      // The sidebar itself must still accept local user interaction while ChatGPT is active.
      await pin(page,P1).click();
      await expect(pin(page,P1)).toBeFocused();
      await expect(page.locator('#ng8-pins')).toBeVisible();
      expect(page.url()).toBe(initialUrl);
      await shot(page,'03-thinking-local-interaction.png');

      await page.evaluate(()=>{document.documentElement.dataset.ng86Activity='ready';delete document.documentElement.dataset.ng8Running;});
      const retry=await page.evaluate(pid=>window.__uxRpc(`/backend-api/gizmos/${pid}/conversations?limit=20&cursor=777`),P1);
      expect(retry.ok).toBeTruthy();
      expect(rt.traffic.projectCalls.length).toBe(before+1);
    });

    await test.step('focus, drawer content and action menu remain usable after stress',async()=>{
      // Return to a known open state and wait for hydrated rows.
      if(await drawer(page,P1).count()===0)await pin(page,P1).click();
      await expect(drawer(page,P1)).toHaveCount(1,{timeout:7000});
      const rows=drawer(page,P1).locator('.ng96-chat-entry');
      await expect.poll(()=>rows.count(),{timeout:15000}).toBeGreaterThan(0);
      const ids=await rows.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-chat-entry')).filter(Boolean));
      expect(new Set(ids).size).toBe(ids.length);

      await action(page,P1).click();
      const menu=page.locator('#ng123-action-menu');
      await expect(menu).toBeVisible({timeout:5000});
      const geometry=await menu.evaluate(el=>{const r=el.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight,parent:el.parentElement===document.body};});
      expect(geometry.parent).toBeTruthy();
      expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.w);expect(geometry.bottom).toBeLessThanOrEqual(geometry.h);
      await shot(page,'04-action-menu-after-stress.png');
    });

    expect(rt.traffic.maxInFlight).toBeLessThanOrEqual(1);
    expect(rt.pageErrors).toEqual([]);
    const meaningfulConsoleErrors=rt.consoleErrors.filter(x=>!/favicon|Failed to load resource.*204/i.test(x));
    expect(meaningfulConsoleErrors).toEqual([]);
  }finally{await rt.close();}
});
