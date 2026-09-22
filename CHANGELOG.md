# NiakGPT 0.9.111 — ordre de boot React et drainage scheduler tardif

- **Régression terrain confirmée après 0.9.110** : le même `Minified React error #418` sur `HTML`, avec une longue chaîne `MessagePort`, reste observable et le rail droit NiakGPT ne se monte toujours pas.
- **Cause racine** : 0.9.110 a conservé la preuve HostRoot mais a raccourci la barrière temporelle historique de 0.9.81 à une courte stabilité/quiet window. Un HostRoot peut paraître settled alors que React possède encore des commits différés dans son scheduler.
- **Correction d’architecture** : une preuve HostRoot positive est suivie de 1,6 s d’identité `nav/main/composer` stable, d’une vraie fenêtre sans mutation de 1,2 s, de deux tours idle, de frames, puis d’une comparaison stricte des identités hôtes et d’une nouvelle preuve MAIN-world du HostRoot courant.
- **Quiet window réelle** : `waitForQuiet()` observe désormais aussi les mutations d’attributs et distingue une vraie période calme d’un simple timeout maximal ; un timeout ne vaut plus preuve de stabilité.
- **Fallback ordonné** : si les internals React privés sont indisponibles, le même drainage scheduler/shell est tenté avant le fallback par interaction native trusted.
- **Régression MV3 dédiée** : `hydration-scheduler-drain-v111.spec.js` démarre avec un HostRoot déjà settled, puis injecte encore des commits tardifs via `MessageChannel`, dont un #418 `HTML`, et exige zéro mutation NiakGPT avant la fin réelle du scheduler.
- **Chromium + Brave stable** : la nouvelle régression est branchée dans les deux jobs Live Stability avec le checkpoint `HYDRATION_SCHEDULER_DRAIN_V111_CHECKPOINT PASS`.

# NiakGPT 0.9.110 — récupération React #418 sans blocage permanent

- **Régression terrain confirmée après 0.9.109** : réinstallation effectuée, `Minified React error #418` toujours visible et rail NiakGPT toujours absent.
- **Cause racine du deadlock NiakGPT** : le gate exigeait `memoizedState.isDehydrated === false` au sens littéral. Après un #418 récupérable, React peut abandonner l’hydratation SSR et rendre côté client ; le HostRoot courant peut alors ne plus exposer du tout `isDehydrated`. 0.9.109 interprétait cet état récupéré comme « pas encore hydraté » et pouvait rester fermé indéfiniment.
- **Deuxième contrainte trop stricte supprimée** : l’ownership React de `<html>` + `<body>` reste diagnostique mais n’est plus nécessaire pour démarrer. Le HostRoot courant + au moins deux identités hôtes React stables font autorité.
- **Current-root normalization** : le probe normalise systématiquement `stateNode.current` avant d’évaluer l’état d’hydratation afin de ne pas suivre un alternate obsolète.
- **Fallback utilisateur fiabilisé** : l’interaction native est mémorisée dès l’évaluation du content script ; un clic/keypress intervenu pendant les probes n’est plus perdu.
- **Régression MV3 dédiée** : `hydration-recovery-v110.spec.js` simule `isDehydrated:true` puis un rendu client avec `memoizedState={}`, sans expando React sur `<html>/<body>`, et exige zéro mutation avant recovery puis le montage réel du rail.
- **Chromium + Brave stable** : la nouvelle régression est exécutée dans les deux jobs Live Stability avec `HYDRATION_RECOVERY_V110_CHECKPOINT PASS`.

# NiakGPT 0.9.109 — résolution HostRoot par chaîne Fiber réelle

- **Régression terrain persistante** : après 0.9.108, l’utilisateur observe encore le #418 React et surtout l’absence de la sidebar NiakGPT dans son ChatGPT authentifié.
- **Limite des tests précédents** : les fixtures MV3 plaçaient toujours `__reactContainer$…` sur `document/html/body`. Elles validaient donc notre barrière, mais pas le cas où ChatGPT n’expose plus ce marqueur à cet emplacement.
- **Correction d’architecture** : le probe MAIN-world sait désormais retrouver le HostRoot en remontant la chaîne `.return` depuis les vrais `__reactFiber$…` attachés à `<html>`, `<body>`, la navigation, `main` ou le composer. Le conteneur React reste une voie rapide, mais n’est plus une condition obligatoire.
- **Preuve toujours stricte** : le runtime ne démarre que si un HostRoot est réellement trouvé, `isDehydrated === false`, aucune racine candidate n’est encore déshydratée, React possède `<html>` + `<body>`, au moins deux identités hôtes sont possédées, puis une seconde lecture confirme le même état.
- **Non-régression dédiée** : `hydration-fiber-root-v109.spec.js` ne crée aucun `__reactContainer$…`. Le HostRoot n’est accessible que par les chaînes Fiber, reste déshydraté 6,5 s, puis le test exige `react-fiber-root-settled` et le rail réel.
- **Diagnostic terrain** : si la preuve échoue encore, NiakGPT écrit un snapshot compact `niakgpt-hydration-probe-v109` en sessionStorage et logue `[NiakGPT hydration blocked]` sans muter le DOM.
- **Test live GitHub** : une tentative directe contre `chatgpt.com` a été ajoutée séparément ; GitHub Actions est bloqué par Cloudflare avant l’app réelle, donc ce signal n’est pas utilisé comme preuve produit.

# NiakGPT 0.9.108 — preuve React positive, aucun bypass heuristique

- **Complément indispensable à 0.9.107** : l’ownership React de `<html>` + `<body>` était bien vérifié sur le chemin full-document, mais un ancien raccourci restait actif lorsque `data-build` et `window.__reactRouterContext` étaient absents.
- **Cause du faux vert** : le probe MAIN-world calculait `fullDocument` depuis ces deux sentinelles volatiles ; `fullDocument:false` déclenchait `main-world-legacy-host` et autorisait NiakGPT sans vérifier HostRoot, HTML/BODY ou ownership hôte.
- **Correction de cause racine** : le probe ne renvoie plus `fullDocument`. Le gate exige maintenant simultanément `containerFound`, `rootSettled`, `documentRootOwned` et au moins deux identités hôtes possédées par React, puis reconfirme la même preuve après deux frames.
- **Régression terrain exacte** : le test MV3 réel retire `data-build` et `window.__reactRouterContext`, maintient le HostRoot à `isDehydrated:true` pendant 6,5 s et exige encore zéro preuve NiakGPT / zéro rail après 5 s, puis un démarrage normal après settlement.
- **0.9.107 conservée et renforcée** : le test document-root dédié continue d’exiger zéro mutation tant que React ne possède pas explicitement `<html>` et `<body>`.
- **Fixtures fonctionnelles clarifiées** : les tests post-hydratation simulent désormais explicitement un HostRoot déjà réglé au lieu de dépendre d’un bypass produit.
- **Le 410 `/backend-api/f/conversation/resume` reste natif ChatGPT** : la route demeure absente et interdite dans le runtime NiakGPT.

# NiakGPT 0.9.107 — ownership HTML/BODY avant toute mutation

- **Régression terrain encore présente après 0.9.106** : ChatGPT remonte toujours `Minified React error #418` avec `args[]=HTML`.
- **Angle mort identifié** : le probe MAIN-world validait un HostRoot `isDehydrated === false` et au moins deux nœuds fonctionnels (`nav/main/composer`), mais ne vérifiait pas que React avait déjà revendiqué la racine document elle-même.
- **Cause corrigée au bon niveau** : sur le renderer full-document, NiakGPT exige désormais l’ownership React explicite de `<html>` **et** `<body>`, en plus du HostRoot stabilisé et des nœuds hôtes, puis reconfirme cette preuve après deux frames.
- **Frontière zéro-touch renforcée** : tant que HTML/BODY ne sont pas possédés par React, aucun `data-ng*`, aucune classe NiakGPT, aucun CSS et aucun shell NiakGPT ne sont autorisés.
- **Non-régression MV3 réelle** : `hydration-document-root-v107.spec.js` simule le cas exact où le HostRoot et `nav/main/composer` paraissent prêts plusieurs secondes avant HTML/BODY ; le test exige zéro mutation pendant cette fenêtre puis un démarrage normal après ownership document-root.
- **Chromium + Brave** : cette régression est branchée dans les deux jobs Live Stability et possède un checkpoint dédié `HYDRATION_DOCUMENT_ROOT_CHECKPOINT PASS`.
- **Fallback conservé** : si l’ownership document-root ne peut pas être prouvé, NiakGPT reste fermé jusqu’à une interaction native fiable plutôt que de deviner un délai.

# NiakGPT 0.9.106 — probe React MAIN-world + reprise fiable de la sidebar

- **Régression terrain après 0.9.105** : la sidebar NiakGPT pouvait rester absente alors que ChatGPT lui-même continuait à fonctionner.
- **Cause racine** : `boot-gate-v100.js` s’exécute comme content script MV3 isolé, alors que les expandos React (`__reactContainer$…`, `__reactFiber$…`) appartiennent au monde JavaScript de la page. Le lab 0.9.105 posait les marqueurs dans le même monde que le gate et ne reproduisait donc pas l’isolation réelle Chrome/Brave.
- **Autorité corrigée** : le service worker exécute désormais un probe strictement en `world:'MAIN'`, sans mutation DOM, et renvoie uniquement `fullDocument / rootSettled / needed / ownedCount` au gate isolé.
- **Plus de fusible permanent sur #418** : un #418 observé avant activation reste un signal hôte, mais un HostRoot ensuite stabilisé peut autoriser le boot ; à défaut, le fallback reste une vraie interaction native.
- **Zéro-touch conservé** : aucun CSS, attribut `data-ng*` ni nœud NiakGPT n’est injecté avant la preuve d’hydratation.
- **Non-régression réelle MV3** : nouveau test Chromium/Brave avec l’extension chargée via `--load-extension`, expandos React créés uniquement dans le monde page et **aucun clic utilisateur** ; le test exige `react-main-world-settled` puis la présence de `#ng8-rail`.
- **Le 410 `/backend-api/f/conversation/resume` reste natif ChatGPT** : cette route reste absente du runtime NiakGPT et interdite par les validateurs.

# NiakGPT 0.9.105 — zéro influence avant hydratation + HostRoot réellement terminé

- **Le 0.9.104 n’a pas suffi sur le terrain** : l’erreur React #418 persistait après la barrière par clés internes.
- **Deux angles morts identifiés** :
  1. les clés `__reactContainer$…` / `__reactFiber$…` apparaissent avant la fin effective de l’hydratation ;
  2. 34 feuilles CSS NiakGPT étaient encore injectées à `document_start`, donc pouvaient modifier la mise en page avant l’hydratation client alors même que le JavaScript était correctement retenu.
- **HostRoot réel** : le gate n’accepte plus la simple présence des clés React ; il exige `memoizedState.isDehydrated === false` sur le HostRoot et des fibres hôtes présentes.
- **CSS différé** : le manifest ne contient plus aucun `content_scripts[].css`. `STYLE_RUNTIME` est injecté par le service worker uniquement après réussite du gate, juste avant les scripts runtime.
- **Packaging corrigé** : le builder inclut explicitement `STYLE_RUNTIME` dans le ZIP afin que le déplacement hors manifest ne puisse pas perdre des feuilles CSS.
- **Régression ciblée** : le lab installe d’abord les clés React avec `isDehydrated:true` et vérifie que NiakGPT reste totalement absent ; il ne peut démarrer qu’après passage à `isDehydrated:false`.
- **Frontière complète** : avant hydratation validée, NiakGPT n’injecte ni nœud, ni attribut `data-ng*`, ni feuille CSS.

# NiakGPT 0.9.104 — fusible d’hydratation React full-document

- **Régression terrain reproduite** : ChatGPT remontait `Minified React error #418` avec une pile terminant sur `body/html` et une longue activité `MessagePort`. Cela caractérise une hydratation React qui continue alors que le DOM peut sembler stable.
- **Cause racine** : le gate 0.9.103 utilisait stabilité d’identité DOM + calme + idle scheduler comme preuve d’hydratation. Ce n’est pas suffisant pour le renderer React full-document actuel : React peut garder les mêmes nœuds tout en poursuivant l’hydratation.
- **Barrière déterministe** : sur le document ChatGPT actuel (`data-build` / React Router), NiakGPT attend maintenant la propriété React réelle du root et d’au moins deux nœuds hôtes avant toute mutation de `html`, `body` ou de la sidebar.
- **Fail closed** : si les marqueurs React ne sont pas disponibles, NiakGPT attend une interaction native fiable au lieu de choisir un délai arbitraire. Si une erreur d’hydratation #418 est observée avant activation, le runtime ne démarre pas.
- **Preuve négative** : le lab cross-engine garde volontairement le DOM inchangé pendant plusieurs secondes de scheduler `MessageChannel`; avant les marqueurs React, il exige zéro `data-ng*`, zéro nœud NiakGPT et zéro activation.
- **Correctifs 0.9.103 conservés** : archive Project Memory via worker MV3, migration des queues metadata-only, normalisation des routes Project slugguées, et placement Projects pleine largeur avant la section Chats.

# NiakGPT 0.9.103 — archives réelles en chat actif + placement Projects/Chats terrain

- **Preuve terrain après 0.9.102** : le coffre privé avait bien assaini les noms et fermé l’inventaire Project de référence à 171/171, mais l’arbre GitHub contenait toujours **0 fichier sous `conversations/`** et les index restaient à `parts:0/messages:0/bootstrapMetadataOnly:true`.
- **Cause mémoire** : l’historique complet ne pouvait démarrer que depuis un onglet hors conversation. Un utilisateur qui reste normalement dans ChatGPT pouvait donc laisser la queue tourner indéfiniment sans jamais écrire les corps de conversation.
- **Transport historique isolé** : après une minute de calme, Project Memory peut lire un détail de conversation depuis le service worker MV3 via un endpoint strictement limité à `/backend-api/conversation/<id>`. Le jeton de session ChatGPT est éphémère, gardé uniquement en mémoire du worker et jamais écrit dans le coffre ou le stockage extension.
- **Chat courant** : la capture DOM immédiate reste prioritaire et sans broker page. Le PID de route est maintenant canonisé, y compris les routes slugguées `g-p-<id>-<slug>`.
- **Migration 0.9.102** : une ancienne queue metadata-only est automatiquement rematérialisée en queue full-history ; un ancien `lastSyncAt` ne vaut plus preuve d’archive.
- **Placement Projects** : le DOM terrain montre le scrollport visible `nav[aria-label="Historique de chat"]`. v131 le préfère explicitement et v121 refuse désormais un parent flex-row/grid multi-colonne comme lane de montage. Le bloc Projects est monté avant la section Chats complète, jamais à côté de son titre.

# NiakGPT 0.9.102 — Project Memory : inventaire complet, file persistante, noms propres

- **Recheck du coffre privé** : 17 Projects, 316 conversations connues, 310 seulement présentes dans le cache, 0 fichier de conversation archivé et 16 noms de Projects contaminés par icône/date/compteur. Le Project NiakGPT était marqué `indexed:true` malgré `30 connus / 24 cachés`.
- **Cause supplémentaire trouvée après 0.9.101** : `deepInventory()` assimilait `indexed:true` à « inventaire complet ». Un Project pouvait donc perdre définitivement les chats manquants sans être rescanné.
- **Complétude réelle** : un Project est désormais incomplet si `knownConversationCount > cachedConversationCount`, même si l'index serveur est marqué fait. Project Memory demande alors une réparation ciblée de la liste de chats.
- **Réparation sûre à côté d'un peer inactif** : seul le listing `/gizmos/<project>/conversations` explicitement marqué `memoryBootstrap:true` peut passer depuis un onglet hors chat lorsqu'un autre chat est visible mais inactif. Une génération peer referme immédiatement cette exception.
- **File non destructrice** : si le count-gap persiste après une tentative, la queue Project Memory reste présente avec `pauseReason: inventory-incomplete`; elle n'est plus effacée comme si la synchronisation était terminée.
- **Noms Projects** : l'inventaire racine `PROJECTS.json`, le cache recovery et les checkpoints utilisent tous la sanitation canonique ; les décorations NiakGPT ne doivent plus redevenir des noms.
- **Non-régression** : le lab reproduit explicitement `indexed=true / known=2 / cached=1`, exige la découverte du chat manquant, son archivage canonique, la conservation des archives existantes et un `PROJECTS.json` propre.

# NiakGPT 0.9.101 — Project Memory réelle, archives préservées, noms Projects sains

- **Recheck terrain concluant** : le coffre privé continuait bien à écrire, mais le Project NiakGPT restait à 24 conversations métadonnées avec `0 messages / 0 parts` et aucun dossier `conversations/`. Attendre davantage ne pouvait donc pas résoudre le défaut.
- **Archive du chat courant sans backend ChatGPT** : Project Memory sérialise désormais les messages déjà rendus dans le DOM d’un chat Project vers le coffre GitHub privé. Aucun GET ChatGPT n’est nécessaire pour cette capture ; elle est marquée `complete:false` / `historyPartial:true` afin qu’une synchronisation canonique ultérieure puisse la remplacer.
- **Bootstrap non destructif** : `writeCachedBootstrap()` fusionne l’index distant existant et ne remet plus une archive réelle à `parts:0/messages:0`. Les signaux et métadonnées d’archive déjà présentes sont conservés.
- **Historique de fond réellement réveillable** : un onglet hors chat peut terminer une lecture Project Memory à côté d’une conversation visible mais inactive. Une génération sur ce peer ferme immédiatement l’exception et annule les GET NiakGPT en cours. Tous les autres modules restent sous la quarantaine de conversation.
- **Noms Projects réparés** : les décorations NiakGPT (icône, date, compteur) ne peuvent plus contaminer le nom canonique. La sanitation agit à l’extraction DOM, sur le cache existant et avant sérialisation dans le coffre.
- **Non-régression** : les labs exigent une capture DOM avec contenu réel et zéro RPC ChatGPT, la conservation d’une archive lors d’un bootstrap métadonnées, l’exception mémoire uniquement pour un peer inactif, et le blocage immédiat dès qu’un peer génère.

# NiakGPT 0.9.100 — shell sidebar terrain + reprise SPA déterministe

- **Bloc Projects demi-largeur reproduit** : un nouveau scénario navigateur reproduit le cas où le vrai shell gauche est un `div` non étiqueté tandis qu’un `nav` interne n’occupe qu’une colonne. Avant correction, `#ng8-pins` restait monté dans cette colonne droite.
- **Cause racine corrigée** : `ux-v131.js` peut désormais promouvoir un ancêtre gauche visible non sémantique lorsque sa géométrie et les contrôles natifs prouvent qu’il est le shell de la même sidebar. v121 détecte alors le changement d’autorité, retire l’ancien nœud direct-once et recrée le catalogue dans le shell pleine largeur.
- **Classement après navigation SPA** : `server-index-v100.js`, `reclassify-v101.js` et `reclassify-deep-v112.js` se réveillent sur `navigation.navigatesuccess` en plus de `popstate`. Quitter un chat ne dépend plus d’un événement de cache/activité fortuit.
- **Non-régression terrain** : le lab laisse volontairement expirer le premier passage du classifieur dans une conversation puis quitte le fil via l’API Navigation sans `popstate`; le rattrapage doit repartir seul.
- **Project Memory GitHub** : aucun changement de politique réseau : le snapshot local est écrit immédiatement, mais l’historique complet reste volontairement différé tant qu’une conversation est visible puis attend une fenêtre de calme hors chat.

# NiakGPT 0.9.99 — troisième passe : runtime simplifié, observers filtrés, Projects masqués sûrs

- **Runtime sidebar nettoyé** : `sidebar-ux-v119.js` était encore injecté et critique alors que v121 neutralisait immédiatement son exécution. Il n’est plus injecté ni empaqueté ; le test statique a d’abord reproduit `legacy/conflicting runtime loaded sidebar-ux-v119.js`.
- **Panneaux natifs à propriétaire unique** : `side-panels-v096.js` et `live-fixes-v104.js` modifiaient tous deux les mêmes panneaux. v096 possède désormais seul la détection, l’offset réel du rail et le cycle BFCache ; le JS v104 est retiré du runtime/ZIP.
- **Hot path allégé** : `live-fixes-v106.js` ne se réveille plus sur chaque mutation structurelle d’un long fil. Son observer global filtre uniquement breadcrumb, statut Project et anciennes marques de migration.
- **Observers globaux filtrés** : `sidebar-icons-v114.js` ne recalcule plus la racine sidebar à chaque token/fragment du stream ; `project-memory-ui-v132.js` ne recherche plus le Control Center à chaque mutation quand il est fermé.
- **Projects masqués = jamais cibles automatiques** : `hiddenProjectIds` est désormais exclu des cibles du classifieur normal, du deep-classifier, du self-heal des Projects principaux et du plan de nettoyage/gouvernance. Les identités masquées restent néanmoins canoniques pour ne pas créer de faux orphelins.
- **Une seule autorité de classement automatique** : l’ancien `autoResync()` de `project-governance-v090.js` est retiré. v101/v112 sont les seuls moteurs automatiques ; le nettoyage manuel de gouvernance utilise désormais leur verrou partagé `niakgpt-data-mutation-v100`.
- **Continuité sans double PATCH** : v100 et v112 ne modifient plus eux-mêmes le Project du nouveau fil. v124 est l’unique consommateur du pending partagé et effectue exactement un rattachement sous le verrou global ; le handoff natif v129 partage lui aussi ce verrou.
- **Tests release-critical** : nouveaux labs pour churn conversationnel, propriétaire unique des panneaux + BFCache, et exclusion des Projects masqués du classement.

# NiakGPT 0.9.98 — autorité Projects unique renforcée

- **Régression terrain réellement reproduite** : le fallback Projects local pouvait appliquer l’ancienne classe `ng8-native-project-more-suppressed` à un bouton générique « Afficher plus » de la section Chats, donc faire disparaître une partie de la liste des conversations non organisées.
- **Cause racine supprimée** : `project-state-selfheal-v102.js` ne possède plus de deuxième système de masquage ligne par ligne. La seule autorité visuelle des Projects natifs reste `sidebar-projects-authority-v112.js` et son marqueur structurel `data-ng112-native-projects="1"`.
- **Pas de double autorité** : le self-heal publie synchroniquement `niakgpt:local-project-recovery-ready`; v112 décide ensuite quels hosts Projects structurels masquer, sans toucher les contrôles Chats.
- **Reclassement automatique multi-lots** : le test terrain injecte neuf conversations non organisées et exige leur classement intégral malgré la limite interne de huit éléments par passage, sans GET d’historique complet.
- **CI classification** : `deep-classification-v112.mjs` devient release-critical dans Current Finalization.
- **Parcours Project réel** : le workflow Chromium + Brave macOS est désormais déclenché aussi par les changements d’autorité Projects, self-heal, classification et UX sidebar.
- **Vérité de version** : le lab de session sidebar ne simule plus arbitrairement la 0.9.83 ; il lit la version courante du manifest.

# NiakGPT 0.9.97 — sidebar Projects restaurée depuis le cas terrain réel

- **Une seule autorité Projects** : la surface NiakGPT reste la seule liste Projects visible dès qu’elle est exploitable ; le menu Projects natif de ChatGPT est masqué sans emporter la section Chats.
- **Correction de la géométrie vue sur le terrain** : le catalogue NiakGPT occupe toute la largeur utile de la sidebar et ne peut plus tomber dans une sous-colonne interne d’un layout ChatGPT en grille.
- **Vrai shell gauche** : la détection privilégie la sidebar de conversation située sur le bord gauche au lieu d’un nav/wrapper interne dont le nom de classe contient seulement « sidebar ».
- **Identités canoniques récupérées** : le self-heal accepte aussi les href Projects absolus https://chatgpt.com/g/g-p-…, ce qui restaure les g-p-*, les Projects principaux et les cibles de classification quand le cache n’a plus que des entrées locales/dom-only.
- **Chats non organisés séparés** : les conversations génériques /c/... restent dans la section Chats native sous le bloc Projects ; elles ne sont pas injectées dans #ng8-pins.
- **Classification automatique** : une conversation non organisée et déjà stabilisée est de nouveau déplacée vers le Project pertinent après récupération des identités canoniques, avec un PATCH ciblé et sans lecture complète de conversation. La quarantaine réseau reste volontairement active tant qu’une conversation est visible.
- **Régression navigateur dédiée** : le lab reproduit une sidebar à deux colonnes, des liens Projects absolus, un cache uniquement local, des Chats génériques et vérifie géométrie, unicité, gouvernance puis classification automatique.

# NiakGPT 0.9.96 — GitHub invalidé + scroll terrain réellement adaptatif

- **Connexion GitHub** : un onglet ChatGPT resté ouvert après une mise à jour de l’extension ne peut plus laisser le bouton bloqué sur « Ouverture de GitHub… ». L’appel `chrome.runtime.connect` est désormais capturé même lorsqu’il lève synchroniquement `Extension context invalidated`, le port possède un état terminal borné et l’UI réactive immédiatement l’action avec une consigne de rechargement explicite.
- **Cause racine du scroll persistant** : un scroll natif tardif de ChatGPT pouvait être pris pour une remontée volontaire dès qu’il arrivait hors de la petite fenêtre des écritures programmatiques. Le garde ne déduit plus l’intention utilisateur d’un simple déplacement du scroll : wheel/touch/clavier et scrollbar restent les autorités de l’intention humaine, tandis qu’une correction native pendant une génération est restaurée vers le bas.
- **Changement de propriétaire du scroll** : si ChatGPT transfère dynamiquement le scroll d’un wrapper vers un ancêtre sans remplacer `<main>`, NiakGPT réévalue l’ancêtre scrollable, observe les changements de géométrie/classe/style et rebinde l’autorité au nouveau root.
- **Tests terrain** : le lab reproduit maintenant une correction native tardive après la dernière mutation du stream et une migration du scroll-root en pleine génération. Project Memory reproduit aussi exactement `runtime.connect() -> Extension context invalidated` et exige que le CTA ne reste jamais bloqué.
- **Preuves visuelles** : Current Finalization exécute le lab Project Memory dans le job terrain Chromium et collecte les screenshots avec les autres artefacts de régression.

# NiakGPT 0.9.95 — GitHub ref autoritative + diagnostic runtime

- **Correction terrain supplémentaire** : le recovery Projects n’abandonne plus l’UI à la liste native ChatGPT. Le cache local et l’inventaire canonique utilisent désormais la même surface visuelle `#ng8-pins`; la surface native est masquée dès que cette autorité est exploitable.
- `sidebar-projects-authority-v112` accepte explicitement le fallback local comme autorité temporaire et applique sa suppression native de façon synchrone au signal de recovery, ce qui élimine le mélange des deux menus.
- Le scroll de génération est réécrit autour du dernier turn réel et de son **ancêtre réellement scrollable**, y compris lorsque le scroller entoure `<main>`.
- L’intention d’envoi (bouton Envoyer ou Entrée dans le composer) arme le suivi **avant** que ChatGPT puisse remonter le viewport ; un latch borné couvre le délai avant apparition de l’état de génération.
- Le lab reproduit maintenant le défaut réel : ChatGPT remonte volontairement le scroller juste après l’envoi puis répète des corrections de scroll pendant plusieurs frames. NiakGPT doit finir et rester en bas.
- Ce même lab terrain est exécuté avec **Brave stable sur macOS** ; les anciens tests Brave ne couvraient pas ce chemin exact de DOM/hydratation.

- Corrige le cas terrain où `cached_bootstrap_write_failed:github_http_422:Update is not a fast forward` persistait malgré les retries.
- Les appels GitHub Project Memory passent maintenant en `cache: 'no-store'` afin qu’une lecture de `refs/heads/*` ne puisse pas recycler une tête obsolète.
- Après avoir construit un commit, NiakGPT relit la ref juste avant PATCH ; si un autre writer a avancé la branche, il reconstruit d’abord sur le nouveau parent.
- Les retries de ref passent de 5 à 8 avec backoff borné à 3 s ; aucun force-push n’est autorisé.
- Le contrat de test reproduit à la fois le 422 au PATCH et le déplacement de branche entre création du commit et update-ref.
- Le diagnostic `extension-errors` ignore uniquement les deux messages standards de livraison ResizeObserver ; une erreur runtime réelle reste affichée.
- Le gate terrain vérifie explicitement ce filtrage sans masquer une erreur synthétique réelle.

# NiakGPT 0.9.94 — audit scroll multi-input + faux miroir Projects

- Le garde de scroll choisit désormais uniquement un conteneur réellement scrollable ; un wrapper DOM avec `overflow: visible/hidden` ne peut plus voler l’autorité au fil.
- Les gestes utilisateur sont bornés au fil actif : faire défiler la sidebar n’interrompt plus le suivi de la réponse.
- Support tactile déterministe : swipe pour remonter = lecture libre, retour tactile en bas = réarmement du suivi.
- `Shift+Espace` est reconnu comme navigation vers le haut ; les flèches/Espace dans `textarea`, `input`, `contenteditable` ou `role=textbox` restent du texte et ne changent pas l’état de scroll.
- Le recovery Projects exclut explicitement les lignes de conversation `/c/...` de la détection de miroir natif, évitant qu’un chat portant le même titre qu’un Project masque le fallback.
- Le gate terrain couvre maintenant faux miroir par titres de chats, faux scroll-root non scrollable, sidebar wheel, clavier dans le composer, tactile et `Shift+Espace`.
- `chat-state-authority-v113` détecte désormais un contexte d’extension invalidé avant le persist différé et absorbe aussi bien l’exception synchrone que le rejet Promise. Le scénario exact d’un reload d’extension pendant le timer de persistance est couvert sans `pageerror`.
- Le même durcissement couvre `chat-attention-v113` et la persistance des profils : aucun timer/UI stale ne doit lancer une exception Chrome API après le rechargement de l’extension.

# NiakGPT 0.9.93 — Project Memory GitHub race hardening

- Le recovery local ne double plus la section Projects : si au moins deux noms du cache correspondent exactement à la surface native visible, la UI native reste seule affichée jusqu’à récupération d’identités canoniques.
- Le reclassement effectue désormais un rattrapage de tout l’historique non assigné après obtention d’un index serveur complet, au lieu de se limiter aux chats récents.
- Après réinstallation/cache froid, l’index canonique démarre hors conversation après ~12 s de calme au lieu d’exiger 2 minutes ; la quarantaine réseau reste absolue dans un chat actif.
- Le reclassement respecte la quarantaine réseau absolue des conversations : aucun PATCH de classement n’est tenté dans un fil actif.
- Nouveau garde `conversation-scroll-guard-v133.js` : quand l’utilisateur est au bas d’une réponse en cours, les mutations/resize du stream ne le repoussent plus vers le haut ; une remontée volontaire désactive immédiatement le suivi.
- Ajout d’un gate cross-engine reproduisant les trois régressions terrain : double Projects, chat vieux de 30 jours non classé, scroll de génération.

- Corrige l’erreur terrain `cached_bootstrap_write_failed: github_http_422: Update is not a fast forward`.
- Sérialise toutes les écritures GitHub Project Memory au niveau du service worker, y compris le commit d’initialisation du coffre.
- Un conflit de tête de branche relit maintenant `refs/heads/<branch>`, reconstruit le commit sur le nouveau parent et réessaie jusqu’à 5 fois avec backoff borné.
- Les 422 de règles/protection GitHub ne sont pas masqués : seuls les vrais conflits non-fast-forward sont retentés.
- Ajoute un test backend qui force deux déplacements externes successifs de la branche avant de vérifier la réussite sur la tête fraîche.
- Aucun dossier `.niakgpt-memory` n’est à créer manuellement.

# NiakGPT 0.9.92 — slot Projects terrain + erreurs worker

- Corrige le cas terrain où ChatGPT affiche les lignes Projects sans titre « Projects » ni href `g-p-*` : v121 retrouve maintenant le bloc par concordance d’identités avec les noms de Projects du cache et ancre les Pins juste avant ce bloc.
- Borne le calcul du « primary tail » pour qu’un conteneur géant englobant récents/Projects ne puisse plus être déclaré à tort « after-primary ».
- Le lab terrain retire volontairement le titre Projects, ajoute des conversations récentes avant les Projects et exige le mode `native-projects` avant/après remount.
- Project Memory consomme désormais la Promise de `chrome.tabs.remove()` lors de la fermeture de l’onglet d’enregistrement GitHub, supprimant une source réelle de rejet asynchrone non géré.
- Les erreurs service-worker sont conservées sous forme expurgée et exposées dans le diagnostic `extension-errors`.
- Le validateur courant refuse toute référence runtime à `/backend-api/f/conversation/resume` et toute réassignation globale de `fetch`.

# NiakGPT 0.9.91 — Pins persistants après remount sidebar

- Corrige la disparition terrain du bloc Pins après un remount tardif de la sidebar ChatGPT.
- v121 ne rend plus un catalogue canonique vide par-dessus un cache local exploitable ; il demande explicitement au self-heal de repeupler le même nœud.
- La suppression externe de `#ng8-pins` est réparée même si elle arrive pendant un epoch de rendu interne.
- v131 devient un garde de cycle de vie : sidebar active + Pins manquants => demande de recréation, puis nouvelle vérification visuelle.
- Le self-heal écoute la demande de récupération locale et repopule les 5 Projects cache sans trafic backend pendant une conversation.
- Le test terrain charge désormais le garde CSS v131 réel, vérifie la visibilité effective, supprime/remonte toute la sidebar puis exige que les Pins reviennent avant Projects/Chats.
- Le diagnostic d’autorité distingue `cache local · Projects natifs conservés` de `bloc NiakGPT absent`.

# NiakGPT 0.9.90 — récupération locale Projects + privacy fail-closed

- Le renderer v121 conserve désormais un fallback Pins local/dom-only au lieu de le remplacer par un catalogue vide quand l’identité serveur canonique n’est pas encore connue.
- Le placement reconnaît les sections Projects modernes même lorsque leurs lignes n’exposent pas encore de liens `/g/g-p-*` : **PINS · PROJECTS** reste avant Projects et donc au-dessus de Chats.
- L’autorité v112 ne masque plus la surface Projects native pendant un fallback local ; elle ne prend la main qu’après présence de liens canoniques.
- Le self-heal v102 ne reparent plus un bloc v121 déjà monté et n’invente pas de gouvernance canonique à partir d’entrées locales.
- Ajout du lab `field-sidebar-cache-recovery-v090.mjs` : 5 Projects locaux, 9 chats, gouvernance vide, lignes natives sans liens canoniques, puis upgrade vers 5 identités `g-p-*`.
- Les alias de classification propres à des projets privés sont remplacés par des catégories génériques dérivées du contexte Project.
- Ajout de `check-public-tree-privacy-v134.mjs`, exécuté dans les trois gates release, pour refuser les marqueurs privés connus, e-mails réels, chemins utilisateur locaux et secrets/tokens plausibles dans l’arbre public.

# NiakGPT 0.9.89 — Sidebar field correction

- Corrige la régression terrain visible en 0.9.88 où le catalogue **PINS · PROJECTS** pouvait se monter sous l’en-tête natif **Chats** lorsque le bloc Projects natif n’était pas encore présent : le boundary Chats est désormais une limite de placement explicite et les Pins restent au-dessus.
- Corrige l’appartenance fantôme de conversations générales à un Project : un `gizmo_id: null` explicite est maintenant une preuve autoritaire de détachement et efface l’ancien `projectId` au lieu de le conserver.
- Nettoie aussi les résidus `projectChats` contradictoires et le drawer Pins refuse d’afficher une conversation dont l’état canonique prouve qu’elle n’appartient plus au Project.
- Étend la régression terrain navigateur avec la forme exacte de la capture : en-tête Chats + recents génériques + cache Project périmé.

# NiakGPT 0.9.88 — Field regressions: Pins, chat quarantine, GitHub bootstrap

- Corrige ensemble les trois régressions terrain déjà signalées : mauvais placement/masquage des Pins, interférence réseau possible pendant une discussion, et coffre GitHub connecté sans fichiers Project réellement écrits.
- `page-bridge.js` impose désormais une quarantaine absolue : si cet onglet ou un pair visible est sur une conversation, **aucune requête backend ChatGPT appartenant à NiakGPT** ne part, y compris foreground, PATCH, POST et DELETE. Les actions natives ChatGPT ne passent pas par ce broker.
- `pin-folders-v096.js`, l’analyse profonde, le reclassement et la récupération restent cache-only / en pause pendant une conversation ; les drawers n’essaient plus de s’hydrater en réseau pendant le chat.
- `sidebar-projects-v121.js` remonte désormais jusqu’au host Projects natif complet avant de monter les Pins : `#ng8-pins` doit être son sibling précédent, jamais un enfant d’un Project déplié. L’autorité v112 masque ensuite ce sibling natif de manière déterministe.
- Project Memory écrit immédiatement dans le dépôt GitHub privé un snapshot **local-cache-only** : `PROJECTS.json`, puis `project.json`, `index.json` et `PROJECT_STATE.md` pour chaque Project connu. Cette étape ne lit pas le backend ChatGPT.
- L’historique complet reste en file pendant une discussion et reprend hors chat après une minute de calme, avec 20 s minimum entre lectures complètes. Le heartbeat local passe à 30 s.
- « Synchroniser maintenant » pendant un chat réécrit le snapshot local GitHub et diffère l’historique ; un échec d’écriture GitHub devient une erreur visible au lieu de rester indéfiniment sur « bootstrap en attente ».
- Nouveau lab `field-regressions-v088.mjs` : Project natif déplié avec sous-chats, quarantaine absolue current/peer sur toutes méthodes NiakGPT, et fichiers GitHub immédiats depuis le cache sans aucun RPC ChatGPT.
- Les tests Project Switch et réseau existants sont réalignés : foreground est autorisé uniquement hors discussion.

# NiakGPT 0.9.87 — Native chat zero-background network quarantine

- Corrige une régression terrain où l’extension pouvait contribuer aux messages natifs ChatGPT « Connexion interrompue » / vérification dès son installation.
- `server-index-v100.js` ne démarre plus à ~80 ms : aucun GET backend automatique NiakGPT n’est autorisé sur une route de conversation ; hors conversation, l’index attend 2 minutes de calme.
- `server-index-bootstrap-v124.js` ne peut plus envoyer jusqu’à 28 relances espacées de 550 ms ; le bootstrap devient lent, borné et conversation-safe.
- `page-bridge.js` impose la barrière centrale `native_conversation_quiet` avant réseau, y compris lorsqu’un autre onglet visible signale une conversation active.
- Project Memory attend désormais 5 minutes de calme, espace les lectures d’historique complet d’au moins 20 s et conserve un heartbeat local de secours de 60 s.
- Une lecture Project explicitement déclenchée par l’utilisateur reste possible seulement si ChatGPT n’est pas en génération, vérification ou incident réseau.
- Nouveau lab `native-chat-zero-background-v087.mjs` : zéro RPC/auth/backend automatique au démarrage d’un chat, quarantaine multi-onglets, exception foreground bornée.
- Les anciens tests de réveil ont été réalignés : ils prouvent toujours la reprise d’une file persistante sans imposer les délais agressifs de 0.9.86.

# NiakGPT 0.9.86 — Project Memory persistent queue self-wake

- Correction du cas terrain `Coffre connecté · bootstrap en attente · 16 Project(s)` pouvant rester bloqué indéfiniment.
- Ajout d’un heartbeat local de 15 s qui vérifie la file persistante et relance `resume()` dès qu’un onglet visible est éligible.
- Aucun appel réseau ChatGPT n’est déclenché par le heartbeat tant que ChatGPT est occupé.
- Les sorties précoces `busy`, onglet caché/changement de propriétaire et lock Project Memory momentanément indisponible réarment désormais une tentative.
- Après une pause ou une erreur transitoire, la présence d’éléments dans la file garantit qu’un nouveau réveil reste planifié.
- Nouveau lab `project-memory-wake-v086.mjs` : reproduit un état occupé qui disparaît sans événement puis un premier lock refusé ; la file doit se consommer seule.

# NiakGPT 0.9.85 — Native traffic priority + reliable Pins launcher

- ChatGPT natif obtient une priorité réseau absolue : un envoi ou une génération annule les GET internes NiakGPT en vol.
- Suppression du fallback automatique fetch → XHR sur erreur réseau afin d’éviter les requêtes doublées pendant une interruption.
- Aucun clic automatique sur le bouton natif « Réessayer » après vérification/réseau : brouillon préservé, reprise laissée à ChatGPT.
- L’analyse profonde n’a plus de `fetch()` ChatGPT direct : elle passe par le broker unique et annulable.
- La reprise d’incident ne clique plus automatiquement sur le bouton natif « Réessayer ».
- Project Memory devient strictement opportuniste : 45 s d’inactivité humaine, 8 s minimum entre deux lectures complètes d’historique et longue pause après 429/réseau.
- Un incident vérification/réseau place le broker NiakGPT en quarantaine avant toute reprise.
- Les Pins se montent depuis le launcher natif visible `/projects` même si les liens Project individuels ne sont pas encore hydratés.
- L’ouverture explicite d’un drawer Project reste réactive après retour au calme, mais demeure bloquée pendant une génération/vérification/incident réseau réel ; un cache partiel est complété au lieu d’être considéré comme final.
- Le header du bloc devient **PINS · PROJECTS** pour ne plus être confondu avec le menu Projects natif.
- Nouveaux labs : `native-priority-network-v085.mjs` et `pins-launcher-only-v085.mjs`.

# NiakGPT 0.9.84 — Late hydration + stable GitHub memory sync

## Régressions terrain — 2026-08-30

- correction du cas réel où **PROJECTS restait en haut de la sidebar** lorsque NiakGPT montait avant l’arrivée tardive de la navigation native ChatGPT ;
- suppression du fallback générique qui pouvait figer le catalogue dans une position transitoire : sans navigation primaire fiable, NiakGPT attend désormais au lieu de monter trop tôt ;
- détection des contrôles primaires par href **et** libellé natif, et détection d’un slot Projects visible même si ses liens internes ne sont pas encore chargés ;
- lorsqu’un slot plus autoritaire apparaît après coup, l’ancien bloc est neutralisé et un nouveau bloc est monté directement au bon endroit, sans reparenting du même nœud ;
- correction de la partie GitHub du Centre de contrôle qui pouvait **se volatiliser pendant la synchronisation** : les mises à jour d’état ne reconstruisent plus le DOM du formulaire tant que sa structure n’a pas réellement besoin de changer ;
- conservation du dépôt, de la branche, du dossier saisi, du focus et de l’état des contrôles pendant les événements de progression ;
- un état OAuth/session GitHub transitoire ne remplace plus brutalement le sélecteur de dépôt d’un coffre déjà configuré ;
- Project Memory n’attend plus le WORKER général : son verrou propre ne peut être pris que par un onglet visible ; une tab cachée ne peut plus conserver le verrou en restant bloquée à 0 % ;
- après connexion du coffre, l’onglet visible déclenche immédiatement la consommation de la file ; si la visibilité change, la file persistante est reprise sans perdre les commits déjà écrits ;
- progression affinée au niveau des conversations du Project courant et inventaire initial borné à 15 s avant première persistance ;
- nouveaux labs : `pins-late-hydration-v084.mjs`, `project-memory-ui-stability-v084.mjs`, `project-memory-visible-owner-v084.mjs`.
- le catalogue Projects répare immédiatement un déplacement externe avant le prochain paint, puis effectue une vérification bornée pour les DOM React transitoires ;
- la position de scroll du catalogue est capturée **synchroniquement avant tout retire/remount**, afin qu’un geste utilisateur ne revienne jamais à 0 pendant un remount tardif ;
- le renommage d’un Project via le menu natif est durci : délais adaptatifs, second essai borné et fermeture native par Escape plutôt que suppression de DOM.

---

# NiakGPT 0.9.83 — Pins slot + Project Memory bootstrap recovery

## Régressions terrain — 2026-08-30

- correction du bloc **PROJECTS** visible au-dessus du menu natif ChatGPT : une surface Projects native cachée, inert ou située avant/au-dessus de la navigation primaire ne peut plus servir d’ancre ;
- `primaryTail()` ne remonte plus dans un parent qui mélange navigation primaire et liens Projects/chats ; le fallback Pins reste sous les contrôles natifs ChatGPT ;
- nouveau lab `pins-primary-slot-v083.mjs` avec le scénario exact « faux Projects caché en haut → ChatGPT/Nouveau chat/Bibliothèque/Apps → Pins » sur Chromium/Firefox/WebKit ;
- restauration de la section **PROJECT MEMORY · COFFRE GITHUB PRIVÉ** quand son runtime optionnel arrive alors que le Centre de contrôle est déjà ouvert ;
- ajout de l’événement `niakgpt:control-center-rendered` et rendu initial immédiat de `project-memory-ui-v132.js` ;
- un coffre connecté crée maintenant immédiatement une **file de bootstrap persistante** ; le WORKER peut reprendre cette file après changement de rôle, masquage, reload ou session ultérieure ;
- un coffre déjà initialisé mais sans `lastSyncAt` recrée automatiquement sa file au démarrage de 0.9.83, sans reconnexion GitHub ;
- le Control Center affiche le nombre de Projects en attente, la dernière synchro et les erreurs de sync ;
- correction de la sélection qui sautait dans le Diagnostic : aucun rerender DOM du panneau pendant une sélection texte native active, puis reprise des métriques après relâchement ;
- nouveau lab `diagnostic-selection-v083.mjs` et extension du lab Project Memory pour couvrir l’auto-render + la récupération d’un coffre connecté/non synchronisé.

---

# NiakGPT 0.9.82 — Sidebar DOM stability + GitHub auth transport hotfix

## Régressions terrain — 2026-08-30

- correction du chargement Pins qui pouvait rester accroché à un ancien shell de conversation et nécessiter un passage par l’accueil + actualisation ;
- `#ng8-pins` suit désormais un contrat **direct-once** : calcul de l’emplacement final avant création, aucun reparenting du même nœud entre deux branches React ;
- lors d’un remount ChatGPT, l’ancien bloc est neutralisé sur place et un nouveau bloc est monté directement dans le shell visible actif ;
- ajout d’un garde `safeInsert()` refusant toute insertion parent/descendant invalide ;
- correction des erreurs terrain compatibles avec `Cannot moveNode ... new parent is already a descendant` et `Node cannot be found in the current page` ;
- nouveau lab `dom-node-stability-v082.mjs` : départ direct dans un chat, remount tardif du sidebar, aucun passage accueil/refresh, aucune réutilisation/reparenting du vieux nœud ;
- correction de **Connexion GitHub refusée · The auth url has an invalid scheme** : le launcher `chrome-extension://` n’est plus envoyé à `launchWebAuthFlow` ;
- l’amorce GitHub App Manifest s’ouvre dans un onglet normal, POSTe vers GitHub et revient par le callback HTTPS exact de l’extension ;
- `launchWebAuthFlow` est désormais encapsulé par une garde qui refuse tout schéma autre que HTTP(S) ;
- ajout du callback exact `https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/*` aux host permissions, sans permission globale `tabs`.

---

# NiakGPT 0.9.81 — Late React scheduler hydration hotfix

## Hydration / affichage — 2026-08-30

- aucun JavaScript NiakGPT n’est désormais chargé à `document_start` ; le groupe bootstrap passe à `document_idle` ;
- la barrière ne se fie plus au seul « DOM calme » : elle exige une identité stable des nœuds `nav/main/composer`, une fenêtre sans mutation prolongée, deux passages idle du scheduler et plusieurs frames ;
- correction du cas réel où React continue sa réconciliation via `MessagePort` après une période sans mutation et remplace ensuite des nœuds différés ;
- le lab d’hydratation reproduit deux remplacements tardifs du shell via `MessageChannel` après `load` et échoue si NiakGPT s’active pendant cette fausse stabilité ;
- les modules continuité/watchdog/pins/menu/handoff restent dormants jusqu’au signal final `niakgpt:host-hydrated-v100`.

---

# NiakGPT 0.9.80 — React hydration barrier hotfix

## Hydration / affichage — 2026-08-30

- correction de la course pouvant provoquer **React recoverable error #418** et casser l’affichage ChatGPT lorsque NiakGPT est chargé à `document_start` ;
- `boot-gate-v100.js` impose désormais une barrière host-hydrated renforcée : chargement complet, calme DOM prolongé, frames de stabilisation puis signal `niakgpt:host-hydrated-v100` ;
- les cinq modules pré-runtime (`composer-continuation`, `long-run-watchdog`, `pin-interaction-rescue`, `project-menu-augment`, `continuity-native-handoff`) restent totalement dormants avant ce signal ;
- avant hydratation : aucun observer, timer, attribut HTML, interception ou mutation DOM NiakGPT ;
- ajout de `visual-lab/hydration-barrier-v080.mjs` : snapshot d’un DOM SSR-shaped, vérification d’immuabilité avant barrière puis activation après signal sur Chromium, Firefox et WebKit ;
- le nouveau lab est intégré au Public Quality Gate et les invariants statiques refusent toute réactivation précoce d’un module `document_start`.

---

# NiakGPT 0.9.79 — Connexion GitHub native et choix du coffre

## Project Memory GitHub UX — 2026-08-30

- le parcours principal Project Memory devient **Se connecter avec GitHub → autoriser → choisir le dépôt** ; plus de PAT à fabriquer/copier dans le flux normal ;
- ajout d’un GitHub App Manifest flow backendless : chaque profil crée son connecteur GitHub App privé, sans client secret partagé dans le dépôt public NiakGPT ;
- permissions minimales du connecteur : **Contents: write** et **Metadata: read** ; GitHub reste propriétaire de l’écran « All repositories / Only select repositories » ;
- ajout de la permission MV3 `identity` et du seul host supplémentaire `https://github.com/login/*` pour l’échange/renouvellement OAuth ;
- validation de deux `state` indépendants et des callbacks `chromiumapp.org` avant tout échange de code ;
- user access token GitHub App conservé en session, refresh token/client secret du connecteur personnel conservés localement ; la clé privée PEM renvoyée par le manifest flow n’est jamais persistée ;
- le sélecteur NiakGPT liste uniquement les dépôts privés non archivés réellement autorisés à l’installation GitHub App ;
- un dépôt demandé hors de cette liste est refusé côté service worker, même si l’UI est contournée ;
- le fine-grained PAT reste disponible sous **Avancé · PAT manuel** pour les organisations/comptes qui interdisent l’installation de GitHub Apps ;
- packaging, documentation Privacy/Security/Architecture et gates statiques/browser mis à jour pour couvrir ce nouveau modèle sans réintroduire de secret GitHub Actions.

---

# NiakGPT 0.9.78 — Hotfix Project Memory isolé et connexion dépôt neuf

## Correctifs critiques — 2026-08-30

- séparation stricte du coffre Project Memory : suppression du live smoke et de tout secret Actions reliant le dépôt public NiakGPT à un vrai dépôt privé utilisateur ; le nom du coffre et son secret d’accès restent exclusivement locaux au navigateur ;
- correction CodeQL du contrôle de domaines synthétiques dans `tools/check-fixture-privacy-v133.mjs` : validation par labels DNS, sans comparaison de sous-chaîne ambiguë ;

- Project Memory sort du runtime critique : `ISOLATED_RUNTIME` termine désormais jusqu’à `ux-v131.js`, puis Project Memory se charge dans `OPTIONAL_RUNTIME` en best-effort ;
- l’échec de `project-memory-background-v132.js` est capturé dans le service worker et ne peut plus empêcher le bootstrap Projects/sidebar ;
- le bootstrap principal répond avant toute injection Project Memory optionnelle : Pins, drawers et menus `...` ne dépendent plus de GitHub ;
- prise en charge des dépôts GitHub privés totalement neufs, sans branche ni commit : création du premier blob/tree/commit/ref ;
- token et configuration Project Memory ne sont persistés qu’après initialisation réussie ;
- un échec de connexion conserve dépôt, branche, dossier, token et préférence “mémoriser” dans le formulaire, avec bouton de retry visible ;
- nouveau gate `labs/project-memory-isolation-v133.mjs` : backend mémoire cassé et runtime mémoire cassé doivent laisser le bootstrap Projects vert ;
- le lab UX Project Memory teste désormais l’échec visible, la conservation du formulaire et le retry ;
- le lab global `sidebar-session-ux-v123.mjs` provoque un échec Project Memory puis reteste immédiatement le catalogue Pins/Projects et ses menus d’actions ;
- la release passe en 0.9.78 afin que le hotfix soit distribué comme une vraie mise à jour ;
- correction visuelle des lignes Project : colonne contenu + colonne action `...` explicites, hitboxes non chevauchantes et contrôle d’overflow/alignement dans le lab human UX ;
- reconnaissance explicite de `Nos systèmes effectuent quelques vérifications …` et `Connexion interrompue. En attente de la réponse complète.` ;
- toutes les RPC NiakGPT et la synchro Project Memory se suspendent pendant vérification ou interruption réseau ;
- brouillon et fin de réponse assistant partielle sont conservés chiffrés en session ; après retour réseau, NiakGPT privilégie une reprise native unique, sinon prépare une continuité exacte sans envoi automatique ;
- reprise réseau durcie par une fenêtre de stabilisation DOM bornée pour éviter les races WebKit/SPA.

---

# NiakGPT 0.9.77 — Project Memory GitHub privé et continuité durable

## Project Memory v132 — 2026-08-29

- ajout d’un **dépôt GitHub privé choisi par l’utilisateur** comme mémoire durable optionnelle des Projects ;
- vérification obligatoire `private: true` à la connexion puis avant les lectures/écritures ; dépôt archivé refusé ;
- fine-grained token conservé en session par défaut, persistance locale uniquement sur choix explicite ;
- bootstrap automatique de tous les Projects existants non vides : description/instructions, historique des fils, tâches, décisions, contraintes et signaux d’architecture ;
- historique complet découpé sous `projects/<id>/conversations/<id>/` et checkpoint compact `PROJECT_STATE.md` ;
- après bootstrap, synchronisation incrémentale des seuls fils dont le timestamp canonique a changé ;
- queue de synchronisation persistante et reprise après interruption ;
- pause des lectures lourdes pendant génération/vérification ChatGPT et conservation du broker/circuit breaker existant ;
- `GET /backend-api/conversation/{id}` complet toujours interdit hors requête explicite `memoryBootstrap: true` ;
- restauration du checkpoint une seule fois au premier message d’un nouveau fil Project, sans gonfler les prompts suivants ;
- intégration au Control Center avec connexion, synchro, resync complet, déconnexion et options dédiées ;
- ajout de la permission hôte `https://api.github.com/*`, sans trafic GitHub tant que Project Memory n’est pas configuré ;
- packaging renforcé pour inclure les workers chargés via `importScripts()` ;
- nouveaux gates statiques Project Memory + fixture publique synthétique `test/x.md` sans donnée utilisateur ni secret ;
- documentation Privacy/Security/Architecture mise à jour pour distinguer clairement dépôt privé, token, historique Git et absence de chiffrement E2E applicatif dans cette version.

---

# NiakGPT 0.9.76 — UX native-first intégrale et reprise longue sûre

## Documentation & maintenance refresh — 2026-08-28

- `README.md` becomes the primary English landing page and `README.fr.md` provides the full French version with reciprocal language links.
- Privacy, security, troubleshooting, contributing, testing and Visual Lab documentation were rewritten around the current 0.9.76/v131 behavior instead of historical 0.9.52/early-0.9.76 assumptions.
- Current 0.9.76 release/hotfix notes now reflect the 6m30 watchdog, composer-residue protection, BFCache recovery and native-first UX baseline.
- Added `tools/check-repository-hygiene.mjs` and wired it into the main check workflow.
- Removed four top-level runtime files with zero repository references and no production/package role.
- Added a weekly GitHub Actions purge workflow that keeps a short recent diagnostic window while removing older completed runs/artifacts.


- Ajout de `ux-v131.js/css` comme garde UX finale : sélection de la vraie sidebar gauche, exposition de `#ng8-pins` uniquement après vérification du host et disparition de la réservation permanente de largeur/hauteur autour de ChatGPT.
- `sidebar-projects-v121.js` reste propriétaire du catalogue/placement incrémental ; les nœuds Projects, leur ordre, le focus et les scrolls catalogue/drawers sont conservés pendant les rafraîchissements de cache, tout en laissant un nouveau geste utilisateur reprendre immédiatement la main.
- Rail droit transformé en dock discret, masqué sur l’accueil/surfaces utilitaires ; barre basse remplacée par une capsule passive. Les easter eggs Matrix/Terminator restent montés, mais `BY SKYNET` n’occupe plus la capsule passive.
- Prompteur adaptatif converti en contrôle compact opt-in `Optimiser`, ouvrable explicitement ou via `Alt+P`, repliable avec `Escape`, sans requête réseau ni envoi automatique.
- Continuité parallèle raccourcie en `↳ Suite en parallèle` ; après un envoi natif, seul le préfixe NiakGPT est retiré si le composer contrôlé ne s’est pas vidé, sans effacer un texte modifié par l’utilisateur.
- `long-run-watchdog-v129.js` passe à une fenêtre par défaut de 6 min 30, n’écrit rien tant qu’aucun vrai candidat Envoyer n’existe, protège tout brouillon utilisateur et ne nettoie que les protocoles automatiques exacts qu’il connaît. Une modification utilisateur, même contenant encore le marqueur NiakGPT, n’est jamais effacée.
- `interruption-guard-v119.js` restaure correctement l’incident chiffré asynchrone et empêche une écriture cryptographique obsolète d’écraser un état plus récent.
- Gates renforcés : session humaine complète, scroll réel, menus/hitboxes/clavier/dialogues, remounts, routes accueil/utilitaires/Project/chat, continuité de limite, erreurs réseau, travail logique >10 min, résidus composer et protection des modifications utilisateur.
- Nouvelle CI `NiakGPT UX Integral v131` screenshot-driven sur Chromium / Firefox / WebKit, validation focused Live Stability sur Chromium + Brave stable macOS, matrice Current Finalization multi-OS/multi-engine et packaging vérifié.
- README et architecture resynchronisés sur 0.9.76 avant livraison.

# NiakGPT 0.9.68 — Autorité Projects unique, menus isolés et boot cache déterministe

- `sidebar-projects-authority-v112.js` devient l’unique propriétaire de la visibilité des Projects natifs ; `sidebar-authority-v107.js` et `sidebar-expando-guard-v108.js` restent uniquement dans les régressions historiques et ne sont plus injectés/empaquetés.
- `live-fixes-v104.js` ne gère plus que les panneaux Activité / Réflexion / Sources / Outputs ; `live-fixes-v106.js` ne gère plus que le contexte Project et le nettoyage ponctuel des anciennes marques de migration.
- Ajout de `sidebar-metadata-v118.js/css` : normalisation des dates, suppression des faux Projects-date et réparation conservatrice du cache, sans aucune responsabilité de visibilité Projects.
- Le boot impose désormais `cache-bus → diagnostics → metadata v118 → cache-guardian/recovery/server-index → gouvernance/UI`.
- `sidebar-metadata-v118.js` est une IIFE async : sa première sanitation du cache est réellement attendue avant que l’injecteur ne passe aux consommateurs suivants.
- Les publications runtime du cache reçoivent un ordre monotone interne : une sanitation ancienne retardée par Web Locks ne peut plus écraser un snapshot externe plus récent, y compris lorsque les timestamps `at` sont identiques.
- `cache-bus-v096.js` conserve le snapshot externe le plus récent pendant une suspension BFCache, attend les écritures déjà en vol puis réhydrate l’état newest-first au `pageshow`.
- Les abonnés existants du cache-bus survivent désormais à un `pagehide` BFCache persistant : aucune notification n’est envoyée pendant la suspension, puis le snapshot le plus récent est republié à la reprise ; seul un vrai départ de page détruit les listeners.
- `native-actions-v113.js` isole chaque session de menu : les menus déjà visibles restent intacts, seuls les menus ouverts par l’action courante sont promus, et le cleanup retire Popover, top-layer, classe, variables CSS et datasets NiakGPT.
- La réutilisation d’un même nœud natif par React est couverte ; une seconde ouverture doit repartir d’un état natif propre.
- Le fallback local conversation termine maintenant sa session flottante exactement à la fermeture, afin qu’un menu apparu ensuite ne puisse pas être capturé par un timer tardif.
- Nouveaux/renforcés gates : `native-menu-session-v118`, `sidebar-metadata-v118`, lifecycle/concurrence/BFCache, autorité/remount, hitboxes atomiques, preview image, validateurs d’ordre de boot et exclusion des anciennes autorités du ZIP.
- Documentation README/architecture/changelog synchronisée avec le runtime 0.9.68 et la licence GPL-3.0.

# NiakGPT 0.9.67 — Hitboxes sidebar et menus flottants

- Sépare physiquement la zone cliquable du Project et son bouton `…`, sans chevauchement.
- Chaque conversation des drawers devient une ligne atomique `.ng96-chat-entry` contenant son lien et son bouton d’actions comme deux hitboxes sœurs.
- Les menus ChatGPT natifs sont promus hors des contextes de clipping de la sidebar, avec prise en charge des sous-menus.
- Suppression du bouton redondant d’ouverture Project et stabilisation des clics immédiats après remount/rerender.
- Nouveau gate pixel `sidebar-hitboxes-v117` et renforcement de la matrice réelle, y compris Brave stable visible sur macOS.

# NiakGPT 0.9.66 — Autorité sidebar passive et matrice OS/navigateurs

- Remplace l’autorité Projects agressive par un marquage passif `data-ng112-native-projects` + CSS.
- Retire l’observation globale des attributs/classes du document et limite les observers aux roots/sidebar utiles en `childList`.
- Les actions natives savent exposer temporairement hors écran une surface Projects masquée sans réintroduire de churn permanent.
- Renforce la matrice Ubuntu / Windows / macOS × Chromium / Firefox / WebKit, plus Brave stable réel sur macOS et profils cold/warm.

# NiakGPT 0.9.65 — Sidebar autoritaire et pins sans clignotement

- Étend la détection des Projects natifs aux roots/sous-arbres frères et variantes de markup réellement observées.
- Corrige le feedback loop entre dossiers épinglés et actions natives qui faisait clignoter/remplacer les boutons `…`.
- Le drawer existant est conservé tant que ses données n’ont pas changé ; les mutations coopérantes ne forcent plus sa reconstruction.
- Ajoute un gate « real shape » avec roots séparés, remount du bloc natif, actions et vérification anti-churn.

# NiakGPT 0.9.64 — Human navigation, stabilité live et sécurité

- Corrige l’alerte CodeQL `js/xss-through-dom` : le texte des tours du sommaire est maintenant injecté via `textContent` et n’est plus réinterprété comme HTML.
- Durcit les pins contre les remounts/rerenders React : dossiers et boutons d’actions se réhydratent de façon synchrone à chaque `niakgpt:pins-rendered`, avec garde du premier clic avant décoration.
- Réarme les actions après retour BFCache, visibilité et navigation SPA.
- Le visualiseur image détecte aussi les overlays plein écran sans ancien sélecteur dialog et restaure systématiquement le bouton de fermeture NiakGPT.
- L’autorité Projects masque aussi la ligne native `Projects` lorsqu’elle contient un bouton d’action frère.
- Les contrôles principaux de sidebar (nouvelle discussion, recherche, images, applications, Codex) reçoivent désormais des glyphes NiakGPT distinctifs au lieu de simples SVG ChatGPT recolorés.
- Nouveau stress test `human-nav-stress-v114` : 16 cycles de rerender/remount/navigation + menus natifs + fermeture image sur Chromium, Firefox et WebKit.

# NiakGPT 0.9.63 — Actions natives, état canonique et non-lus

- Remplace les anciens contrôles de renommage custom par les menus d’actions ChatGPT natifs complets pour Projects et conversations lorsque la ligne native est disponible.
- Retire `project-pins-v090.js` du runtime afin d’éviter un second propriétaire de synchronisation des Projects.
- Ajoute une autorité monotone pour les titres et affectations Project afin qu’un cache ancien ou un titre d’onglet obsolète ne remplace plus un titre serveur connu.
- Rend le fil d’Ariane canonique et entièrement lié : `Accueil > Project > Chat`, sans utiliser `OUT` comme nom de Project.
- Ajoute l’état non-lu, sa remise à zéro à l’ouverture et le signal immédiat lorsqu’une réponse se termine hors vue.
- Ajoute `conversation-load-guard-v113.js` pour relâcher les optimisations NiakGPT tant que le contenu natif de la conversation n’est pas encore rendu.
- Consolide les gates courants et réduit les workflows redondants avant l’ajout de CodeQL.

# NiakGPT 0.9.62 — Finalisation sidebar, continuité, classement et performances

- Le bloc Projects NiakGPT devient réellement autoritaire : détection du doublon natif par structure **et par identité des noms de Projects**, sans dépendre uniquement des classes ou des `href` ChatGPT ; Récents reste intact et le natif revient seulement si `#ng8-pins` disparaît.
- Ajout du renommage Project/conversation depuis le bloc NiakGPT ; le Project ouvre l’action **Renommer** du menu natif via une mise en scène hors écran du bloc natif masqué, tandis que les conversations conservent un fallback `PATCH {title}` ciblé.
- Continuité OUT renforcée : capsule commençant par `Reprends la conversation nommée « Project > chat »`, historique local et contexte Project, rattachement du nouveau chat au **Project exact** puis lock `continuity-exact`; les nouveaux chats normaux gardent le recommender habituel.
- Nouveau rattrapage profond strictement borné pour les chats ambigus/orphelins : titre/snippet d’abord, premier message ensuite, messages suivants uniquement si nécessaire ; 2 chats max/cycle, 1 sur gros fil, 10 messages/14k caractères max, cadence réseau minimale et suspension pendant génération/429.
- Les chats associés à un Project inexistant sont soit reclassés avec confiance, soit détachés du fantôme au lieu de rester dans un état invalide.
- Gros fils : garde 0.9.62 à 70 tours, historique froid avec queue chaude limitée à 44 tours, `content-visibility`/containment, Matrix coupée pendant génération lourde et éléments décoratifs désactivés ; aucun retour de l’ancien intercepteur global hotcache.
- Cache : validation transactionnelle avec 120 conversations et deux mises à jour sérialisées sans perte d’historique ; `cache-bus-v096.js` reste le propriétaire local des écritures séquentielles.
- Entêtes : `TOI / CHATGPT` redevient systématique sur les tours récents ; date/heure fiable `JJ/MM/AA · HH:mm` depuis le DOM natif ou l’envoi courant, sans heure inventée au reload ; le module répare aussi les écrasements tardifs d’un autre décorateur.
- Accueil : correctif mesuré du chevauchement `Par quoi commençons-nous ?` / composer, activé uniquement si les rectangles se recouvrent réellement.
- Matrix : gardien du canvas avec fallback léger, sans prise de contrôle de la géométrie des enfants de `main`, et respect de `prefers-reduced-motion`.
- DA : harmonisation des icônes/SVG natifs ChatGPT (couleurs, hover/focus, surfaces) sans remplacer les SVG ni leur logique.
- QA : nouveau gate 0.9.62 avec HTML rendu, analyse DOM JSON et screenshots sur Chromium / Firefox / WebKit ; scénarios dédiés au doublon Projects, renommage natif, accueil, Matrix, gros fil, cache long, DA native, cas `TV job...` et continuité Project exacte.

# NiakGPT 0.9.52 — Sidebar, native panels & long-thread stabilization

- Unifies the left sidebar around the NiakGPT coloured Projects block and suppresses native Project rows, open-project child conversations and their local “Show more” controls without hiding Recents.
- Detects ChatGPT Activity / Reflection / Sources / Outputs panels by label + viewport geometry, including anonymous DIV wrappers, and converts them to a fixed overlay left of the NiakGPT rail so chat width is not stolen.
- Long conversations use a cold-history model: initial decoration is capped to a 160-turn live tail and duplicate rescans coalesce instead of cancelling each other mid-scan.
- Continuity no longer observes `characterData` across the whole conversation; OUT checks run on structural alerts and when ChatGPT becomes idle.
- Adds screenshot-producing visual regression labs for sidebar, native panels and 500-turn conversations, designed to run on Chromium, Firefox and WebKit.
- Historical labs remain in the repository; 0.9.52 adds new gates instead of cleaning prior suites.

# NiakGPT 0.9.51 — Project UI + long-thread safety

- Keeps the colored NiakGPT Projects block as the only visible Project system; native ChatGPT Project rows/labels are suppressed with DOM-drift fallbacks.
- Confirms NiakGPT never calls `/backend-api/f/conversation/resume`; that route is not present in the extension.
- Adds a bridge circuit breaker so queued NiakGPT backend requests do not execute while ChatGPT is loading, waiting, thinking, executing, or showing a native verification challenge.
- Server Project refresh now waits for ChatGPT activity to return to ready; cached Projects remain available immediately.
- Long-thread activity tracking no longer observes character-data mutations across the entire conversation DOM; streamed-token observation is scoped to the current assistant turn.
- Existing labs are preserved; 0.9.51 adds regression coverage rather than replacing prior suites.

# NiakGPT 0.9.50

- Panneaux natifs Activité / Réflexion / Sources : overlay fixe 320 px à gauche du rail NiakGPT, sans réservation de largeur dans le chat.
- Le rail NiakGPT reste visible quand un panneau natif est ouvert.
- Sidebar : le bloc Projects NiakGPT remplace visuellement la section Projects native dupliquée ; un seul propriétaire de scroll vertical.
- Conversations : garde anti-duplication des nœuds de titre identiques dans une même ligne.
- Fond : Matrix nettement atténuée et gradient plus profond pour retrouver de la lisibilité.
- Labs conservés et étendus ; aucun nettoyage des labs.

# Changelog

Les changements notables de NiakGPT sont regroupés ici. Le projet est encore en phase RC : les versions 0.x peuvent faire évoluer l’architecture interne rapidement.

## 0.9.49 — Restauration 0.9.48, continuité OUT et labs multi-moteurs

- restauration du delta 0.9.48 sur le build 0.9.44 vérifié, avec conservation de la clé d’identité Chrome ;
- monde MAIN réduit à `page-bridge.js` uniquement ; les anciens intercepteurs `window.fetch` de hotcache/activity ne sont plus chargés ;
- refus avant réseau de tout `GET /backend-api/conversation/{id}` initié par NiakGPT ; mutations `PATCH` conservées avec accusé de réception local ;
- server-index piloté par événements : inventaire Projects léger immédiatement disponible, crawl détaillé suspendu pendant l’activité puis repris au retour à `PRÊT` ;
- gros fils : aucun traitement chaud massif pendant le streaming, reprise différée après stabilisation ;
- panneaux Activité / Réflexion / Sources / Outputs : géométrie native (`right`, `translate`, `max-width`) préservée et priorité temporaire sur le rail NiakGPT ;
- nouveaux chats : fenêtre de maturation de 8 s, classement avec un seul PATCH et sans GET complet ;
- conversations `OUT` : badge, tri en bas, bouton de continuation, capsule locale Project/URL/instructions/historique et rattachement du nouveau fil au même Project ;
- timestamps **TOI · HH:mm / CHATGPT · HH:mm** sans GET complet de conversation ;
- prompteur adaptatif local : contexte Project/fil, conservation des contraintes, profils dev/recherche/rédaction/comparaison/plan, actions COPIER/REMPLACER sans auto-send ;
- ajout d’un lab Playwright commun Chromium / Firefox / WebKit et d’une matrice CI dédiée, sans inclure les fichiers de lab dans le ZIP de l’extension.

## 0.9.44 — Bootstrap Projects anti-blocage et horodatage des messages

- suppression du deadlock `recovery=pending` qui pouvait bloquer indéfiniment l’index serveur pendant un état Activité ;
- inventaire Projects exécuté même pendant une génération/activité : les Projects et pins deviennent disponibles sans attendre le crawl des chats ;
- gouvernance automatique évolutive : un seed partiel de 10 Projects est élargi quand l’inventaire serveur complet arrive ;
- conservation des verrous manuels tant qu’un index serveur complet n’a pas validé les conversations ;
- diagnostic cache mis à jour dès que l’inventaire Projects est disponible ;
- ajout de `HH:mm` à côté de **TOI / CHATGPT** lorsque l’heure est disponible dans le DOM ou les métadonnées locales déjà disponibles ;
- aucune nouvelle boucle réseau : la récupération de timeline respecte le circuit breaker 429 et ne relance pas pendant une activité.

## 0.9.43 — Panneaux natifs bornés et démarrage frais plus réactif

- Activité / Sources / Sorties : suivi actif du panneau ouvert avec `ResizeObserver` local, sans observer global permanent ;
- clic sur une analyse/source/sortie déjà ouverte : détection des portails fixes secondaires créés par ChatGPT, même sans libellé « Activité » ;
- bord droit mesuré contre le rail NiakGPT et, si le diagnostic NiakGPT est ouvert, contre son bord gauche réel ;
- correction via la propriété CSS indépendante `translate` afin de ne pas écraser les transforms/animations natives de ChatGPT ;
- clipping du contenu normal au panneau ; seul `pre/code` conserve un scroll horizontal local ;
- même traitement pour Activité, Sources et Sorties ;
- réinstallation / cache neuf : les Projects serveur sont publiés dès leur inventaire, avant la fin de l’indexation de tous les chats/dates, afin que gouvernance et pins apparaissent rapidement ;
- diagnostic `cache-garde` : un cache `0 Projects / 28 chats / 0 dates` est désormais signalé `PARTIEL` au lieu de `OK`.

## 0.9.42 — Garde anti-effondrement du cache / démarrage déterministe

- nouveau `cache-guardian-v100.js`, injecté avant Recovery, index serveur et modules UI ;
- détection d’un cache effondré (Projects/chats/dates fortement inférieurs au dernier état complet) ;
- restauration locale depuis le high-water mark ou le snapshot pré-AUTO REBUILD avant tout rendu/indexation ;
- reconstruction de la gouvernance à partir des Projects restaurés lorsque les `coreProjectIds` ont été vidés ;
- `app`, sidebar, gouvernance, index serveur et reclassement attendent la fin du garde de cache ;
- l’index serveur devient strictement non destructif lorsqu’une réponse ChatGPT paraît partielle : aucun Project/chat/date connu n’est supprimé ;
- une réponse partielle déclenche une nouvelle tentative différée au lieu de publier un faux état complet ;
- récupération AUTO : inventaire général prioritaire pour réduire fortement les requêtes par Project et limiter les 429 ;
- conservation du broker 0.9.41 : déduplication, sérialisation et circuit breaker 429.

## 0.9.41 — Récupération AUTO / gouvernance / verrouillage fiable

- détection locale d’un état corrompu après AUTO REBUILD (Projects générés, gouvernance vide, accumulation anormale de verrous) et récupération **une seule fois** depuis le snapshot enregistré juste avant ce rebuild ;
- restauration des Projects et affectations précédentes par nom, recréation seulement si nécessaire, puis suppression uniquement des Projects explicitement enregistrés comme créés par l’AUTO et vérifiés vides ;
- conservation des vrais verrous manuels antérieurs et mise en quarantaine des verrous suspects générés après le snapshot, sans suppression silencieuse ;
- le détecteur de déplacement manuel exige désormais un geste utilisateur fiable dans l’UI Project/menu avant d’enregistrer un verrou ;
- AUTO REBUILD ne fabrique plus de Projects à partir de mots capitalisés récurrents comme `NiakGPT`, `Boutique Démo` ou `Client Démo` : les cibles nommées doivent déjà exister côté serveur avec un historique réel ;
- récupération prioritaire : index serveur, gouvernance, reclassement et resynchronisation attendent sa fin avant de modifier l’état ;
- protection contre la réintroduction de Projects serveur supprimés via des ancres DOM obsolètes après récupération ;
- fil d’Ariane basé en priorité sur l’affectation serveur/cache du chat courant et nettoyage des libellés `Ouvrir le projet …` ;
- revalidation Chromium des pins, dates, Activité/Sources/Sorties, gros fils, viewer, onboarding, français/DA, cache stable et reclassement 54 chats.

## 0.9.38 — QA navigateur renforcée / panneaux natifs / accueil

- ne modifie plus la géométrie ni le positionnement des enfants directs de `main`, afin de préserver l’accueil ChatGPT et son titre au-dessus du composer ;
- panneaux natifs Activité / Sources / Sorties bornés à leur largeur visible, avec scroll horizontal local uniquement dans les blocs de code ;
- cartes Activité / Sources / Sorties intégrées aux réponses protégées contre les largeurs/min-width natives excessives ;
- reclassement après enrichissement moins strict mais toujours conditionné à un score et une marge positifs ; cooldown ambigu réduit ;
- validation dans Chromium avec l’extension MV3 réellement chargée sur une fixture `https://chatgpt.com/` interceptée localement.

## 0.9.37 — Convergence cache / verrous / QA renforcée

- sérialisation transactionnelle de toutes les écritures principales du cache afin d’éviter les pertes de chats, dates et affectations entre modules ;
- un seul propriétaire pour l’index serveur ; l’ancien indexeur backend de `app-v090.js` reste dormant ;
- verrou inter-onglets commun aux mutations Projects, AUTO REBUILD, gouvernance et reclassement, avec reprise bornée en cas de contention ;
- priorité aux données serveur pour les compteurs et affectations, sans écrasement par un snapshot DOM partiel ;
- nettoyage des conversations obsolètes uniquement après un inventaire serveur complet ; en cas de réponse partielle, le cache précédent est conservé ;
- pins NiakGPT renforcés dans la sidebar, auto-réparation après rerender React ; synchronisation des pins natifs conservatrice et non destructive ;
- Activité / Sources / Outputs protégés contre les règles visuelles génériques et contre les débordements du panneau latéral ;
- QA Chromium 144 : sidebar/pins/dates, liens Projects, file À classer, 54 chats + verrou manuel, gros fil 321 messages, onboarding court, panneau Activité/Sources, concurrence cache et reprise de verrou.

## 0.9.36 — QA navigateur réel et restauration UI

- Projects NiakGPT montés comme enfants directs de la sidebar afin d'éviter le clipping du bloc de pins dans la zone virtualisée des Récents.
- Synchronisation des pins natifs passée en best-effort : aucun spam de menus si ChatGPT ne rend pas la zone native correspondante.
- Reclassement enrichi avec alias de Projects (MediaLab, Films, Analyse, Tech, Business, Juridique, Maison, Auto, Travail, etc.) et seuil post-enrichissement prudent pour réduire les faux « ambigus » ; `chat/chats` reste exclu des signaux Perso pour ne pas confondre ChatGPT avec les animaux.
- Suppression du flattening CSS générique des cartes internes : Activité, Sources, fichiers et citations conservent leur structure native.
- Panneaux Activité/Sources : NiakGPT ne transforme plus un wrapper arbitraire de titre en header flex.
- Ajout d'une validation locale dans Chromium 144 réel : layout, gros fil + hydratation massive, pins auto-réparés, dates sans doublons, navigation Project, reclassement 11/54, Activité/Sources, panneau latéral et onboarding 1024×540.

## 0.9.35 — Sidebar, pins et file À classer

- un seul propriétaire DOM pour les pins NiakGPT ; montage juste avant la section Récents lorsque disponible ;
- suppression de la pollution d’index où un badge de date `14/08` pouvait être interprété comme un Project ;
- purge automatique des Projects DOM fantômes lors de la prochaine indexation serveur ;
- synchronisation des pins natifs désormais additive et non destructive ; si l’UI native n’expose pas l’action, NiakGPT cesse de boucler en erreur ;
- remise à zéro des tentatives de reclassement après indexation serveur et reprise planifiée des chats ambigus au lieu d’un blocage silencieux de 30 minutes.

## 0.9.34 — Récupération d’index et restauration sidebar

- réindexation serveur locale automatique lorsque le cache ne contient que les éléments visibles du DOM ;
- restauration des Projects complets, compteurs et dates à partir des endpoints ChatGPT déjà utilisés par NiakGPT ;
- le bouton « Réindexer maintenant » fonctionne même depuis un onglet CLIENT ;
- la synchronisation des pins ne désépingle plus quoi que ce soit tant que la gouvernance n’est pas initialisée ;
- reclassement « À classer » protégé par verrou inter-onglets mais non bloqué artificiellement par le rôle CLIENT ;
- fil d’Ariane : récupération du vrai nom du Project et du vrai titre du chat depuis le titre natif lorsque le cache est incomplet ;
- conservation du marqueur d’index serveur lors des mises à jour DOM du cache.

## 0.9.33 — Correctif local consolidé / fil d’Ariane

- correction conservée du crash `turnSel is not defined` sur les mutations des gros fils ;
- réparation de la coordination `requestIdleCallback` : plus de boucle de réveil toutes les 20 ms sur un fil lourd, et les tâches avec `timeout` finissent réellement par s’exécuter ;
- indexation Projects/dates capable de progresser même lorsqu’un seul onglet lourd est ouvert, sans polling permanent ;
- reclassement `À classer` maintenu sur onglet lourd en petits lots de 3, avec cadence ralentie ;
- récupération des verrous manuels depuis le miroir `localStorage` lors du changement d’identifiant d’une extension non empaquetée ;
- clics des Projects du panneau Explorer forcés vers la page Project canonique, jamais vers un chat ;
- dates de sidebar réappliquées après chaque publication du cache et diagnostic `dates` ajouté ;
- bloc Projects NiakGPT recréé automatiquement si un rerender React de la sidebar le retire ;
- les dossiers épinglés et leurs métadonnées se réhydratent explicitement après chaque recréation du bloc Projects ;
- migration d’une ancienne installation locale détectée via les miroirs du domaine afin de ne pas relancer l’onboarding inutilement ;
- ajout d’un fil d’Ariane fixe **NiakGPT › Project › Conversation** en haut, sans observer global ni polling ;
- le fil d’Ariane est masqué automatiquement pendant le visualiseur d’image.

## 0.9.32 — Correctif runtime / Projects / reclassement

- correction du crash `turnSel is not defined` dans le traitement incrémental des messages ;
- le worker multi-onglets ne reste plus bloqué dans un onglet masqué : le travail de fond passe à un onglet visible ;
- réparation du seed Governance lorsqu'une nouvelle installation locale avait mémorisé `0` Project principal avant le chargement du cache ;
- miroir de la gouvernance dans le stockage local du domaine pour mieux survivre aux changements de dossier d'une extension non empaquetée ;
- exclusion des pseudo-Projects DOM des listes de Projects cliquables afin qu'un Project n'ouvre plus par erreur une conversation ;
- liens de Projects serveur normalisés vers `/g/<id>/project` ;
- file `À classer` traitée par lots successifs au lieu de rester bloquée après le premier lot sans déplacement ;
- placement du bloc de Projects NiakGPT stabilisé dans la racine réelle de la sidebar ;
- identifiant d’extension local désormais stabilisé par une clé publique de manifest, pour éviter de perdre le stockage NiakGPT à chaque changement de dossier décompressé.

## 0.9.31 — Consolidation locale

- gros fils : mutations bornées à 10 unités réelles par lot ;
- fond/Matrix/viewer stabilisés ;
- AUTO REBUILD : DELETE et POST Projects gouvernés via le bridge ;
- reprise de phase après interruption ;
- À classer traité comme file d’attente, jamais comme projet principal ;
- onboarding français en 3 étapes, scrollable sur petite hauteur.

## 0.9.6 — Audit RC

### UX / navigation

- les Projects épinglés deviennent de vrais dossiers dépliables : clic Project = liste instantanée des conversations depuis le cache local, bouton `↗` séparé pour ouvrir la page Project complète ;
- conversations du sous-menu triées par dernière activité avec date visible et filtre local sur les gros Projects ;
- Quick Open en onglet CLIENT privilégie les liens SPA natifs au lieu d’un reload complet ;
- barre basse stabilisée : zones d’état, rôle WORKER/CLIENT, SAFE et `BY SKYNET` ne doivent plus se décaler lors des changements d’état ;
- Matrix légèrement plus visible au repos sans augmentation de cadence CPU, toujours fortement atténuée en activité/gros fil.

### Coach

- nouveau coach contextuel : le prompt courant domine le classement, Project/titre/derniers échanges servent uniquement à désambiguïser ;
- extraction de contraintes, technologies et entités réellement citées ;
- trois rôles distincts par recommandation : approche/diagnostic, angle mort/vérification, livrable/action ;
- recommandations spécialisées pour code, performance, design/UX, recherche, droit, comparaison, organisation, données et rédaction.

### Panneaux natifs

- traitement commun des panneaux **Activité**, **Sources** et **Sorties / Outputs** ;
- DA NiakGPT cohérente, header lisible et fermeture toujours accessible ;
- panneaux ouverts décalés à gauche du rail NiakGPT ;
- poignées/boutons repliés eux aussi déplacés pour ne jamais se chevaucher avec la barre latérale droite ;
- adaptation automatique lorsque le panneau NiakGPT droit est lui-même ouvert.

### Performance / architecture

- suppression du `routeTick` périodique du cœur ;
- navigation SPA pilotée par Navigation API / clic / `popstate` ;
- rebinding des observers uniquement quand les nœuds `main` ou sidebar changent réellement ;
- suppression des retries périodiques d’indexation sur les onglets qui ne peuvent pas travailler ;
- `CLIENT → WORKER`, retour à `PRÊT`, visibilité et navigation réveillent directement la file idle ;
- plus aucun polling permanent autorisé dans les nouveaux modules coach, dossiers épinglés ou panneaux latéraux.

### QA

- nouveaux invariants anti-`routeTick`, anti-retry périodique et anti-reload Quick Open CLIENT ;
- garde de géométrie pour la barre basse ;
- garde de coexistence rail droit / Activité / Sources / Sorties ;
- garde sur les dossiers épinglés instantanés et le coach contextuel.

## 0.9.5 — RC6

### Runtime / cycle de vie

- `manifest.json` devient la source de vérité de version pour les contrôles et le packaging ;
- ajout d’un service worker MV3 minimal pour distinguer installation neuve et mise à jour ;
- une mise à jour existante n’affiche jamais de force l’onboarding ;
- packaging du service worker avec vérification explicite dans le ZIP final.

### Workspace

- onboarding first-run en 4 étapes, ignorable et réservé aux nouvelles installations ;
- profils **Power**, **Code / IDE**, **Research**, **Focus / Writing**, **Analyst** et **High Contrast** ;
- Command Palette `Ctrl+Shift+P` pour Quick Open, Control Center, Safe Mode, Explorer, TOC, diagnostic, Governance, Matrix et profils ;
- profils accessibles depuis le Control Center ;
- raccourcis clavier et dialogues avec focus trap et restauration du focus.

### Performance / architecture

- cœur, chronologie, panneau Activité, Governance et pins natifs event-driven ;
- aucun polling permanent dans les modules applicatifs principaux ;
- WORKER / CLIENT partagé entre onglets ;
- Safe Mode coupe les tâches non essentielles et fait céder le WORKER ;
- cache chaud IndexedDB des conversations lourdes et déduplication réseau inter-onglets.

### Projects

- première page d’un Project sans `cursor=0` inventé ;
- pagination uniquement avec les cursors opaques réellement renvoyés ;
- `limit=20` avec fallback sans `limit` sur `422` ;
- compteurs réels + date de dernière activité ;
- nettoyage des reliquats/doublons et resynchronisation prudente ;
- priorité absolue aux déplacements manuels vérifiés et verrouillés.

### États / DA

- `CHARGEMENT`, `ATTENTE`, `RÉFLEXION / ANALYSE`, `EXÉCUTION`, `ERREUR`, `PRÊT` partagés entre onglets ;
- couleur d’activité sur la ligne du chat, le Project et la barre basse ;
- panneau Activité harmonisé et fermeture toujours accessible ;
- Matrix plus discret et adaptable ;
- profils visuels spécialisés sans dépendre des couleurs de thème ChatGPT.

### QA / release

- Visual Lab Playwright desktop/laptop/gros fil ;
- vraie extension non empaquetée chargée dans Chromium sur un `chatgpt.com` mocké ;
- tests de compteurs, pagination, activité, verrou manuel, Safe Mode et élection multi-onglets ;
- Public Quality Gate avec ZIP installable propre, garde de confidentialité et documentation obligatoire.

## 0.9.3 — RC4

### Performance / architecture

- cœur `app-v090.js` event-driven ;
- Governance et pins natifs 0.9 sans polling permanent ;
- chronologie et polish Activity sans boucle permanente ;
- garde unique du bloc Projects pour empêcher les duplications DOM ;
- coordination WORKER / CLIENT multi-onglets ;
- Safe Mode qui cède le rôle WORKER ;
- tracker d’activité auto-résilient au `document_start`.

### Projects

- première page de conversations Project sans `cursor=0` inventé ;
- pagination uniquement avec les cursors réellement renvoyés ;
- `limit=20` + fallback sur réponse `422` ;
- compteurs réels et date de dernière activité ;
- nettoyage des reliquats et doublons ;
- priorité absolue aux déplacements manuels vérifiés.

### UX

- Control Center ;
- Safe Mode ;
- états `CHARGEMENT`, `ATTENTE`, `RÉFLEXION / ANALYSE`, `EXÉCUTION`, `ERREUR` ;
- coloration du chat et du Project actifs ;
- panneau Activité harmonisé ;
- Matrix plus discret ;
- améliorations focus/accessibilité ;
- bloc Projects compact avec section secondaire.

### QA

- Visual Lab Playwright ;
- tests desktop/laptop/gros fil ;
- tests Control Center et Safe Mode ;
- lancement de la vraie extension non empaquetée dans Chromium sur un `chatgpt.com` mocké.

## 0.9.0 — Public RC architecture

- premier Control Center ;
- nouveau coordinateur multi-onglets faible coût ;
- export/import de configuration ;
- diagnostic sans contenu de conversation ;
- Safe Mode ;
- réglages Matrix, densité, coach, activités, pins et auto-resync.

## 0.8.7

- détection d’activité soutenue par le trafic réseau ;
- réduction des faux états `PRÊT` ;
- partage des états entre onglets.

## 0.8.6

- états visuels des conversations et Projects ;
- barre basse synchronisée sur l’activité réelle.

## 0.8.5

- Project Governance ;
- verrouillage des déplacements manuels ;
- nettoyage des reliquats ;
- pins natifs gouvernés.

## 0.8.4

- cache chaud IndexedDB des conversations ;
- déduplication réseau entre onglets.

## 0.8.3

- architecture WORKER / CLIENT multi-onglets.

## 0.8.2

- tri chronologique et dates visibles dans la sidebar.

## 0.8.1

- compatibilité compteur Project après erreurs `422` ;
- finitions DA et panneau Activité.

## 0.8.0

- reconstruction idle-safe du moteur ;
- indexation Project par Project ;
- cache-first ;
- Quick Open ;
- coach, sommaire, code, Matrix et DA NiakGPT.
