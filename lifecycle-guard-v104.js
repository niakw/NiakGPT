(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_LIFECYCLE_GUARD_104__) return;
  window.__NIAKGPT_LIFECYCLE_GUARD_104__ = true;

  const NativeBroadcastChannel=window.BroadcastChannel;
  if(typeof NativeBroadcastChannel!=='function')return;
  const closedMessage=e=>e?.name==='InvalidStateError'||/channel is closed|broadcastchannel.*closed|closed broadcastchannel/i.test(String(e?.message||e||''));

  function SafeBroadcastChannel(name){
    const channel=new NativeBroadcastChannel(name);
    let closed=false;
    const nativePost=channel.postMessage.bind(channel);
    const nativeClose=channel.close.bind(channel);
    channel.postMessage=function(data){
      if(closed)return;
      try{return nativePost(data);}catch(error){if(closedMessage(error)){closed=true;return;}throw error;}
    };
    channel.close=function(){
      if(closed)return;closed=true;
      try{return nativeClose();}catch(error){if(!closedMessage(error))throw error;}
    };
    return channel;
  }
  try{Object.defineProperty(SafeBroadcastChannel,'name',{value:'BroadcastChannel'});}catch{}
  SafeBroadcastChannel.prototype=NativeBroadcastChannel.prototype;
  try{Object.setPrototypeOf(SafeBroadcastChannel,NativeBroadcastChannel);}catch{}
  window.BroadcastChannel=SafeBroadcastChannel;
})();
