(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_BRIDGE__) return;
  window.__NIAKGPT_BRIDGE__ = true;

  const REQ = 'niakgpt:rpc-request';
  const RES = 'niakgpt:rpc-response';
  const nativeFetch = window.fetch.bind(window);
  const allowed = [
    /^\/backend-api\/conversations(?:\?|$)/,
    /^\/backend-api\/conversation\/[A-Za-z0-9_-]+$/,
    /^\/backend-api\/gizmos\/snorlax\/sidebar(?:\?|$)/,
    /^\/backend-api\/gizmos\/g-p-[A-Za-z0-9_-]+\/conversations(?:\?|$)/,
    /^\/backend-api\/gizmos\/g-p-[A-Za-z0-9_-]+$/,
    /^\/backend-api\/projects$/
  ];
  const conversationRx = /^\/backend-api\/conversation\/[A-Za-z0-9_-]+$/;
  const projectConversationsRx = /^\/backend-api\/gizmos\/g-p-[A-Za-z0-9_-]+\/conversations(?:\?|$)/;
  const projectRx = /^\/backend-api\/gizmos\/g-p-[A-Za-z0-9_-]+$/;
  const projectCreatePath = '/backend-api/projects';

  let cachedToken = '';
  let tokenAt = 0;

  // One broker owns every NiakGPT backend request. This prevents the independent
  // modules (indexer, governance, recovery, reclassifier) from bursting the same
  // undocumented ChatGPT endpoints at once.
  const inflightGets = new Map();
  const responseCache = new Map();
  let requestChain = Promise.resolve();
  let lastNetworkAt = 0;
  let rateLimitedUntil = 0;
  let rateStrike = 0;
  let rateClearTimer = 0;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const now = () => Date.now();
  const cacheTTL = () => 1200;
  const gapFor = (_path, method) => method === 'GET' ? 180 : 450;
  const cacheKey = (path, method) => `${method}:${path}`;
  const nativeBusy = () => document.documentElement.dataset.ng8Running === '1' ||
    ['loading','waiting','thinking','executing'].includes(document.documentElement.dataset.ng86Activity || '') ||
    document.documentElement.dataset.ng105Verification === '1';
  const nativeBusyResult = () => ({ok:false,status:0,data:null,error:'native_busy',transport:'bridge-pause'});

  function retryAfterMsFrom(value) {
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
    const at = Date.parse(raw);
    return Number.isFinite(at) ? Math.max(0, at - now()) : 0;
  }
  function publishRateLimit(ms, source='429') {
    const until = now() + Math.max(1000, ms || 0);
    rateLimitedUntil = Math.max(rateLimitedUntil, until);
    document.documentElement.dataset.ng100RateLimitedUntil = String(rateLimitedUntil);
    clearTimeout(rateClearTimer);rateClearTimer=setTimeout(()=>clearExpiredRateLimit(),Math.max(50,rateLimitedUntil-now()+25));
    document.dispatchEvent(new CustomEvent('niakgpt:rate-limit',{detail:{until:rateLimitedUntil,retryAfterMs:Math.max(0,rateLimitedUntil-now()),source}}));
  }
  function clearExpiredRateLimit() {
    if (rateLimitedUntil && now() >= rateLimitedUntil) {
      rateLimitedUntil = 0;
      clearTimeout(rateClearTimer);rateClearTimer=0;
      document.documentElement.removeAttribute('data-ng100-rate-limited-until');
      document.dispatchEvent(new CustomEvent('niakgpt:rate-limit-cleared'));
    }
  }
  function syntheticRateLimit() {
    clearExpiredRateLimit();
    const left = Math.max(0, rateLimitedUntil - now());
    return left ? {ok:false,status:429,data:null,error:'rate_limited_cooldown',transport:'bridge-circuit',retry_after_ms:left} : null;
  }
  function rememberSuccess(key, result, path) {
    responseCache.set(key,{at:now(),ttl:cacheTTL(path),result:{...result,cached_by_bridge:true}});
    if(responseCache.size>80){
      const oldest=[...responseCache.entries()].sort((a,b)=>a[1].at-b[1].at).slice(0,responseCache.size-60);
      for(const [k] of oldest)responseCache.delete(k);
    }
  }
  function cachedSuccess(key) {
    const hit=responseCache.get(key);if(!hit)return null;
    if(now()-hit.at>hit.ttl){responseCache.delete(key);return null;}
    return {...hit.result};
  }
  function invalidateAfterMutation(path) {
    if(conversationRx.test(path))responseCache.delete(cacheKey(path,'GET'));
    else responseCache.clear();
  }

  function isAllowed(path, method) {
    if (!allowed.some(rx => rx.test(path))) return false;
    if (method === 'GET') return path !== projectCreatePath;
    if (method === 'PATCH') return conversationRx.test(path);
    if (method === 'DELETE') return projectRx.test(path);
    if (method === 'POST') return path === projectCreatePath;
    return false;
  }
  function validProjectCreate(body){
    if(!body||typeof body!=='object'||Array.isArray(body))return false;
    const keys=Object.keys(body).sort();
    return keys.length===3&&keys[0]==='instructions'&&keys[1]==='memory_scope'&&keys[2]==='name'&&body.instructions===''&&typeof body.name==='string'&&body.name.trim().length>0&&body.memory_scope==='unset';
  }

  function normalizeProjectConversationPath(path, mode = 'safe') {
    if (!projectConversationsRx.test(path)) return path;
    try {
      const url = new URL(path, location.origin);
      if (mode === 'default') {
        url.searchParams.delete('limit');
      } else {
        const requested = Number(url.searchParams.get('limit') || 0);
        if (!requested || requested > 20) url.searchParams.set('limit', '20');
      }
      // Never invent a cursor. The first Project page is requested without one;
      // subsequent requests reuse only the opaque cursor returned by ChatGPT.
      return `${url.pathname}${url.search}`;
    } catch {
      return path;
    }
  }

  async function getAccessToken(force = false) {
    if (!force && cachedToken && Date.now() - tokenAt < 120000) return cachedToken;
    try {
      const r = await nativeFetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (!r.ok) return '';
      const session = await r.json();
      cachedToken = String(session?.accessToken || '');
      tokenAt = Date.now();
      return cachedToken;
    } catch {
      return '';
    }
  }

  function parsePayload(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  function xhrRequest(path, method, body, token) {
    return new Promise(resolve => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(method, path, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('OAI-Language', document.documentElement.lang || 'fr-FR');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        if (method !== 'GET' && method !== 'DELETE') xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 20000;
        xhr.onload = () => resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          data: parsePayload(xhr.responseText),
          error: xhr.status >= 200 && xhr.status < 300 ? '' : `XHR HTTP ${xhr.status}`,
          transport: 'xhr',
          retry_after_ms: retryAfterMsFrom(xhr.getResponseHeader('Retry-After'))
        });
        xhr.onerror = () => resolve({ ok:false, status:0, data:null, error:'xhr_network_error', transport:'xhr' });
        xhr.ontimeout = () => resolve({ ok:false, status:0, data:null, error:'xhr_timeout', transport:'xhr' });
        xhr.send(method === 'GET' || method === 'DELETE' ? null : JSON.stringify(body ?? {}));
      } catch (error) {
        resolve({ ok:false, status:0, data:null, error:`xhr_exception:${String(error?.message || error)}`, transport:'xhr' });
      }
    });
  }

  async function fetchRequest(path, method, body, token) {
    const init = {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'OAI-Language': document.documentElement.lang || 'fr-FR',
        Authorization: `Bearer ${token}`
      }
    };
    if (method !== 'GET' && method !== 'DELETE') {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body ?? {});
    }
    try {
      const r = await nativeFetch(path, init);
      const text = await r.text();
      return {
        ok: r.ok,
        status: r.status,
        data: parsePayload(text),
        error: r.ok ? '' : `FETCH HTTP ${r.status}`,
        transport: 'fetch',
        retry_after_ms: retryAfterMsFrom(r.headers.get('Retry-After'))
      };
    } catch (error) {
      return { ok:false, status:0, data:null, error:`fetch_exception:${String(error?.message || error)}`, transport:'fetch' };
    }
  }

  async function requestWithTransportFallback(path, method, body, token) {
    let result = await fetchRequest(path, method, body, token);
    if (result.status === 0) {
      const xhr = await xhrRequest(path, method, body, token);
      if (xhr.ok || xhr.status !== 0) result = xhr;
      else result = {
        ok:false,
        status:0,
        data:null,
        error:`${result.error};${xhr.error}`,
        transport:'fetch+xhr'
      };
    }
    return result;
  }

  async function backendFetchCore(path, method, body, forceToken = false) {
    // Last-second circuit breaker: requests queued before the user presses Send must not
    // wake up during a long/complex ChatGPT generation or native verification phase.
    if (nativeBusy()) return nativeBusyResult();
    const token = await getAccessToken(forceToken);
    if (!token) return { ok:false, status:401, data:null, error:'auth_session_missing', transport:'auth' };

    const originalPath = path;
    let effectivePath = method === 'GET' ? normalizeProjectConversationPath(path, 'safe') : path;

    const circuit = syntheticRateLimit();
    if (circuit) return circuit;

    const gap = gapFor(effectivePath, method);
    const wait = Math.max(0, lastNetworkAt + gap - now());
    if (wait) await sleep(wait);
    if (nativeBusy()) return nativeBusyResult();
    const afterWaitCircuit = syntheticRateLimit();
    if (afterWaitCircuit) return afterWaitCircuit;

    lastNetworkAt = now();
    let result = await requestWithTransportFallback(effectivePath, method, body, token);

    if (result.status === 401 && !forceToken) {
      cachedToken = '';
      return backendFetchCore(originalPath, method, body, true);
    }

    if (method === 'GET' && projectConversationsRx.test(originalPath) && result.status === 422) {
      const noLimitPath = normalizeProjectConversationPath(originalPath, 'default');
      if (noLimitPath !== effectivePath) {
        const retryCircuit=syntheticRateLimit();
        if(retryCircuit)return retryCircuit;
        const retryWait=Math.max(0,lastNetworkAt+gapFor(noLimitPath,method)-now());if(retryWait)await sleep(retryWait);
        lastNetworkAt=now();
        const retry = await requestWithTransportFallback(noLimitPath, method, body, token);
        if (retry.status === 401 && !forceToken) {
          cachedToken = '';
          return backendFetchCore(originalPath, method, body, true);
        }
        result = retry;
        effectivePath = noLimitPath;
      }
    }

    if (result.status === 429) {
      rateStrike=Math.min(6,rateStrike+1);
      const fallback=Math.min(45000,4000*Math.pow(2,rateStrike-1));
      const delay=Math.max(Number(result.retry_after_ms)||0,fallback)+Math.floor(Math.random()*350);
      result.retry_after_ms=delay;
      publishRateLimit(delay,'429');
    } else if (result.ok) {
      rateStrike=0;
      clearExpiredRateLimit();
    }

    if (effectivePath !== originalPath) {
      result.request_path = effectivePath;
      result.normalized_by_bridge = true;
    }
    return result;
  }

  function enqueueNetwork(fn){
    const run=requestChain.then(fn,fn);
    requestChain=run.catch(()=>{});
    return run;
  }

  function backendFetch(path, method, body) {
    const normalized = method === 'GET' ? normalizeProjectConversationPath(path,'safe') : path;
    const key=cacheKey(normalized,method);
    if(method==='GET'){
      const cached=cachedSuccess(key);if(cached)return Promise.resolve(cached);
      const pending=inflightGets.get(key);if(pending)return pending;
      const promise=enqueueNetwork(()=>backendFetchCore(path,method,body)).then(result=>{
        if(result?.ok)rememberSuccess(key,result,normalized);
        return result;
      }).finally(()=>inflightGets.delete(key));
      inflightGets.set(key,promise);return promise;
    }
    return enqueueNetwork(()=>backendFetchCore(path,method,body)).then(result=>{
      if(result?.ok)invalidateAfterMutation(path);
      return result;
    });
  }

  document.addEventListener(REQ, async event => {
    const d = event.detail || {};
    const id = String(d.id || '');
    const method = String(d.method || 'GET').toUpperCase();
    const path = String(d.path || '');

    if (!id || !isAllowed(path, method)) {
      document.dispatchEvent(new CustomEvent(RES, {
        detail: { id, ok:false, status:0, error:`blocked_request:${method}:${path}`, transport:'guard' }
      }));
      return;
    }

    // Full conversation payloads stay forbidden during normal runtime. Project Memory may
    // request one explicitly during a user-enabled private GitHub bootstrap/sync. Those reads
    // still pass through the single broker, native-busy guard, gap and rate-limit circuit.
    if (method === 'GET' && conversationRx.test(path) && d.memoryBootstrap !== true) {
      document.dispatchEvent(new CustomEvent(RES,{detail:{id,ok:false,status:0,data:null,error:'conversation_detail_get_disabled',transport:'guard'}}));
      return;
    }

    // All NiakGPT project moves go through Project Governance.
    if (method === 'PATCH' && conversationRx.test(path) && d.governance !== true) {
      document.dispatchEvent(new CustomEvent(RES, {
        detail: { id, ok:false, status:409, data:null, error:'project_move_requires_governance', transport:'governance-guard' }
      }));
      return;
    }

    if (method === 'DELETE' && projectRx.test(path) && d.governance !== true) {
      document.dispatchEvent(new CustomEvent(RES,{detail:{id,ok:false,status:409,data:null,error:'project_delete_requires_governance',transport:'governance-guard'}}));return;
    }
    if (method === 'POST' && path === projectCreatePath) {
      if(d.governance!==true){document.dispatchEvent(new CustomEvent(RES,{detail:{id,ok:false,status:409,data:null,error:'project_create_requires_governance',transport:'governance-guard'}}));return;}
      if(!validProjectCreate(d.body)){document.dispatchEvent(new CustomEvent(RES,{detail:{id,ok:false,status:400,data:null,error:'invalid_project_create_payload',transport:'governance-guard'}}));return;}
    }

    const result = await backendFetch(path, method, d.body);
    document.dispatchEvent(new CustomEvent(RES, { detail:{ id, ...result } }));
  });
})();
