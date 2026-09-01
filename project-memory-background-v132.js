'use strict';

(() => {
  const CONFIG_KEY = 'niakgpt-project-memory-config-v132';
  const TOKEN_KEY = 'niakgpt-project-memory-token-v132';
  const SESSION_TOKEN_KEY = 'niakgpt-project-memory-session-token-v132';
  const GITHUB_APP_AUTH_KEY = 'niakgpt-project-memory-github-app-auth-v133';
  const GITHUB_APP_SESSION_KEY = 'niakgpt-project-memory-github-app-session-v133';
  const GITHUB_APP_FLOW_KEY = 'niakgpt-project-memory-github-app-flow-v133';
  const API = 'https://api.github.com';
  const API_VERSION = '2022-11-28';
  const DEFAULT_ROOT = '.niakgpt-memory';
  const MAX_FILES = 32;
  const MAX_BATCH_BYTES = 7 * 1024 * 1024;
  const WORKER_ERROR_KEY = 'niakgpt-worker-errors-v100';

  const clean = value => String(value ?? '').trim();
  const workerErrorText = value => clean(value?.message || value?.reason?.message || value?.reason || value || 'worker_error')
    .replace(/github_pat_[A-Za-z0-9_]+/g, '[redacted]')
    .replace(/gh[pousr]_[A-Za-z0-9]+/g, '[redacted]')
    .replace(/([?&](?:code|token|access_token|client_secret)=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, 240);
  async function rememberWorkerError(kind, value) {
    try {
      const raw = (await chrome.storage.local.get(WORKER_ERROR_KEY))[WORKER_ERROR_KEY];
      const list = Array.isArray(raw) ? raw.filter(item => item && typeof item === 'object') : [];
      const row = { kind: clean(kind) || 'WORKER', message: workerErrorText(value), at: Date.now(), version: chrome.runtime.getManifest().version };
      if (!list.some(item => item.kind === row.kind && item.message === row.message)) list.unshift(row);
      await chrome.storage.local.set({ [WORKER_ERROR_KEY]: list.slice(0, 6) });
    } catch {}
  }
  try {
    self.addEventListener('error', event => { void rememberWorkerError('JS', event?.error || event?.message); });
    self.addEventListener('unhandledrejection', event => { void rememberWorkerError('PROMISE', event?.reason); });
  } catch {}
  const utf8Bytes = value => new TextEncoder().encode(String(value ?? '')).byteLength;
  const base64Utf8 = value => {
    const bytes = new TextEncoder().encode(String(value ?? ''));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };

  function normalizeRepo(value) {
    let raw = clean(value);
    raw = raw.replace(/^https?:\/\/github\.com\//i, '').replace(/^git@github\.com:/i, '').replace(/\.git$/i, '');
    raw = raw.replace(/^\/+|\/+$/g, '');
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw) ? raw : '';
  }

  function normalizeBranch(value) {
    const branch = clean(value) || 'main';
    if (branch.length > 200 || /[~^:?*[\\\x00-\x20]/.test(branch) || branch.includes('..') || branch.endsWith('/') || branch.startsWith('/')) return '';
    return branch;
  }

  function normalizeRoot(value) {
    const raw = clean(value || DEFAULT_ROOT).replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
    if (!raw || raw.length > 180 || raw.split('/').some(part => !part || part === '.' || part === '..')) return '';
    return raw;
  }

  function normalizeRelativePath(value) {
    const raw = clean(value).replace(/^\/+/, '').replace(/\/{2,}/g, '/');
    if (!raw || raw.length > 700 || raw.split('/').some(part => !part || part === '.' || part === '..')) return '';
    return raw;
  }

  function joinRoot(root, relative) {
    const safeRoot = normalizeRoot(root);
    const safeRelative = normalizeRelativePath(relative);
    if (!safeRoot || !safeRelative) throw new Error('invalid_memory_path');
    return `${safeRoot}/${safeRelative}`;
  }

  function authHeaders(token, extra = {}) {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'NiakGPT-Project-Memory',
      ...extra
    };
  }

  async function github(token, path, init = {}) {
    if (!token) throw new Error('github_token_missing');
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: authHeaders(token, init.headers || {})
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!response.ok) {
      const message = typeof data === 'object' && data ? data.message : text;
      const error = new Error(`github_http_${response.status}:${String(message || 'request_failed').slice(0, 180)}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function getPatToken() {
    try {
      const session = await chrome.storage.session.get(SESSION_TOKEN_KEY);
      if (clean(session?.[SESSION_TOKEN_KEY])) return clean(session[SESSION_TOKEN_KEY]);
    } catch {}
    try {
      const local = await chrome.storage.local.get(TOKEN_KEY);
      return clean(local?.[TOKEN_KEY]);
    } catch {
      return '';
    }
  }

  async function savePatToken(token, remember) {
    const value = clean(token);
    if (!value) throw new Error('github_token_missing');
    try { await chrome.storage.session.set({ [SESSION_TOKEN_KEY]: value }); } catch {}
    if (remember) await chrome.storage.local.set({ [TOKEN_KEY]: value });
    else await chrome.storage.local.remove(TOKEN_KEY);
  }

  async function clearPatToken() {
    try { await chrome.storage.session.remove(SESSION_TOKEN_KEY); } catch {}
    try { await chrome.storage.local.remove(TOKEN_KEY); } catch {}
  }

  function randomState(bytes = 18) {
    const raw = new Uint8Array(bytes);
    crypto.getRandomValues(raw);
    return Array.from(raw, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function base64Url(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function randomPkceVerifier() {
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    return base64Url(raw);
  }

  async function pkceChallenge(verifier) {
    const value = clean(verifier);
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(value)) throw new Error('github_oauth_invalid_pkce_verifier');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return base64Url(new Uint8Array(digest));
  }

  async function readGitHubAppAuth() {
    try {
      const raw = (await chrome.storage.local.get(GITHUB_APP_AUTH_KEY))[GITHUB_APP_AUTH_KEY];
      if (!raw || typeof raw !== 'object') return null;
      const appId = Number(raw.appId || 0);
      const appSlug = clean(raw.appSlug);
      const clientId = clean(raw.clientId);
      const clientSecret = clean(raw.clientSecret);
      if (!appId || !appSlug || !clientId || !clientSecret) return null;
      return {
        schema: 1,
        appId,
        appSlug,
        clientId,
        clientSecret,
        refreshToken: clean(raw.refreshToken),
        refreshExpiresAt: Number(raw.refreshExpiresAt || 0),
        persistentAccessToken: clean(raw.persistentAccessToken),
        accountLogin: clean(raw.accountLogin),
        accountAvatar: clean(raw.accountAvatar),
        repositories: Array.isArray(raw.repositories) ? raw.repositories.filter(item => item && typeof item === 'object') : [],
        installations: Array.isArray(raw.installations) ? raw.installations.filter(item => item && typeof item === 'object') : [],
        createdAt: Number(raw.createdAt || 0),
        updatedAt: Number(raw.updatedAt || 0)
      };
    } catch {
      return null;
    }
  }

  async function writeGitHubAppAuth(auth) {
    await chrome.storage.local.set({ [GITHUB_APP_AUTH_KEY]: auth });
  }

  async function readGitHubAppSession() {
    try {
      const raw = (await chrome.storage.session.get(GITHUB_APP_SESSION_KEY))[GITHUB_APP_SESSION_KEY];
      if (!raw || typeof raw !== 'object') return null;
      const token = clean(raw.token);
      if (!token) return null;
      return { token, expiresAt: Number(raw.expiresAt || 0) };
    } catch {
      return null;
    }
  }

  async function writeGitHubAppSession(token, expiresAt = 0) {
    const value = clean(token);
    if (!value) throw new Error('github_app_token_missing');
    try { await chrome.storage.session.set({ [GITHUB_APP_SESSION_KEY]: { token: value, expiresAt: Number(expiresAt || 0) } }); } catch {}
  }

  async function clearGitHubAppSession() {
    try { await chrome.storage.session.remove(GITHUB_APP_SESSION_KEY); } catch {}
  }

  async function oauthTokenRequest(params) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params).toString()
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!response.ok || !data?.access_token) {
      const detail = clean(data?.error_description || data?.error || text || 'oauth_exchange_failed');
      throw new Error('github_oauth_exchange_failed:' + detail.slice(0, 160));
    }
    return data;
  }

  async function persistGitHubTokenResponse(auth, data) {
    const now = Date.now();
    const accessToken = clean(data?.access_token);
    const expiresIn = Number(data?.expires_in || 0);
    const expiresAt = expiresIn > 0 ? now + expiresIn * 1000 : 0;
    const refreshToken = clean(data?.refresh_token);
    const refreshExpiresIn = Number(data?.refresh_token_expires_in || 0);
    const next = {
      ...auth,
      refreshToken: refreshToken || auth.refreshToken || '',
      refreshExpiresAt: refreshToken && refreshExpiresIn > 0 ? now + refreshExpiresIn * 1000 : Number(auth.refreshExpiresAt || 0),
      persistentAccessToken: expiresAt ? '' : accessToken,
      updatedAt: now
    };
    await writeGitHubAppSession(accessToken, expiresAt);
    await writeGitHubAppAuth(next);
    return { auth: next, token: accessToken, expiresAt };
  }

  async function getGitHubAppToken() {
    let auth = await readGitHubAppAuth();
    if (!auth) throw new Error('github_app_not_connected');

    const session = await readGitHubAppSession();
    if (session?.token && (!session.expiresAt || session.expiresAt > Date.now() + 90_000)) return session.token;
    if (auth.persistentAccessToken) {
      await writeGitHubAppSession(auth.persistentAccessToken, 0);
      return auth.persistentAccessToken;
    }
    if (!auth.refreshToken) throw new Error('github_app_reauthorization_required');
    if (auth.refreshExpiresAt && auth.refreshExpiresAt <= Date.now() + 90_000) throw new Error('github_app_reauthorization_required');

    const refreshed = await oauthTokenRequest({
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken
    });
    const saved = await persistGitHubTokenResponse(auth, refreshed);
    return saved.token;
  }

  async function tokenForConfig(config) {
    if (config?.authMode === 'github-app') return getGitHubAppToken();
    return getPatToken();
  }

  async function directGitHubJson(url, init = {}) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': API_VERSION,
        ...(init.headers || {})
      }
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
    if (!response.ok) {
      const detail = typeof data === 'object' && data ? data.message : text;
      const error = new Error('github_http_' + response.status + ':' + clean(detail || 'request_failed').slice(0, 180));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function listPaged(token, path, key) {
    const all = [];
    for (let page = 1; page <= 10; page++) {
      const join = path.includes('?') ? '&' : '?';
      const data = await github(token, path + join + 'per_page=100&page=' + page);
      const batch = key ? (Array.isArray(data?.[key]) ? data[key] : []) : (Array.isArray(data) ? data : []);
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  }

  async function refreshGitHubRepositories() {
    const auth = await readGitHubAppAuth();
    if (!auth) throw new Error('github_app_not_connected');
    const token = await getGitHubAppToken();
    const user = await github(token, '/user');
    const allInstallations = await listPaged(token, '/user/installations', 'installations');
    const installations = allInstallations.filter(item => Number(item?.app_id || 0) === auth.appId && !item?.suspended_at);
    const byName = new Map();

    for (const installation of installations) {
      const repositories = await listPaged(token, '/user/installations/' + encodeURIComponent(String(installation.id)) + '/repositories', 'repositories');
      for (const item of repositories) {
        const fullName = normalizeRepo(item?.full_name);
        if (!fullName || item?.private !== true || item?.archived === true) continue;
        byName.set(fullName.toLowerCase(), {
          id: Number(item?.id || 0),
          fullName,
          name: clean(item?.name),
          owner: clean(item?.owner?.login),
          private: true,
          defaultBranch: normalizeBranch(item?.default_branch || 'main') || 'main',
          installationId: Number(installation.id || 0)
        });
      }
    }

    const repositories = [...byName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
    const installView = installations.map(item => ({
      id: Number(item?.id || 0),
      account: clean(item?.account?.login),
      manageUrl: clean(item?.html_url),
      repositorySelection: clean(item?.repository_selection)
    }));
    const next = {
      ...auth,
      accountLogin: clean(user?.login),
      accountAvatar: clean(user?.avatar_url),
      repositories,
      installations: installView,
      updatedAt: Date.now()
    };
    await writeGitHubAppAuth(next);
    return {
      account: { login: next.accountLogin, avatar: next.accountAvatar },
      repositories,
      installations: installView,
      manageUrl: installView[0]?.manageUrl || ''
    };
  }

  function validateStateRedirect(actual, expected, state) {
    const url = new URL(String(actual || ''));
    const target = new URL(String(expected || ''));
    if (url.origin !== target.origin || url.pathname !== target.pathname) throw new Error('github_oauth_invalid_redirect');
    if (clean(url.searchParams.get('state')) !== clean(state)) throw new Error('github_oauth_state_mismatch');
    return url;
  }

  function validateRedirect(actual, expected, state) {
    const url = validateStateRedirect(actual, expected, state);
    const code = clean(url.searchParams.get('code'));
    if (!code) throw new Error(clean(url.searchParams.get('error')) || 'github_oauth_code_missing');
    return code;
  }

  async function githubManifestForActiveFlow() {
    const flow = (await chrome.storage.session.get(GITHUB_APP_FLOW_KEY))[GITHUB_APP_FLOW_KEY];
    if (!flow || typeof flow !== 'object' || Number(flow.startedAt || 0) < Date.now() - 15 * 60_000) throw new Error('github_auth_flow_expired');
    return {
      ok: true,
      state: clean(flow.manifestState),
      manifest: {
        name: clean(flow.appName),
        url: 'https://github.com/niakw/NiakGPT',
        description: 'Connecteur privé Project Memory pour ce profil NiakGPT.',
        redirect_url: clean(flow.manifestRedirect),
        callback_urls: [clean(flow.oauthRedirect)],
        setup_url: clean(flow.installRedirect),
        setup_on_update: false,
        public: false,
        default_events: [],
        default_permissions: { contents: 'write', metadata: 'read' },
        request_oauth_on_install: false
      }
    };
  }

  async function launchIdentityFlow(url) {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('github_auth_url_invalid_scheme');
    return chrome.identity.launchWebAuthFlow({ url: parsed.toString(), interactive: true });
  }

  async function closeTabQuietly(tabId) {
    if (!Number.isInteger(tabId) || !chrome?.tabs?.remove) return;
    try { await chrome.tabs.remove(tabId); } catch {}
  }

  async function launchManifestRegistrationTab(flow) {
    if (!chrome?.tabs?.create || !chrome?.tabs?.remove || !chrome?.tabs?.onUpdated || !chrome?.tabs?.onRemoved) throw new Error('github_tabs_api_unavailable');
    const expected = new URL(clean(flow?.manifestRedirect));
    const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('github-vault-start.html'), active: true });
    const tabId = Number(tab?.id);
    if (!Number.isInteger(tabId)) throw new Error('github_manifest_tab_missing');

    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (error, value) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        try { chrome.tabs.onUpdated.removeListener(onUpdated); } catch {}
        try { chrome.tabs.onRemoved.removeListener(onRemoved); } catch {}
        if (!error) void closeTabQuietly(tabId);
        if (error) reject(error); else resolve(value);
      };
      const onUpdated = (id, changeInfo, currentTab) => {
        if (id !== tabId) return;
        const candidate = clean(changeInfo?.url || currentTab?.pendingUrl || currentTab?.url);
        if (!candidate) return;
        let parsed;
        try { parsed = new URL(candidate); } catch { return; }
        if (parsed.origin !== expected.origin || parsed.pathname !== expected.pathname) return;
        try { finish(null, validateRedirect(candidate, flow.manifestRedirect, flow.manifestState)); }
        catch (error) { finish(error); }
      };
      const onRemoved = id => { if (id === tabId) finish(new Error('github_manifest_registration_cancelled')); };
      const timeout = setTimeout(() => finish(new Error('github_manifest_registration_timeout')), 4 * 60_000);
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    });
  }

  async function startGitHubLogin() {
    if (!chrome?.identity?.launchWebAuthFlow || !chrome?.identity?.getRedirectURL) throw new Error('github_identity_api_unavailable');
    if (!chrome?.tabs?.create || !chrome?.tabs?.onUpdated) throw new Error('github_tabs_api_unavailable');

    const manifestRedirect = chrome.identity.getRedirectURL('niakgpt-github-manifest');
    const installRedirect = chrome.identity.getRedirectURL('niakgpt-github-install');
    const oauthRedirect = chrome.identity.getRedirectURL('niakgpt-github-oauth');
    const pkceVerifier = randomPkceVerifier();
    const codeChallenge = await pkceChallenge(pkceVerifier);
    const flow = {
      schema: 2,
      manifestState: randomState(),
      installState: randomState(),
      oauthState: randomState(),
      manifestRedirect,
      installRedirect,
      oauthRedirect,
      pkceVerifier,
      codeChallenge,
      appName: 'NiakGPT Vault ' + randomState(4),
      startedAt: Date.now()
    };
    await chrome.storage.session.set({ [GITHUB_APP_FLOW_KEY]: flow });

    try {
      let auth = await readGitHubAppAuth();

      if (!auth) {
        const manifestCode = await launchManifestRegistrationTab(flow);
        const created = await directGitHubJson(API + '/app-manifests/' + encodeURIComponent(manifestCode) + '/conversions', { method: 'POST' });

        const appId = Number(created?.id || 0);
        const appSlug = clean(created?.slug);
        const clientId = clean(created?.client_id);
        const clientSecret = clean(created?.client_secret);
        if (!appId || !appSlug || !clientId || !clientSecret) throw new Error('github_app_manifest_conversion_incomplete');

        auth = {
          schema: 1,
          appId,
          appSlug,
          clientId,
          clientSecret,
          refreshToken: '',
          refreshExpiresAt: 0,
          persistentAccessToken: '',
          accountLogin: '',
          accountAvatar: '',
          repositories: [],
          installations: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await writeGitHubAppAuth(auth);
      }

      const installUrl = 'https://github.com/apps/' + encodeURIComponent(auth.appSlug) + '/installations/new?state=' + encodeURIComponent(flow.installState);
      const installResult = await launchIdentityFlow(installUrl);
      validateStateRedirect(installResult, installRedirect, flow.installState);

      const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
      authorizeUrl.searchParams.set('client_id', auth.clientId);
      authorizeUrl.searchParams.set('redirect_uri', oauthRedirect);
      authorizeUrl.searchParams.set('state', flow.oauthState);
      authorizeUrl.searchParams.set('code_challenge', flow.codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');
      const oauthResult = await launchIdentityFlow(authorizeUrl.toString());
      const oauthCode = validateRedirect(oauthResult, oauthRedirect, flow.oauthState);
      const tokenData = await oauthTokenRequest({
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        code: oauthCode,
        redirect_uri: oauthRedirect,
        code_verifier: flow.pkceVerifier
      });
      const saved = await persistGitHubTokenResponse(auth, tokenData);
      auth = saved.auth;
      const listing = await refreshGitHubRepositories();
      return {
        ok: true,
        account: listing.account,
        repositories: listing.repositories,
        installations: listing.installations,
        manageUrl: listing.manageUrl,
        appSlug: auth.appSlug
      };
    } finally {
      try { await chrome.storage.session.remove(GITHUB_APP_FLOW_KEY); } catch {}
    }
  }

  async function logoutGitHubApp() {
    await clearGitHubAppSession();
    try { await chrome.storage.local.remove(GITHUB_APP_AUTH_KEY); } catch {}
    try { await chrome.storage.session.remove(GITHUB_APP_FLOW_KEY); } catch {}
    const config = await readConfig();
    if (config?.authMode === 'github-app') await writeConfig({ ...config, enabled: false });
    return { ok: true };
  }

  async function readConfig() {
    try {
      const raw = (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY];
      if (!raw || typeof raw !== 'object') return null;
      const repo = normalizeRepo(raw.repo);
      const branch = normalizeBranch(raw.branch);
      const root = normalizeRoot(raw.root);
      if (!repo || !branch || !root) return null;
      return {
        schema: Number(raw.schema || 1),
        enabled: raw.enabled === true,
        repo,
        branch,
        root,
        authMode: raw.authMode === 'github-app' ? 'github-app' : 'pat',
        rememberToken: raw.rememberToken === true,
        verifiedPrivateAt: Number(raw.verifiedPrivateAt || 0),
        connectedAt: Number(raw.connectedAt || 0)
      };
    } catch {
      return null;
    }
  }

  async function writeConfig(config) {
    await chrome.storage.local.set({ [CONFIG_KEY]: config });
  }

  async function repoMetadata(token, repo) {
    return github(token, `/repos/${repo.split('/').map(encodeURIComponent).join('/')}`);
  }

  async function verifyPrivateRepo(token, repo) {
    const meta = await repoMetadata(token, repo);
    if (meta?.private !== true) throw new Error('memory_repository_must_be_private');
    if (meta?.archived === true) throw new Error('memory_repository_archived');
    return meta;
  }

  async function getRef(token, repo, branch) {
    return github(token, `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  }

  async function tryGetRef(token, repo, branch) {
    try {
      return await getRef(token, repo, branch);
    } catch (error) {
      if (error?.status === 404 || error?.status === 409) return null;
      throw error;
    }
  }

  async function initializeEmptyRepo(token, config, markerContent) {
    const existing = await tryGetRef(token, config.repo, config.branch);
    if (existing?.object?.sha) return { initialized: false, ref: existing };

    const meta = await verifyPrivateRepo(token, config.repo);
    if (Number(meta?.size || 0) > 0) throw new Error('github_branch_missing');

    // GitHub explicitly refuses POST /git/refs on an empty repository. The Contents
    // endpoint is the supported way to create the very first commit/default branch.
    const initBranch = normalizeBranch(meta?.default_branch || config.branch || 'main');
    if (!initBranch) throw new Error('invalid_github_initial_branch');
    const path = joinRoot(config.root, 'niakgpt-memory.json');
    const created = await github(token, `/repos/${config.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'NiakGPT: initialize private Project Memory',
        content: base64Utf8(markerContent)
      })
    });
    const initialSha = clean(created?.commit?.sha);
    if (!initialSha) throw new Error('github_initial_content_commit_failed');

    if (config.branch !== initBranch) {
      const baseRef = await getRef(token, config.repo, initBranch);
      const sha = clean(baseRef?.object?.sha || initialSha);
      if (!sha) throw new Error('github_initial_branch_head_missing');
      await github(token, `/repos/${config.repo}/git/refs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${config.branch}`, sha })
      });
    }

    const ready = await getRef(token, config.repo, config.branch);
    return { initialized: true, sha: clean(ready?.object?.sha || initialSha), initBranch };
  }

  async function readFileWith(token, config, relativePath) {
    const meta = await verifyPrivateRepo(token, config.repo);
    const path = joinRoot(config.root, relativePath);
    const data = await github(token, `/repos/${config.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(config.branch)}`);
    if (Array.isArray(data) || data?.type !== 'file') throw new Error('memory_path_not_file');
    if (data.encoding !== 'base64') throw new Error('unsupported_github_content_encoding');
    const binary = atob(String(data.content || '').replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const content = new TextDecoder().decode(bytes);
    return { content, sha: data.sha || '', repoPrivate: meta.private === true };
  }

  async function readFile(config, relativePath) {
    const token = await tokenForConfig(config);
    if (!token) throw new Error('github_token_missing');
    return readFileWith(token, config, relativePath);
  }

  async function commitFilesWith(token, config, files, message, retry = 0) {
    await verifyPrivateRepo(token, config.repo);
    if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) throw new Error('invalid_memory_file_batch');

    let total = 0;
    const normalized = [];
    const seen = new Set();
    for (const item of files) {
      const relative = normalizeRelativePath(item?.path);
      const content = String(item?.content ?? '');
      if (!relative || seen.has(relative)) throw new Error('invalid_or_duplicate_memory_path');
      seen.add(relative);
      total += utf8Bytes(content);
      if (total > MAX_BATCH_BYTES) throw new Error('memory_batch_too_large');
      normalized.push({ path: joinRoot(config.root, relative), content });
    }

    const ref = await getRef(token, config.repo, config.branch);
    const parent = clean(ref?.object?.sha);
    if (!parent) throw new Error('github_branch_head_missing');
    const commit = await github(token, `/repos/${config.repo}/git/commits/${parent}`);
    const baseTree = clean(commit?.tree?.sha);
    if (!baseTree) throw new Error('github_base_tree_missing');

    const treeEntries = [];
    for (const item of normalized) {
      const blob = await github(token, `/repos/${config.repo}/git/blobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.content, encoding: 'utf-8' })
      });
      if (!blob?.sha) throw new Error('github_blob_create_failed');
      treeEntries.push({ path: item.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const tree = await github(token, `/repos/${config.repo}/git/trees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: baseTree, tree: treeEntries })
    });
    const nextCommit = await github(token, `/repos/${config.repo}/git/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: clean(message) || 'NiakGPT Project Memory sync',
        tree: tree.sha,
        parents: [parent]
      })
    });

    try {
      await github(token, `/repos/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: nextCommit.sha, force: false })
      });
    } catch (error) {
      if (retry < 1 && (error?.status === 409 || error?.status === 422)) {
        return commitFilesWith(token, config, files, message, retry + 1);
      }
      throw error;
    }
    return { sha: nextCommit.sha, files: normalized.length, bytes: total };
  }

  async function commitFiles(config, files, message) {
    const token = await tokenForConfig(config);
    if (!token) throw new Error('github_token_missing');
    return commitFilesWith(token, config, files, message);
  }

  async function initializeConnection(detail, token, authMode, rememberToken = false) {
    const repo = normalizeRepo(detail?.repo);
    const root = normalizeRoot(detail?.root || DEFAULT_ROOT);
    if (!repo) throw new Error('invalid_github_repository');
    if (!root) throw new Error('invalid_memory_root');
    if (!token) throw new Error('github_token_missing');

    const meta = await verifyPrivateRepo(token, repo);
    const branch = normalizeBranch(detail?.branch || meta?.default_branch || 'main');
    if (!branch) throw new Error('invalid_github_branch');

    const now = Date.now();
    const config = {
      schema: 2,
      enabled: true,
      repo,
      branch,
      root,
      authMode: authMode === 'github-app' ? 'github-app' : 'pat',
      rememberToken: authMode === 'pat' && rememberToken === true,
      verifiedPrivateAt: now,
      connectedAt: now
    };

    const marker = {
      kind: 'NiakGPTProjectMemory',
      schema: 2,
      storage: 'private-github-repository',
      authentication: config.authMode,
      createdBy: 'NiakGPT',
      updatedAt: new Date(now).toISOString()
    };
    const markerContent = JSON.stringify(marker, null, 2) + '\n';
    const ref = await tryGetRef(token, repo, branch);
    let initializedEmptyRepo = false;
    if (!ref?.object?.sha) {
      const initialized = await initializeEmptyRepo(token, config, markerContent);
      initializedEmptyRepo = initialized.initialized === true;
    } else {
      await commitFilesWith(token, config, [{
        path: 'niakgpt-memory.json',
        content: markerContent
      }], 'NiakGPT: initialize private Project Memory');
    }

    await writeConfig(config);
    return { ok: true, config: { ...config, tokenAvailable: true }, repositoryPrivate: true, initializedEmptyRepo };
  }

  async function connect(detail) {
    const token = clean(detail?.token);
    if (!token) throw new Error('github_token_missing');
    const rememberToken = detail?.rememberToken === true;
    const result = await initializeConnection(detail, token, 'pat', rememberToken);
    await savePatToken(token, rememberToken);
    return result;
  }

  async function connectGitHubRepository(detail) {
    const auth = await readGitHubAppAuth();
    if (!auth) throw new Error('github_app_not_connected');
    const token = await getGitHubAppToken();
    const listing = await refreshGitHubRepositories();
    const requested = normalizeRepo(detail?.repo);
    const selected = listing.repositories.find(item => item.fullName.toLowerCase() === requested.toLowerCase());
    if (!selected) throw new Error('github_repository_not_authorized_for_vault');
    return initializeConnection({
      repo: selected.fullName,
      branch: detail?.branch || selected.defaultBranch,
      root: detail?.root || DEFAULT_ROOT
    }, token, 'github-app', false);
  }

  async function status() {
    const config = await readConfig();
    const patToken = config?.authMode === 'pat' ? await getPatToken() : '';
    const appAuth = await readGitHubAppAuth();
    const appSession = await readGitHubAppSession();
    const now = Date.now();
    const sessionValid = !!(appSession?.token && (!appSession.expiresAt || appSession.expiresAt > now + 90_000));
    const refreshValid = !!(appAuth?.refreshToken && (!appAuth.refreshExpiresAt || appAuth.refreshExpiresAt > now + 90_000));
    const appTokenAvailable = !!(sessionValid || appAuth?.persistentAccessToken || refreshValid);
    const tokenAvailable = config?.authMode === 'github-app' ? appTokenAvailable : !!patToken;
    const manageUrl = clean(appAuth?.installations?.[0]?.manageUrl);
    return {
      ok: true,
      connected: !!(config?.enabled && tokenAvailable),
      configured: !!config?.enabled,
      tokenAvailable,
      config: config ? {
        schema: config.schema,
        enabled: config.enabled,
        repo: config.repo,
        branch: config.branch,
        root: config.root,
        authMode: config.authMode,
        rememberToken: config.rememberToken,
        verifiedPrivateAt: config.verifiedPrivateAt,
        connectedAt: config.connectedAt
      } : null,
      github: {
        registered: !!appAuth,
        authenticated: !!(appAuth && appTokenAvailable),
        account: appAuth ? { login: appAuth.accountLogin, avatar: appAuth.accountAvatar } : null,
        appSlug: appAuth?.appSlug || '',
        repositories: appAuth?.repositories || [],
        installations: appAuth?.installations || [],
        manageUrl
      }
    };
  }

  async function disconnect(detail = {}) {
    const config = await readConfig();
    if (config?.authMode === 'pat') await clearPatToken();
    if (detail.forgetConfig === true) await chrome.storage.local.remove(CONFIG_KEY);
    else if (config) await writeConfig({ ...config, enabled: false });
    return { ok: true };
  }

  function safeError(error) {
    const message = String(error?.message || error || 'unknown_error');
    return message.replace(/github_pat_[A-Za-z0-9_]+/g, '[redacted]').replace(/gh[pousr]_[A-Za-z0-9]+/g, '[redacted]').slice(0, 260);
  }

  if (typeof chrome !== 'undefined' && chrome?.runtime?.onConnect) {
    chrome.runtime.onConnect.addListener(port => {
      if (port?.name !== 'niakgpt:memory-github-login-v132') return;
      let started = false;
      port.onMessage.addListener(message => {
        if (message?.type === 'keepalive') return;
        if (message?.type !== 'start' || started) return;
        started = true;
        startGitHubLogin()
          .then(result => { try { port.postMessage({ type:'result', result }); } catch {} })
          .catch(error => { try { port.postMessage({ type:'result', result:{ ok:false, error:safeError(error) } }); } catch {} });
      });
    });
  }

  if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const type = message?.type;
      if (!String(type || '').startsWith('niakgpt:memory-') || !String(type).endsWith('-v132')) return;

      (async () => {
        if (type === 'niakgpt:memory-connect-v132') return connect(message);
        if (type === 'niakgpt:memory-status-v132') return status();
        if (type === 'niakgpt:memory-disconnect-v132') return disconnect(message);
        if (type === 'niakgpt:memory-github-manifest-v132') return githubManifestForActiveFlow();
        if (type === 'niakgpt:memory-github-login-v132') return startGitHubLogin();
        if (type === 'niakgpt:memory-github-repositories-v132') return { ok: true, ...(await refreshGitHubRepositories()) };
        if (type === 'niakgpt:memory-github-connect-repo-v132') return connectGitHubRepository(message);
        if (type === 'niakgpt:memory-github-logout-v132') return logoutGitHubApp();
        if (type === 'niakgpt:memory-read-v132') {
          const config = await readConfig();
          if (!config?.enabled) throw new Error('project_memory_not_configured');
          const result = await readFile(config, message.path);
          return { ok: true, ...result };
        }
        if (type === 'niakgpt:memory-commit-v132') {
          const config = await readConfig();
          if (!config?.enabled) throw new Error('project_memory_not_configured');
          const result = await commitFiles(config, message.files, message.message);
          return { ok: true, ...result };
        }
        throw new Error('unknown_project_memory_message');
      })().then(sendResponse).catch(error => sendResponse({ ok: false, error: safeError(error) }));
      return true;
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      normalizeRepo,
      normalizeBranch,
      normalizeRoot,
      normalizeRelativePath,
      joinRoot,
      safeError,
      MAX_FILES,
      MAX_BATCH_BYTES,
      initializeEmptyRepo,
      tryGetRef,
      connect,
      initializeConnection,
      validateRedirect,
      validateStateRedirect,
      pkceChallenge,
      launchIdentityFlow,
      launchManifestRegistrationTab
    };
  }
})();
