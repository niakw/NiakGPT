import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const token=String(process.env.NIAKGPT_PRIVATE_REPO_TOKEN||'').trim();
const repo=String(process.env.NIAKGPT_PRIVATE_REPO||'niakw/niakgpt-private').trim();
if(!token)throw new Error('NIAKGPT_PRIVATE_REPO_TOKEN repository secret is missing');
if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error('invalid private memory repo');

const localStore={},sessionStore={};
globalThis.chrome={storage:{
  local:{
    async get(key){return Object.prototype.hasOwnProperty.call(localStore,key)?{[key]:localStore[key]}:{};},
    async set(obj){Object.assign(localStore,obj);},
    async remove(key){for(const k of(Array.isArray(key)?key:[key]))delete localStore[k];}
  },
  session:{
    async get(key){return Object.prototype.hasOwnProperty.call(sessionStore,key)?{[key]:sessionStore[key]}:{};},
    async set(obj){Object.assign(sessionStore,obj);},
    async remove(key){for(const k of(Array.isArray(key)?key:[key]))delete sessionStore[k];}
  }
}};

const auth={
  Accept:'application/vnd.github+json',
  Authorization:'Bearer '+token,
  'X-GitHub-Api-Version':'2022-11-28',
  'User-Agent':'NiakGPT-Project-Memory-Live-Smoke'
};
const api=async path=>{
  const r=await fetch('https://api.github.com'+path,{headers:auth});
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null;}catch{data=text;}
  return {ok:r.ok,status:r.status,data};
};

const before=await api('/repos/'+repo);
assert.equal(before.ok,true,'cannot access '+repo+': HTTP '+before.status);
assert.equal(before.data?.private,true,'live memory repository is not private');
assert.equal(before.data?.archived,false,'live memory repository is archived');

const markerPath='.niakgpt-memory/niakgpt-memory.json';
const markerUrl='/repos/'+repo+'/contents/'+markerPath.split('/').map(encodeURIComponent).join('/')+'?ref=main';
const existing=await api(markerUrl);
let initialized=false;

if(existing.status===404 || Number(before.data?.size||0)===0){
  const require=createRequire(import.meta.url);
  const memory=require('../project-memory-background-v132.js');
  const result=await memory.connect({repo,branch:'main',root:'.niakgpt-memory',token,rememberToken:false});
  assert.equal(result.ok,true);
  assert.equal(result.repositoryPrivate,true);
  initialized=result.initializedEmptyRepo===true;
}

const after=await api('/repos/'+repo);
assert.equal(after.ok,true);
assert.equal(after.data?.private,true);
const marker=await api(markerUrl);
assert.equal(marker.ok,true,'Project Memory marker missing after live smoke: HTTP '+marker.status);
assert.equal(marker.data?.type,'file');
assert.ok(Number(marker.data?.size||0)>0,'Project Memory marker is empty');

console.log('PROJECT_MEMORY_LIVE_SMOKE_PASS repo='+repo+' private=true marker=true initialized='+initialized);
