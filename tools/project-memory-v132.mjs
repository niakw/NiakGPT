import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const localStore = {};
const sessionStore = {};
const tabUpdatedListeners = new Set();
const tabRemovedListeners = new Set();
let createdAuthTab = null;
let removedAuthTab = null;
const identityCalls = [];
globalThis.chrome = {
  runtime: {
    getURL(path) { return 'chrome-extension://lopeiincnbjihmoahcbogokeniojgobk/' + String(path || ''); }
  },
  identity: {
    async launchWebAuthFlow(details) { identityCalls.push(details); return details.url; }
  },
  tabs: {
    async create(options) { createdAuthTab = {...options,id:77}; return createdAuthTab; },
    async remove(id) { removedAuthTab = id; },
    onUpdated: {
      addListener(fn) { tabUpdatedListeners.add(fn); },
      removeListener(fn) { tabUpdatedListeners.delete(fn); }
    },
    onRemoved: {
      addListener(fn) { tabRemovedListeners.add(fn); },
      removeListener(fn) { tabRemovedListeners.delete(fn); }
    }
  },
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

const chatgptCalls=[];
globalThis.fetch=async(url,init={})=>{
  const u=new URL(String(url)),method=String(init.method||'GET').toUpperCase();
  chatgptCalls.push({url:u.href,method,credentials:init.credentials,cache:init.cache,authorization:init.headers?.Authorization||''});
  if(u.origin==='https://chatgpt.com'&&u.pathname==='/api/auth/session')return new Response(JSON.stringify({accessToken:'lab-token'}),{status:200,headers:{'content-type':'application/json'}});
  if(u.origin==='https://chatgpt.com'&&u.pathname==='/backend-api/conversation/lab-chat')return new Response(JSON.stringify({current_node:'n1',mapping:{n1:{id:'n1',parent:null,message:{author:{role:'assistant'},content:{parts:['archived from background']}}}}}),{status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({message:'unexpected direct memory request'}),{status:500,headers:{'content-type':'application/json'}});
};
const directProbe=await memory.chatgptMemoryProbe();
assert.equal(directProbe.ok,true,'background ChatGPT session probe failed');
const directConversation=await memory.chatgptMemoryGet('/backend-api/conversation/lab-chat');
assert.equal(directConversation.ok,true,'background conversation fetch failed');
assert.equal(directConversation.transport,'extension-background');
assert.equal(chatgptCalls.filter(call=>call.url.endsWith('/api/auth/session')).length,1,'background transport did not cache its ephemeral ChatGPT session token');
assert.equal(chatgptCalls.at(-1).credentials,'include');
assert.equal(chatgptCalls.at(-1).cache,'no-store');
assert.equal(chatgptCalls.at(-1).authorization,'Bearer lab-token');
await assert.rejects(()=>memory.chatgptMemoryGet('/backend-api/conversations?offset=0'),/chatgpt_memory_path_not_allowed/,'background memory transport accepted a broad ChatGPT endpoint');

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
await assert.rejects(()=>memory.launchIdentityFlow('chrome-extension://lopeiincnbjihmoahcbogokeniojgobk/github-vault-start.html'),/github_auth_url_invalid_scheme/);
await memory.launchIdentityFlow('https://github.com/login/oauth/authorize?client_id=synthetic');
assert.equal(identityCalls.length,1);
assert.match(identityCalls[0].url,/^https:\/\/github\.com\/login\/oauth\/authorize/);

const manifestFlow = {
  manifestRedirect:'https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/niakgpt-github-manifest',
  manifestState:'manifest-state-1'
};
const manifestPromise = memory.launchManifestRegistrationTab(manifestFlow);
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(createdAuthTab.url,'chrome-extension://lopeiincnbjihmoahcbogokeniojgobk/github-vault-start.html');
assert.equal(createdAuthTab.active,true);
for (const fn of [...tabUpdatedListeners]) {
  fn(77,{url:'https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/niakgpt-github-manifest?code=manifest-code-1&state=manifest-state-1'},{});
}
assert.equal(await manifestPromise,'manifest-code-1');
assert.equal(removedAuthTab,77);
assert.equal(tabUpdatedListeners.size,0);
assert.equal(tabRemovedListeners.size,0);
assert.equal(memory.MAX_FILES, 32);
assert.ok(memory.MAX_BATCH_BYTES >= 5 * 1024 * 1024);
assert.equal(memory.MAX_REF_RETRIES,8);
assert.equal(memory.refRace(Object.assign(new Error('github_http_422:Update is not a fast forward'),{status:422,data:{message:'Update is not a fast forward'}})),true);
assert.equal(memory.refRace(Object.assign(new Error('github_http_422:Repository rule violations found'),{status:422,data:{message:'Repository rule violations found'}})),false);


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


let raceHead='race-parent-0', racePatchAttempts=0, raceCommitSeq=0;
const raceParents=new Map();
globalThis.fetch = async (url, init = {}) => {
  const u=new URL(String(url)),path=u.pathname,method=String(init.method||'GET').toUpperCase();
  const body=init.body?JSON.parse(init.body):null;
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(method==='GET'&&path==='/repos/niakw/race-memory')return reply(200,{private:true,archived:false,size:1,default_branch:'main'});
  if(method==='GET'&&path==='/repos/niakw/race-memory/git/ref/heads/main'){assert.equal(init.cache,'no-store','mutable Git ref read must bypass browser HTTP cache');return reply(200,{object:{sha:raceHead}});}
  if(method==='GET'&&path.startsWith('/repos/niakw/race-memory/git/commits/'))return reply(200,{tree:{sha:'tree-'+raceHead}});
  if(method==='POST'&&path==='/repos/niakw/race-memory/git/blobs')return reply(201,{sha:'blob-'+Math.random().toString(36).slice(2)});
  if(method==='POST'&&path==='/repos/niakw/race-memory/git/trees')return reply(201,{sha:'tree-new-'+Math.random().toString(36).slice(2)});
  if(method==='POST'&&path==='/repos/niakw/race-memory/git/commits'){
    const sha='race-commit-'+(++raceCommitSeq); raceParents.set(sha,body.parents?.[0]||''); return reply(201,{sha});
  }
  if(method==='PATCH'&&path==='/repos/niakw/race-memory/git/refs/heads/main'){
    racePatchAttempts++;
    if(racePatchAttempts<=2){raceHead='external-'+racePatchAttempts;return reply(422,{message:'Update is not a fast forward'});}
    assert.equal(raceParents.get(body.sha),raceHead,'retry commit did not rebase on latest branch head');
    raceHead=body.sha;return reply(200,{object:{sha:raceHead}});
  }
  return reply(500,{message:'unexpected race mock '+method+' '+path});
};
const raceResult=await memory.commitFilesWith('synthetic-race-token',{repo:'niakw/race-memory',branch:'main',root:'.niakgpt-memory'},[{path:'PROJECTS.json',content:'{}\n'}],'race test');
assert.equal(racePatchAttempts,3,'non-fast-forward race was not retried until a fresh head succeeded');
assert.equal(raceResult.sha,raceHead);

// Second race window: the branch advances after commit creation but before PATCH.
// NiakGPT must re-read the authoritative ref and rebuild before attempting update-ref.
let preHead='pre-parent-0',preCommitSeq=0,prePatchAttempts=0;
const preParents=new Map();
globalThis.fetch=async(url,init={})=>{
  const u=new URL(String(url)),path=u.pathname,method=String(init.method||'GET').toUpperCase();
  const body=init.body?JSON.parse(init.body):null;
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(method==='GET'&&path==='/repos/niakw/preflight-memory')return reply(200,{private:true,archived:false,size:1,default_branch:'main'});
  if(method==='GET'&&path==='/repos/niakw/preflight-memory/git/ref/heads/main'){assert.equal(init.cache,'no-store','preflight ref read must bypass browser cache');return reply(200,{object:{sha:preHead}});}
  if(method==='GET'&&path.startsWith('/repos/niakw/preflight-memory/git/commits/'))return reply(200,{tree:{sha:'tree-'+preHead}});
  if(method==='POST'&&path==='/repos/niakw/preflight-memory/git/blobs')return reply(201,{sha:'blob-pre'});
  if(method==='POST'&&path==='/repos/niakw/preflight-memory/git/trees')return reply(201,{sha:'tree-pre-'+preCommitSeq});
  if(method==='POST'&&path==='/repos/niakw/preflight-memory/git/commits'){
    const sha='pre-commit-'+(++preCommitSeq);preParents.set(sha,body.parents?.[0]||'');
    if(preCommitSeq<=2)preHead='pre-external-'+preCommitSeq;
    return reply(201,{sha});
  }
  if(method==='PATCH'&&path==='/repos/niakw/preflight-memory/git/refs/heads/main'){
    prePatchAttempts++;assert.equal(preParents.get(body.sha),preHead,'preflight retry did not rebuild on current branch head');
    preHead=body.sha;return reply(200,{object:{sha:preHead}});
  }
  return reply(500,{message:'unexpected preflight mock '+method+' '+path});
};
const preResult=await memory.commitFilesWith('synthetic-preflight-token',{repo:'niakw/preflight-memory',branch:'main',root:'.niakgpt-memory'},[{path:'PROJECTS.json',content:'{}\n'}],'preflight race test');
assert.equal(preCommitSeq,3,'preflight race did not rebuild until the branch head stabilized');
assert.equal(prePatchAttempts,1,'preflight race still emitted doomed update-ref requests');
assert.equal(preResult.sha,preHead);

// Priority first-transfer inlines file content into Create Tree. This keeps the branch
// commit serialized while removing one GitHub blob POST per transcript chunk.
assert.equal(memory.PRIORITY_TREE_INLINE,true);
assert.ok(memory.PRIVATE_REPO_VERIFY_TTL_MS>=5*60*1000);
let priorityHead='priority-parent-0',priorityCommitSeq=0,priorityBlobCalls=0,priorityTreeBody=null,priorityRepoChecks=0;
globalThis.fetch=async(url,init={})=>{
  const u=new URL(String(url)),path=u.pathname,method=String(init.method||'GET').toUpperCase();
  const body=init.body?JSON.parse(init.body):null;
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(method==='GET'&&path==='/repos/niakw/priority-memory'){priorityRepoChecks++;return reply(200,{private:true,archived:false,size:1,default_branch:'main'});}
  if(method==='GET'&&path==='/repos/niakw/priority-memory/git/ref/heads/main')return reply(200,{object:{sha:priorityHead}});
  if(method==='GET'&&path.startsWith('/repos/niakw/priority-memory/git/commits/'))return reply(200,{tree:{sha:'tree-'+priorityHead}});
  if(method==='POST'&&path==='/repos/niakw/priority-memory/git/blobs'){priorityBlobCalls++;return reply(201,{sha:'unexpected-blob'});}
  if(method==='POST'&&path==='/repos/niakw/priority-memory/git/trees'){priorityTreeBody=body;return reply(201,{sha:'priority-tree-1'});}
  if(method==='POST'&&path==='/repos/niakw/priority-memory/git/commits')return reply(201,{sha:'priority-commit-'+(++priorityCommitSeq)});
  if(method==='PATCH'&&path==='/repos/niakw/priority-memory/git/refs/heads/main'){
    priorityHead=body.sha;return reply(200,{object:{sha:priorityHead}});
  }
  return reply(500,{message:'unexpected priority mock '+method+' '+path});
};
const priorityFiles=Array.from({length:8},(_,i)=>({path:'projects/g-p-priority/conversations/c-'+i+'/part-001.md',content:'payload '+i+'\n'}));
const priorityConfig={repo:'niakw/priority-memory',branch:'main',root:'.niakgpt-memory'};
const priorityResult=await memory.commitFilesWith('synthetic-priority-token',priorityConfig,priorityFiles,'priority inline-tree test',0,true);
assert.equal(priorityResult.files,8);
assert.equal(priorityBlobCalls,0,'priority transfer still emitted per-file blob requests');
assert.equal(priorityTreeBody.tree.length,8);
assert.ok(priorityTreeBody.tree.every(row=>typeof row.content==='string'&&!Object.hasOwn(row,'sha')),'priority tree did not inline blob content');
const priorityResult2=await memory.commitFilesWith('synthetic-priority-token',priorityConfig,[{path:'PROJECTS.json',content:'{}\n'}],'priority verify-cache test',0,true);
assert.equal(priorityResult2.files,1);
assert.equal(priorityRepoChecks,1,'private repository verification cache did not remove repeated metadata reads');

// Large Project regression: a multi-megabyte project index may be returned by GitHub
// Contents without inline base64. The blob fallback must recover it, and a stale writer
// must merge with the current durable index instead of shrinking 3 archived chats to 1.
const archived=(id,updated,extra={})=>({
  schema:1,id,title:'Thread '+id,updated,capturedAt:new Date(updated).toISOString(),
  parts:2,messages:20,canonicalHash:'hash-'+id,bootstrapMetadataOnly:false,
  historyPartial:false,complete:true,captureSource:'backend',
  signals:{tasks:['large duplicated signal '+id],architecture:[],decisions:[],recent:[]},
  ...extra
});
const currentLargeIndex={
  schema:1,projectId:'g-p-large',projectName:'Large Workspace',updatedAt:'2026-09-22T22:09:00.000Z',
  conversations:{c1:archived('c1',1000),c2:archived('c2',2000),c3:archived('c3',3000)}
};
const staleIncoming={
  schema:1,projectId:'g-p-large',projectName:'Large Workspace',updatedAt:'2026-09-22T22:10:00.000Z',
  conversations:{c1:archived('c1',1000)}
};
const pureMerged=memory.mergeProjectIndexPayload(currentLargeIndex,staleIncoming);
assert.equal(Object.keys(pureMerged.conversations).length,3,'stale project index merge dropped durable conversations');
assert.equal(Object.hasOwn(pureMerged.conversations.c2,'signals'),false,'compact project index still duplicated per-chat signals');

let mergeHead='merge-parent-0',mergeTreeBody=null,mergeBlobReads=0;
globalThis.fetch=async(url,init={})=>{
  const u=new URL(String(url)),path=u.pathname,method=String(init.method||'GET').toUpperCase();
  const body=init.body?JSON.parse(init.body):null;
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(method==='GET'&&path==='/repos/niakw/merge-memory')return reply(200,{private:true,archived:false,size:1,default_branch:'main'});
  if(method==='GET'&&path==='/repos/niakw/merge-memory/git/ref/heads/main')return reply(200,{object:{sha:mergeHead}});
  if(method==='GET'&&path==='/repos/niakw/merge-memory/git/commits/'+mergeHead)return reply(200,{tree:{sha:'tree-'+mergeHead}});
  if(method==='GET'&&path==='/repos/niakw/merge-memory/contents/.niakgpt-memory/projects/g-p-large/index.json'){
    assert.equal(u.searchParams.get('ref'),mergeHead);
    return reply(200,{type:'file',encoding:'none',content:'',sha:'large-index-blob',size:3_100_000});
  }
  if(method==='GET'&&path==='/repos/niakw/merge-memory/git/blobs/large-index-blob'){
    mergeBlobReads++;
    return reply(200,{encoding:'base64',content:Buffer.from(JSON.stringify(currentLargeIndex),'utf8').toString('base64'),sha:'large-index-blob'});
  }
  if(method==='POST'&&path==='/repos/niakw/merge-memory/git/trees'){mergeTreeBody=body;return reply(201,{sha:'tree-merged'});}
  if(method==='POST'&&path==='/repos/niakw/merge-memory/git/commits')return reply(201,{sha:'merge-commit-1'});
  if(method==='PATCH'&&path==='/repos/niakw/merge-memory/git/refs/heads/main'){mergeHead=body.sha;return reply(200,{object:{sha:mergeHead}});}
  return reply(500,{message:'unexpected merge mock '+method+' '+path});
};
const mergeResult=await memory.commitFilesWith(
  'synthetic-merge-token',
  {repo:'niakw/merge-memory',branch:'main',root:'.niakgpt-memory'},
  [{path:'projects/g-p-large/index.json',content:JSON.stringify(staleIncoming)}],
  'stale writer merge',
  0,
  true
);
assert.equal(mergeResult.files,1);
assert.equal(mergeBlobReads,1,'large Contents payload did not fall back to Git blob');
const mergedTreeRow=mergeTreeBody.tree.find(row=>row.path.endsWith('/projects/g-p-large/index.json'));
assert.ok(mergedTreeRow&&typeof mergedTreeRow.content==='string','merged project index was not written inline');
const mergedTreeIndex=JSON.parse(mergedTreeRow.content);
assert.equal(Object.keys(mergedTreeIndex.conversations).length,3,'commit layer allowed stale project index shrink');
assert.equal(Object.hasOwn(mergedTreeIndex.conversations.c3,'signals'),false,'commit layer failed to compact duplicated signals');

// Durable-directory reconciliation recovers archives that survived a previously clobbered
// project index. Only IDs absent from the current resume index are read.
sessionStore['niakgpt-project-memory-session-token-v132']='synthetic-archive-token';
let archiveIndexReads=0;
globalThis.fetch=async(url,init={})=>{
  const u=new URL(String(url)),path=u.pathname,method=String(init.method||'GET').toUpperCase();
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(method==='GET'&&path==='/repos/niakw/archive-memory')return reply(200,{private:true,archived:false,size:1,default_branch:'main'});
  if(method==='GET'&&path==='/repos/niakw/archive-memory/contents/.niakgpt-memory/projects/g-p-large/conversations')return reply(200,[
    {type:'dir',name:'c1'},{type:'dir',name:'c2'},{type:'dir',name:'c3'}
  ]);
  const m=path.match(/^\/repos\/niakw\/archive-memory\/contents\/\.niakgpt-memory\/projects\/g-p-large\/conversations\/(c2|c3)\/index\.json$/);
  if(method==='GET'&&m){
    archiveIndexReads++;
    const row=archived(m[1],m[1]==='c2'?2000:3000);
    return reply(200,{type:'file',encoding:'base64',content:Buffer.from(JSON.stringify(row),'utf8').toString('base64'),sha:'idx-'+m[1]});
  }
  return reply(500,{message:'unexpected archive mock '+method+' '+path});
};
const archiveSnapshot=await memory.projectArchiveSnapshot(
  {repo:'niakw/archive-memory',branch:'main',root:'.niakgpt-memory',authMode:'pat'},
  'g-p-large',
  ['c1']
);
assert.equal(archiveSnapshot.directoryCount,3);
assert.equal(archiveSnapshot.recovered.length,2);
assert.equal(archiveIndexReads,2,'archive reconciliation reread already-known conversation indexes');
assert.deepEqual(archiveSnapshot.recovered.map(row=>row.id).sort(),['c2','c3']);
delete sessionStore['niakgpt-project-memory-session-token-v132'];

// Cold-cache recovery must rebuild its canonical Project inventory from durable vault
// directories, without returning private Project instructions/descriptions to the page.
sessionStore['niakgpt-project-memory-session-token-v132']='synthetic-catalog-token';
const b64=value=>Buffer.from(JSON.stringify(value),'utf8').toString('base64');
const catalogRows={
  'g-p-alpha':{schema:1,id:'g-p-alpha',name:'Workspace Alpha',conversationCount:11,knownConversationCount:12,indexed:true,description:'private description',instructions:'private instructions'},
  'g-p-beta':{schema:1,id:'g-p-beta',name:'Workspace Beta',conversationCount:7,knownConversationCount:7,indexed:true,description:'private description',instructions:'private instructions'},
  'g-p-gamma':{schema:1,id:'g-p-gamma',name:'Workspace Gamma',conversationCount:3,knownConversationCount:4,indexed:false,description:'private description',instructions:'private instructions'}
};
globalThis.fetch=async(url,init={})=>{
  const u=new URL(String(url)),path=u.pathname,method=String(init.method||'GET').toUpperCase();
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  if(method==='GET'&&path==='/repos/niakw/catalog-memory')return reply(200,{private:true,archived:false,size:1,default_branch:'main'});
  if(method==='GET'&&path==='/repos/niakw/catalog-memory/contents/.niakgpt-memory/projects')return reply(200,[
    ...Object.keys(catalogRows).map(name=>({type:'dir',name})),
    {type:'dir',name:'not-a-project'},
    {type:'file',name:'README.md'}
  ]);
  if(method==='GET'&&path==='/repos/niakw/catalog-memory/contents/.niakgpt-memory/PROJECT_CATALOG.json')return reply(200,{type:'file',encoding:'base64',content:b64({kind:'NiakGPTProjectCatalog',projects:[{id:'g-p-gamma',name:'Workspace Gamma',knownConversationCount:4,indexed:false},{id:'g-p-alpha',name:'Workspace Alpha',knownConversationCount:12,indexed:true}]}),sha:'durable-catalog'});
    if(method==='GET'&&path==='/repos/niakw/catalog-memory/contents/.niakgpt-memory/PROJECTS.json')return reply(200,{type:'file',encoding:'base64',content:b64({kind:'NiakGPTCachedBootstrap',projects:[{id:'g-p-alpha',name:'Collapsed Alpha',knownConversationCount:1,indexed:false}]}),sha:'collapsed-root'});
  const match=path.match(/^\/repos\/niakw\/catalog-memory\/contents\/\.niakgpt-memory\/projects\/(g-p-[^/]+)\/project\.json$/);
  if(method==='GET'&&match&&catalogRows[match[1]])return reply(200,{type:'file',encoding:'base64',content:b64(catalogRows[match[1]]),sha:'project-'+match[1]});
  return reply(500,{message:'unexpected catalog mock '+method+' '+path});
};
const catalog=await memory.projectCatalog({repo:'niakw/catalog-memory',branch:'main',root:'.niakgpt-memory',authMode:'pat'});
assert.equal(catalog.repoPrivate,true);
assert.equal(catalog.source,'vault-project-directories');
assert.equal(catalog.orderSource,'PROJECT_CATALOG.json','collapsed live PROJECTS.json overrode durable high-water ordering');
assert.equal(catalog.projectCount,3,'vault catalog did not enumerate canonical Project directories');
assert.deepEqual(catalog.projects.map(row=>row.id),['g-p-gamma','g-p-alpha','g-p-beta'],'vault catalog did not preserve durable root ordering before appending missing directories');
assert.equal(catalog.projects[1].name,'Workspace Alpha','project.json must override stale bootstrap/catalog metadata');
assert.equal(catalog.projects[1].knownConversationCount,12);
assert.equal(catalog.projects[0].indexed,false);
assert.equal(catalog.projects.some(row=>Object.hasOwn(row,'instructions')||Object.hasOwn(row,'description')),false,'vault catalog leaked private Project content');
delete sessionStore['niakgpt-project-memory-session-token-v132'];

const manifest = JSON.parse(fs.readFileSync('manifest.json','utf8'));
assert.equal(manifest.version, '0.9.119');
assert.deepEqual(manifest.permissions, ['storage','scripting','identity']);
assert.deepEqual(manifest.host_permissions, ['https://chatgpt.com/*','https://api.github.com/*','https://github.com/login/*','https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/*']);

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
assert.match(backend, /launchManifestRegistrationTab/);
assert.match(backend, /chrome\.tabs\.create\(\{ url: chrome\.runtime\.getURL\('github-vault-start\.html'\), active: true \}\)/);
assert.doesNotMatch(backend, /launchWebAuthFlow\(\{\s*url:\s*chrome\.runtime\.getURL/s);
assert.match(backend, /github_auth_url_invalid_scheme/);
assert.match(backend, /niakgpt:memory-github-login-v132/);
assert.match(backend, /chrome\.runtime\.onConnect\.addListener/);
assert.match(backend, /app-manifests\//);
assert.match(backend, /request_oauth_on_install: false/);
assert.match(backend, /setup_url: clean\(flow\.installRedirect\)/);
assert.match(backend, /code_challenge/);
assert.match(backend, /code_challenge_method', 'S256'/);
assert.match(backend, /code_verifier: flow\.pkceVerifier/);
assert.match(backend, /validateStateRedirect\(installResult, installRedirect, flow\.installState\)/);
assert.match(backend, /default_permissions: \{ contents: 'write', metadata: 'read' \}/);
assert.match(backend, /niakgpt:memory-github-connect-repo-v132/);
assert.match(backend, /github_repository_not_authorized_for_vault/);
assert.match(backend, /grant_type: 'refresh_token'/);
assert.match(backend, /CHATGPT_CONVERSATION_RX/);
assert.match(backend, /niakgpt:memory-chatgpt-probe-v132/);
assert.match(backend, /niakgpt:memory-chatgpt-fetch-v132/);
assert.match(backend, /niakgpt:memory-catalog-v132/);
assert.match(backend, /async function projectCatalog\(config\)/);
assert.match(backend, /PROJECT_ARCHIVE_SCAN_CONCURRENCY = 8/);
assert.match(backend, /async function projectArchiveSnapshot\(config, projectId, knownArchivedIds=\[\]\)/);
assert.match(backend, /mergeProjectIndexPayload/);
assert.match(backend, /data\.encoding!=='base64'/);
assert.match(backend, /git\/blobs\//);
assert.match(backend, /source: 'vault-project-directories'/);
assert.match(backend, /PROJECT_CATALOG\.json/);
assert.match(backend, /orderSource:/);
assert.match(backend, /credentials: 'include'/);
assert.match(backend, /transport: 'extension-background'/);
assert.doesNotMatch(backend, /chrome\.storage\.(?:local|session)\.set\([^\n]{0,240}chatgptAccessToken/,'ChatGPT access token must remain memory-only');
assert.doesNotMatch(backend, /chrome\.storage\.(?:local|session)\.set\([^\n]{0,240}CHATGPT_TOKEN/,'ChatGPT access token must never receive a storage key');

const bridge = fs.readFileSync('page-bridge.js','utf8');
assert.match(bridge, /conversation_detail_get_disabled/);
assert.match(bridge, /d\.memoryBootstrap !== true/);
assert.match(bridge, /activeGetControllers/);
assert.match(bridge, /fetch_aborted_native_priority/);
assert.match(bridge, /native_conversation_quiet/);
assert.match(bridge, /chat-route-guard/);
assert.match(bridge, /ng90PeerChatActive/);
assert.match(bridge, /memoryPeerSafe/);
assert.match(bridge, /peerBusyPage/);
assert.match(bridge, /data-ng90-peer-busy/);
assert.match(bridge, /d\.memoryBootstrap === true/);
assert.match(bridge, /conversationQuiet\(path,method,d\.memoryBootstrap === true\)/);
assert.match(bridge, /return fetchRequest\(path, method, body, token\)/);
assert.doesNotMatch(bridge, /transport:'fetch\+xhr'/);

const runtime = fs.readFileSync('project-memory-v132.js','utf8');
assert.match(runtime, /function inject\(ed\)/);
assert.doesNotMatch(runtime, /async function inject\(ed\)/);
assert.match(runtime, /prefsReady/);
assert.match(runtime, /canonicalUpdated/);
assert.match(runtime, /MEMORY_LOCK/);
assert.match(runtime, /autoOwner/);
assert.match(runtime, /niakgpt:tab-role-changed/);
assert.match(runtime, /HISTORY_FETCH_GAP_MS = 20000/);
assert.match(runtime, /HUMAN_QUIET_MS = 60\*1000/);
assert.match(runtime, /WAKE_HEARTBEAT_MS = 30000/);
assert.match(runtime, /async function wakeHeartbeat\(\)/);
assert.match(runtime, /ng132WakeBeat/);
assert.match(runtime, /if\(!acquired&&automatic\)\{ schedule\(WAKE_HEARTBEAT_MS\); return lockedResult; \}/);
assert.match(runtime, /fetch_aborted_native_priority/);
assert.match(runtime, /memory_sync_paused_rate_limit/);
assert.match(runtime, /memory_sync_paused_network/);
assert.match(runtime, /lastHistoryFetchAt/);
assert.match(runtime, /PROJECT_STATE\.md/);
assert.match(runtime, /NIAKGPT PROJECT MEMORY — CHECKPOINT RÉCUPÉRÉ/);
assert.match(runtime, /Superseded/);
assert.match(runtime, /githubLogin/);
assert.match(runtime, /runtime\.connect\(\{name:'niakgpt:memory-github-login-v132'\}\)/);
assert.match(runtime, /extension_context_invalidated_reload_required/);
assert.match(runtime, /GITHUB_AUTH_UI_TIMEOUT_MS/);
assert.match(runtime, /setTimeout\(heartbeat,20_000\)/);
assert.match(runtime, /githubRepositories/);
assert.match(runtime, /githubConnectRepo/);
assert.match(runtime, /githubLogout/);
assert.match(runtime, /primeBootstrapQueue/);
assert.match(runtime, /ensureBootstrapQueued/);
assert.match(runtime, /queuedProjects/);
assert.match(runtime, /changes\[QUEUE_KEY\]/);
assert.match(runtime, /historyCompletedAt/);
assert.match(runtime, /historyQueueSchema/);
assert.match(runtime, /historyCacheSignature/);
assert.match(runtime, /conversationPage/);
assert.match(runtime, /ng90PeerBusy/);
assert.match(runtime, /peerBusy/);
assert.match(runtime, /memory_sync_paused_conversation/);
assert.match(runtime, /captureCurrentDomConversation/);
assert.match(runtime, /backgroundHistoryProbe/);
assert.match(runtime, /backgroundHistoryFetch/);
assert.match(runtime, /BACKGROUND_HISTORY_FETCH_GAP_MS = 6000/);
assert.match(runtime, /PRIORITY_HISTORY_FETCH_GAP_MS = 6000/);
assert.match(runtime, /PRIORITY_RETRY_MS = 1000/);
assert.match(runtime, /syncPriorityNow/);
assert.match(runtime, /projectArchivedBefore/);
assert.match(runtime, /CHAT_FETCH_RETRIES_PRIORITY = 2/);
assert.match(runtime, /CHUNK = 1000000/);
assert.match(runtime, /canonicalHash/);
assert.match(runtime, /compactProjectIndex/);
assert.match(runtime, /reconcileProjectArchive/);
assert.match(runtime, /archiveRecovered/);
assert.match(runtime, /niakgpt:memory-project-archive-v132/);
assert.match(runtime, /chatRetryLedger/);
assert.match(runtime, /fetchConversationResilient/);
assert.match(runtime, /chat-fetch-retry/);
assert.match(runtime, /queueWait/);
assert.match(runtime, /RATE_GUARD_KEY = 'niakgpt-project-memory-rate-guard-v119'/);
assert.match(runtime, /HISTORY_RATE_MAX = 10/);
assert.match(runtime, /ACCOUNT_RATE_COOLDOWN_MS = 15\*60\*1000/);
assert.match(runtime, /reserveHistoryRequest/);
assert.match(runtime, /markAccountRateLimit/);
assert.match(runtime, /accountRateLimitText/);
assert.match(runtime, /function normalizePid\(value\)/);
assert.match(runtime, /return m \? normalizePid\(m\[1\]\) : ''/);
assert.match(runtime, /captureSource:'live-dom'/);
assert.match(runtime, /complete:false/);
assert.match(runtime, /old&&Number\(old\.parts\|\|0\)>0&&Number\(old\.messages\|\|0\)>0/);
assert.match(runtime, /Number\(p\.count\|\|0\) > \(p\.chats\|\|\[\]\)\.length/);
assert.match(runtime, /name:projectName\(project\.name\|\|''\)/);
assert.match(runtime, /projectName = v =>/);
assert.match(runtime, /CACHE_BOOTSTRAP_LOCK/);
assert.match(runtime, /writeCachedBootstrap/);
assert.match(runtime, /async function recoverVaultCatalog\(force=false\)/);
assert.match(runtime, /await recoverVaultCatalog\(options\.force===true\)/);
assert.match(runtime, /vaultCatalogRecoveredAt/);
assert.match(runtime, /PROJECT_CATALOG\.json/);
assert.match(runtime, /server-index-authority/);
assert.match(runtime, /niakgpt:memory-catalog-v132/);
assert.match(runtime, /bootstrapMetadataOnly:true/);
assert.match(runtime, /bootstrapWritten:true/);
assert.match(runtime, /cachedOnly:true,historyDeferred:true/);
assert.doesNotMatch(runtime, /setTimeout\(\(\)=>\{ if\(!document\.hidden&&!busy\(\)\) bootstrap/,'Project Memory reconnect must not restart immediate backend bootstrap');

const ui = fs.readFileSync('project-memory-ui-v132.js','utf8');
assert.match(ui, /GITHUB PRIVÉ/);
assert.match(ui, /openWithoutMemory/);
assert.match(ui, /Réessayer avec le PAT/);
assert.match(ui, /Réessayer avec GitHub/);
assert.match(ui, /Recharger l’onglet puis réessayer/);
assert.match(ui, /Contexte NiakGPT expiré après une mise à jour/);
assert.match(ui, /Réessayer ce dépôt/);
assert.match(ui, /Coffre initialisé · snapshot local en attente/);
assert.match(ui, /Snapshot local GitHub écrit/);
assert.match(ui, /transport historique de fond indisponible : capture DOM seulement/);
assert.match(ui, /génération peer active : réseau mémoire suspendu/);
assert.match(ui, /conversations manquantes : réparation ciblée en attente/);
assert.match(ui, /reprise après 1 min de calme/);
assert.match(ui, /Forcer la synchro des chats/);
assert.match(ui, /Transfert initial prioritaire/);
assert.match(ui, /data-ng132-priority/);
assert.match(ui, /chat\(s\) temporairement indisponible\(s\)/);
assert.match(ui, /mise à jour remplace sa révision Git/);
assert.match(ui, /reprise restaurée/);
assert.match(ui, /Protection ChatGPT active/);
assert.match(ui, /10 lectures historiques\/minute/);
assert.match(ui, /niakgpt:control-center-rendered/);
assert.match(ui, /schedule\(0\);/);
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
assert.ok(fs.existsSync('visual-lab/project-memory-priority-sync-v116.mjs'),'Project Memory priority transfer gate missing');
assert.ok(fs.existsSync('visual-lab/project-memory-transient-fetch-v117.mjs'),'Project Memory transient-fetch isolation gate missing');
assert.ok(fs.existsSync('visual-lab/project-memory-index-reconcile-v118.mjs'),'Project Memory large-index reconciliation gate missing');
assert.ok(fs.existsSync('visual-lab/project-memory-rate-guard-v119.mjs'),'Project Memory account rate-limit guard gate missing');
assert.ok(fs.existsSync('visual-lab/native-chat-zero-background-v087.mjs'),'native chat zero-background gate missing');
const memoryLab=fs.readFileSync('visual-lab/project-memory-v132.mjs','utf8');
assert.match(memoryLab,/configured unsynced vault did not recreate persistent bootstrap queue/);
assert.match(memoryLab,/page\.locator\('\[data-ng132-memory\]'\)\.waitFor/);
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
assert.match(launcher,/github\.com\/settings\/apps\/new\?state=/);
assert.match(launcher,/niakgpt:memory-github-manifest-v132/);

console.log('PROJECT_MEMORY_V132_PASS');
