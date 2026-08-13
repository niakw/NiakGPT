import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);

// Manifest: 0.9.5, lifecycle service worker, deterministic icons, lifecycle onboarding.
{
  const p='manifest.json',m=JSON.parse(read(p));
  m.version='0.9.5';
  m.background={service_worker:'background-v100.js'};
  for(const script of m.content_scripts||[]){
    if(script.world==='MAIN')continue;
    script.js=(script.js||[]).map(x=>x==='onboarding-v100.js'?'onboarding-v101.js':x);
  }
  m.icons={'16':'icons/icon-16.png','32':'icons/icon-32.png','48':'icons/icon-48.png','128':'icons/icon-128.png'};
  m.action={...(m.action||{}),default_title:'NiakGPT',default_icon:{'16':'icons/icon-16.png','32':'icons/icon-32.png'}};
  write(p,JSON.stringify(m,null,2)+'\n');
}

// Fix RGBA scanlines in deterministic icon generator.
{
  const p='tools/generate-icons.py';let s=read(p);
  const old="raw=b''.join(b'\\x00'+bytes(pixels[y*w:(y+1)*w]) for y in range(h))";
  const fixed="raw=b''.join(b'\\x00'+bytes(pixels[y*w*4:(y+1)*w*4]) for y in range(h))";
  if(s.includes(old))s=s.replace(old,fixed);
  if(!s.includes(fixed))throw new Error('PNG RGBA scanline writer could not be verified');
  write(p,s);
}

// Clean package must include service worker in addition to content scripts and icons.
{
  const p='tools/package-extension.mjs';let s=read(p);
  const anchor="const runtime=new Set(['manifest.json']);";
  if(!s.includes('manifest.background?.service_worker')){
    if(!s.includes(anchor))throw new Error('Package runtime anchor missing');
    s=s.replace(anchor,`${anchor}\nif(manifest.background?.service_worker)runtime.add(manifest.background.service_worker);`);
  }
  write(p,s);
}

// Runtime invariant checker: version/lifecycle/onboarding v101/background inclusion.
{
  const p='tools/check-runtime.mjs';let s=read(p);
  s=s.replaceAll("manifest.version !== '0.9.4'","manifest.version !== '0.9.5'");
  s=s.replaceAll('Expected 0.9.4','Expected 0.9.5');
  s=s.replaceAll("'onboarding-v100.js'","'onboarding-v101.js'");
  if(!s.includes("manifest.background?.service_worker !== 'background-v100.js'")){
    const anchor="if (manifest.version !== '0.9.5') fail(`Expected 0.9.5, got ${manifest.version}`);";
    if(!s.includes(anchor))throw new Error('Checker version anchor missing');
    s=s.replace(anchor,`${anchor}\nif (manifest.background?.service_worker !== 'background-v100.js') fail('Lifecycle service worker required');`);
  }
  if(!s.includes("const background = read('background-v100.js')")){
    const anchor='// 1.0 UX: onboarding, profiles, command palette.';
    if(!s.includes(anchor))throw new Error('Checker UX anchor missing');
    const block=`// Install lifecycle and deterministic onboarding.\nconst background = read('background-v100.js');\nhas(background, 'chrome.runtime.onInstalled');\nhas(background, \"reason:details.reason\");\nhas(texts['onboarding-v101.js'], 'INSTALL_META');\nhas(texts['onboarding-v101.js'], \"lifecycle?.reason==='install'\");\nhas(texts['onboarding-v101.js'], \"lifecycle?.reason==='update'\");\nno(texts['onboarding-v101.js'], 'hasLegacyMirror');\nconst shouldShow = texts['onboarding-v101.js'].match(/async function shouldShow\\(\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\n\\s*function close/)?.[1] || '';\nif (!shouldShow) fail('Unable to inspect onboarding shouldShow()');\nconst shouldShowLogic = shouldShow.replace(/\\/\\*[\\s\\S]*?\\*\\//g,'').replace(/\\/\\/.*$/gm,'');\nno(shouldShowLogic, 'localStorage', 'Onboarding upgrade detection must not depend on page localStorage');\nno(shouldShowLogic, 'indexedDB', 'Onboarding upgrade detection must not depend on page IndexedDB');\n\n${anchor}`;
    s=s.replace(anchor,block);
  }
  // Public docs gate.
  if(!s.includes("background-v100.js")||!s.includes("onboarding-v101.js"))throw new Error('Checker lifecycle convergence failed');
  write(p,s);
}

// Check workflow syntax must include background worker.
for(const p of ['.github/workflows/check.yml','.github/workflows/public-gate.yml']){
  if(!fs.existsSync(p))continue;
  let s=read(p);
  if(!s.includes('node --check background-v100.js')){
    const marker='      - name: Check JavaScript syntax\n';
    const idx=s.indexOf(marker);
    if(idx>=0){
      const runIdx=s.indexOf('        run:',idx);
      const nextStep=s.indexOf('\n      - name:',runIdx+1);
      if(runIdx>=0){
        const insertAt=nextStep>=0?nextStep:s.length;
        s=s.slice(0,insertAt).replace(/\s*$/,'')+'\n          node --check background-v100.js\n'+s.slice(insertAt);
      }
    }
  }
  write(p,s);
}

// Runtime test expectations + lifecycle update scenario.
{
  const p='visual-lab/tests/runtime-extension.spec.js';let s=read(p).replaceAll('0.9.4','0.9.5');
  if(!s.includes('lifecycle update never forces onboarding')){
    const anchor="test('real extension boots and Project counters use cursor-safe pagination'";
    const idx=s.indexOf(anchor);if(idx<0)throw new Error('Runtime test insertion anchor missing');
    const block=`test('lifecycle update never forces onboarding', async () => {\n  const rt = await launchRuntime();\n  try {\n    await rt.page.goto(\`https://chatgpt.com/c/${CHAT1}\`, { waitUntil: 'domcontentloaded' });\n    const worker = rt.context.serviceWorkers()[0] || await rt.context.waitForEvent('serviceworker', { timeout: 5000 });\n    await worker.evaluate(async () => {\n      await chrome.storage.local.set({'niakgpt-install-meta-v100':{reason:'update',previousVersion:'0.9.4',currentVersion:'0.9.5',changedAt:Date.now()}});\n      await chrome.storage.local.remove('niakgpt-onboarding-v100');\n    });\n    await rt.page.reload({ waitUntil:'domcontentloaded' });\n    await expect(rt.page.locator('#ng8-status')).toBeVisible({ timeout:12000 });\n    await rt.page.waitForTimeout(2200);\n    await expect(rt.page.locator('#ng100-onboarding')).toHaveCount(0);\n  } finally { await rt.close(); }\n});\n\n`;
    s=s.slice(0,idx)+block+s.slice(idx);
  } else {
    s=s.replace(/await rt\.page\.evaluate\(async \(\) => \{\s*await chrome\.storage\.local\.set\(\{'niakgpt-install-meta-v100':[\s\S]*?await chrome\.storage\.local\.remove\('niakgpt-onboarding-v100'\);\s*\}\);/m,
`const worker = rt.context.serviceWorkers()[0] || await rt.context.waitForEvent('serviceworker', { timeout: 5000 });\n    await worker.evaluate(async () => {\n      await chrome.storage.local.set({'niakgpt-install-meta-v100':{reason:'update',previousVersion:'0.9.4',currentVersion:'0.9.5',changedAt:Date.now()}});\n      await chrome.storage.local.remove('niakgpt-onboarding-v100');\n    });`);
  }
  write(p,s);
}

// Source-level onboarding race test is rewritten deterministically.
write('visual-lab/tests/onboarding-race.spec.js',`const { test, expect } = require('@playwright/test');\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst source = fs.readFileSync(path.join(__dirname, '..', '..', 'onboarding-v101.js'), 'utf8');\n\ntest('first-install detection uses extension lifecycle and persistent storage only', async () => {\n  expect(source).toContain('INSTALL_META');\n  expect(source).toContain('LEGACY_STORAGE_KEYS');\n  expect(source).toContain('chrome.storage.local.get(null)');\n  expect(source).toContain(\"lifecycle?.reason==='install'\");\n  expect(source).toContain(\"lifecycle?.reason==='update'\");\n  expect(source).not.toContain('hasLegacyMirror');\n  const match = source.match(/async function shouldShow\\(\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\n\\s*function close/);\n  expect(match, 'shouldShow() source must be inspectable').not.toBeNull();\n  const logic = match[1].replace(/\\/\\*[\\s\\S]*?\\*\\//g,'').replace(/\\/\\/.*$/gm,'');\n  expect(logic).not.toContain('localStorage');\n  expect(logic).not.toContain('indexedDB');\n});\n`);

console.log('NiakGPT 0.9.5 convergence source updates applied');
