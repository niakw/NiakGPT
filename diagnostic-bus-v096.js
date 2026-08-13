(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_DIAGNOSTICS__) return;

  const values=new Map();
  const api={
    set(key,text){
      key=String(key||'').trim().toLowerCase();text=String(text||'').trim();if(!key)return;
      if(values.get(key)===text)return;values.set(key,text);
      document.dispatchEvent(new CustomEvent('niakgpt:diagnostic-changed',{detail:{key,text}}));
    },
    delete(key){key=String(key||'').trim().toLowerCase();if(values.delete(key))document.dispatchEvent(new CustomEvent('niakgpt:diagnostic-changed',{detail:{key,text:''}}));},
    snapshot(){return Object.fromEntries(values);}
  };
  window.__NIAKGPT_DIAGNOSTICS__=api;
})();
