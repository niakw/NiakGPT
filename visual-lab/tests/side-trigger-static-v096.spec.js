const { test, expect } = require('@playwright/test');
const path=require('node:path');
const css=path.resolve(__dirname,'..','..','side-panels-v096.css');

async function setup(page){
  await page.setContent(`<!doctype html><html><head></head><body><aside id="right-host"><button id="trigger" class="ng96-native-side-trigger ng96-side-trigger-static ng96-side-trigger-sources">Sources</button></aside><aside id="ng8-rail"></aside><aside id="ng8-panel"></aside></body></html>`);
  await page.addStyleTag({path:css});
  await page.addStyleTag({content:`:root{--ng8-rail:48px;--ng8-panel-w:360px}body{margin:0;background:#05090d}#right-host{position:fixed;right:0;top:120px;display:flex;justify-content:flex-end;width:110px;height:40px}#trigger{position:static;width:72px;height:32px}#ng8-rail{position:fixed;right:0;top:0;bottom:0;width:48px}#ng8-panel{position:fixed;right:48px;top:0;width:360px;height:100vh}`});
}

const boxes=page=>page.evaluate(()=>{const t=document.getElementById('trigger').getBoundingClientRect(),r=document.getElementById('ng8-rail').getBoundingClientRect(),p=document.getElementById('ng8-panel').getBoundingClientRect();return{trigger:{left:t.left,right:t.right},rail:{left:r.left},panel:{left:p.left}};});

test('static collapsed Sources handle stays fully left of right rail',async({page})=>{
  await setup(page);const b=await boxes(page);expect(b.trigger.right).toBeLessThanOrEqual(b.rail.left-7);
});

test('static collapsed handle also clears the NiakGPT panel when it is open',async({page})=>{
  await setup(page);await page.locator('body').evaluate(el=>el.classList.add('ng8-panel-open'));const b=await boxes(page);expect(b.trigger.right).toBeLessThanOrEqual(b.panel.left-7);
});
