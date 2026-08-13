'use strict';

const INSTALL_META='niakgpt-install-meta-v100';

const MAIN_RUNTIME=[
  'page-bridge.js',
  'manual-lock-main-v085.js',
  'activity-main-v087.js',
  'hotcache-main-v084.js'
];

const ISOLATED_RUNTIME=[
  'onboarding-v101.js',
  'profiles-v100.js',
  'control-center-v090.js',
  'cache-bus-v096.js',
  'diagnostic-bus-v096.js',
  'commands-v100.js',
  'multitab-v090.js',
  'project-governance-v090.js',
  'project-pins-v090.js',
  'sidebar-host-v090.js',
  'dom-index-v101.js',
  'app-v090.js',
  'coach-v101.js',
  'polish-v090.js',
  'side-panels-v096.js',
  'chronology-v090.js',
  'pin-folders-v096.js',
  'activity-ui-v097.js',
  'retro-loader-v097.js'
];

chrome.runtime.onInstalled.addListener(async details=>{
  try{
    const current=chrome.runtime.getManifest().version;
    const old=(await chrome.storage.local.get(INSTALL_META))[INSTALL_META]||{};
    const preserveUpdate=details.reason==='install'&&old.reason==='update'&&old.currentVersion===current;
    const reason=preserveUpdate?'update':details.reason;
    const next={...old,reason,currentVersion:current,previousVersion:details.previousVersion||old.previousVersion||'',changedAt:preserveUpdate?(old.changedAt||Date.now()):Date.now()};
    if(reason==='install'&&!old.installedAt)next.installedAt=Date.now();
    await chrome.storage.local.set({[INSTALL_META]:next});
  }catch(error){console.warn('[NiakGPT lifecycle]',error);}
});

async function injectOne(tabId,frameId,file,world){
  try{
    await chrome.scripting.executeScript({target:{tabId,frameIds:[frameId]},files:[file],world});
    return null;
  }catch(error){
    return `${world}:${file}:${String(error?.message||error||'injection_failed').slice(0,220)}`;
  }
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type!=='niakgpt:inject-runtime-v100')return;
  const tabId=sender.tab?.id;
  const frameId=Number.isInteger(sender.frameId)?sender.frameId:0;
  if(!Number.isInteger(tabId)){sendResponse({ok:false,errors:['missing_tab_id']});return;}
  (async()=>{
    const errors=[];
    for(const file of MAIN_RUNTIME){
      const failure=await injectOne(tabId,frameId,file,'MAIN');
      if(failure)errors.push(failure);
    }
    for(const file of ISOLATED_RUNTIME){
      const failure=await injectOne(tabId,frameId,file,'ISOLATED');
      if(failure)errors.push(failure);
    }
    const coreFailed=errors.some(item=>item.includes(':app-v090.js:'));
    sendResponse({ok:!coreFailed,errors});
  })().catch(error=>sendResponse({ok:false,errors:[`bootstrap:${String(error?.message||error)}`]}));
  return true;
});
