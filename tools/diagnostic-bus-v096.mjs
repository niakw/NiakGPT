import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const must=(c,m)=>{if(!c)throw new Error(m);};

// Manifest: load diagnostics before modules that publish into it.
{
  const p='manifest.json',m=JSON.parse(read(p));
  const iso=m.content_scripts.find(x=>x.world!=='MAIN');
  must(iso,'isolated content script missing');
  const list=iso.js||[];
  if(!list.includes('diagnostic-bus-v096.js')){
    const i=list.indexOf('cache-bus-v096.js');must(i>=0,'cache bus anchor missing');list.splice(i+1,0,'diagnostic-bus-v096.js');
  }
  write(p,JSON.stringify(m,null,2)+'\n');
}

// Core: external diagnostic snapshot is merged on every render, never patched post-render only.
{
  const p='app-v090.js';let s=read(p);
  if(!s.includes('function diagnosticRows()')){
    const marker='  function renderPanelIfDiag(){';must(s.includes(marker),'app diagnostic marker missing');
    s=s.replace(marker,`  function diagnosticRows(){\n    const external=window.__NIAKGPT_DIAGNOSTICS__?.snapshot?.()||{};\n    return Object.entries({...S.health,...external});\n  }\n${marker}`);
  }
  s=s.replace('Object.entries(S.health).map(([k,v])=>','diagnosticRows().map(([k,v])=>');
  if(!s.includes("'niakgpt:diagnostic-changed'")){
    const marker="    document.addEventListener('niakgpt:settings-changed',()=>{ensureMatrix();ensureBots();renderPins();});";
    must(s.includes(marker),'app settings event anchor missing');
    s=s.replace(marker,`${marker}\n    document.addEventListener('niakgpt:diagnostic-changed',()=>renderPanelIfDiag());`);
  }
  must(s.includes('function diagnosticRows()'),'diagnostic merge missing');
  must(s.includes('diagnosticRows().map'),'diagnostic render still ignores bus');
  write(p,s);
}

// Coach owns its durable diagnostic state.
{
  const p='coach-v100.js';let s=read(p);
  const old="function setCoachStatus(text){coachStatus=text;document.documentElement.setAttribute('data-ng100-coach-status',text);patchDiagnostic();}";
  const next="function setCoachStatus(text){coachStatus=text;document.documentElement.setAttribute('data-ng100-coach-status',text);window.__NIAKGPT_DIAGNOSTICS__?.set('coach',text);patchDiagnostic();}";
  if(s.includes(old))s=s.replace(old,next);
  must(s.includes("__NIAKGPT_DIAGNOSTICS__?.set('coach',text)"),'coach diagnostic bus publish missing');
  write(p,s);
}

// Tab role is available even if the Diagnostic panel has never been opened.
{
  const p='multitab-v090.js';let s=read(p);
  if(!s.includes("__NIAKGPT_DIAGNOSTICS__?.set('onglet'")){
    const marker="    if(status){status.dataset.tabRole=role;status.title=`NiakGPT ${VERSION} · ${role}${safeMode?' · SAFE MODE':''}`;}";
    must(s.includes(marker),'multitab status anchor missing');
    s=s.replace(marker,`${marker}\n    window.__NIAKGPT_DIAGNOSTICS__?.set('onglet',safeMode?'SAFE MODE · tâches partagées suspendues':role==='WORKER'?'WORKER · tâches partagées':'CLIENT · délégation active');`);
  }
  write(p,s);
}

// Hot cache publishes the same text it renders locally.
{
  const p='hotcache-v084.js';let s=read(p);
  const old="    row.innerHTML = `<span>hotcache</span><b class=\"${hot ? 'ok' : /ERROR/i.test(mode) ? 'err' : 'wait'}\">${mode} · ${entries}/5 · ${hits} hit · ${net} net${dedupe ? ` · ${dedupe} partagé${dedupe > 1 ? 's' : ''}` : ''}</b>`;";
  if(s.includes(old)){
    const next="    const statusText=`${mode} · ${entries}/5 · ${hits} hit · ${net} net${dedupe ? ` · ${dedupe} partagé${dedupe > 1 ? 's' : ''}` : ''}`;\n    window.__NIAKGPT_DIAGNOSTICS__?.set('hotcache',statusText);\n    row.innerHTML = `<span>hotcache</span><b class=\"${hot ? 'ok' : /ERROR/i.test(mode) ? 'err' : 'wait'}\">${statusText}</b>`;";
    s=s.replace(old,next);
  }
  must(s.includes("__NIAKGPT_DIAGNOSTICS__?.set('hotcache',statusText)"),'hotcache diagnostic bus publish missing');
  write(p,s);
}

// Native pins publish their verified state rather than relying on a transient row.
{
  const p='project-pins-v090.js';let s=read(p);
  const marker='    row.replaceChildren(label,value);';
  if(!s.includes("__NIAKGPT_DIAGNOSTICS__?.set('pins'")){
    must(s.includes(marker),'pins diagnostic row anchor missing');
    s=s.replace(marker,"    window.__NIAKGPT_DIAGNOSTICS__?.set('pins',value.textContent||'');\n"+marker);
  }
  write(p,s);
}

// Runtime checker follows manifest order and enforces bus ownership.
{
  const p='tools/check-runtime.mjs';let s=read(p);
  s=s.replace("'cache-bus-v096.js','commands-v100.js'","'cache-bus-v096.js','diagnostic-bus-v096.js','commands-v100.js'");
  if(!s.includes("const diagnosticBusText=read('diagnostic-bus-v096.js')")){
    const marker='// Core / performance invariants.';must(s.includes(marker),'checker diagnostic marker missing');
    s=s.replace(marker,`// Stable diagnostic bus: module states survive any panel rerender.\nconst diagnosticBusText=read('diagnostic-bus-v096.js');\nhas(diagnosticBusText,'__NIAKGPT_DIAGNOSTICS__');\nhas(diagnosticBusText,'snapshot()');\nhas(texts['app-v090.js'],'function diagnosticRows()');\nhas(texts['app-v090.js'],'diagnosticRows().map');\nhas(texts['coach-v100.js'],\"__NIAKGPT_DIAGNOSTICS__?.set('coach',text)\");\nhas(texts['multitab-v090.js'],\"__NIAKGPT_DIAGNOSTICS__?.set('onglet'\");\nhas(texts['hotcache-v084.js'],\"__NIAKGPT_DIAGNOSTICS__?.set('hotcache',statusText)\");\nhas(texts['project-pins-v090.js'],\"__NIAKGPT_DIAGNOSTICS__?.set('pins'\");\n\n${marker}`);
  }
  write(p,s);
}

console.log('NiakGPT 0.9.6 diagnostics converged on stable bus');
