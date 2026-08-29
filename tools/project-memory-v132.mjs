import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
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
assert.equal(memory.MAX_FILES, 32);
assert.ok(memory.MAX_BATCH_BYTES >= 5 * 1024 * 1024);

const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
assert.equal(manifest.version, '0.9.77');
assert.deepEqual(manifest.permissions, ['storage','scripting']);
assert.deepEqual(manifest.host_permissions, ['https://chatgpt.com/*','https://api.github.com/*']);

const background = fs.readFileSync('background-v100.js','utf8');
assert.match(background, /importScripts\('project-memory-background-v132\.js'\)/);
assert.match(background, /'project-memory-v132\.js'/);
assert.match(background, /'project-memory-ui-v132\.js'/);

const backend = fs.readFileSync('project-memory-background-v132.js','utf8');
assert.match(backend, /meta\?\.private !== true/);
assert.match(backend, /memory_repository_must_be_private/);
assert.match(backend, /chrome\.storage\.session/);
assert.match(backend, /rememberToken/);
assert.doesNotMatch(backend, /github_pat_[A-Za-z0-9_]{20,}/);

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
assert.match(runtime, /PROJECT_STATE\.md/);
assert.match(runtime, /NIAKGPT PROJECT MEMORY — CHECKPOINT RÉCUPÉRÉ/);
assert.match(runtime, /Superseded/);

const ui = fs.readFileSync('project-memory-ui-v132.js','utf8');
assert.match(ui, /GITHUB PRIVÉ/);
assert.match(ui, /openWithoutMemory/);
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
assert.ok(fs.existsSync('.github/workflows/project-memory-v132.yml'),'Project Memory workflow missing');

console.log('PROJECT_MEMORY_V132_PASS');
