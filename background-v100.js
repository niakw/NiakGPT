'use strict';

const INSTALL_META='niakgpt-install-meta-v100';

const MAIN_RUNTIME=[
  'page-bridge.js'
];

const ISOLATED_RUNTIME=[
  'onboarding-v101.js',
  'profiles-v100.js',
  'control-center-v090.js',
  'cache-bus-v096.js',
  'diagnostic-bus-v096.js',
  'cache-guardian-v100.js',
  'recovery-v100.js',
  'server-index-v100.js',
  'commands-v100.js',
  'browser-compat-v102.js',
  'lifecycle-guard-v104.js',
  'multitab-v090.js',
  'governance-adapter-v105.js',
  'project-governance-v090.js',
  'governance-queue-v101.js',
  'reclassify-v101.js',
  'locale-fr-v101.js',
  'sidebar-projects-authority-v112.js',
  'sidebar-host-v090.js',
  'app-v090.js',
  'project-state-selfheal-v102.js',
  'project-assignment-selfheal-v103.js',
  'breadcrumb-v100.js',
  'continuity-v100.js',
  'visual-stability-v101.js',
  'home-layout-v112.js',
  'coach-v101.js',
  'polish-v090.js',
  'side-panels-v096.js',
  'live-fixes-v104.js',
  'live-fixes-v106.js',
  'chronology-v090.js',
  'pin-folders-v096.js',
  'project-chat-ux-v110.js',
  'project-links-v106.js',
  'activity-ui-v097.js',
  'retro-loader-v097.js'
];

chrome.runtime.onInstalled.addListener(async details=>{
  try{
    const current=chrome.runtime.getManifest().version;
    const old=(await chrome.storage.local.get(INSTALL_META))[INSTALL_META]||{};
    const preserveUpdate=details.reason==='install'&&old.reason==='update'&&old.currentVersion===current;
    const reason=preserveUpdate?'update':details.reason;
    let next={...old,reason,currentVersion:current,previousVersion:details.previousVersion||old.previousVersion||'',changedAt:preserveUpdate?(old.changedAt||Date.now()):Date.now()};
    if(reason==='install'&&!old.installedAt)next.installedAt=Date.now();

    // A lifecycle write can race the asynchronous onInstalled handler (notably when an
    // unpacked extension is reloaded during an upgrade test). Re-read before committing and
    // never overwrite a newer, explicit update marker for the same version with "install".
    if(details.reason==='install'){
      const latest=(await chrome.storage.local.get(INSTALL_META))[INSTALL_META]||{};
      const latestIsUpdate=latest.reason==='update'&&latest.currentVersion===current;
      const latestIsNewer=Number(latest.changedAt||0)>=Number(old.changedAt||0);
      if(latestIsUpdate&&latestIsNewer){
        next={...latest,reason:'update',currentVersion:current,previousVersion:latest.previousVersion||details.previousVersion||'',changedAt:latest.changedAt||Date.now()};
      }
    }
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
    const coreFailed=errors.some(item=>item.includes(':app-v090.js:')||item.includes(':project-state-selfheal-v102.js:')||item.includes(':project-assignment-selfheal-v103.js:'));
    sendResponse({ok:!coreFailed,errors});
  })().catch(error=>sendResponse({ok:false,errors:[`bootstrap:${String(error?.message||error)}`]}));
  return true;
});
