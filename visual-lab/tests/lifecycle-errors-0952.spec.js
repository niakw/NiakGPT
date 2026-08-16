const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const patchGuard = src => src
  .replace("location.hostname !== 'chatgpt.com' ||", 'false ||')
  .replace("location.hostname!=='chatgpt.com'||", 'false||');

function baseChromeShim({ invalidateOnSet = false } = {}) {
  return `(()=>{
    const store={
      'niakgpt-settings-v090':{safeMode:false},
      'niakgpt-governance-v085':{seeded:true,coreProjectIds:['g-p-one'],hiddenProjectIds:[],locks:{}},
      'niakgpt-v08-cache':{schema:2,projects:[{id:'g-p-one',name:'One',href:'/g/g-p-one/project',domOnly:false}],chats:[],counts:{'g-p-one':0},indexedProjectIds:['g-p-one']}
    };
    const listeners=[];let invalidate=${invalidateOnSet ? 'true' : 'false'};
    const norm=keys=>{if(keys==null)return{...store};if(typeof keys==='string')return{[keys]:store[keys]};if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,store[k]]));return{};};
    window.chrome={runtime:{getManifest:()=>({version:'0.9.52'})},storage:{local:{
      get:async keys=>norm(keys),
      set:async obj=>{if(invalidate)throw new Error('Extension context invalidated.');const changes={};for(const [k,v] of Object.entries(obj)){changes[k]={oldValue:store[k],newValue:v};store[k]=v;}for(const fn of [...listeners])fn(changes,'local');},
      remove:async keys=>{for(const k of(Array.isArray(keys)?keys:[keys]))delete store[k];}
    },onChanged:{addListener:fn=>listeners.push(fn),removeListener:fn=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);}}}};
    window.__setInvalidate=v=>{invalidate=!!v};window.__store=store;
  })();`;
}

test('multitab pagehide cannot post to a closed BroadcastChannel or retry a released lock', async ({ page }) => {
  const errors=[];const warnings=[];
  page.on('pageerror', error => errors.push(String(error?.message || error)));
  page.on('console', msg => { if (msg.type()==='warning') warnings.push(msg.text()); });
  await page.setContent('<main></main>');
  await page.addScriptTag({ content: baseChromeShim() });
  await page.evaluate(() => {
    class LabChannel {
      constructor(){this.closed=false;this.listeners=[];window.__labChannel=this;}
      postMessage(){if(this.closed)throw new DOMException('Channel is closed','InvalidStateError');}
      addEventListener(type,fn){if(type==='message')this.listeners.push(fn);}
      close(){this.closed=true;}
    }
    window.BroadcastChannel=LabChannel;
    Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,cb)=>cb({name:'niakgpt-worker-v090'})}});
    document.documentElement.dataset.ng86Activity='ready';
    document.documentElement.dataset.ng8Heavy='0';
    document.documentElement.dataset.ng90Safe='0';
  });
  await page.addScriptTag({ content: patchGuard(read('multitab-v090.js')) });
  await page.waitForTimeout(220);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));
  await page.waitForTimeout(1100);
  expect(errors).toEqual([]);
  expect(warnings.filter(x => /NiakGPT multitab.*lock|Channel is closed|InvalidStateError/.test(x))).toEqual([]);
  expect(await page.evaluate(() => window.__labChannel.closed)).toBeTruthy();
  expect(await page.locator('html').getAttribute('data-ng8-tab-role')).toBe('client');
});

test('cache bus converts extension-context invalidation into a detached no-op state', async ({ page }) => {
  const errors=[];const warnings=[];
  page.on('pageerror', error => errors.push(String(error?.message || error)));
  page.on('console', msg => { if (msg.type()==='warning') warnings.push(msg.text()); });
  await page.setContent('<main></main>');
  await page.addScriptTag({ content: baseChromeShim() });
  await page.addScriptTag({ content: patchGuard(read('cache-bus-v096.js')) });
  await page.evaluate(() => window.__NIAKGPT_CACHE_BUS__.ready);
  await page.evaluate(() => window.__setInvalidate(true));
  const result = await page.evaluate(async () => {
    const value = await window.__NIAKGPT_CACHE_BUS__.update(latest => ({...latest, probe:true}));
    return { alive:window.__NIAKGPT_CACHE_BUS__.alive(), state:document.documentElement.dataset.ng96CacheBus, value };
  });
  expect(result.alive).toBeFalsy();
  expect(result.state).toBe('detached');
  expect(errors).toEqual([]);
  expect(warnings.filter(x => /Extension context invalidated|cache bus write/i.test(x))).toEqual([]);
});

test('diagnostics never advertise the retired hotcache as READY', async ({ page }) => {
  await page.setContent('<main></main>');
  await page.addScriptTag({ content: baseChromeShim() });
  await page.addScriptTag({ content: patchGuard(read('cache-bus-v096.js')) });
  await page.addScriptTag({ content: patchGuard(read('diagnostic-bus-v096.js')) });
  await page.waitForTimeout(150);
  const snapshot=await page.evaluate(() => window.__NIAKGPT_DIAGNOSTICS__.snapshot());
  expect(snapshot.hotcache).toContain('OFF');
  expect(snapshot.hotcache).not.toContain('READY');
  expect(snapshot.hotcache).not.toContain('/5');
});
