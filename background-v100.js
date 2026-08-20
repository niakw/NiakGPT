'use strict';

const INSTALL_META='niakgpt-install-meta-v100';
const HARD_ISOLATED_BARRIER='sidebar-metadata-v118.js';

const MAIN_RUNTIME=[
  'page-bridge.js'
];

const ISOLATED_RUNTIME=[
  'onboarding-v101.js',
  'profiles-v100.js',
  'control-center-v090.js',
  'cache-bus-v096.js',
  'diagnostic-bus-v096.js',
  'sidebar-metadata-v118.js',
  'cache-guardian-v100.js',
  'recovery-v100.js',
  'server-index-v100.js',
  'server-index-bootstrap-v124.js',
  'commands-v100.js',
  'browser-compat-v102.js',
  'lifecycle-guard-v104.js',
  'multitab-v090.js',
  'governance-adapter-v105.js',
  'project-governance-v090.js',
  'governance-queue-v101.js',
  'reclassify-v101.js',
  'analysis-bridge-v112.js',
  'reclassify-deep-v112.js',
  'locale-fr-v101.js',
  'sidebar-icons-v114.js',
  'sidebar-projects-authority-v112.js',
  'sidebar-host-v090.js',
  'performance-guard-v112.js',
  'sidebar-projects-v121.js',
  'sidebar-ux-v119.js',
  'pin-folders-v096.js',
  'app-v090.js',
  'sidebar-actions-v123.js',
  'folder-scroll-anchor-v124.js',
  'project-native-name-sync-v124.js',
  'home-layout-v112.js',
  'matrix-guardian-v112.js',
  'turn-headers-v112.js',
  'project-state-selfheal-v102.js',
  'project-assignment-selfheal-v103.js',
  'chat-state-authority-v113.js',
  'breadcrumb-v113.js',
  'continuity-v100.js',
  'continuity-v112.js',
  'continuity-consumer-v124.js',
  'interruption-guard-v119.js',
  'continuity-limit-v125.js',
  'visual-stability-v101.js',
  'coach-v101.js',
  'polish-v090.js',
  'side-panels-v096.js',
  'live-fixes-v104.js',
  'live-fixes-v106.js',
  'chronology-v090.js',
  'project-chat-ux-v110.js',
  'chat-attention-v113.js',
  'conversation-load-guard-v113.js',
  'project-links-v106.js',
  'activity-ui-v097.js',
  'native-ux-v126.js',
  'native-ux-v125.js',
  'sidebar-route-placement-v125.js',
  'retro-loader-v097.js'
];

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

chrome.runtime.onInstalled.addListener(async details=>{
  try{
    const current=chrome.runtime.getManifest().version;
    const old=(await chrome.storage.local.get(INSTALL_META))[INSTALL_META]||{};
    const oldShowsUpgrade=old.reason==='update'||!!old.previousVersion;
    const preserveUpdate=details.reason==='install'&&oldShowsUpgrade&&old.currentVersion===current;
    const reason=preserveUpdate?'update':details.reason;
    let next={...old,reason,currentVersion:current,previousVersion:details.previousVersion||old.previousVersion||'',changedAt:preserveUpdate?(old.changedAt||Date.now()):Date.now()};
    if(reason==='install'&&!old.installedAt)next.installedAt=Date.now();

    if(details.reason==='install'){
      await sleep(140);
      const latest=(await chrome.storage.local.get(INSTALL_META))[INSTALL_META]||{};
      const latestIsUpdate=(latest.reason==='update'||!!latest.previousVersion)&&latest.currentVersion===current;
      const latestIsNewer=Number(latest.changedAt||0)>=Number(old.changedAt||0);
      if(latestIsUpdate&&latestIsNewer)return;
      if(latest.changedAt&&Number(latest.changedAt)>Number(old.changedAt||0)&&latest.reason&&latest.reason!=='install')return;
      if(latest.reason==='install'&&latest.currentVersion===current&&Number(latest.changedAt||0)>Number(next.changedAt||0))return;
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
    let bootBlocked=false;
    for(const file of MAIN_RUNTIME){
      const failure=await injectOne(tabId,frameId,file,'MAIN');
      if(failure){errors.push(failure);bootBlocked=true;break;}
    }
    if(!bootBlocked){
      for(const file of ISOLATED_RUNTIME){
        const failure=await injectOne(tabId,frameId,file,'ISOLATED');
        if(!failure)continue;
        errors.push(failure);
        if(file===HARD_ISOLATED_BARRIER){bootBlocked=true;break;}
      }
    }
    const coreFailed=bootBlocked||errors.some(item=>item.includes(':app-v090.js:')||item.includes(':pin-folders-v096.js:')||item.includes(':folder-scroll-anchor-v124.js:')||item.includes(':project-native-name-sync-v124.js:')||item.includes(':project-state-selfheal-v102.js:')||item.includes(':project-assignment-selfheal-v103.js:')||item.includes(':sidebar-projects-authority-v112.js:')||item.includes(':sidebar-projects-v121.js:')||item.includes(':sidebar-metadata-v118.js:')||item.includes(':server-index-v100.js:')||item.includes(':server-index-bootstrap-v124.js:')||item.includes(':chat-state-authority-v113.js:')||item.includes(':sidebar-ux-v119.js:')||item.includes(':sidebar-actions-v123.js:')||item.includes(':continuity-consumer-v124.js:')||item.includes(':interruption-guard-v119.js:')||item.includes(':continuity-limit-v125.js:')||item.includes(':native-ux-v126.js:'));
    sendResponse({ok:!coreFailed,errors});
  })().catch(error=>sendResponse({ok:false,errors:[`bootstrap:${String(error?.message||error)}`]}));
  return true;
});