'use strict';

let PROJECT_MEMORY_BACKEND_READY=false;
try{
  importScripts('project-memory-background-v132.js');
  PROJECT_MEMORY_BACKEND_READY=true;
}catch(error){
  console.warn('[NiakGPT optional Project Memory backend]',error);
}

const INSTALL_META='niakgpt-install-meta-v100';
const HARD_ISOLATED_BARRIER='sidebar-metadata-v118.js';

const STYLE_RUNTIME=[
  'theme-v08.css',
  'polish-v081.css',
  'chronology-v081.css',
  'multitab-v083.css',
  'governance-v085.css',
  'activity-v086.css',
  'control-center-v090.css',
  'project-memory-v132.css',
  'core-v090.css',
  'profiles-v100.css',
  'commands-v100.css',
  'onboarding-v100.css',
  'coach-v100.css',
  'pin-folders-v096.css',
  'sidebar-ux-v119.css',
  'side-panels-v096.css',
  'continuity-v100.css',
  'interruption-guard-v119.css',
  'visual-stability-v101.css',
  'live-fixes-v104.css',
  'sidebar-metadata-v118.css',
  'sidebar-projects-authority-v112.css',
  'project-chat-ux-v110.css',
  'home-layout-v112.css',
  'native-actions-v113.css',
  'sidebar-actions-v123.css',
  'chat-attention-v113.css',
  'matrix-guardian-v112.css',
  'performance-guard-v112.css',
  'sidebar-icons-v114.css',
  'native-da-v112.css',
  'live-stability-v129.css',
  'ux-v131.css',
  'retro-loader-v097.css'
];
const STYLE_INJECTED=new Set();

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
  'visual-stability-v101.js',
  'coach-v101.js',
  'polish-v090.js',
  'side-panels-v096.js',
  'live-fixes-v106.js',
  'chronology-v090.js',
  'project-chat-ux-v110.js',
  'chat-attention-v113.js',
  'conversation-load-guard-v113.js',
  'project-links-v106.js',
  'activity-ui-v097.js',
  'retro-loader-v097.js',
  'conversation-scroll-guard-v133.js',
  'ux-v131.js'
];

const OPTIONAL_RUNTIME=[
  'project-memory-v132.js',
  'project-memory-ui-v132.js'
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

async function injectStyles(tabId,frameId){
  const key=`${tabId}:${frameId}`;
  if(STYLE_INJECTED.has(key))return null;
  try{
    await chrome.scripting.insertCSS({target:{tabId,frameIds:[frameId]},files:STYLE_RUNTIME,origin:'AUTHOR'});
    STYLE_INJECTED.add(key);
    return null;
  }catch(error){
    return `STYLE:${String(error?.message||error||'style_injection_failed').slice(0,220)}`;
  }
}

async function injectOne(tabId,frameId,file,world){
  try{
    await chrome.scripting.executeScript({target:{tabId,frameIds:[frameId]},files:[file],world});
    return null;
  }catch(error){
    return `${world}:${file}:${String(error?.message||error||'injection_failed').slice(0,220)}`;
  }
}

async function probeReactHydration(tabId,frameId){
  try{
    const results=await chrome.scripting.executeScript({
      target:{tabId,frameIds:[frameId]},
      world:'MAIN',
      func:()=>{
        const OWNER_RX=/^__react(?:Fiber|Props|Container)\$.+/;
        const CONTAINER_RX=/^__reactContainer\$.+/;
        const owned=node=>{
          if(!node)return false;
          try{return Object.getOwnPropertyNames(node).some(key=>OWNER_RX.test(key));}catch{return false;}
        };
        const containerFiber=()=>{
          for(const node of [document,document.documentElement,document.body]){
            if(!node)continue;
            try{
              const key=Object.getOwnPropertyNames(node).find(name=>CONTAINER_RX.test(name));
              if(key&&node[key])return node[key];
            }catch{}
          }
          return null;
        };
        const container=containerFiber();
        const current=container?.stateNode?.current||container;
        const candidates=[container,current,container?.alternate,current?.alternate].filter(Boolean);
        const rootSettled=candidates.some(fiber=>fiber?.memoizedState&&fiber.memoizedState.isDehydrated===false);
        const identities=[
          document.querySelector('nav[aria-label*="Historique de chat" i],nav[aria-label*="Chat history" i],nav,aside'),
          document.querySelector('main'),
          document.querySelector('#prompt-textarea,[data-testid="prompt-textarea"],textarea,[contenteditable="true"]')
        ].filter(Boolean);
        const needed=Math.min(2,identities.length);
        const ownedCount=identities.filter(owned).length;
        return {
          containerFound:!!container,
          rootSettled,
          needed,
          ownedCount
        };
      }
    });
    const probe=results?.[0]?.result||null;
    return probe?{ok:true,...probe}:{ok:false,error:'empty_main_world_probe'};
  }catch(error){
    return {ok:false,error:String(error?.message||error||'main_world_probe_failed').slice(0,220)};
  }
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  const type=message?.type;
  const tabId=sender.tab?.id;
  const frameId=Number.isInteger(sender.frameId)?sender.frameId:0;
  if(type==='niakgpt:probe-react-hydration-v106'){
    if(!Number.isInteger(tabId)){sendResponse({ok:false,error:'missing_tab_id'});return;}
    probeReactHydration(tabId,frameId).then(sendResponse).catch(error=>sendResponse({ok:false,error:String(error?.message||error)}));
    return true;
  }
  if(type!=='niakgpt:inject-runtime-v100')return;
  if(!Number.isInteger(tabId)){sendResponse({ok:false,errors:['missing_tab_id']});return;}
  (async()=>{
    const errors=[];
    let bootBlocked=false;
    const styleFailure=await injectStyles(tabId,frameId);
    if(styleFailure){errors.push(styleFailure);bootBlocked=true;}
    if(!bootBlocked)for(const file of MAIN_RUNTIME){
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
    const coreFailed=bootBlocked||errors.some(item=>item.includes(':app-v090.js:')||item.includes(':pin-folders-v096.js:')||item.includes(':folder-scroll-anchor-v124.js:')||item.includes(':project-native-name-sync-v124.js:')||item.includes(':project-state-selfheal-v102.js:')||item.includes(':project-assignment-selfheal-v103.js:')||item.includes(':sidebar-projects-authority-v112.js:')||item.includes(':sidebar-projects-v121.js:')||item.includes(':sidebar-metadata-v118.js:')||item.includes(':server-index-v100.js:')||item.includes(':server-index-bootstrap-v124.js:')||item.includes(':chat-state-authority-v113.js:')||item.includes(':sidebar-actions-v123.js:')||item.includes(':continuity-consumer-v124.js:')||item.includes(':interruption-guard-v119.js:')||item.includes(':conversation-scroll-guard-v133.js:')||item.includes(':ux-v131.js:'));
    sendResponse({ok:!coreFailed,errors,projectMemoryBackendReady:PROJECT_MEMORY_BACKEND_READY});
    if(!coreFailed&&PROJECT_MEMORY_BACKEND_READY){
      (async()=>{
        await sleep(0);
        for(const file of OPTIONAL_RUNTIME){
          const failure=await injectOne(tabId,frameId,file,'ISOLATED');
          if(failure)console.warn('[NiakGPT optional runtime]',failure);
        }
      })().catch(error=>console.warn('[NiakGPT optional Project Memory runtime]',error));
    }
  })().catch(error=>sendResponse({ok:false,errors:[`bootstrap:${String(error?.message||error)}`]}));
  return true;
});