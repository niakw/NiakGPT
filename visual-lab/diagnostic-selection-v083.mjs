import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const ROOT=path.resolve('..');
const source=await fs.readFile(path.join(ROOT,'app-v090.js'),'utf8');
const engines={chromium,firefox,webkit};
const requested=String(process.env.NIAKGPT_BROWSER||'').trim();
const selected=requested?{[requested]:engines[requested]}:engines;
if(requested&&!engines[requested])throw new Error('Unsupported NIAKGPT_BROWSER='+requested);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const [engine,launcher] of Object.entries(selected)){
  const browser=await launcher.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:800},reducedMotion:'reduce'});
  const page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const local={};
      const listeners=[];
      window.__externalDiag={custom:'ONE'};
      window.chrome={
        storage:{
          local:{
            async get(keys){
              if(keys==null)return structuredClone(local);
              const list=Array.isArray(keys)?keys:[keys],out={};
              for(const key of list)if(local[key]!==undefined)out[key]=structuredClone(local[key]);
              return out;
            },
            async set(obj){Object.assign(local,structuredClone(obj));},
            async remove(keys){for(const key of (Array.isArray(keys)?keys:[keys]))delete local[key];}
          },
          onChanged:{addListener(fn){listeners.push(fn);}}
        }
      };
      const own={};
      window.__NIAKGPT_DIAGNOSTICS__={
        set(k,v){own[k]=v;},
        snapshot(){return {...own,...window.__externalDiag};}
      };
    });
    await page.route('https://chatgpt.com/**',route=>route.fulfill({
      status:200,
      contentType:'text/html; charset=utf-8',
      body:'<!doctype html><html><head><style>aside[data-testid="conversation-sidebar"]{position:fixed;left:0;top:0;width:300px;height:780px}main{margin-left:320px}</style></head><body><aside data-testid="conversation-sidebar"><a href="/">ChatGPT</a><a href="/search">Recherche</a></aside><main><div data-message-author-role="assistant">Conversation</div></main></body></html>'
    }));
    await page.goto('https://chatgpt.com/c/11111111-1111-4111-8111-111111111111',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      document.documentElement.dataset.ng8TabRole='client';
      document.documentElement.dataset.ng86Activity='ready';
      document.documentElement.dataset.ng90Matrix='off';
      document.documentElement.dataset.ng90Eggs='off';
    });
    await page.addScriptTag({content:source});
    await page.waitForSelector('#ng8-rail button[data-tab="diag"]',{timeout:4000});
    await page.locator('#ng8-rail button[data-tab="diag"]').evaluate(button=>button.click());
    await page.waitForFunction(()=>document.querySelector('#ng8-panel')?.innerText.includes('ONE'),null,{timeout:3000});
    // Isolate the field regression from first-boot churn: the user is copying an already
    // open diagnostic while live module metrics continue to change.
    await page.waitForTimeout(700);

    const selectedText=await page.evaluate(()=>{
      const panel=document.getElementById('ng8-panel'),diag=panel.querySelector('.ng8-diag');
      window.__diagNodeBefore=diag;
      diag.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      const range=document.createRange();range.selectNodeContents(diag);
      const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      diag.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
      return sel.toString();
    });
    assert(selectedText.includes('ONE'),engine+': fixture did not select diagnostic text');

    await page.evaluate(()=>{
      window.__externalDiag.custom='TWO';
      document.dispatchEvent(new CustomEvent('niakgpt:diagnostic-changed'));
      document.dispatchEvent(new CustomEvent('niakgpt:diagnostic-changed'));
    });
    await page.waitForTimeout(650);
    const held=await page.evaluate(()=>({
      selected:getSelection()?.toString()||'',
      sameNode:window.__diagNodeBefore===document.querySelector('#ng8-panel .ng8-diag'),
      text:document.getElementById('ng8-panel')?.innerText||''
    }));
    assert(held.selected.includes('ONE'),engine+': diagnostic update destroyed the active text selection: '+JSON.stringify(held));
    assert(held.sameNode,engine+': diagnostic DOM rerendered while text was selected');
    assert(!held.text.includes('TWO'),engine+': diagnostic content updated during active selection');

    await page.evaluate(()=>{
      getSelection()?.removeAllRanges();
      document.dispatchEvent(new Event('selectionchange'));
      document.querySelector('main')?.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    });
    await page.waitForFunction(()=>document.getElementById('ng8-panel')?.innerText.includes('TWO'),null,{timeout:2500});
    assert((await page.locator('#ng8-panel').innerText()).includes('TWO'),engine+': diagnostics did not resume after selection ended');
  }finally{
    await context.close();
    await browser.close();
  }
}

console.log('diagnostic-selection-v083: PASS sticky read-copy mode preserves selection and refresh resumes after explicit exit');
