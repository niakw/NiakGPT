(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_POLISH_081__) return;
  window.__NIAKGPT_POLISH_081__ = true;

  const OWN = '#ng8-panel,#ng8-rail,#ng8-status,#ng8-quick,#ng8-coach,#ng8-pins';
  const VERSION = (() => { try { return chrome.runtime.getManifest().version || '0.8.6'; } catch { return '0.8.6'; } })();

  function visible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0;
  }

  function fixBrand() {
    const candidates = document.querySelectorAll('header *, nav *, [data-testid*="sidebar"] *');
    for (const el of candidates) {
      if (!(el instanceof HTMLElement) || !visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > 105 || r.left > 360) continue;
      const own = el.childElementCount === 0 ? (el.textContent || '').trim() : '';
      if (own === 'ChatGPT Plus' || own === 'NiakGPT Plus' || own === 'ChatGPT') {
        el.textContent = 'NiakGPT';
        el.dataset.ng8Brand = '1';
        break;
      }
    }

    const version = document.querySelector('#ng8-status > span:first-child');
    if (version && /NiakGPT/.test(version.textContent || '')) version.innerHTML = `<b>NiakGPT</b> ${VERSION}`;
  }

  function activityPanel() {
    const candidates = [...document.querySelectorAll('aside,[role="dialog"],[data-testid*="activity" i],[class*="fixed"]')];
    for (const panel of candidates) {
      if (!(panel instanceof HTMLElement) || panel.closest(OWN) || !visible(panel)) continue;
      const r = panel.getBoundingClientRect();
      if (r.width < 280 || r.width > 720 || r.right < innerWidth - 80) continue;
      const heads = [...panel.querySelectorAll('h1,h2,h3,[role="heading"],header,div,span')].slice(0,80);
      const hasActivity = heads.some(x => /^(activité|activite|activity)(\s|·|$)/i.test((x.textContent || '').trim()));
      if (hasActivity) return panel;
    }
    return null;
  }

  function closeActivity(panel) {
    const native = [...panel.querySelectorAll('button')].find(b => {
      const label = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''} ${b.textContent || ''}`.trim();
      return /fermer|close|masquer|hide|réduire|reduire/i.test(label);
    });
    if (native) { native.click(); return; }

    const id = panel.id;
    if (id) {
      const trigger = [...document.querySelectorAll('button[aria-expanded="true"],button[aria-controls]')].find(b => b.getAttribute('aria-controls') === id);
      if (trigger) { trigger.click(); return; }
    }

    document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', code:'Escape', bubbles:true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', code:'Escape', bubbles:true }));
  }

  function decorateActivity() {
    document.querySelectorAll('.ng8-native-activity').forEach(p => { if (!visible(p)) p.classList.remove('ng8-native-activity'); });
    const panel = activityPanel();
    if (!panel) return;
    panel.classList.add('ng8-native-activity');
    if (getComputedStyle(panel).position === 'static') panel.style.position = 'relative';

    const header = panel.querySelector('header,[role="heading"]')?.closest('header,div') || panel.querySelector('header');
    if (header instanceof HTMLElement) header.classList.add('ng8-activity-head');

    let close = panel.querySelector(':scope > .ng8-activity-close');
    if (!close) {
      close = document.createElement('button');
      close.type = 'button';
      close.className = 'ng8-activity-close';
      close.setAttribute('aria-label', 'Fermer le panneau Activité');
      close.title = 'Fermer Activité';
      close.textContent = '×';
      close.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        closeActivity(panel);
      });
      panel.appendChild(close);
    }
  }

  function markActiveProject() {
    const match = location.pathname.match(/\/g\/(g-p-[^/]+)\//i);
    const pid = match?.[1] || '';
    document.querySelectorAll('#ng8-pins a[data-ng8-pin]').forEach(a => {
      a.classList.toggle('ng8-active-project', !!pid && (a.getAttribute('href') || '').includes(pid));
    });
  }

  function polish() {
    if (document.hidden) return;
    decorateActivity();
    if (document.documentElement.dataset.ng8Running !== '1') {
      fixBrand();
      markActiveProject();
    }
  }

  polish();
  document.addEventListener('click', () => setTimeout(polish, 120), true);
  window.addEventListener('popstate', () => setTimeout(polish, 100));
  setInterval(polish, 2600);
})();
