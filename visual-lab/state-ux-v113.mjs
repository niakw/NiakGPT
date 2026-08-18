import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';
const ROOT=path.resolve('..'),OUT=path.resolve('artifacts/finalization-v113');
const files=await Promise.all(['chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','chat-attention-v113.css','conversation-load-guard-v113.js'].map(f=>fs.readFile(path.join(ROOT,f),'utf8')));
const [stateJs,breadcrumbJs,attentionJs,attentionCss,loadGuardJs]=files;
const ALL={chromium,firefox,webkit},requested=String(process.env.NIAKGPT_BROWSER||'').trim(),engines=requested?{[requested]:ALL[requested]}:ALL;if(requested&&!ALL[requested])throw new Error(`Unsupported NIAKGPT_BROWSER=${requested}`);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
for(const [engine,launcher] of Object.entries(engines)){
  const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:1220,height:800},colorScheme:'dark'}),page=await context.newPage();
  try{
    await page.addInitScript(()=>{
      const id1='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',id2='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      const t1=1787000000000,t2=1786990000000;
      const store={'niakgpt-v08-cache':{projects:[{id:'g-p-niakgpt',name:'NiakGPT'}],chats:[{id:id1,title:'Correct Server Title',projectId:'g-p-niakgpt',updated:t1},{id:id2,title:'Background Chat',projectId:'g-p-niakgpt',updated:t2}]}};const listeners=[];
      const pick=key=>typeof key==='string'?{[key]:store[key]}:Array.isArray(key)?Object.fromEntries(key.map(k=>[k,store[k]])):{...store};
      window.__labTimes={t1,t2,responseDone:t1+700,backgroundUpdate:t1+10000};window.__labStore=store;window.__labNotify=(key,next)=>{const old=store[key];store[key]=next;for(const fn of listeners)fn({[key]:{oldValue:old,newValue:next}},'local');};
      window.chrome={runtime:{id:'lab',getManifest:()=>({version:'0.9.63'})},storage:{local:{get:async key=>pick(key),set:async obj=>{for(const [k,v] of Object.entries(obj)){const old=store[k];store[k]=v;for(const fn of listeners)fn({[k]:{oldValue:old,newValue:v}},'local');}}},onChanged:{addListener:fn=>listeners.push(fn)}}};
    });
    const html=`<!doctype html><html data-ng86-activity="ready"><head><title>Correct Server Title, chat dans le projet NiakGPT | ChatGPT</title></head><body><nav data-testid="conversation-sidebar"><section id="ng8-pins"><div class="ng96-pin-entry" data-pid="g-p-niakgpt"><a data-ng8-pin="1" href="/g/g-p-niakgpt/project"><span>NiakGPT</span></a></div><div class="ng96-folder-list"><a data-chat="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" href="/g/g-p-niakgpt/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"><span>Correct Server Title</span><time>18/08</time></a><a data-chat="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" href="/g/g-p-niakgpt/c/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"><span>Background Chat</span><time>18/08</time></a></div></section></nav><main><article data-testid="conversation-turn-1"><div data-message-author-role="assistant">Visible content</div></article></main></body></html>`;
    await page.route('https://chatgpt.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:html}));await page.goto('https://chatgpt.com/g/g-p-niakgpt/c/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:attentionCss});for(const js of [stateJs,breadcrumbJs,attentionJs,loadGuardJs])await page.addScriptTag({content:js});await page.waitForTimeout(650);
    const crumb=await page.evaluate(()=>[...document.querySelectorAll('#ng100-breadcrumb a')].map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')})));
    assert(crumb.length===3,'breadcrumb must contain exactly 3 links for a Project chat');assert(crumb[0].text==='Accueil'&&crumb[1].text==='NiakGPT'&&crumb[2].text==='Correct Server Title','breadcrumb labels drifted');
    await page.evaluate(()=>{document.title='Wrong Browser Tab Title | ChatGPT';document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{state:'ready',active:false}}));});await page.waitForTimeout(260);
    const tabAuthority=await page.evaluate(()=>({cache:window.__labStore['niakgpt-v08-cache'].chats.find(c=>c.id.startsWith('aaaaaaaa')).title,crumb:[...document.querySelectorAll('#ng100-breadcrumb a')].at(-1)?.textContent.trim()}));
    assert(tabAuthority.cache==='Correct Server Title'&&tabAuthority.crumb==='Correct Server Title','browser tab title overrode canonical server title');
    await page.evaluate(()=>{const raw=structuredClone(window.__labStore['niakgpt-v08-cache']);raw.chats=raw.chats.map(c=>c.id.startsWith('aaaaaaaa')?{...c,title:'Wrong Old Cache',updated:window.__labTimes.t1}:c);window.__labNotify('niakgpt-v08-cache',raw);});await page.waitForTimeout(500);
    const canonical=await page.evaluate(()=>({cache:window.__labStore['niakgpt-v08-cache'].chats.find(c=>c.id.startsWith('aaaaaaaa')).title,crumb:[...document.querySelectorAll('#ng100-breadcrumb a')].at(-1)?.textContent.trim()}));
    assert(canonical.cache==='Correct Server Title'&&canonical.crumb==='Correct Server Title','same-timestamp stale title defeated canonical state');
    const serverBefore=await page.evaluate(()=>window.__labStore['niakgpt-v08-cache'].chats.find(x=>x.id.startsWith('aaaaaaaa')).updated);
    await page.evaluate(()=>{document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{state:'thinking',active:true,at:window.__labTimes.t1+100}}));document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{state:'ready',active:false,at:window.__labTimes.responseDone}}));});await page.waitForTimeout(320);
    const liveSignal=await page.evaluate(()=>{const c=window.__labStore['niakgpt-v08-cache'].chats.find(x=>x.id.startsWith('aaaaaaaa'));return{updated:c.updated,attentionAt:c.attentionAt||0,expected:window.__labTimes.responseDone};});
    assert(liveSignal.updated===serverBefore&&liveSignal.attentionAt===liveSignal.expected,'response completion must publish attentionAt without forging server updated');
    await page.evaluate(()=>{const raw=structuredClone(window.__labStore['niakgpt-v08-cache']);raw.chats=raw.chats.map(c=>c.id.startsWith('bbbbbbbb')?{...c,title:'Background Chat',updated:window.__labTimes.backgroundUpdate}:c);window.__labNotify('niakgpt-v08-cache',raw);});await page.waitForTimeout(350);
    let attention=await page.evaluate(()=>({unread:document.querySelector('a[data-chat^="bbbbbbbb"]')?.dataset.ng113Unread||'',project:document.querySelector('.ng96-pin-entry')?.dataset.ng113UnreadCount||''}));assert(attention.unread==='1'&&attention.project==='1','background updated chat did not become visually unread');
    await page.evaluate(()=>document.querySelector('a[data-chat^="bbbbbbbb"]')?.addEventListener('click',e=>e.preventDefault(),{once:true}));await page.locator('a[data-chat^="bbbbbbbb"]').click();await page.waitForTimeout(120);attention=await page.evaluate(()=>({unread:document.querySelector('a[data-chat^="bbbbbbbb"]')?.dataset.ng113Unread||''}));assert(attention.unread!=='1','opening chat did not clear unread state');
    await page.evaluate(()=>{document.documentElement.dataset.ng112LongThread='1';document.documentElement.dataset.ng8Heavy='1';document.querySelector('main article')?.remove();document.dispatchEvent(new CustomEvent('niakgpt:activity-changed',{detail:{state:'ready',active:false}}));});await page.waitForTimeout(500);
    const guard=await page.evaluate(()=>({long:document.documentElement.dataset.ng112LongThread,heavy:document.documentElement.dataset.ng8Heavy,mainDisplay:getComputedStyle(document.querySelector('main')).display}));assert(guard.long==='0'&&guard.heavy==='0'&&guard.mainDisplay!=='none','load guard did not release NiakGPT pressure on missing native content');
    const dir=path.join(OUT,engine);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,'state-ux.png'),fullPage:true});await fs.writeFile(path.join(dir,'state-ux.html'),await page.content());await fs.writeFile(path.join(dir,'state-ux.json'),JSON.stringify({crumb,tabAuthority,canonical,serverBefore,liveSignal,attention,guard},null,2));
  }finally{await context.close();await browser.close();}
}
console.log(`state-ux-v113: ${Object.keys(engines).join(',')} PASS`);
