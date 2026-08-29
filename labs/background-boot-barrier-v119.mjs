import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('background-v100.js','utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const runtimeList=name=>[...(source.match(new RegExp(`const ${name}=\\[(.*?)\\];`,'s'))?.[1]||'').matchAll(/'([^']+)'/g)].map(x=>x[1]);
const main=runtimeList('MAIN_RUNTIME'),isolated=runtimeList('ISOLATED_RUNTIME');

async function runScenario(failFile=''){
  let onMessage=null;
  const calls=[];
  const chrome={
    runtime:{
      onInstalled:{addListener(){}},
      onMessage:{addListener(fn){onMessage=fn;}},
      getManifest(){return{version:'0.9.68'};}
    },
    storage:{local:{async get(){return{};},async set(){}}},
    scripting:{async executeScript({files}){
      const file=files?.[0]||'';calls.push(file);
      if(file===failFile)throw new Error(`forced_injection_failure:${file}`);
      return[];
    }}
  };
  vm.runInNewContext(source,{chrome,console,setTimeout,clearTimeout,Promise,Number,String,Date,importScripts(){}},{filename:'background-v100.js'});
  assert(typeof onMessage==='function','background did not register runtime message listener');
  const response=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error(`response timeout for ${failFile||'success'}`)),1000);
    const returned=onMessage({type:'niakgpt:inject-runtime-v100'},{tab:{id:7},frameId:0},value=>{clearTimeout(timeout);resolve(value);});
    if(returned!==true){clearTimeout(timeout);reject(new Error(`listener did not keep async channel open for ${failFile||'success'}`));}
  });
  return{calls,response};
}

{
  const {calls,response}=await runScenario('page-bridge.js');
  assert(JSON.stringify(calls)===JSON.stringify(['page-bridge.js']),`MAIN failure did not halt all later injection: ${JSON.stringify(calls)}`);
  assert(response.ok===false&&response.errors?.some(e=>e.includes('MAIN:page-bridge.js:forced_injection_failure')),`MAIN failure response drift: ${JSON.stringify(response)}`);
}

{
  const {calls,response}=await runScenario('sidebar-metadata-v118.js');
  const expected=['page-bridge.js',...isolated.slice(0,isolated.indexOf('sidebar-metadata-v118.js')+1)];
  assert(JSON.stringify(calls)===JSON.stringify(expected),`metadata failure allowed cache consumers/later runtime to inject: ${JSON.stringify(calls)}`);
  assert(!calls.includes('cache-guardian-v100.js')&&!calls.includes('recovery-v100.js')&&!calls.includes('server-index-v100.js'),`cache consumer injected after metadata barrier failure: ${JSON.stringify(calls)}`);
  assert(response.ok===false&&response.errors?.some(e=>e.includes('ISOLATED:sidebar-metadata-v118.js:forced_injection_failure')),`metadata barrier failure response drift: ${JSON.stringify(response)}`);
}

{
  const {calls,response}=await runScenario();
  const expected=[...main,...isolated];
  assert(JSON.stringify(calls)===JSON.stringify(expected),`successful bootstrap did not inject exact runtime order: ${calls.length}/${expected.length}`);
  assert(response.ok===true&&Array.isArray(response.errors)&&response.errors.length===0,`successful bootstrap response drift: ${JSON.stringify(response)}`);
}

console.log(`background-boot-barrier-v119: PASS main=${main.length} isolated=${isolated.length}`);
