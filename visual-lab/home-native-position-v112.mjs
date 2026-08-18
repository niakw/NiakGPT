import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const OUT=path.resolve('artifacts/finalization-v112');
const js=await fs.readFile(path.join(ROOT,'home-layout-v112.js'),'utf8');
const css=await fs.readFile(path.join(ROOT,'home-layout-v112.css'),'utf8');
const ALL={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const engines=requested?{[requested]:ALL[requested]}:ALL;
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:900},colorScheme:'dark'});
  const page=await context.newPage();
  try{
    const html=`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;background:#05090d;color:#fff}main{position:relative;height:760px}.home{position:relative;height:100%}
      h1{position:absolute;top:360px;left:50%;transform:translateX(-50%);margin:0;font:700 32px system-ui;white-space:nowrap}
      form{position:absolute;top:350px;left:50%;transform:translateX(-50%);width:760px;height:110px;background:#111;border:1px solid #555}
      #prompt-textarea{height:70px}
    </style></head><body class="ng8-ready"><main><div class="home"><h1>Par quoi commençons-nous ?</h1><form><div id="prompt-textarea" contenteditable="true"></div></form></div></main></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
    await page.goto('https://chatgpt.com/',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:css});await page.addScriptTag({content:js});await page.waitForTimeout(450);
    const result=await page.evaluate(()=>{
      const h=document.querySelector('h1').getBoundingClientRect(),f=document.querySelector('form').getBoundingClientRect();
      const hc=(h.left+h.right)/2,fc=(f.left+f.right)/2;
      return{heading:{left:h.left,right:h.right,top:h.top,bottom:h.bottom,center:hc},composer:{left:f.left,right:f.right,top:f.top,bottom:f.bottom,center:fc},centerDelta:Math.abs(hc-fc),overlap:h.bottom>f.top-12&&h.top<f.bottom+12,repaired:document.querySelector('h1').classList.contains('ng112-home-heading-repaired'),position:getComputedStyle(document.querySelector('h1')).position,transform:getComputedStyle(document.querySelector('h1')).transform,translate:getComputedStyle(document.querySelector('h1')).translate};
    });
    assert(result.repaired,'overlap repair did not activate');assert(!result.overlap,'heading still overlaps composer');assert(result.centerDelta<2,`native horizontal centering changed by ${result.centerDelta}px`);assert(result.position==='absolute',`native positioning overwritten: ${result.position}`);
    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,'home-native-position.png'),fullPage:true});
    await fs.writeFile(path.join(dir,'home-native-position.html'),await page.content());
    await fs.writeFile(path.join(dir,'home-native-position.json'),JSON.stringify(result,null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`home-native-position-v112: ${Object.keys(engines).join(',')} PASS`);
