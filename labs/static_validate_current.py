#!/usr/bin/env python3
from pathlib import Path
import json
import re
import subprocess
import sys

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve()
errors=[]

def fail(message):
    errors.append(str(message))

def read(path):
    return (ROOT/path).read_text(encoding='utf-8')

def runtime(name):
    text=read('background-v100.js')
    match=re.search(rf"const\s+{name}\s*=\s*\[(.*?)\];",text,re.S)
    if not match:
        fail(f'missing {name}')
        return []
    return re.findall(r"['\"]([^'\"]+\.js)['\"]",match.group(1))

manifest=json.loads(read('manifest.json'))
version=manifest.get('version')
if manifest.get('manifest_version')!=3: fail('manifest_version != 3')
if version!='0.9.123': fail(f"version={version}")
if manifest.get('permissions')!=['storage','scripting','identity']: fail('permissions drift')
if manifest.get('host_permissions')!=['https://chatgpt.com/*','https://api.github.com/*','https://github.com/login/*','https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/*']: fail('host permissions drift')

# Release-facing documentation must never lag behind the installable manifest again.
readme=read('README.md')
readme_fr=read('README.fr.md')
changelog=read('CHANGELOG.md')
architecture=read('ARCHITECTURE.md')
if f'version-{version}-' not in readme: fail('README version badge drift')
if f'Current version: {version}' not in readme: fail('English README current version drift')
if f'Version actuelle : {version}' not in readme_fr: fail('French README current version drift')
if 'README.fr.md' not in readme: fail('English README missing French language link')
if 'README.md' not in readme_fr: fail('French README missing English language link')
if not changelog.startswith(f'# NiakGPT {version} '): fail('CHANGELOG latest release drift')
if f'architecture {version}' not in architecture: fail('ARCHITECTURE version drift')

static_js=[file for cs in manifest.get('content_scripts',[]) for file in cs.get('js',[])]
expected_static=[
    'boot-gate-v100.js','composer-continuation-v128.js','long-run-watchdog-v129.js',
    'pin-interaction-rescue-v129.js','project-menu-augment-v129.js','continuity-native-handoff-v129.js'
]
if static_js!=expected_static: fail(f'static runtime drift: {static_js!r}')
js_content_scripts=[cs for cs in manifest.get('content_scripts',[]) if cs.get('js')]
if any(cs.get('run_at')!='document_idle' for cs in js_content_scripts): fail('all NiakGPT JS content scripts must run at document_idle')
if any(cs.get('run_at')=='document_start' and cs.get('js') for cs in manifest.get('content_scripts',[])): fail('document_start JS forbidden after hydration regression')
expected_styles=[
    'theme-v08.css','polish-v081.css','chronology-v081.css','multitab-v083.css','governance-v085.css','activity-v086.css','control-center-v090.css','project-memory-v132.css','core-v090.css','profiles-v100.css','commands-v100.css','onboarding-v100.css','coach-v100.css','pin-folders-v096.css','sidebar-ux-v119.css','side-panels-v096.css','continuity-v100.css','interruption-guard-v119.css','visual-stability-v101.css','live-fixes-v104.css','sidebar-metadata-v118.css','sidebar-projects-authority-v112.css','project-chat-ux-v110.css','home-layout-v112.css','native-actions-v113.css','sidebar-actions-v123.css','chat-attention-v113.css','matrix-guardian-v112.css','performance-guard-v112.css','sidebar-icons-v114.css','native-da-v112.css','live-stability-v129.css','ux-v131.css','retro-loader-v097.css'
]
style_runtime=[file for cs in manifest.get('content_scripts',[]) for file in cs.get('css',[])]
if style_runtime!=expected_styles: fail(f'field-proven declarative style drift: {style_runtime!r}')
css_content_scripts=[cs for cs in manifest.get('content_scripts',[]) if cs.get('css')]
if any(cs.get('run_at')!='document_start' for cs in css_content_scripts): fail('declarative styles must remain at document_start')

hydration_gate=read('boot-gate-v100.js')
for token in ('waitComplete(5000)','waitStableHostIdentity(1600,8500)','waitForQuiet(1200,7000)','idleTurn(2200)','waitStableHostIdentity(500,2500)','__NIAKGPT_HOST_HYDRATED_100__','niakgpt:host-hydrated-v100'):
    if token not in hydration_gate: fail('field-proven 0.9.81/0.9.103 boot barrier incomplete '+token)
if hydration_gate.count('idleTurn(2200)') < 2: fail('field-proven scheduler fence lost one of its two idle turns')
for token in ('mainWorldReactProbe','waitReactHydrationOwnership','waitPostReactSchedulerDrain','niakgpt:probe-react-hydration','Object.getOwnPropertyNames','ng100HydrationProof'):
    if token in hydration_gate: fail('private React boot dependency reintroduced '+token)
if 'location.reload(' in hydration_gate: fail('boot gate must never reload ChatGPT')
for file in expected_static[1:]:
    src=read(file)
    for token in ('const init=()=>','window.__NIAKGPT_HOST_HYDRATED_100__',"window.addEventListener('niakgpt:host-hydrated-v100',init,{once:true})"):
        if token not in src: fail('pre-runtime hydration gate incomplete '+file+' '+token)

if not (ROOT/'visual-lab/hydration-barrier-v080.mjs').exists(): fail('field-proven scheduler barrier browser gate missing')
hydration_lab=read('visual-lab/hydration-barrier-v080.mjs')
for token in ('MessageChannel',"tick===7","tick===17",'first false-calm scheduler window','late MessagePort hydration settled','stable-node activation'):
    if token not in hydration_lab: fail('0.9.103 scheduler regression incomplete '+token)

known_good_path=ROOT/'visual-lab/tests/hydration-known-good-v113.spec.js'
if not known_good_path.exists(): fail('real MV3 known-good hydration regression missing')
known_good=known_good_path.read_text(encoding='utf-8')
for token in ('launchPersistentContext','--load-extension','MessageChannel',"tick===7","tick===17",'privateReactKeys:0','HYDRATION_KNOWN_GOOD_V113_CHECKPOINT PASS'):
    if token not in known_good: fail('real MV3 known-good regression incomplete '+token)
for token in ('__reactContainer','__reactFiber','memoizedState','isDehydrated'):
    if token in known_good: fail('known-good regression must not manufacture private React internals '+token)

background=read('background-v100.js')
for token in ('STYLE_RUNTIME','chrome.scripting.insertCSS','async function injectStyles','STYLE_INJECTED','async function probeReactHydration','niakgpt:probe-react-hydration',"world:'MAIN'"):
    if token in background: fail('broken 0.9.104+ hydration authority reintroduced '+token)

packager=read('tools/package-extension.mjs')
if "['MAIN_RUNTIME','ISOLATED_RUNTIME','OPTIONAL_RUNTIME']" not in packager: fail('package builder must use manifest-driven CSS/runtime contract')
if "'STYLE_RUNTIME'" in packager: fail('package builder must not depend on deferred STYLE_RUNTIME')

hydration_workflow=read('.github/workflows/live-stability-v129.yml')
if hydration_workflow.count('tests/hydration-known-good-v113.spec.js') < 3: fail('known-good regression must be tracked and run in Chromium and Brave')
if 'HYDRATION_KNOWN_GOOD_V113_CHECKPOINT PASS' not in hydration_workflow: fail('Brave fallback must require known-good checkpoint')

sidebar_projects=read('sidebar-projects-v121.js')
for token in ('safeInsert(parent,node,before=null)','dataset.ng121Retired','mountParentByBox','box.parentElement!==mountedParent','ng121MountPolicy','direct-once','retireStaleBox','placementTarget(root=navRoot(),box=null)','visiblePlacementNode','nativeSectionAfterPrimary','projectLinks(parent).length'):
    if token not in sidebar_projects: fail('sidebar no-reparent contract incomplete '+token)
for token in ('duplicates=[]','if(host===keepHost){a.remove();structural=true;continue;}'):
    if token not in sidebar_projects: fail('sidebar duplicate Project cleanup incomplete '+token)
if "section.parentElement.insertBefore(box,section)" in sidebar_projects or "tail.insertAdjacentElement('afterend',box)" in sidebar_projects or "root.appendChild(box)" in sidebar_projects: fail('Pins reparenting path reintroduced')
if not (ROOT/'visual-lab/dom-node-stability-v082.mjs').exists(): fail('DOM node stability regression gate missing')
if not (ROOT/'visual-lab/pins-primary-slot-v083.mjs').exists(): fail('Pins primary-slot regression gate missing')
if not (ROOT/'visual-lab/diagnostic-selection-v083.mjs').exists(): fail('Diagnostic selection regression gate missing')

main=runtime('MAIN_RUNTIME')
isolated=runtime('ISOLATED_RUNTIME')
optional=runtime('OPTIONAL_RUNTIME')
if main!=['page-bridge.js']: fail(f'MAIN_RUNTIME={main!r}')
required={
    'sidebar-metadata-v118.js','sidebar-projects-authority-v112.js','sidebar-projects-v121.js','pin-folders-v096.js','app-v090.js','sidebar-actions-v123.js',
    'home-layout-v112.js','analysis-bridge-v112.js','reclassify-deep-v112.js','matrix-guardian-v112.js','performance-guard-v112.js','turn-headers-v112.js','continuity-v112.js',
    'chat-state-authority-v113.js','breadcrumb-v113.js','chat-attention-v113.js','conversation-load-guard-v113.js','sidebar-icons-v114.js','continuity-consumer-v124.js','interruption-guard-v119.js',
    'conversation-scroll-guard-v133.js','ux-v131.js'
}
missing_runtime=sorted(required-set(isolated))
if missing_runtime: fail('current runtime missing: '+', '.join(missing_runtime))
if isolated and isolated[-1]!='ux-v131.js': fail('v131 UX reconciler must be the final isolated runtime authority')
if isolated.index('continuity-consumer-v124.js')<=isolated.index('continuity-v112.js'): fail('continuity v124 consumer must load after v112 producer')
continuity100=read('continuity-v100.js')
continuity112=read('continuity-v112.js')
continuity124=read('continuity-consumer-v124.js')
continuity129=read('continuity-native-handoff-v129.js')
if 'patchNewChat' in continuity100: fail('legacy v100 Project PATCH owner reintroduced')
if "method:'PATCH'" in continuity112: fail('v112 producer regained Project PATCH ownership')
if 'niakgpt:rpc-request' in continuity100: fail('v100 continuity producer regained network ownership')
if 'niakgpt:rpc-request' in continuity112: fail('v112 continuity producer regained network ownership')
for token in ("const DATA_LOCK='niakgpt-data-mutation-v100'","navigator.locks.request(DATA_LOCK"):
    if token not in continuity124: fail('v124 continuity assignment lock incomplete '+token)
if "const DATA_LOCK='niakgpt-data-mutation-v100'" not in continuity129: fail('native continuity handoff assignment lock missing')
if optional!=['project-memory-v132.js','project-memory-ui-v132.js']: fail(f'OPTIONAL_RUNTIME={optional!r}')
if any(x.startswith('project-memory-') for x in isolated): fail('Project Memory leaked into critical isolated runtime')
for forbidden in (
    'project-pins-v090.js','native-rename-v112.js','breadcrumb-v100.js','sidebar-authority-v107.js','sidebar-expando-guard-v108.js',
    'sidebar-ux-v119.js','live-fixes-v104.js','native-actions-controller-v119.js','native-actions-v113.js','composer-continuation-v128.js','long-run-watchdog-v129.js',
    'pin-interaction-rescue-v129.js','project-menu-augment-v129.js','continuity-native-handoff-v129.js'
):
    if forbidden in isolated: fail(f'legacy/conflicting runtime wired: {forbidden}')

recovery_overlays=(
    'native-ux-v125.js','native-ux-v126.js','continuity-limit-v125.js','continuity-live-v126.js',
    'sidebar-route-placement-v125.js','sidebar-truth-v127.js','native-ux-v125.css','native-ux-v126.css','sidebar-truth-v127.css','assets/mascot-v125.svg'
)
for file in recovery_overlays:
    if file in isolated: fail(f'0.9.71-0.9.73 recovery overlay wired: {file}')
    if (ROOT/file).exists(): fail(f'0.9.71-0.9.73 recovery overlay still shipped: {file}')

refs=set(main+isolated+optional+style_runtime)
for cs in manifest.get('content_scripts',[]):
    refs.update(cs.get('js',[]))
    refs.update(cs.get('css',[]))
refs.add(manifest.get('background',{}).get('service_worker',''))
background=read('background-v100.js')
for import_body in re.findall(r"importScripts\((.*?)\)",background,re.S):
    refs.update(re.findall(r"['\"]([^'\"]+\.js)['\"]",import_body))
refs.update((manifest.get('icons') or {}).values())
refs.update((manifest.get('action',{}).get('default_icon') or {}).values())
missing=sorted(x for x in refs if x and not (ROOT/x).exists())
if missing: fail('missing refs: '+', '.join(missing))
runtime_js='\n'.join(read(x) for x in sorted(refs) if x.endswith('.js') and (ROOT/x).exists())
if '/backend-api/f/conversation/resume' in runtime_js or 'conversation/resume' in runtime_js: fail('native ChatGPT conversation resume route referenced by NiakGPT runtime')
if re.search(r'(?:window|globalThis)\.fetch\s*=',runtime_js): fail('global fetch override reintroduced')

for file in sorted(x for x in refs if x.endswith('.js')):
    result=subprocess.run(['node','--check',str(ROOT/file)],capture_output=True,text=True)
    if result.returncode: fail(f'node --check {file}: {result.stderr.strip()}')
for file in sorted(x for x in refs if x.endswith('.css')):
    text=read(file)
    if text.count('{')!=text.count('}'): fail(f'CSS braces {file}')

hydration=subprocess.run(['node','tools/check-hydration-v100.mjs'],cwd=ROOT,capture_output=True,text=True)
if hydration.returncode:
    fail('hydration invariants: '+(hydration.stderr.strip() or hydration.stdout.strip()))

actions=read('sidebar-actions-v123.js')
for token in ('ng123-action-menu','ng123-rename-dialog','dataset.ng123Action','dataset.ng123Id','openMenu','renameChat','moveChat','nativeProjectRename','stopImmediatePropagation'):
    if token not in actions: fail('single-owner sidebar actions incomplete '+token)

metadata=read('sidebar-metadata-v118.js')
for token in ('cleanProjectName','normalizedProjects','renamed=false'):
    if token not in metadata: fail('canonical Project-name sanitation incomplete '+token)
selfheal_names=read('project-state-selfheal-v102.js')
for token in ('cleanProjectName','sanitizeCachedProjectNames','noms Projects canonisés'):
    if token not in selfheal_names: fail('Project recovery name sanitation incomplete '+token)
catalog=read('sidebar-projects-v121.js')
if 'placementAnchorNode' not in catalog or "data-ng112-native-projects" not in catalog:
    fail('v121 must preserve the hidden v112 native Projects host as a placement anchor')
for token in ('cleanProjectName',':scope > span,[class*="truncate" i]'):
    if token not in catalog: fail('Project label sanitation incomplete '+token)
for token in ('sessionOrder','armBootstrap','projectScrollMemory','pendingProjectScroll','userScrollIntentAt','userScrollEpoch','user-priority-armed','placeIntentEpoch=userScrollEpoch','niakgpt:sidebar-projects-reconcile','signalAuthorityReady','niakgpt:sidebar-projects-ready','authoritativeLaneSafe','column-fragment','laneUnsafe','surface NiakGPT unique','autorité v121 unique · natif masqué'):
    if token not in catalog: fail('single-authority Projects catalog/lane incomplete '+token)
selfheal=read('project-state-selfheal-v102.js')
for token in ('surface NiakGPT unique','NiakGPT autoritaire','nativePreferred:false','window.__NIAKGPT_FIND_SIDEBAR_V131__','a[href*="/g/g-p-"]','niakgpt:local-project-recovery-ready','hiddenSet','visibleIds'):
    if token not in selfheal: fail('single-authority local recovery incomplete '+token)
base_reclassify=read('reclassify-v101.js')
deep_reclassify=read('reclassify-deep-v112.js')
governance=read('project-governance-v090.js')
cache_guardian=read('cache-guardian-v100.js')
recovery_runtime=read('recovery-v100.js')
for token in ('hiddenProjectIds','hiddenIds.has(id)',"navigation.addEventListener('navigatesuccess',()=>schedule(1400))"):
    if token not in base_reclassify: fail('base classifier hidden-Project exclusion / SPA wake incomplete '+token)
for token in ('hiddenProjectIds','visibleProjects','!hiddenIds.has(p.id)',"navigation.addEventListener('navigatesuccess',()=>schedule(1800))"):
    if token not in deep_reclassify: fail('deep classifier hidden-Project exclusion / SPA wake incomplete '+token)
for token in ('hiddenProjectIds','hidden.has(p.id)','...hidden'):
    if token not in governance: fail('governance hidden-Project target exclusion incomplete '+token)
for token in ("const DATA_LOCK='niakgpt-data-mutation-v100'","navigator.locks.request(DATA_LOCK"):
    if token not in governance: fail('governance manual mutation lock incomplete '+token)
if 'async function autoResync()' in governance: fail('governance must not remain a second automatic classifier')
if 'scheduleAutoResync(' in governance: fail('governance automatic classifier scheduler reintroduced')
for token in ('hiddenProjectIds','hiddenSet','!hiddenSet.has(id)'):
    if token not in cache_guardian: fail('cache guardian hidden-Project preservation incomplete '+token)
for token in ('hiddenProjectIds:[...hiddenSet]','targetByOldId.get(oldId)||oldId','!hiddenSet.has(id)'):
    if token not in recovery_runtime: fail('structural recovery hidden-Project preservation incomplete '+token)
if 'hiddenProjectIds:[]' in cache_guardian: fail('cache guardian may not erase hidden Projects')
if 'hiddenProjectIds:[]' in recovery_runtime: fail('structural recovery may not erase hidden Projects')
for token in ('ng8-native-project','function suppressNative('):
    if token in selfheal: fail('local recovery regained native Projects visual authority '+token)
ux=read('ux-v131.js')
for token in ('columnFragment','genericChats','unlabelled DIV','same sidebar','laneMismatch','ux-v131-stale-lane','v121 then retires/recreates'):
    if token not in ux: fail('field sidebar outer-shell promotion / stale-lane handoff incomplete '+token)
ux_css=read('ux-v131.css')
for token in ('grid-column:1 / -1!important','place-self:auto stretch!important','box-sizing:border-box!important'):
    if token not in ux_css: fail('field sidebar full-lane geometry invariant missing '+token)
authority=read('sidebar-projects-authority-v112.js')
for token in ('[data-ng102-project]',"querySelectorAll('[data-ng8-pin],[data-ng102-project]", 'niakgpt:local-project-recovery-ready','niakgpt:sidebar-projects-ready','()=>apply()'):
    if token not in authority: fail('single-authority native suppression incomplete '+token)
for token in ('else if(document.body)','roots.add(document.body)'):
    if token not in authority: fail('SPA sidebar remount authority gap invariant missing '+token)
scroll_guard=read('conversation-scroll-guard-v133.js')
for token in ('conversationTail','ancestorScroller','scrollableNode','targetsConversationScroller','noteSendIntent','SEND_LATCH_MS','touchstart','touchPoint','event.shiftKey','editable(event.target)','ng133ScrollSticky','ng133ScrollRoot','remontée volontaire','generation-start','send-intent','ensureRoot','rootObserver','rootScrollEvent','pointerScrollActive','correction scroll native'):
    if token not in scroll_guard: fail('conversation scroll audit contract incomplete '+token)
if 'setInterval(' in scroll_guard: fail('conversation scroll guard must remain event-driven')
chat_state=read('chat-state-authority-v113.js')
for token in ('contextAlive','markDead','ng113Context','Promise.resolve(pending).catch','invalidated=e=>'):
    if token not in chat_state: fail('chat-state context invalidation guard incomplete '+token)
if "chrome.storage.local.set({[STATE_KEY]:state}).catch" in chat_state: fail('chat-state direct persist path can still throw synchronously after extension reload')
chat_attention=read('chat-attention-v113.js')
for token in ('contextAlive','markDead','ng113AttentionContext','Promise.resolve(pending).catch','invalidated=e=>'):
    if token not in chat_attention: fail('chat-attention context invalidation guard incomplete '+token)
if "setTimeout(()=>chrome.storage.local.set" in chat_attention: fail('chat-attention direct delayed storage path can still throw synchronously')
profiles=read('profiles-v100.js')
for token in ('persistProfile','contextAlive','Promise.resolve(pending).catch','invalidated=e=>'):
    if token not in profiles: fail('profiles context invalidation guard incomplete '+token)
if "chrome.storage.local.set({[KEY]:profile}).catch" in profiles: fail('profile persistence still calls stale extension API without a synchronous guard')
if re.search(r"recentUser[^\n]*return\s+null|user-priority:[^\n]*return\s+null",catalog): fail('recent user Project scroll must arm a restore snapshot, not return null')
if 'userIntentAt:userScrollIntentAt' not in catalog: fail('pending Project scroll snapshot lost user intent epoch binding')
continuity=read('continuity-v100.js')
for token in ('armComposerObserver','composerObserver','CONTINUITÉ NIAKGPT','injectPending'):
    if token not in continuity: fail('event-driven continuity injection incomplete '+token)

folders=read('pin-folders-v096.js')
for token in ('drawerScrollMemory','innerScroll','outerScroll','niakgpt:hydrate-project'):
    if token not in folders: fail('drawer scroll/hydration continuity incomplete '+token)
interrupt=read('interruption-guard-v119.js')
for token in ('continueFrom?.(chatId)',r'failed\s+to\s+fetch','persistedIncident','allowedType','type:allowedType','persistEpoch'):
    if token not in interrupt: fail('interruption recovery/security incomplete '+token)

parallel=read('composer-continuation-v128.js')
for token in ('↳ Suite en parallèle','LEGACY_HEADER','waiting','thinking','executing','nativeGenerationBusy','idleTriggerUntil','CANCEL_RX','prepareParallelContinuation','niakgpt:parallel-continue','isContentEditable','execCommand','cleanupAfterNativeSend','ng128ComposerCleanup','prefix-stripped'):
    if token not in parallel: fail('parallel continuation incomplete '+token)
if 'setInterval(' in parallel: fail('parallel continuation must remain event-driven')

memory_bg=read('project-memory-background-v132.js')
for token in ('memory_repository_must_be_private','verifiedPrivateAt','chrome.storage.session','niakgpt:memory-connect-v132','niakgpt:memory-commit-v132','git/refs/heads','initializeEmptyRepo',"method: 'PUT'",'github_initial_content_commit_failed','chrome.identity.launchWebAuthFlow','launchManifestRegistrationTab','chrome.tabs.create','github_auth_url_invalid_scheme','chrome.runtime.onConnect.addListener','app-manifests/','request_oauth_on_install','niakgpt:memory-github-connect-repo-v132','github_repository_not_authorized_for_vault','refresh_token','code_challenge','code_verifier','setup_url: clean(flow.installRedirect)','request_oauth_on_install: false','MAX_REF_RETRIES = 8','MAX_REF_BACKOFF_MS','PRIORITY_TREE_INLINE = true','PRIVATE_REPO_VERIFY_TTL_MS = 5 * 60 * 1000','PROJECT_ARCHIVE_SCAN_CONCURRENCY = 8','mergeProjectIndexPayload','projectArchiveSnapshot','git/blobs/',"cache: init.cache || 'no-store'",'const beforeUpdate = await getRef','queueCommit','refRace','message.priority === true',"content:item.content"):
    if token not in memory_bg: fail('Project Memory backend incomplete '+token)
if 'force: true' in memory_bg[memory_bg.find('git/refs/heads'):memory_bg.find('git/refs/heads')+5000]: fail('Project Memory must never force-push the vault branch')
interruption=read('interruption-guard-v119.js')
for token in ('nos\\s+systèmes\\s+effectuent\\s+quelques\\s+vérifications','connexion\\s+(?:perdue|interrompue)','assistantTail','settleRecovery','recoveryEpoch=0'):
    if token not in interruption: fail('interruption recovery contract incomplete '+token)
bridge=read('page-bridge.js')
if "interruption === 'network'" not in bridge or "interruption === 'verify'" not in bridge: fail('RPC interruption pause missing')
if 'native_conversation_quiet' not in bridge or 'chat-route-guard' not in bridge or 'ng90PeerChatActive' not in bridge or 'memoryPeerSafe' not in bridge or 'peerBusyPage' not in bridge or 'data-ng90-peer-busy' not in bridge or "projectConversationsRx.test(String(path||''))" not in bridge: fail('conversation quarantine / Project Memory idle-peer inventory exception missing')

server_index=read('server-index-v100.js')
for token in ('COLD_BOOTSTRAP_QUIET_MS=12*1000','quietRequirement','coldBootstrap','conversationPage()',"navigation.addEventListener('navigatesuccess',routeWake)",'memoryRepairIds','memoryBootstrap:memoryBootstrap===true','peerBlocked','projectIds'):
    if token not in server_index: fail('cold canonical index recovery incomplete '+token)
server_bootstrap=read('server-index-bootstrap-v124.js')
for token in ('COLD_BOOTSTRAP_QUIET_MS=12*1000','quietRequirement(raw)','conversationPage()'):
    if token not in server_bootstrap: fail('cold canonical bootstrap recovery incomplete '+token)

memory=read('project-memory-v132.js')
for forbidden in ('RATE_GUARD_KEY','HISTORY_RATE_MAX','ACCOUNT_RATE_COOLDOWN_MS','reserveHistoryRequest','cooldownUntil'):
    if forbidden in memory: fail('0.9.123 must not reintroduce the artificial Project Memory rate cap '+forbidden)
for token in ('memoryBootstrap: memoryBootstrap === true','PROJECT_STATE.md','conversations/','sync_already_running','injectOnNewChat','NIAKGPT PROJECT MEMORY — CHECKPOINT RÉCUPÉRÉ','canonicalUpdated','MEMORY_LOCK','CACHE_BOOTSTRAP_LOCK','autoOwner','niakgpt:tab-role-changed','primeBootstrapQueue','ensureBootstrapQueued','writeCachedBootstrap','bootstrapMetadataOnly:true','bootstrapWritten:true','cachedOnly:true,historyDeferred:true','queuedProjects','changes[QUEUE_KEY]','githubLogin','runtime.connect','extension_context_invalidated_reload_required','GITHUB_AUTH_UI_TIMEOUT_MS','setTimeout(heartbeat,20_000)','githubRepositories','githubConnectRepo','githubLogout','captureCurrentDomConversation',"captureSource:'live-dom'",'complete:false','projectName = v =>','peerBusy()','ACTIVE_HISTORY_RETRY_MS = 5000','PRIORITY_HISTORY_FETCH_GAP_MS = 900','PRIORITY_RETRY_MS = 1000','CHAT_FETCH_RETRIES_PRIORITY = 2','CHUNK = 1000000','canonicalHash','compactProjectIndex','reconcileProjectArchive','archiveRecovered','niakgpt:memory-project-archive-v132','activeHistoryMode','priorityWorkerMode','humanQuietRequired','retryDelay','syncPriorityNow','prioritySync','priorityKick','projectArchivedBefore','chatRetryLedger','fetchConversationResilient','retryPileRows','retryFailedChatsNow','manual:true',"holdReason:'rate-limit-manual'",'releaseQueueHold','Number(p.count||0) > (p.chats||[]).length',"name:projectName(project.name||'')"):
    if token not in memory: fail('Project Memory runtime incomplete '+token)
memory_ui=read('project-memory-ui-v132.js')
for token in ('Forcer la synchro des chats','Transfert initial prioritaire','data-ng132-priority','syncPriorityNow','Réessayer les chats en échec','data-ng132-retry-failed','Reprendre après restriction ChatGPT','Pile manuelle','mise à jour remplace sa révision Git','reprise restaurée'):
    if token not in memory_ui: fail('Project Memory priority UI incomplete '+token)
bridge=read('page-bridge.js')
if "d.memoryBootstrap !== true" not in bridge or 'conversation_detail_get_disabled' not in bridge: fail('Project Memory full-history bridge guard incomplete')
if 'project-memory-v132.css' not in style_runtime: fail('Project Memory UI CSS missing from declarative manifest styles')
if not (ROOT/'visual-lab/project-memory-v132.mjs').exists(): fail('Project Memory browser UX gate missing')
if not (ROOT/'visual-lab/project-memory-active-catchup-v115.mjs').exists(): fail('Project Memory active-chat catch-up gate missing')
if not (ROOT/'visual-lab/project-memory-priority-sync-v116.mjs').exists(): fail('Project Memory priority first-transfer gate missing')
if not (ROOT/'visual-lab/project-memory-transient-fetch-v117.mjs').exists(): fail('Project Memory transient-fetch isolation gate missing')
if not (ROOT/'visual-lab/project-memory-index-reconcile-v118.mjs').exists(): fail('Project Memory clobbered-index reconciliation gate missing')
if not (ROOT/'visual-lab/project-memory-manual-rate-hold-v121.mjs').exists(): fail('Project Memory real-429 manual-resume gate missing')
if not (ROOT/'visual-lab/native-chat-zero-background-v087.mjs').exists(): fail('native chat zero-background regression gate missing')
if not (ROOT/'visual-lab/field-regressions-v088.mjs').exists(): fail('0.9.88 combined field regression gate missing')
if not (ROOT/'visual-lab/user-reported-v133.mjs').exists(): fail('0.9.93 user-reported regression gate missing')
if not (ROOT/'github-vault-start.html').exists() or not (ROOT/'github-vault-start.js').exists(): fail('GitHub auth launcher missing')
if not (ROOT/'labs/project-memory-isolation-v133.mjs').exists(): fail('Project Memory isolation failure gate missing')
if not (ROOT/'.github/workflows/project-memory-v132.yml').exists(): fail('Project Memory workflow missing')
fixture=read('test/x.md')
if 'Synthetic test data only' not in fixture or 'No real user text.' not in fixture: fail('Project Memory public lab fixture is not explicitly synthetic')

watchdog=read('long-run-watchdog-v129.js')
for token in ('DEFAULT_SEGMENT_MS','6*60*1000+30*1000','↻ Reprise NiakGPT','LEGACY_MARKER','LEGACY_MESSAGE','AUTO_RX','knownAutoDraft','nativeStop','draft-protected','attemptResume','niakgpt:long-run-resume','CANCEL_RX','sendCandidate','waiting-send-control','clearAutoDraft'):
    if token not in watchdog: fail('long-run watchdog incomplete '+token)
if 'setInterval(' in watchdog: fail('long-run watchdog must use bounded timers, not polling intervals')
if "if(ed&&AUTO_RX.test(editorText(ed)))clearAutoDraft(ed)" in watchdog: fail('watchdog startup may clear user-modified protocol-looking draft')

ux=read('ux-v131.js')
for token in ('findSidebar','score(el)','repairPins','dataset.ng131Mounted','nativeProjectSection','dataset.ng131Surface','enhanceA11y','__NIAKGPT_FIND_SIDEBAR_V131__'):
    if token not in ux: fail('v131 UX reconciler incomplete '+token)
ux_css=read('ux-v131.css')
for token in ('#ng8-pins:not([data-ng131-mounted="1"])','body.ng8-ready{padding-right:0!important;padding-bottom:0!important}','#ng8-status{','#ng8-rail{','.ng131-coach-detail[hidden]','@media(prefers-reduced-motion:reduce)'):
    if token not in ux_css: fail('v131 UX visual authority incomplete '+token)

rescue=read('pin-interaction-rescue-v129.js')
for token in ('pointerdown','pointerup','replacementAction','clickSeen','fallback'):
    if token not in rescue: fail('pin interaction rescue incomplete '+token)
menu=read('project-menu-augment-v129.js')
for token in ('Personnaliser le Project','Nouveau chat dans ce Project','ng129-project-context','openProjectSettings'):
    if token not in menu: fail('Project menu augmentation incomplete '+token)
app=read('app-v090.js')
for token in ('panelSelectionActive','diagnosticSelectionHeld','syncDiagnosticSelectionLock','releaseDiagnosticSelection','selectionchange','diagSelectionGesture','sticky read/copy mode','S.diagTimer=setTimeout(retry,280)',"role()==='worker'","getManifest().version || '?'"):
    if token not in app: fail('app/client ownership or diagnostic stability incomplete '+token)
for token in ('ng8-native-project','syncNativeProjectSection(','function nativeProjectSection('):
    if token in app: fail('app fallback regained native Projects visual authority '+token)
boot=read('boot-gate-v100.js')
for token in ('niakgpt:boot-error-v100','github_pat_','access_token','[redacted]'):
    if token not in boot: fail('boot error redaction/diagnostic bridge incomplete '+token)
diagnostics=read('diagnostic-bus-v096.js')
for token in ('BOOT_ERRORS_KEY','niakgpt:boot-error-v100','worker + runtime propres','benignRuntimeNoise','ResizeObserver loop','completed with undelivered notifications'):
    if token not in diagnostics: fail('extension runtime error diagnostic incomplete '+token)
multitab=read('multitab-v090.js')
for token in ('window.__NIAKGPT_APP_090__','role===\'WORKER\'','openClientQuick'):
    if token not in multitab: fail('Quick Open fallback ownership incomplete '+token)

handoff=read('continuity-native-handoff-v129.js')
for token in ('nativeLimitControl','CONTINUITÉ NIAKGPT','markCurrentOut','writePending','finishProjectLock','sendButton'):
    if token not in handoff: fail('native continuity handoff incomplete '+token)

for gate in (
    'visual-lab/sidebar-session-ux-v123.mjs','visual-lab/tests/sidebar-human-ux-v123.spec.js',
    'visual-lab/parallel-continue-v128.mjs','visual-lab/tests/composer-continuation-runtime-v128.spec.js',
    'visual-lab/tests/live-stability-v129.spec.js','visual-lab/tests/long-run-composer-residue-v131.spec.js','visual-lab/tests/hydration-isolated-world-v106.spec.js','visual-lab/tests/hydration-document-root-v107.spec.js','visual-lab/ux-integral-v131.mjs'
):
    if not (ROOT/gate).exists(): fail('current browser-fixture UX gate missing '+gate)
workflow=read('.github/workflows/current-finalization.yml')
for token in ('sidebar-session-ux-v123.mjs','sidebar-human-ux-v123.spec.js','pins-primary-slot-v083.mjs','state-ux-v113.mjs','Chat-state authority + extension-context invalidation','Reported Pins placement — native controls stay above Projects','PRIMARY real Brave — FULL human sidebar','mcr.microsoft.com/playwright:v1.62.1-noble','project-memory-isolation-v133.mjs','live-fixes-context-v106.mjs','Project-context hot path · unrelated main churn stays ignored','global-observer-hotpath-v099.mjs','Global observer hot path · unrelated stream churn stays ignored','side-panels-owner-v096.mjs','Native side-panel owner · rail offset + BFCache recovery','hidden-project-classification-v099.mjs','Hidden Projects · never automatic classification targets','classification-authority-v099.mjs','Classification authority · governance never auto-PATCHes','continuity-authority-v099.mjs','Continuity authority · one shared-pending Project PATCH','deep-classification-v112.mjs','Deep classification · orphan chat to canonical Project'):
    if token not in workflow: fail('Current Finalization missing '+token)
project_switch=read('.github/workflows/project-switch-user-journey-v130.yml')
for token in ('sidebar-projects-authority-v112.js','project-state-selfheal-v102.js','reclassify-v101.js','reclassify-deep-v112.js','ux-v131.js','visual-lab/user-reported-v133.mjs'):
    if token not in project_switch: fail('Project-switch journey trigger coverage incomplete '+token)
live_stability=read('.github/workflows/live-stability-v129.yml')
if live_stability.count('tests/hydration-known-good-v113.spec.js') < 3: fail('known-good hydration regression must be tracked and execute in Chromium and Brave stability jobs')
for token in ('background-v100.js','hydration-known-good-v113.spec.js','HYDRATION_KNOWN_GOOD_V113_CHECKPOINT PASS','conversation-scroll-guard-v133.js','project-state-selfheal-v102.js','user-reported-v133.mjs','User-reported scroll + single Projects authority in Brave stable','/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'):
    if token not in live_stability: fail('Brave macOS field gate missing '+token)
if re.search(r'^\s*npx playwright install --with-deps\b',workflow,re.M): fail('Linux Finalization reintroduced apt --with-deps')
parallel_workflow=read('.github/workflows/parallel-continuation-v128.yml')
for token in ('parallel-continue-v128.mjs','composer-continuation-runtime-v128.spec.js','chromium, firefox, webkit','parallel-continuation-v128'):
    if token not in parallel_workflow: fail('Parallel continuation workflow missing '+token)
live_workflow=read('.github/workflows/live-stability-v129.yml')
for token in ('live-stability-v129.spec.js','long-run-composer-residue-v131.spec.js','hydration-known-good-v113.spec.js','HYDRATION_KNOWN_GOOD_V113_CHECKPOINT PASS','[1-9][0-9]* passed','Brave stable','chromium'):
    if token not in live_workflow: fail('Live stability workflow missing '+token)
ux_workflow=read('.github/workflows/ux-integral-v131.yml')
for token in ('ux-integral-v131.mjs','chromium, firefox, webkit','screenshot UX','mcr.microsoft.com/playwright:v1.62.1-noble'):
    if token not in ux_workflow: fail('UX integral v131 workflow missing '+token)

package_tool=read('tools/package-extension.mjs')
for token in (
    'sidebar-actions-v123.js','sidebar-actions-v123.css','native-actions-controller-v119.js','native-actions-v113.js','composer-continuation-v128.js',
    'long-run-watchdog-v129.js','pin-interaction-rescue-v129.js','project-menu-augment-v129.js','continuity-native-handoff-v129.js','live-stability-v129.css',
    'ux-v131.js','ux-v131.css','project-memory-background-v132.js','project-memory-v132.js','project-memory-ui-v132.js','project-memory-v132.css','github-vault-start.html','github-vault-start.js'
):
    if token not in package_tool: fail('package runtime policy missing '+token)

if not (ROOT/'TESTING_TRUTH.md').exists(): fail('testing truth contract missing')
if errors:
    print('STATIC_CURRENT_FAIL')
    for error in errors: print('- '+error)
    raise SystemExit(1)
print('STATIC_CURRENT_PASS')
