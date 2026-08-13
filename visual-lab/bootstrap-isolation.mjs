import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root=path.resolve('..');
const base=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const fixture=fs.readFileSync(path.join(process.cwd(),'runtime-fixture.html'),'utf8');
const main=base.content_scripts.find(x=>x.world==='MAIN');
const isolated=base.content_scripts.find(x=>x.world!=='MAIN'&&x.js?.includes('app-v090.js'));
const loader=base.content_scripts.find(x=>x.js?.includes('retro-loader-v097.js'));

const slice=n=>[main,{...isolated,js:isolated.js.slice(0,n)}];
const groups={
  none:[],
  main:[main],
  throughChronology:slice(15),
  throughPinFolders:slice(16),
  activityUI:slice(17),
  full:[main,isolated,loader]
};

const filesFor=manifest=>{
  const files=new Set([manifest.background?.service_worker,...Object.values(manifest.icons||{}),...Object.values(manifest.action?.default_icon||{})].filter(Boolean));
  for(const cs of manifest.content_scripts||[])for(const f of [...(cs.js||[]),...(cs.css||[])])files.add(f);
  return [...files];
};

async function probe(name,scripts){
  const ext=fs.mkdtempSync(path.join(os.tmpdir(),`ng-bootstrap-${name}-`));
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),`ng-profile-${name}-`));
  const manifest={...base,content_scripts:scripts};
  fs.writeFileSync(path.join(ext,'manifest.json'),JSON.stringify(manifest));
  for(const file of filesFor(manifest)){
    const src=path.join(root,file),dst=path.join(ext,file);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);
  }
  let context;
  const result={name,launch:false,commit:false,fixture:false,status:false,error:''};
  try{
    context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chromium',viewport:{width:1000,height:700},args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
    result.launch=true;
    await context.route('https://chatgpt.com/**',route=>{
      const req=route.request(),u=new URL(req.url());
      if(req.resourceType()==='document')return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture});
      if(u.pathname==='/api/auth/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({accessToken:'probe'})});
      return route.fulfill({status:200,contentType:'application/json',body:'{}'});
    });
    const page=context.pages()[0]||await context.newPage();
    page.on('pageerror',e=>console.log(`[${name}] pageerror`,e.message));
    await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'commit',timeout:5000});result.commit=true;
    try{await page.locator('#native-brand').waitFor({state:'attached',timeout:3500});result.fixture=true;}catch{}
    try{await page.locator('#ng8-status').waitFor({state:'attached',timeout:2500});result.status=true;}catch{}
  }catch(e){result.error=String(e?.message||e).split('\n')[0];}
  finally{await context?.close().catch(()=>{});fs.rmSync(ext,{recursive:true,force:true});fs.rmSync(profile,{recursive:true,force:true});}
  console.log(JSON.stringify(result));
  return result;
}

const results=[];
for(const [name,scripts] of Object.entries(groups))results.push(await probe(name,scripts));
console.log('\nSUMMARY');
for(const r of results)console.log(`${r.name.padEnd(18)} launch=${r.launch} commit=${r.commit} fixture=${r.fixture} status=${r.status} ${r.error}`);

const full=results.at(-1);
if(!full.fixture||!full.status)process.exitCode=2;
