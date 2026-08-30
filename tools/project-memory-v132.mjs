import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const localStore = {};
const sessionStore = {};
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        if (Array.isArray(key)) return Object.fromEntries(key.filter(k => Object.prototype.hasOwnProperty.call(localStore,k)).map(k => [k,localStore[k]]));
        return Object.prototype.hasOwnProperty.call(localStore,key) ? {[key]:localStore[key]} : {};
      },
      async set(obj) { Object.assign(localStore,obj); },
      async remove(key) { for (const k of (Array.isArray(key)?key:[key])) delete localStore[k]; }
    },
    session: {
      async get(key) { return Object.prototype.hasOwnProperty.call(sessionStore,key) ? {[key]:sessionStore[key]} : {}; },
      async set(obj) { Object.assign(sessionStore,obj); },
      async remove(key) { for (const k of (Array.isArray(key)?key:[key])) delete sessionStore[k]; }
    }
  }
};
const memory = require('../project-memory-background-v132.js');

assert.equal(memory.normalizeRepo('niakw/private-memory'), 'niakw/private-memory');
assert.equal(memory.normalizeRepo('https://github.com/niakw/private-memory.git'), 'niakw/private-memory');
assert.equal(memory.normalizeRepo('git@github.com:niakw/private-memory.git'), 'niakw/private-memory');
assert.equal(memory.normalizeRepo('not a repo'), '');
assert.equal(memory.normalizeRoot('.niakgpt-memory'), '.niakgpt-memory');
assert.equal(memory.normalizeRoot('../escape'), '');
assert.equal(memory.normalizeRelativePath('projects/g-p-test/PROJECT_STATE.md'), 'projects/g-p-test/PROJECT_STATE.md');
assert.equal(memory.normalizeRelativePath('../PROJECT_STATE.md'), '');
assert.equal(memory.joinRoot('.niakgpt-memory','projects/g-p-test/PROJECT_STATE.md'), '.niakgpt-memory/projects/g-p-test/PROJECT_STATE.md');
assert.match(memory.safeError(new Error('bad github_pat_ABCDEF1234567890')), /\[redacted\]/);
assert.doesNotMatch(memory.safeError(new Error('bad github_pat_ABCDEF1234567890')), /ABCDEF1234567890/);
assert.equal(memory.validateRedirect('https://abcdefghijklmnop.chromiumapp.org/oauth?code=abc&state=state-1','https://abcdefghijklmnop.chromiumapp.org/oauth','state-1'),'abc');
assert.throws(()=>memory.validateRedirect('https://abcdefghijklmnop.chromiumapp.org/oauth?code=abc&state=evil','https://abcdefghijklmnop.chromiumapp.org/oauth','state-1'),/github_oauth_state_mismatch/);
assert.equal(memory.MAX_FILES, 32);
assert.ok(memory.MAX_BATCH_BYTES >= 5 * 1024 * 1024);


const fetchCalls = [];
let emptyInitialized=false;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const path = u.pathname;
  const method = String(init.method || 'GET').toUpperCase();
  fetchCalls.push({path,method,body:init.body ? JSON.parse(init.body) : null});
  const reply = (status,data) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});

  if (method === 'GET' && path === '/repos/niakw/empty-memory') return reply(200,{private:true,archived:false,size:emptyInitialized?1:0,default_branch:'main'});
  if (method === 'GET' && path === '/repos/niakw/empty-memory/git/ref/heads/main') {
    return emptyInitialized ? reply(200,{ref:'refs/heads/main',object:{sha:'commit-empty-1'}}) : reply(409,{message:'Git Repository is empty.'});
  }
  if (method === 'PUT' && path === '/repos/niakw/empty-memory/contents/.niakgpt-memory/niakgpt-memory.json') {
    emptyInitialized=true;
    return reply(201,{content:{path:'.niakgpt-memory/niakgpt-memory.json',sha:'blob-empty-1'},commit:{sha:'commit-empty-1'}});
  }

  if (method === 'GET' && path === '/repos/niakw/public-memory') return reply(200,{private:false,archived:false,size:0,default_branch:'main'});
  return reply(500,{message:'unexpected mock request '+method+' '+path});
};

const connected = await memory.connect({
  repo:'niakw/empty-memory',
  branch:'main',
  root:'.niakgpt-memory',
  token:'synthetic-empty-repo-token',
  rememberToken:false
});
assert.equal(connected.ok,true);
assert.equal(connected.initializedEmptyRepo,true);
assert.equal(connected.repositoryPrivate,true);
assert.equal(localStore['niakgpt-project-memory-config-v132'].repo,'niakw/empty-memory');
assert.equal(localStore['niakgpt-project-memory-config-v132'].authMode,'pat');
assert.equal(localStore['niakgpt-project-memory-config-v132'].schema,2);
assert.equal(sessionStore['niakgpt-project-memory-session-token-v132'],'synthetic-empty-repo-token');
assert.equal(localStore['niakgpt-project-memory-token-v132'],undefined);
const initialContent = fetchCalls.find(call => call.path.endsWith('/contents/.niakgpt-memory/niakgpt-memory.json') && call.method === 'PUT');
assert.ok(initialContent,'zero-commit repository did not use GitHub Contents API for its first commit');
assert.equal(Object.prototype.hasOwnProperty.call(initialContent.body,'branch'),false,'first empty-repo Contents write must let GitHub create the default branch');
assert.match(Buffer.from(initialContent.body.content,'base64').toString('utf8'),/NiakGPTProjectMemory/);
assert.equal(fetchCalls.some(call => call.path.endsWith('/git/refs') && call.method === 'POST'),false,'default branch initialization incorrectly used Create Reference on an empty repository');

delete localStore['niakgpt-project-memory-config-v132'];
delete sessionStore['niakgpt-project-memory-session-token-v132'];
await assert.rejects(
  () => memory.connect({repo:'niakw/public-memory',branch:'main',root:'.niakgpt-memory',token:'synthetic-public-token',rememberToken:false}),
  /memory_repository_must_be_private/
);
assert.equal(localStore['niakgpt-project-memory-config-v132'],undefined,'failed connect persisted config');
assert.equal(sessionStore['niakgpt-project-memory-session-token-v132'],undefined,'failed connect persisted token');

const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
assert.equal(manifest.version, '0.9.79');
assert.deepEqual(manifest.permissions, ['storage','scripting','identity']);
assert.deepEqual(manifest.host_permissions, ['https://chatgpt.com/*','https://api.github.com/*','https://github.com/login/*']);

const background = fs.readFileSync('background-v100.js','utf8');
assert.match(background, /try\{\s*importScripts\('project-memory-background-v132\.js'\)/s);
assert.match(background, /const OPTIONAL_RUNTIME=\[/);
assert.match(background, /'project-memory-v132\.js'/);
assert.match(background, /'project-memory-ui-v132\.js'/);
const isolatedBody = background.match(/const ISOLATED_RUNTIME=\[(.*?)\];/s)?.[1] || '';
assert.doesNotMatch(isolatedBody,/project-memory-v132\.js|project-memory-ui-v132\.js/,'Project Memory leaked back into critical runtime');
const coreFailureLine = background.match(/const coreFailed=.*?;/s)?.[0] || '';
assert.doesNotMatch(coreFailureLine,/project-memory/,'Project Memory failure can still fail critical sidebar boot');
assert.ok(background.indexOf('sendResponse({ok:!coreFailed') < background.indexOf('for(const file of OPTIONAL_RUNTIME)'),'optional runtime still delays core bootstrap response');

const backend = fs.readFileSync('project-memory-background-v132.js','utf8');
assert.match(backend, /meta\?\.private !== true/);
assert.match(backend, /memory_repository_must_be_private/);
assert.match(backend, /chrome\.storage\.session/);
assert.match(backend, /rememberToken/);
assert.match(backend, /initializeEmptyRepo/);
assert.match(backend, /method: 'PUT'/);
assert.match(backend, /github_initial_content_commit_failed/);
assert.match(backend, /refs\/heads/);
assert.doesNotMatch(backend, /github_pat_[A-Za-z0-9_]{20,}/);
assert.match(backend, /chrome\.identity\.launchWebAuthFlow/);
assert.match(backend, /app-manifests\//);
assert.match(backend, /request_oauth_on_install/);
assert.match(backend, /default_permissions: \{ contents: 'write', metadata: 'read' \}/);
assert.match(backend, /niakgpt:memory-github-connect-repo-v132/);
assert.match(backend, /github_repository_not_authorized_for_vault/);
assert.match(backend, /grant_type: 'refresh_token'/);
assert.doesNotMatch(backend, /clientSecret.*sendResponse|client_secret.*sendResponse/s,'GitHub App client secret leaked through runtime response');

const bridge = fs.readFileSync('page-bridge.js','utf8');
assert.match(bridge, /conversation_detail_get_disabled/);
assert.match(bridge, /d\.memoryBootstrap !== true/);

const runtime = fs.readFileSync('project-memory-v132.js','utf8');
assert.match(runtime, /function inject\(ed\)/);
assert.doesNotMatch(runtime, /async function inject\(ed\)/);
assert.match(runtime, /prefsReady/);
assert.match(runtime, /canonicalUpdated/);
assert.match(runtime, /MEMORY_LOCK/);
assert.match(runtime, /autoOwner/);
assert.match(runtime, /niakgpt:tab-role-changed/);
assert.match(runtime, /HISTORY_FETCH_GAP_MS = 3000/);
assert.match(runtime, /lastHistoryFetchAt/);
assert.match(runtime, /PROJECT_STATE\.md/);
assert.match(runtime, /NIAKGPT PROJECT MEMORY — CHECKPOINT RÉCUPÉRÉ/);
assert.match(runtime, /Superseded/);
assert.match(runtime, /githubLogin/);
assert.match(runtime, /githubRepositories/);
assert.match(runtime, /githubConnectRepo/);
assert.match(runtime, /githubLogout/);

const ui = fs.readFileSync('project-memory-ui-v132.js','utf8');
assert.match(ui, /GITHUB PRIVÉ/);
assert.match(ui, /openWithoutMemory/);
assert.match(ui, /Réessayer la connexion/);
assert.match(ui, /token\.value = draft\.token/);
assert.match(ui, /!document\.querySelector\('#ng90-control \[data-ng132-memory\]'\)/,'settings click must not rerender an already-mounted Project Memory form');
assert.doesNotMatch(ui, /else if \(document\.querySelector\('#ng90-control\.open'\)\) schedule\(120\)/);

const fixture = fs.readFileSync('test/x.md','utf8');
assert.match(fixture, /Synthetic test data only/);
assert.match(fixture, /No real user text/);
assert.match(fixture, /No auth token/);
assert.doesNotMatch(fixture, /github_pat_|ghp_|Authorization:/);

const packager = fs.readFileSync('tools/package-extension.mjs','utf8');
assert.match(packager, /importScripts/);
assert.match(packager, /project-memory-background-v132\.js/);

assert.ok(fs.existsSync('visual-lab/project-memory-v132.mjs'),'Project Memory browser gate missing');
assert.ok(fs.existsSync('labs/project-memory-isolation-v133.mjs'),'Project Memory isolation gate missing');
assert.ok(fs.existsSync('.github/workflows/project-memory-v132.yml'),'Project Memory workflow missing');
const memoryWorkflow=fs.readFileSync('.github/workflows/project-memory-v132.yml','utf8');
assert.doesNotMatch(memoryWorkflow,/NIAKGPT_PRIVATE_REPO_TOKEN|NIAKGPT_PRIVATE_REPO|live-private-repo|niakgpt-private/,'public Project Memory CI must not know or access a private user vault');
assert.doesNotMatch(memoryWorkflow,/secrets\./,'Project Memory public CI must remain credential-free');
assert.match(ui,/COFFRE GITHUB PRIVÉ/);
assert.match(ui,/Se connecter avec GitHub/);
assert.match(ui,/data-ng132-repo-select/);
assert.match(ui,/Avancé · PAT manuel/);
assert.match(ui,/data-ng132-use-repo/);
assert.ok(fs.existsSync('github-vault-start.html'),'GitHub manifest launcher HTML missing');
assert.ok(fs.existsSync('github-vault-start.js'),'GitHub manifest launcher JS missing');
const launcher=fs.readFileSync('github-vault-start.js','utf8');
assert.match(launcher,/github\.com\/settings\/apps\/new/);
assert.match(launcher,/niakgpt:memory-github-manifest-v132/);

console.log('PROJECT_MEMORY_V132_PASS');
