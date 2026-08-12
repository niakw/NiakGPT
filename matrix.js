(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_MATRIX__) return;
  window.__NIAKGPT_MATRIX__ = true;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function robotSvg() {
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 13h28l7 10v18l-8 10H19l-8-10V23z" fill="#aab1b9" stroke="#d8dde3" stroke-width="2"/>
      <path d="M16 26h32l-3 17H19z" fill="#555d66"/>
      <path d="M22 46h20v7H22z" fill="#777f89"/>
      <path d="M20 19h24l3 6H17z" fill="#7b848d"/>
      <circle class="eye" cx="24" cy="32" r="3.5"/><circle class="eye" cx="40" cy="32" r="3.5"/>
      <path d="M27 40h10M30 46v7M34 46v7" stroke="#d8dde3" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  function addBots() {
    if (!document.getElementById('ng-bot-corner')) {
      const el = document.createElement('div');
      el.id = 'ng-bot-corner'; el.className = 'ng-easterbot'; el.title = "I'll be back."; el.innerHTML = robotSvg();
      document.documentElement.appendChild(el);
    }
    if (!document.getElementById('ng-bot-panel')) {
      const el = document.createElement('div');
      el.id = 'ng-bot-panel'; el.className = 'ng-easterbot'; el.title = 'System online.'; el.innerHTML = robotSvg();
      document.documentElement.appendChild(el);
    }
  }

  addBots();
  if (reducedMotion) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'ng-matrix'; canvas.setAttribute('aria-hidden', 'true');
  document.documentElement.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const glyphs = '01アイウエオカキクケコサシスセソﾊﾐﾋｰﾆｱｸGPT<>[]{}\/|';
  const robotGlyph = '☠';
  let cssW = 0, cssH = 0, cols = 0, drops = [], last = 0, raf = 0;
  const FPS = 18;
  const FRAME = 1000 / FPS;
  const fontSize = 15;
  const renderScale = 0.58;

  function resize() {
    cssW = innerWidth; cssH = innerHeight;
    canvas.width = Math.max(320, Math.floor(cssW * renderScale));
    canvas.height = Math.max(240, Math.floor(cssH * renderScale));
    canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
    const logicalFont = fontSize * renderScale;
    cols = Math.ceil(canvas.width / logicalFont);
    drops = Array.from({ length: cols }, (_, i) => drops[i] ?? Math.random() * -(canvas.height / logicalFont));
  }

  function draw(now) {
    raf = requestAnimationFrame(draw);
    if (document.hidden || now - last < FRAME) return;
    last = now;

    const logicalFont = fontSize * renderScale;
    ctx.fillStyle = 'rgba(4, 10, 8, .12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${logicalFont}px Consolas, "SFMono-Regular", monospace`;
    ctx.textBaseline = 'top';

    for (let i = 0; i < cols; i++) {
      const rareBot = Math.random() < 0.0009;
      const ch = rareBot ? robotGlyph : glyphs[(Math.random() * glyphs.length) | 0];
      const x = i * logicalFont;
      const y = drops[i] * logicalFont;
      const hot = Math.random() < 0.045;
      ctx.fillStyle = rareBot ? 'rgba(210,55,55,.48)' : hot ? 'rgba(174,255,205,.43)' : 'rgba(49,205,104,.28)';
      ctx.fillText(ch, x, y);
      if (y > canvas.height && Math.random() > .976) drops[i] = -Math.random() * 28;
      else drops[i] += 0.52 + Math.random() * 0.16;
    }
  }

  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 160); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) last = performance.now();
  });
  resize();
  raf = requestAnimationFrame(draw);

  addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
})();
