## 0.9.102 — preuve de complétude du coffre, pas seulement d'activité

Le recheck du dépôt privé a compté **316 conversations connues pour 310 seulement cachées**, **0 fichier sous `conversations/`** et **16 noms de Projects pollués sur 17**. Le cas critique était NiakGPT : `indexed=true`, mais `30 connus / 24 cachés`. Cela prouve qu'un simple flag `indexed` ne peut pas servir de preuve de complétude.

1. `project-memory-wake-v086.mjs` démarre avec `indexed=true`, `count=2` et un seul chat en cache. Sans la correction, le second chat n'est jamais demandé ; avec la correction, le count-gap force une réparation avant archive.
2. Le test exige ensuite que le second chat existe dans l'index privé avec `messages>0`, `parts>0` et `complete=true`.
3. `native-chat-zero-background-v087.mjs` vérifie le chemin réseau complet : un listing Project ordinaire reste bloqué par un peer chat visible, mais le même listing explicitement `memoryBootstrap:true` est autorisé lorsque ce peer est inactif et rebloqué dès `ng90PeerBusy=1`.
4. Si un count-gap ne se ferme pas, la queue n'est plus supprimée : elle reste en `inventory-incomplete` et se reprogramme.
5. Le root `PROJECTS.json`, les indexes Project et le cache self-heal doivent tous supprimer les décorations d'UI avant persistance.

## 0.9.101 — preuve terrain du coffre : écrire n’était pas archiver

Le recheck du dépôt privé a supprimé l’hypothèse « il faut juste attendre ». Les commits `cached bootstrap inventory` continuaient, mais le Project NiakGPT possédait 24 conversations indexées avec `parts=0`, `messages=0`, aucun dossier `conversations/`, et son nom avait dérivé vers une chaîne contenant icône, dates et compteurs NiakGPT.

1. Le scénario Project Memory conserve maintenant un faux coffre distant au fil des commits. Après une vraie archive, un nouveau bootstrap cache doit laisser `parts/messages > 0` et `bootstrapMetadataOnly=false`.
2. Sur une route de conversation, le lab place deux messages visibles dans le DOM et appelle la synchronisation. Il exige un `part-001.md` contenant les deux textes et **aucune augmentation du compteur RPC ChatGPT**.
3. Cette capture DOM est explicitement partielle (`complete=false`, `historyPartial=true`, `captureSource=live-dom`) : le worker backend hors chat reste donc autorisé à la remplacer par la version canonique.
4. Le test bridge conserve la quarantaine absolue du chat courant et de tout trafic ordinaire. Depuis une page hors chat, seul un GET conversation marqué `memoryBootstrap:true` peut passer à côté d’un peer visible mais inactif ; `ng90PeerBusy=1` referme immédiatement cette exception.
5. La sanitation reproduit le libellé pollué `▤▤One21/09 [1]›` et exige `One` dans `project.json` et `index.json`.

## 0.9.100 — géométrie terrain réelle + réveil SPA déterministe

La capture terrain a été transformée en scénario rouge plutôt qu’en correctif CSS supposé. Le fixture monte d’abord v121 dans un `nav` sémantique qui n’occupe que la colonne droite d’un shell gauche générique : avant v131, le test exige explicitement le défaut (< 60 % de la largeur) afin de prouver que le scénario reproduit bien le bug.

1. La première CI a montré que le fixture ne donnait pas assez d’autorité au `nav`; il a été corrigé sans toucher au produit.
2. La CI suivante a isolé le vrai défaut produit : v131 retrouvait correctement le shell externe, mais `#ng8-pins` restait dans le fragment étroit. Une première correction v121 a rendu cette ancienne lane invalide ; la CI a pourtant encore échoué, ce qui a prouvé qu’aucun reconcile n’était déclenché lorsque l’ancien parent restait simplement descendant du nouveau shell.
3. Le handoff est désormais complet sans double autorité : v131 détecte le `laneMismatch` sur la surface déjà montée et émet seulement `niakgpt:sidebar-projects-reconcile`; v121 reste l’unique propriétaire du placement, vérifie la **lane autoritaire**, retire le nœud direct-once obsolète et crée un nouveau bloc dans le host pleine largeur. Aucun reparent du nœud React-adjacent vivant n’est réintroduit.
4. Le même scénario doit ensuite obtenir > 90 % de largeur utile, un alignement gauche, rester avant Chats et conserver les Chats génériques hors de `#ng8-pins`.
5. Le classifieur terrain est lancé pendant une conversation et son premier timer est volontairement laissé expirer. Le test quitte ensuite le fil par `navigation.navigatesuccess` sans `popstate` : le classement doit reprendre seul.
6. Les index/classifieurs normal et profond ont donc une reprise SPA explicite, verrouillée aussi par les contrats statiques.

## 0.9.99 — troisième passe, preuves de non-régression supplémentaires

La troisième passe a volontairement remis en cause la 0.9.98 après son merge.

1. Un contrat statique a été rendu rouge en déclarant `sidebar-ux-v119.js` legacy : la CI a confirmé qu’il était toujours injecté comme runtime critique alors que v121 rendait son exécution inerte. Il a été retiré de l’injection et du ZIP.
2. Le même procédé a confirmé `live-fixes-v104.js` comme second propriétaire actif des panneaux natifs. `side-panels-v096.js` possède maintenant seul cette surface, y compris l’offset du rail et la reprise BFCache.
3. `live-fixes-context-v106.mjs` fait muter le contenu principal d’une conversation sans rapport avec Projects et exige zéro balayage global de migration ; un remount réel du breadcrumb doit en revanche encore resynchroniser le Project.
4. `side-panels-owner-v096.mjs` exige la détection du panneau, l’offset exact du rail, l’absence de mutation pendant `pagehide` et la reprise après `pageshow.persisted`.
5. `hidden-project-classification-v099.mjs` vérifie qu’un Project masqué n’est ciblé ni par le classifieur normal ni par le deep-classifier, et que le self-heal ne le réinjecte pas dans `coreProjectIds`.
6. `global-observer-hotpath-v099.mjs` fait churner uniquement `<main>` et exige zéro recherche globale de sidebar/Control Center, puis remonte réellement la sidebar et le Control Center pour vérifier que les observers filtrés restent fonctionnels.
7. `classification-authority-v099.mjs` accélère volontairement les anciens délais de gouvernance dans un fixture et exige zéro PATCH automatique ; le source courant doit en plus utiliser `niakgpt-data-mutation-v100` pour le nettoyage manuel et ne plus contenir `autoResync()`.
8. `continuity-authority-v099.mjs` charge v100, v112 et v124 ensemble avec le même pending, le consomme sur la page Project puis simule l’arrivée du nouveau chat. Il exige exactement **un** PATCH `gizmo_id`, provenant de v124 sous `niakgpt-data-mutation-v100`, un lock de gouvernance persistant et aucun résidu de pending/lock.

## 0.9.98 — récupération locale isolée des Chats + classement multi-lots

Le follow-up 0.9.98 part d’un test rouge ajouté avant le correctif : en mode cache local uniquement, une section Chats contenant plusieurs conversations et un bouton « Afficher plus » recevait la classe legacy de masquage Projects. Chromium a reproduit le défaut avec `true !== false` dans `falseMirrorRecovery`.

Le correctif retire au self-heal toute autorité visuelle concurrente. Il rend la surface NiakGPT disponible puis émet synchroniquement l’évènement de récupération ; v112 reste seul propriétaire du masquage structurel des Projects natifs. Les validations statiques interdisent désormais le retour de `function suppressNative(` ou de nouveaux `classList.add('ng8-native-project…')` dans le self-heal.

Le scénario terrain exact conserve séparément les Chats natifs et leur contrôle « Afficher plus », puis vérifie neuf conversations non organisées : les huit premières et la neuvième doivent toutes être classées automatiquement vers le Project canonique, sans lecture complète de conversation. Le lab utilise aussi l’ordre de chargement de production v112 → v121 → self-heal → v131.

## 0.9.97 — vérité terrain : Projects unique + Chats séparés + reclassement

Le scénario terrain ne valide plus uniquement des sélecteurs abstraits. Il construit une sidebar dans laquelle ChatGPT expose un sous-layout à deux colonnes, des liens Projects absolus et une liste Chats indépendante — la combinaison qui reproduit la capture utilisateur.

Le test exige simultanément : une seule surface Projects visible, un bloc NiakGPT couvrant plus de 90 % de la largeur de la sidebar, l’absence de Chats génériques dans #ng8-pins, la conservation de ces Chats sous le bloc, la promotion des IDs g-p-* en inventaire canonique, la reconstruction des Projects principaux puis un reclassement automatique par PATCH sans GET d’historique complet.

La classification ne contourne pas la quarantaine réseau : aucune mutation NiakGPT du backend ChatGPT n’est lancée pendant qu’une conversation est la surface active. Le rattrapage reprend automatiquement dès qu’une surface hors conversation est active.

## 0.9.96 — vérité terrain : auth invalidée + corrections de scroll natives tardives

- Le scénario GitHub utilise le vrai runtime Project Memory et force `chrome.runtime.connect()` à lever synchroniquement `Extension context invalidated.`. Le test échoue si une promesse non gérée apparaît, si le bouton reste désactivé ou si « Ouverture de GitHub… » reste affiché.
- Le scénario de scroll attend volontairement qu’une correction native arrive **après** les mutations du stream et après l’ancienne fenêtre de protection ; le fil doit encore finir à moins de 8 px du bas.
- Un second scénario bascule le propriétaire du scroll de `#shell` vers `#outer` sans remplacer `main`. Le diagnostic doit annoncer le nouveau root et le nouveau scroller doit rester au bas.
- Ces scénarios produisent des screenshots dans `visual-lab/artifacts` et Current Finalization les publie dans l’artefact terrain.

## 0.9.95 — terrain Brave/macOS : scroll réel + autorité Projects unique

- Le test terrain de scroll utilise désormais un scroller **ancêtre de `main`**, comme sur le shell ChatGPT réel, et contient volontairement un faux gros descendant non scrollable.
- Au clic Envoyer, le fixture simule la régression observée : une frame native replace le scroll vers le haut, puis le stream grandit et deux autres frames natives tentent encore de remonter le fil. Le résultat final doit rester à moins de 8 px du bas.
- Le même scénario vérifie toujours la liberté de lecture vers le haut, le retour en bas, la sidebar indépendante, le clavier du composer et le tactile.
- Le recovery local exige maintenant **une surface NiakGPT visible et la surface Projects native masquée**, avant et après remount React, sans RPC ChatGPT dans le chat actif.
- `.github/workflows/live-stability-v129.yml` exécute directement `user-reported-v133.mjs` avec le binaire **Brave stable macOS**. Un simple test Chromium synthétique ne suffit plus comme preuve terrain.

## 0.9.95 — ref GitHub fraîche + préflight update-ref

- Le contrat Project Memory exige `cache: 'no-store'` sur les lectures GitHub de ref.
- Le scénario non-fast-forward continue à forcer deux 422 successifs puis vérifie que chaque nouveau commit a le parent GitHub réellement courant.
- Un second scénario fait avancer la branche **après** la création du commit mais **avant** PATCH : les deux premiers commits doivent être abandonnés/rebâtis et un seul PATCH final doit être émis.
- Le validateur interdit tout `force: true` sur le chemin update-ref.
- Le gate Chromium des régressions terrain injecte `ResizeObserver loop completed with undelivered notifications.` dans le journal runtime : le diagnostic doit rester propre. Il injecte ensuite une vraie erreur synthétique, qui doit rester visible.

## 0.9.94 — audit ciblé après validation 0.9.93

- `visual-lab/user-reported-v133.mjs` reproduit maintenant un faux positif volontaire : trois chats récents portent exactement les noms de trois Projects locaux, sans aucune vraie surface Projects native. Le fallback doit rester visible.
- Le scénario de génération ajoute un grand conteneur non scrollable contenant un faux turn assistant ; il ne doit jamais devenir l’autorité de scroll.
- Le même scénario vérifie que la molette de sidebar n’altère pas le suivi, qu’ArrowUp dans le composer reste une édition, que le tactile libère/réarme correctement le suivi et que `Shift+Espace` libère la lecture vers le haut.
- Ces cas sont exécutés dans la matrice Chromium / Firefox / WebKit de Current Finalization.
- `state-ux-v113.mjs` invalide maintenant volontairement `chrome.runtime.id` après avoir armé le persist différé du chat-state et fait jeter `Extension context invalidated.` par `chrome.storage.local.set`. Le module doit passer en `data-ng113-context=inactive` et zéro `pageerror` doit être observé.
- Ce scénario n’est plus un test dormant : `Current Finalization` l’exécute explicitement dans la matrice Chromium / Firefox / WebKit.

## 0.9.93 — régressions terrain Projects / classement / scroll génération

- `visual-lab/user-reported-v133.mjs` vérifie Chromium, Firefox et WebKit.
- Le scénario recovery part de Projects `dom-p-*` sans identités serveur, avec une liste native portant les mêmes noms : le bloc local doit rester monté mais caché, et une seule surface Projects reste visible.
- Le scénario classement utilise un chat non assigné vieux de 30 jours et un index canonique complet : un PATCH unique doit l’affecter au bon Project, avec diagnostic `historique complet`.
- Le scénario scroll simule une réponse qui grandit pendant `executing` : le bas reste suivi, une molette vers le haut libère le scroll, puis le retour en bas réarme le suivi.

## 0.9.93 — conflit GitHub non-fast-forward reproduit

- Le contrat Project Memory force deux réponses GitHub 422 `Update is not a fast forward` successives.
- Chaque nouvelle tentative doit relire la tête de `main` et créer son commit avec ce nouveau parent avant de déplacer la ref.
- Un 422 sans sémantique non-fast-forward reste une erreur et n’est pas absorbé.

## 0.9.92 — morphologie terrain sans titre Projects

- Le fixture `field-sidebar-cache-recovery-v090.mjs` reproduit maintenant une sidebar où des chats récents précèdent des lignes Project sans titre « Projects » et sans href Project.
- Le test exige que les Pins soient réellement siblings avant le bloc natif et que `data-ng121-placement` vaille `native-projects`, y compris après remount React.
- La validation statique courante interdit explicitement à NiakGPT de référencer `/backend-api/f/conversation/resume`; un 410 sur cette route vient donc du flux natif ChatGPT, pas d’un appel NiakGPT.

## 0.9.91 — remount React tardif réellement reproduit

- Le lab `field-sidebar-cache-recovery-v090.mjs` charge désormais aussi `ux-v131.css/js` dans l’ordre du runtime de production, vérifie que le fallback est réellement visible, remplace ensuite toute la sidebar par un clone sans `#ng8-pins` pour reproduire un remount React tardif, puis exige la recréation automatique des 5 Projects locaux au-dessus de Projects/Chats avec zéro RPC ChatGPT.
- Le même scénario poursuit jusqu’à l’upgrade canonique et vérifie alors le passage propre à l’autorité NiakGPT.
- Le diagnostic `projects-authority` distingue maintenant un fallback local volontaire d’un bloc Pins réellement absent.


## 0.9.90 — preuve terrain local-cache + privacy

- `visual-lab/field-sidebar-cache-recovery-v090.mjs` reproduit l’état terrain « cache local présent / gouvernance canonique absente / lignes Projects natives sans liens `g-p-*` » et exige : fallback 5 Projects conservé, Pins avant Projects puis Chats, surface native visible, zéro RPC ChatGPT, puis bascule vers l’autorité NiakGPT après upgrade canonique.
- `tools/check-public-tree-privacy-v134.mjs` scanne tout l’arbre texte suivi par Git et échoue en présence de marqueurs privés connus, d’e-mails réels, de chemins utilisateur locaux ou de secrets plausibles.
- Ces tests restent synthétiques : ils prouvent le contrat du code NiakGPT, pas la stabilité future du DOM/transport du service ChatGPT sur un compte authentifié réel.
# NiakGPT testing truth

NiakGPT uses several evidence levels. Their names must describe what they **actually prove**.

## Evidence levels

### 1. Static/runtime contract

Syntax, manifest permissions, runtime order, source invariants, documentation/version consistency, repository hygiene and packaging.

This proves the release is internally coherent. It does not prove the current ChatGPT production DOM.

### 2. Browser fixture interaction

Chromium, Firefox and WebKit exercise deterministic ChatGPT-shaped fixtures.

These tests prove interaction logic, geometry, accessibility, remount/BFCache recovery and cross-engine behavior against those fixtures.

### 3. MV3 extension-on-fixture runtime

The actual unpacked Manifest V3 extension is loaded into real Chromium/Brave processes while ChatGPT document/network behavior is controlled by the test fixture.

This proves bootstrap, content-script order and browser integration. It still does not prove compatibility with every current authenticated ChatGPT revision.

### 4. Authenticated live evidence

Only a real authenticated ChatGPT session, observed manually or through an explicitly authenticated live test, can certify the current production DOM.

CI intentionally has no user authentication and must never label fixture evidence as live production certification.

## Release rule

A user screenshot or reproducible authenticated behavior that contradicts a green fixture is a **release-blocking regression signal**.

The correct response is:

1. reproduce the observed production shape in a deterministic fixture;
2. fix the runtime;
3. make the new regression test pass;
4. re-run the relevant cross-engine/MV3 matrix.

Do not weaken the fixture to match the bug.

## Legacy naming warning

Historical filenames/workflow labels containing words such as `human`, `real extension` or `live` do not upgrade the evidence level by themselves.

Evidence classification depends on what the test really loads.

## Current high-value gates

The 0.9.76/v131 line explicitly covers:

- verified left-sidebar placement;
- Project catalogue scroll ownership and active user-scroll priority;
- Project/chat action remounts and hit-testing;
- BFCache observer recovery;
- parallel continuation residue cleanup;
- user-modified draft protection;
- long-run watchdog safety;
- quiet home-shell behavior;
- Chromium/Firefox/WebKit experience;
- Linux/Windows/macOS runtime paths;
- focused macOS Brave stable MV3 behavior.

## Recovery baseline rule

The 0.9.71–0.9.73 overlay stack is not a stable baseline. A recovery release must not reintroduce `native-ux-v125/v126`, `continuity-limit-v125`, `continuity-live-v126`, `sidebar-route-placement-v125` or `sidebar-truth-v127` without a new authenticated validation cycle.

Fixture CI alone cannot authorize their return.

## Native chat network safety baseline — 0.9.88

A synthetic browser lab is **not** proof that an authenticated production ChatGPT account will never encounter a platform-side network incident. It can, however, prove what NiakGPT itself does or does not emit.

The mandatory regression baseline is therefore explicit:

- loading NiakGPT on a `/c/{id}` conversation must emit **zero NiakGPT ChatGPT-backend traffic**, not merely zero automatic GET;
- foreground Project reads and NiakGPT-owned PATCH/POST/DELETE are also quarantined for the full lifetime of a visible conversation;
- Project Memory, server indexing, recovery, governance and deep analysis cannot bypass that route guard;
- a visible peer conversation applies the same absolute quarantine in other ChatGPT tabs/windows;
- off-chat foreground Project reads remain possible only when no visible peer conversation and no native busy/verification/network state exists;
- CI success must never be described as authenticated live-field proof unless an authenticated live test actually ran.

The field reports that motivated 0.9.87 and 0.9.88 is treated as higher-priority evidence than a green synthetic gate when the two disagree.

## Combined field regression — 0.9.88

`visual-lab/field-regressions-v088.mjs` reproduces the three field failures together: an expanded native Project subtree, absolute current/peer conversation network quarantine, and immediate GitHub files from local cache. Green fixture evidence still does not replace an authenticated field check.
