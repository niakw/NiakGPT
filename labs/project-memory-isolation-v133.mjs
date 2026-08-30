import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('background-v100.js','utf8');

async function runCase({backendThrows=false,optionalFails=false}={}){
  let listener=null;
  const injected=[];
  const warnings=[];
  const chrome={
    runtime:{
      onInstalled:{addListener(){}},
      onMessage:{addListener(fn){listener=fn;}},
      getManifest:()=>({version:'0.9.84'})
    },
    storage:{local:{async get(){return{};},async set(){}}},
    scripting:{
      async executeScript({files}){
        const file=files?.[0]||'';
        injected.push(file);
        if(optionalFails&&file.startsWith('project-memory-'))throw new Error('synthetic optional injection failure');
      }
    }
  };
  const context={
    chrome,
    console:{warn:(...args)=>warnings.push(args.map(String).join(' ')),log(){},error(){}},
    setTimeout,clearTimeout,Promise,Number,String,Date,
    importScripts(file){
      if(file==='project-memory-background-v132.js'&&backendThrows)throw new Error('synthetic backend boot failure');
    }
  };
  vm.runInNewContext(source,context,{filename:'background-v100.js'});
  assert.equal(typeof listener,'function','background message listener missing');

  const response=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('bootstrap response timeout')),4000);
    const keepAlive=listener({type:'niakgpt:inject-runtime-v100'},{tab:{id:7},frameId:0},value=>{
      clearTimeout(timer);resolve(value);
    });
    assert.equal(keepAlive,true,'async bootstrap listener did not keep channel alive');
  });
  await new Promise(r=>setTimeout(r,30));
  return {response,injected,warnings};
}

const backendFailure=await runCase({backendThrows:true});
assert.equal(backendFailure.response.ok,true,'optional backend failure blocked core bootstrap');
assert.equal(backendFailure.response.projectMemoryBackendReady,false);
assert.ok(backendFailure.injected.includes('sidebar-projects-v121.js'),'Projects runtime was not injected after optional backend failure');
assert.ok(backendFailure.injected.includes('sidebar-actions-v123.js'),'Project/chat actions were not injected after optional backend failure');
assert.ok(backendFailure.injected.includes('app-v090.js'),'core app that creates the right NiakGPT rail was not injected after optional backend failure');
assert.ok(backendFailure.injected.includes('side-panels-v096.js'),'right-side panel integration was not injected after optional backend failure');
assert.ok(!backendFailure.injected.includes('project-memory-v132.js'),'optional UI runtime should not inject when backend failed');
for(const file of ['page-bridge.js','sidebar-projects-v121.js','app-v090.js','sidebar-actions-v123.js','ux-v131.js']){
  assert.equal(backendFailure.injected.filter(x=>x===file).length,1,`${file} was injected more than once after optional backend failure; this can race React hydration/remount`);
}

const optionalFailure=await runCase({optionalFails:true});
assert.equal(optionalFailure.response.ok,true,'optional content runtime failure blocked core bootstrap');
assert.equal(optionalFailure.response.projectMemoryBackendReady,true);
assert.ok(optionalFailure.injected.includes('sidebar-projects-v121.js'));
assert.ok(optionalFailure.injected.includes('sidebar-actions-v123.js'));
assert.ok(optionalFailure.injected.includes('app-v090.js'),'right NiakGPT rail owner disappeared when optional Project Memory content failed');
assert.ok(optionalFailure.injected.includes('side-panels-v096.js'),'right panel integration disappeared when optional Project Memory content failed');
assert.ok(optionalFailure.injected.includes('ux-v131.js'));
assert.ok(optionalFailure.injected.includes('project-memory-v132.js'),'optional runtime was not attempted');
assert.ok(optionalFailure.warnings.some(line=>line.includes('optional runtime')),'optional failure was not observable in diagnostics');
for(const file of ['page-bridge.js','sidebar-projects-v121.js','app-v090.js','sidebar-actions-v123.js','ux-v131.js']){
  assert.equal(optionalFailure.injected.filter(x=>x===file).length,1,`${file} was injected more than once after optional content failure; core retry would risk React hydration/remount corruption`);
}

const coreEnd=optionalFailure.injected.indexOf('ux-v131.js');
const memoryStart=optionalFailure.injected.indexOf('project-memory-v132.js');
assert.ok(coreEnd>=0&&memoryStart>coreEnd,'Project Memory injected before critical Projects runtime completed');

console.log('PROJECT_MEMORY_ISOLATION_V133_PASS');
