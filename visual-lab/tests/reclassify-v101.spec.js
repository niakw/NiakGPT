const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const P_BUSINESS='g-p-business111111';
const P_TECH='g-p-tech2222222222';
const P_QUEUE='g-p-queue333333333';
const C_BUSINESS='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const C_TECH='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C_LOCKED='cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('À classer is drained automatically while manual locks stay untouched', async ({ page }) => {
  await page.route('https://chatgpt.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html lang="fr"><body><main></main></body></html>'
  }));
  await page.goto('https://chatgpt.com/reclassify-fixture', { waitUntil: 'domcontentloaded' });

  await page.evaluate(({ P_BUSINESS,P_TECH,P_QUEUE,C_BUSINESS,C_TECH,C_LOCKED }) => {
    const CACHE='niakgpt-v08-cache', GOV='niakgpt-governance-v085';
    const storage={
      [CACHE]:{
        schema:2,at:Date.now(),
        projects:[
          {id:P_BUSINESS,name:'Business & Projets'},
          {id:P_TECH,name:'Tech & Développement'},
          {id:P_QUEUE,name:'À classer'}
        ],
        chats:[
          {id:C_BUSINESS,title:'Shopify SEO marketplace et marge produit',projectId:P_QUEUE,snippet:''},
          {id:C_TECH,title:'Extension Chrome GitHub API JavaScript',projectId:P_QUEUE,snippet:''},
          {id:C_LOCKED,title:'Shopify marketing verrouillé',projectId:P_QUEUE,snippet:''}
        ],
        counts:{[P_BUSINESS]:0,[P_TECH]:0,[P_QUEUE]:3},indexedProjectIds:[]
      },
      [GOV]:{seeded:true,coreProjectIds:[P_BUSINESS,P_TECH,P_QUEUE],hiddenProjectIds:[],locks:{[C_LOCKED]:{projectId:P_QUEUE,source:'manual'}},autoResync:true}
    };
    const listeners=[];
    window.chrome={storage:{
      local:{
        get:async keys=>{
          const list=Array.isArray(keys)?keys:[keys];const out={};
          for(const key of list)if(key!=null&&Object.prototype.hasOwnProperty.call(storage,key))out[key]=storage[key];
          return out;
        },
        set:async values=>{const changes={};for(const [key,value] of Object.entries(values)){changes[key]={oldValue:storage[key],newValue:value};storage[key]=value;}for(const fn of listeners)fn(changes,'local');}
      },
      onChanged:{addListener:fn=>listeners.push(fn)}
    }};
    window.__NIAKGPT_CACHE_BUS__={get:async()=>storage[CACHE]};
    window.__testStorage=storage;
    window.__moves=[];
    const projectByChat={[C_BUSINESS]:P_QUEUE,[C_TECH]:P_QUEUE,[C_LOCKED]:P_QUEUE};
    document.documentElement.dataset.ng8TabRole='worker';
    document.documentElement.dataset.ng86Activity='ready';
    document.documentElement.dataset.ng8Running='0';
    document.documentElement.dataset.ng8Heavy='0';
    document.documentElement.dataset.ng90Safe='0';
    try{Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(_name,_opts,fn)=>fn({name:'test-lock'})}});}catch{}
    document.addEventListener('niakgpt:rpc-request',event=>{
      const d=event.detail||{},m=String(d.path||'').match(/\/backend-api\/conversation\/([0-9a-f-]{20,})$/i);if(!m)return;
      const id=m[1];
      if(String(d.method||'GET').toUpperCase()==='PATCH'){
        projectByChat[id]=d.body?.gizmo_id||'';window.__moves.push({id,target:projectByChat[id]});
        queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{id,gizmo_id:projectByChat[id]}}})));
      }else{
        queueMicrotask(()=>document.dispatchEvent(new CustomEvent('niakgpt:rpc-response',{detail:{id:d.id,ok:true,status:200,data:{id,gizmo_id:projectByChat[id],mapping:{}}}})));
      }
    });
  }, { P_BUSINESS,P_TECH,P_QUEUE,C_BUSINESS,C_TECH,C_LOCKED });

  await page.addScriptTag({ path: path.join(root, 'reclassify-v101.js') });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('niakgpt:tab-role-changed')));

  await expect.poll(async () => page.evaluate(() => window.__moves.length), { timeout: 8000 }).toBe(2);
  const result = await page.evaluate(({ C_BUSINESS,C_TECH,C_LOCKED,P_BUSINESS,P_TECH,P_QUEUE }) => {
    const cache=window.__testStorage['niakgpt-v08-cache'];
    const gov=window.__testStorage['niakgpt-governance-v085'];
    const byId=new Map(cache.chats.map(c=>[c.id,c.projectId]));
    return {
      business:byId.get(C_BUSINESS),tech:byId.get(C_TECH),locked:byId.get(C_LOCKED),
      core:gov.coreProjectIds,moves:window.__moves.slice(),diag:document.documentElement.dataset.ng101Reclassify,
      expected:{P_BUSINESS,P_TECH,P_QUEUE}
    };
  }, { C_BUSINESS,C_TECH,C_LOCKED,P_BUSINESS,P_TECH,P_QUEUE });

  expect(result.business).toBe(P_BUSINESS);
  expect(result.tech).toBe(P_TECH);
  expect(result.locked).toBe(P_QUEUE);
  expect(result.core).toEqual([P_BUSINESS,P_TECH]);
  expect(result.moves.some(x=>x.id===C_LOCKED)).toBe(false);
  expect(result.diag).toBe('ok');
});
