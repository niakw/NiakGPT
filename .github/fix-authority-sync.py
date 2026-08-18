from pathlib import Path
p=Path('sidebar-projects-authority-v112.js')
s=p.read_text(encoding='utf-8')
old="document.addEventListener('niakgpt:pins-rendered',()=>schedule(0));document.addEventListener('niakgpt:recovery-complete',()=>schedule(12));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0);});window.addEventListener('popstate',()=>schedule(0));if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>schedule(0));"
new="document.addEventListener('niakgpt:pins-rendered',()=>apply());document.addEventListener('niakgpt:recovery-complete',()=>schedule(12));document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply();});window.addEventListener('popstate',()=>apply());if(window.navigation?.addEventListener)window.navigation.addEventListener('navigatesuccess',()=>apply());"
if old not in s: raise SystemExit('authority event tail not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
Path('.github/fix-authority-sync.py').unlink()
