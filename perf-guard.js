(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PERF_GUARD__) return;
  window.__NIAKGPT_PERF_GUARD__ = true;

  const OWN_UI = '#ng6-status,#ng6-rail,#ng6-panel,#ng6-coach,#ng6-pinned-projects,#ng6-quick,.ng6-bot';
  const nativeMO = window.MutationObserver;
  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCAF = window.cancelAnimationFrame.bind(window);

  let heavyCache = false;
  let heavyCheckedAt = 0;

  function isRunning() {
    return document.documentElement.dataset.ng6Running === '1';
  }

  function isHeavy() {
    const now = performance.now();
    if (now - heavyCheckedAt < 2200) return heavyCache;
    heavyCheckedAt = now;
    const turns = document.querySelectorAll('[data-ng6-turn]').length;
    heavyCache = turns >= 70 || document.querySelectorAll('pre,table,.katex-display,mjx-container').length >= 45;
    document.documentElement.dataset.ng6Heavy = heavyCache ? '1' : '0';
    return heavyCache;
  }

  function elementOf(node) {
    if (!node) return null;
    if (node.nodeType === Node.ELEMENT_NODE) return node;
    return node.parentElement || null;
  }

  function insideOwnUI(node) {
    const el = elementOf(node);
    return !!el?.closest?.(OWN_UI);
  }

  function meaningfulRecord(record) {
    if (insideOwnUI(record.target)) return false;
    const nodes = [...(record.addedNodes || []), ...(record.removedNodes || [])];
    if (nodes.length && nodes.every(insideOwnUI)) return false;
    return true;
  }

  class GuardedMutationObserver {
    constructor(callback) {
      this._callback = callback;
      this._pending = [];
      this._timer = 0;
      this._last = 0;
      this._native = new nativeMO((records) => {
        const filtered = records.filter(meaningfulRecord);
        if (!filtered.length) return;

        this._pending.push(...filtered.slice(-80));
        if (this._pending.length > 160) this._pending.splice(0, this._pending.length - 160);

        const running = isRunning();
        const heavy = isHeavy();
        const gap = running ? (heavy ? 1900 : 1050) : (heavy ? 320 : 125);
        const elapsed = performance.now() - this._last;
        const wait = Math.max(0, gap - elapsed);

        if (this._timer) return;
        this._timer = window.setTimeout(() => {
          this._timer = 0;
          this._last = performance.now();
          const batch = this._pending.splice(0);
          try { this._callback(batch, this); } catch (error) { console.error('[NiakGPT perf guard]', error); }
        }, wait);
      });
    }
    observe(target, options) { return this._native.observe(target, options); }
    disconnect() {
      if (this._timer) clearTimeout(this._timer);
      this._timer = 0;
      this._pending.length = 0;
      return this._native.disconnect();
    }
    takeRecords() { return this._native.takeRecords().filter(meaningfulRecord); }
  }

  window.MutationObserver = GuardedMutationObserver;

  let virtualId = 1_000_000;
  const rafHandles = new Map();

  window.requestAnimationFrame = function guardedRAF(callback) {
    const id = ++virtualId;
    const running = isRunning();
    const heavy = isHeavy();
    const delay = document.hidden ? 1000 : running ? (heavy ? 650 : 360) : 0;

    if (delay) {
      const timeout = window.setTimeout(() => {
        const real = nativeRAF((time) => {
          rafHandles.delete(id);
          callback(time);
        });
        rafHandles.set(id, { kind:'raf', id:real });
      }, delay);
      rafHandles.set(id, { kind:'timeout', id:timeout });
    } else {
      const real = nativeRAF((time) => {
        rafHandles.delete(id);
        callback(time);
      });
      rafHandles.set(id, { kind:'raf', id:real });
    }
    return id;
  };

  window.cancelAnimationFrame = function guardedCAF(id) {
    const handle = rafHandles.get(id);
    if (!handle) return nativeCAF(id);
    rafHandles.delete(id);
    if (handle.kind === 'timeout') clearTimeout(handle.id);
    else nativeCAF(handle.id);
  };

  document.documentElement.dataset.ng6PerfGuard = '1';
})();
