'use strict';

const INSTALL_META='niakgpt-install-meta-v100';

chrome.runtime.onInstalled.addListener(async details=>{
  try{
    const current=chrome.runtime.getManifest().version;
    const old=(await chrome.storage.local.get(INSTALL_META))[INSTALL_META]||{};
    const next={
      ...old,
      reason:details.reason,
      currentVersion:current,
      previousVersion:details.previousVersion||old.previousVersion||'',
      changedAt:Date.now()
    };
    if(details.reason==='install'&&!old.installedAt)next.installedAt=Date.now();
    await chrome.storage.local.set({[INSTALL_META]:next});
  }catch(error){
    console.warn('[NiakGPT lifecycle]',error);
  }
});
