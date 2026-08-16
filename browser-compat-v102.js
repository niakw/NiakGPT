(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_BROWSER_COMPAT_102__)return;
  window.__NIAKGPT_BROWSER_COMPAT_102__=true;

  // Firefox/WebKit fixtures and some hardened browser contexts may not expose
  // crypto.randomUUID even though crypto.getRandomValues is available. NiakGPT only
  // needs a collision-resistant per-tab identifier, so provide the standard method
  // locally when the browser omitted it.
  try{
    if(globalThis.crypto&&typeof globalThis.crypto.randomUUID!=='function'){
      const fallback=()=>{
        const bytes=new Uint8Array(16);
        if(typeof globalThis.crypto.getRandomValues==='function')globalThis.crypto.getRandomValues(bytes);
        else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
        bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
        const hex=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      };
      try{Object.defineProperty(globalThis.crypto,'randomUUID',{configurable:true,value:fallback});}
      catch{try{globalThis.crypto.randomUUID=fallback;}catch{}}
    }
  }catch{}
})();
