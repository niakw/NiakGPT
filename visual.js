(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_VISUAL__) return;
  window.__NIAKGPT_VISUAL__ = true;

  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function iconFor(label) {
    const s = norm(label);
    if (/code|dev|tech|api|github|web|script|sql|javascript|typescript|python|php|app|logiciel|extension/.test(s)) return '</>';
    if (/design|ui|ux|brand|graph|image|visuel|logo|creative|creatif/.test(s)) return '◇';
    if (/seo|marketing|ads|acquisition|social|contenu|content|growth/.test(s)) return '↗';
    if (/shop|commerce|ecommerce|produit|marketplace|business|vente|store/.test(s)) return '▣';
    if (/jurid|droit|legal|prud|tribunal|avocat|justice|contrat/.test(s)) return '§';
    if (/finance|banque|credit|impot|admin|assurance|budget|compta/.test(s)) return '€';
    if (/film|cinema|serie|anime|culture|media|video/.test(s)) return '▶';
    if (/ia|ai|gpt|llm|prompt|agent|assistant/.test(s)) return '✦';
    if (/perso|personal|famille|sante|health|vie|life/.test(s)) return '♥';
    if (/research|recherche|science|etude|study|knowledge|savoir/.test(s)) return '⌕';
    if (/projet|project|work|travail|productiv/.test(s)) return '◆';
    const first = String(label || '').trim().charAt(0).toUpperCase();
    return first || '◆';
  }

  function toneFromColor(hex) {
    const m = String(hex || '').match(/#([0-9a-f]{6})/i);
    if (!m) return '#569cd6';
    return `#${m[1]}`;
  }

  function decorateProjects() {
    document.querySelectorAll('a[data-ng-native-project="1"]').forEach(a => {
      const label = (a.textContent || '').trim();
      a.dataset.ngIcon = iconFor(label);
      const color = toneFromColor(a.style.getPropertyValue('--ng-project-color'));
      a.style.setProperty('--ng-project-color', color);
    });
  }

  function decorateActivity() {
    const map = [
      ['explorer','▱'],['toc','☷'],['audit','✓'],['prompt','✦'],['perf','⌁'],['settings','⚙'],['diag','◉']
    ];
    map.forEach(([tab,icon]) => {
      const b = document.querySelector(`#ng-activity [data-tab="${tab}"]`);
      if (b && b.dataset.ngVisualIcon !== '1') { b.textContent = icon; b.dataset.ngVisualIcon = '1'; }
    });
  }

  function decorateFeed() {
    document.querySelectorAll('[data-ng-turn]').forEach((turn, index) => {
      turn.dataset.ngParity = String(index % 2);
      const role = turn.querySelector('[data-message-author-role]')?.getAttribute('data-message-author-role') || turn.dataset.ngInteraction || '';
      turn.classList.toggle('ng-user-turn', role === 'user');
      turn.classList.toggle('ng-assistant-turn', role === 'assistant');
    });
  }

  function brand() {
    if (document.title.includes('ChatGPT')) document.title = document.title.replace(/ChatGPT/g, 'NiakGPT');
    const els = [...document.querySelectorAll('header button,header a,header span,button,a,span')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && r.top < 95 && r.left < 430 && /^chatgpt$/i.test((el.textContent || '').trim());
    });
    if (els[0]) { els[0].textContent = 'NiakGPT'; els[0].dataset.ngBrand = '1'; }
  }

  function decorateStatus() {
    const status = document.getElementById('ng-status');
    if (!status) return;
    status.dataset.ngReady = '1';
    const generating = document.documentElement.dataset.ngGenerating === '1';
    status.classList.toggle('ng-status-running', generating);
  }

  function run() {
    brand(); decorateProjects(); decorateActivity(); decorateFeed(); decorateStatus();
  }

  let timer = 0;
  const obs = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  });
  obs.observe(document.documentElement, { subtree:true, childList:true, characterData:true });
  setInterval(run, 900);
  run();
})();
