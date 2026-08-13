'use strict';

const INSTALL_META='niakgpt-install-meta-v100';

chrome.runtime.onInstalled.addListener(async details=>{
  try{
    const current=chrome.runtime.getManifest().version;
    const old=(await chrome.storage.local.get(INSTALL_META))[INSTALL_META]||{};

    // Lifecycle state is monotonic: a delayed install event must not replace a
    // more specific update marker already recorded for this exact version.
    const preserveUpdate=details.reason==='install'&&old.reason==='update'&&old.currentVersion===current;
    const reason=preserveUpdate?'update':details.reason;
    const next={
      ...old,
      reason,
      currentVersion:current,
      previousVersion:details.previousVersion||old.previousVersion||'',
      changedAt:preserveUpdate?(old.changedAt||Date.now()):Date.now()
    };
    if(reason==='install'&&!old.installedAt)next.installedAt=Date.now();
    await chrome.storage.local.set({[INSTALL_META]:next});
  }catch(error){
    console.warn('[NiakGPT lifecycle]',error);
  }
});
