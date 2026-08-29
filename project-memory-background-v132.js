'use strict';

(() => {
  const CONFIG_KEY = 'niakgpt-project-memory-config-v132';
  const TOKEN_KEY = 'niakgpt-project-memory-token-v132';
  const SESSION_TOKEN_KEY = 'niakgpt-project-memory-session-token-v132';
  const API = 'https://api.github.com';
  const API_VERSION = '2022-11-28';
  const DEFAULT_ROOT = '.niakgpt-memory';
  const MAX_FILES = 32;
  const MAX_BATCH_BYTES = 7 * 1024 * 1024;

  const clean = value => String(value ?? '').trim();
  const utf8Bytes = value => new TextEncoder().encode(String(value ?? '')).byteLength;

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

  async function getToken() {
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

  async function saveToken(token, remember) {
    const value = clean(token);
    if (!value) throw new Error('github_token_missing');
    try { await chrome.storage.session.set({ [SESSION_TOKEN_KEY]: value }); } catch {}
    if (remember) await chrome.storage.local.set({ [TOKEN_KEY]: value });
    else await chrome.storage.local.remove(TOKEN_KEY);
  }

  async function clearToken() {
    try { await chrome.storage.session.remove(SESSION_TOKEN_KEY); } catch {}
    try { await chrome.storage.local.remove(TOKEN_KEY); } catch {}
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
        schema: 1,
        enabled: raw.enabled === true,
        repo,
        branch,
        root,
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
    const token = await getToken();
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
    const token = await getToken();
    if (!token) throw new Error('github_token_missing');
    return commitFilesWith(token, config, files, message);
  }

  async function connect(detail) {
    const repo = normalizeRepo(detail?.repo);
    const root = normalizeRoot(detail?.root || DEFAULT_ROOT);
    const token = clean(detail?.token);
    if (!repo) throw new Error('invalid_github_repository');
    if (!root) throw new Error('invalid_memory_root');
    if (!token) throw new Error('github_token_missing');

    const meta = await verifyPrivateRepo(token, repo);
    const branch = normalizeBranch(detail?.branch || meta?.default_branch || 'main');
    if (!branch) throw new Error('invalid_github_branch');
    await getRef(token, repo, branch);

    const rememberToken = detail?.rememberToken === true;
    await saveToken(token, rememberToken);
    const now = Date.now();
    const config = {
      schema: 1,
      enabled: true,
      repo,
      branch,
      root,
      rememberToken,
      verifiedPrivateAt: now,
      connectedAt: now
    };

    const marker = {
      kind: 'NiakGPTProjectMemory',
      schema: 1,
      storage: 'private-github-repository',
      createdBy: 'NiakGPT',
      updatedAt: new Date(now).toISOString()
    };
    await commitFilesWith(token, config, [{
      path: 'niakgpt-memory.json',
      content: JSON.stringify(marker, null, 2) + '\n'
    }], 'NiakGPT: initialize private Project Memory');

    await writeConfig(config);
    return { ok: true, config: { ...config, tokenAvailable: true }, repositoryPrivate: true };
  }

  async function status() {
    const config = await readConfig();
    const token = await getToken();
    return {
      ok: true,
      connected: !!(config?.enabled && token),
      configured: !!config?.enabled,
      tokenAvailable: !!token,
      config: config ? {
        schema: config.schema,
        enabled: config.enabled,
        repo: config.repo,
        branch: config.branch,
        root: config.root,
        rememberToken: config.rememberToken,
        verifiedPrivateAt: config.verifiedPrivateAt,
        connectedAt: config.connectedAt
      } : null
    };
  }

  async function disconnect(detail = {}) {
    await clearToken();
    if (detail.forgetConfig === true) await chrome.storage.local.remove(CONFIG_KEY);
    else {
      const config = await readConfig();
      if (config) await writeConfig({ ...config, enabled: false });
    }
    return { ok: true };
  }

  function safeError(error) {
    const message = String(error?.message || error || 'unknown_error');
    return message.replace(/github_pat_[A-Za-z0-9_]+/g, '[redacted]').replace(/gh[pousr]_[A-Za-z0-9]+/g, '[redacted]').slice(0, 260);
  }

  if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const type = message?.type;
      if (!String(type || '').startsWith('niakgpt:memory-') || !String(type).endsWith('-v132')) return;

      (async () => {
        if (type === 'niakgpt:memory-connect-v132') return connect(message);
        if (type === 'niakgpt:memory-status-v132') return status();
        if (type === 'niakgpt:memory-disconnect-v132') return disconnect(message);
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
      MAX_BATCH_BYTES
    };
  }
})();
