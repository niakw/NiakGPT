# Architecture de NiakGPT

## Invariant architecture 0.9.121 — une panne locale n’a pas le droit de devenir une boucle réseau

NiakGPT ne connaît pas de seuil numérique public et stable pour l’accès aux conversations ChatGPT et **ne doit donc pas en inventer un**. L’invariant 0.9.120 reste valide : pas de budget global N/minute, pas de cooldown arbitraire persistant et pas de compteur propriétaire qui bloque l’utilisateur.

La protection se fait désormais au niveau où l’échec est observé. Une conversation dispose de deux tentatives immédiates bornées. Si elles échouent, son identité `projectId + chatId`, son dernier type d’erreur et son compteur d’essais sont déplacés dans `niakgpt-project-memory-chat-retry-v117` avec `manual:true`. Cette entrée **n’alimente plus la queue automatique**. Le reste du Project continue et le chat fautif ne peut revenir sur le réseau que via l’action explicite **Réessayer les chats en échec**.

Un HTTP 429 est traité différemment d’un échec propre à un chat : il signale que l’accès conversationnel ChatGPT lui-même refuse la charge. La queue courante est alors conservée avec `hold:true` et `holdReason:'rate-limit-manual'`. Heartbeat, scheduler et reprise automatique respectent ce hold sans minuterie de déblocage. L’utilisateur libère volontairement la file avec **Reprendre après restriction ChatGPT** lorsque l’interface native est redevenue utilisable.

La pile manuelle ne change aucun invariant de durabilité : un chat `complete:true` reste sauté, les chemins Git sont canoniques par ID, la réconciliation 0.9.118 restaure les archives présentes et une reprise ciblée ne relit pas les chats sains déjà checkpointés. L’ancien backoff automatique de la 0.9.117 est donc **supplanté** par cette quarantaine manuelle.

## Invariant architecture 0.9.120 — aucune limite de débit Project Memory propriétaire

La 0.9.119 avait ajouté un budget logiciel global de lectures conversationnelles et un cooldown persistant. Cet état pouvait empêcher l’utilisateur de reprendre manuellement la synchronisation même lorsqu’il voulait explicitement continuer. **Cet invariant est annulé en 0.9.120.**

Project Memory ne maintient plus de `RATE_GUARD_KEY`, de fenêtre glissante, de compteur 10/minute ni de `cooldownUntil` persistant. Le mode prioritaire retrouve les cadences déjà utilisées avant 0.9.119 : `BACKGROUND_HISTORY_FETCH_GAP_MS = 4000` et `PRIORITY_HISTORY_FETCH_GAP_MS = 900`. Les garde-fous natifs déjà existants — génération active, vérification, réseau indisponible, onglet non propriétaire, HTTP 429 renvoyé par la requête elle-même — restent des événements ponctuels du transport, mais NiakGPT n’ajoute plus un blocage long de son propre chef.

Les invariants de durabilité 0.9.118 restent supérieurs : une conversation déjà complète est sautée, les archives durables peuvent reconstruire l’index de reprise, les writers obsolètes ne peuvent pas supprimer des checkpoints et aucun nouveau dossier n’est créé pour une conversation déjà connue.

## Invariant architecture 0.9.119 — la mémoire ne doit jamais dégrader l’accès natif ChatGPT

Project Memory partage le même compte et les mêmes endpoints conversationnels que l’interface native. La synchronisation historique est donc un consommateur **de second rang** : elle doit préserver en priorité la capacité de l’utilisateur à ouvrir, recharger et utiliser ses conversations.

Toutes les lectures `/backend-api/conversation/<id>` passent par un garde-fou persistant `niakgpt-project-memory-rate-guard-v119`. Il impose un intervalle minimal de 6 s et un budget maximal de 10 lectures dans une fenêtre glissante de 60 s. Le mode prioritaire ne possède aucune exception à cette règle.

Un signal de rate-limit — HTTP 429, erreur explicite du transport ou message natif de restriction visible dans la page — ouvre un circuit breaker de 15 minutes. Le cooldown est stocké dans `chrome.storage.local`, reporté dans la queue via `retryAt`, consulté avant `bootstrap`, `resume`, `schedule`, le heartbeat et les actions manuelles. Le cooldown ne supprime ni la queue ni les checkpoints.

La priorité continue d’accélérer uniquement les couches qui ne sollicitent pas l’API conversationnelle : réconciliation d’archives déjà présentes, index compact, écritures GitHub Create Tree et reprise au dernier chat durable. Cette séparation interdit qu’une optimisation de transfert puisse à nouveau provoquer un blocage de l’interface ChatGPT elle-même.

## Invariant architecture 0.9.118 — les dossiers de conversation sont l’autorité durable de dernier recours

Le Project `index.json` est un **index de reprise compact**, pas une copie de tout le contexte. Les signaux détaillés restent dans `conversations/<conversation-id>/index.json` et les transcripts dans `part-NNN.md`. Cette séparation empêche la taille de l’index Project de croître proportionnellement au contenu conversationnel et évite de franchir les limites d’inline de GitHub Contents.

Une lecture de fichier mémoire ne doit jamais confondre « GitHub Contents n’embarque plus le contenu » avec « fichier absent ». Si le payload Contents n’est pas en base64 mais fournit un SHA, le backend bascule sur `/git/blobs/<sha>`. Un gros index valide reste donc lisible et ne peut pas déclencher une initialisation vide.

Les écritures de `projects/<project>/index.json` sont **monotones par union** au niveau du service worker. Avant Create Tree, l’index entrant est fusionné avec celui du HEAD Git ; une entrée complète avec transcript ne peut pas être remplacée par une entrée metadata-only ou partielle, et un writer obsolète ne peut pas supprimer des conversations qu’il ne connaît pas.

Enfin, la reprise ne fait pas confiance à un seul fichier d’index. Avant tout rattrapage, `projectArchiveSnapshot` énumère les dossiers durables `conversations/<id>/` et relit uniquement les `index.json` absents de l’index courant, avec concurrence bornée à 8. Les checkpoints récupérés sont appliqués **avant** le calcul `chatDone/chatTotal` ; un Project dont l’index a été tronqué reprend donc au dernier transcript réellement présent dans le coffre, pas à 0.

La régression `project-memory-index-reconcile-v118.mjs` démarre avec un index Project contenant un seul chat, trois archives durables simulées et quatre chats locaux. Elle exige une reprise à 3/4 et interdit tout refetch des trois conversations déjà archivées.

## Invariant architecture 0.9.117 — une panne de lecture appartient au chat, pas au Project

Un échec transitoire de `/backend-api/conversation/<id>` ne peut plus interrompre tout `syncProject()`. Chaque conversation possède son état de retry local persistant. Après un petit nombre de tentatives immédiates, le chat fautif est différé avec une échéance croissante tandis que les autres conversations continuent. La queue globale ne réveille ce Project qu’à l’échéance utile, ce qui interdit l’ancienne boucle de reprise à 1 s sur le même chat.

Le chemin de stockage est une fonction de l’identité, jamais du titre ni de l’instant : `projects/<project-id>/conversations/<conversation-id>/part-NNN.md`. Une réimportation met donc à jour ces mêmes chemins dans l’arbre Git. L’historique Git conserve naturellement les anciennes révisions, mais l’état courant du coffre ne contient pas de second dossier pour la même conversation.

Le checkpoint durable reste **par conversation** : une conversation réussie et l’index Project qui la marque `complete:true` sont validés ensemble avant de passer à la suivante. Les accélérations restent sous cette frontière de sûreté : chunks de transcript portés à 1 000 000 caractères, contenu des fichiers injecté directement dans `Create Tree` en priorité afin d’éviter un appel `/git/blobs` par chunk, et vérification « dépôt toujours privé » mise en cache 5 minutes pendant le transfert. Ainsi une erreur ultérieure ne rejoue pas les chats déjà commités.

## Invariant architecture 0.9.116 — un chat durable vaut un checkpoint durable

Le backlog Project Memory ne peut plus utiliser la fin d’un Project comme seule frontière de reprise. Dès qu’un transcript canonique est écrit avec succès, son entrée `complete:true` est persistée dans `projects/<project>/index.json` dans la même écriture logique. Une interruption ultérieure ne doit donc rejouer au pire que la conversation dont l’écriture n’a pas abouti, jamais tout le préfixe déjà validé du Project.

Le mode utilisateur **Forcer la synchro des chats** est une promotion de priorité, pas un `force:true` destructif. Il conserve le filtre incrémental, réutilise la queue déjà restante lorsqu’elle existe, saute les chats complets et maintient son drapeau de priorité à travers pauses et retries jusqu’à convergence. Une synchro déjà active peut être promue via le changement de queue sans redémarrer sa progression.

La priorité augmente uniquement le débit des chemins déjà isolés : lecture conversation background à 900 ms minimum, retry occupé à 1 s, batching front plus large sous plafond octets et création de blobs GitHub avec concurrence bornée à 6. La branche GitHub reste une ressource sérialisée : `queueCommit`, relecture du ref, détection des races et update non forcé restent inchangés. Les gardes génération, peer occupé, vérification, réseau, visibilité/owner et rate-limit restent supérieures à la priorité.

La régression `visual-lab/project-memory-priority-sync-v116.mjs` couvre le scénario de panne : un premier chat est déjà durable, le suivant réussit, le troisième subit une erreur d’écriture, puis la reprise doit repartir du troisième sans relire le second et finir avec une queue vide.

## Invariant architecture 0.9.115 — le rattrapage historique ne dépend pas de 60 s de silence humain

Le transport historique `extension-background` lit uniquement `/backend-api/conversation/<id>` depuis le service worker et n’utilise ni le bridge MAIN-world ni le DOM de la conversation active. La contrainte de 60 secondes sans interaction utilisateur était donc trop large : elle protégeait correctement les chemins page/RPC, mais affamait aussi le transport worker sûr dès que l’utilisateur continuait à cliquer, écrire ou scroller.

0.9.115 sépare ces deux autorités. Le silence humain reste obligatoire pour les chemins qui peuvent concurrencer la page ChatGPT. En revanche, lorsqu’un chat est ouvert **et** que `backgroundHistoryProbe()` a prouvé le transport worker, Project Memory peut poursuivre son backlog à cadence bornée. Les états réellement dangereux restent bloquants : génération active, interruption réseau/vérification, peer occupé, onglet caché, changement d’owner et rate-limit.

Le rythme reste contrôlé par `BACKGROUND_HISTORY_FETCH_GAP_MS` entre deux lectures conversation et par `ACTIVE_HISTORY_RETRY_MS` lors d’un état temporairement occupé. Aucun polling agressif n’est ajouté et le worker ne lit toujours aucun endpoint large de liste de conversations.

La régression `visual-lab/project-memory-active-catchup-v115.mjs` démarre volontairement juste après une interaction — donc avec `quietFor() << 60 s` — sur un chat actif, avec le transport extension-background disponible. Elle exige qu’un transcript durable soit écrit en moins de huit secondes. Le runtime 0.9.114 échoue ce scénario en restant bloqué derrière le quiet gate.

## Invariant architecture 0.9.114 — le catalogue Projects durable n’est pas le snapshot live

`PROJECTS.json` reste le snapshot de bootstrap du cache local : il peut être réécrit fréquemment et ne constitue donc pas une autorité historique. `PROJECT_CATALOG.json` devient la borne high-water privée : elle n’est écrite que lorsque `serverIndexedAt > 0` prouve que l’inventaire local provient d’un index serveur ChatGPT courant. Une reconstruction depuis le coffre conserve `serverIndexedAt=0` et n’a donc jamais le droit de rétrograder cette borne.

Au cache froid, Project Memory énumère les répertoires privés `projects/g-p-*`, relit uniquement les métadonnées sûres de `project.json`, et applique l’ordre du catalogue high-water. Cette récupération complète l’inventaire local uniquement lorsque celui-ci est plus pauvre et qu’aucun index serveur courant n’existe. Dès qu’un index courant existe, il reste l’autorité absolue, même lors d’une synchronisation forcée.

La réparation de catalogue et la réparation de gouvernance sont liées pour le scénario de panne exact : si `coreProjectIds` reflétait intégralement l’unique Project d’un cache lui-même réduit à 1/1, l’ensemble des Projects visibles récupérés redevient cible du classement automatique. Une sélection partielle explicitement manuelle n’est jamais élargie, les Projects masqués restent masqués et le Project « À classer » reste hors des cibles.

La sidebar ne devine plus sa structure à partir d’un titre « Projects ». La fixture terrain 0.9.114 couvre aussi le layout ChatGPT actuel sans heading : groupe de dossiers natifs + bouton « Afficher plus » + section Chats. Une fois plusieurs identités Projects récupérées, `sidebar-projects-authority-v112.js` acquiert et masque ce groupe natif, `sidebar-projects-v121.js` rend le catalogue complet dans ce slot, et les chats génériques restent dans leur section native jusqu’à un classement réellement décidé.

## Invariant architecture 0.9.113 — revenir à la dernière frontière terrain qui chargeait

Les retours réels 0.9.104 → 0.9.112 ont invalidé l’architecture qui faisait dépendre tout le démarrage de preuves React privées. La frontière de régression est nette : 0.9.103 utilisait encore le même bootstrap que 0.9.81 et chargeait sans `HostRoot`, `__reactContainer$…`, `__reactFiber$…` ni `isDehydrated`; 0.9.104 a introduit cette dépendance, puis 0.9.105 a déplacé en plus tous les styles derrière ce gate, transformant une erreur de preuve en panne totale de l’UI.

0.9.113 restaure donc le contrat 0.9.103 au niveau architectural : CSS déclaratif dans le manifest à `document_start`, JavaScript à `document_idle`, attente du shell, identité hôte stable 1,6 s, vraie fenêtre calme 1,2 s, deux passages idle bornés, frames, puis seconde stabilité hôte. Le service worker n’inspecte plus les internals React et n’injecte plus les styles dynamiquement.

La non-régression `hydration-known-good-v113.spec.js` charge l’extension MV3 réelle, ne crée **aucun** marqueur React privé, provoque deux remplacements tardifs de `nav/main` via `MessageChannel`, exige zéro activation NiakGPT pendant ces remounts, puis exige le montage réel de `#ng8-rail`. Les tests HostRoot/Fiber 0.9.106–0.9.112 sont conservés comme historique mais ne définissent plus l’autorité de release, car ils validaient l’architecture contredite par le terrain.


## Invariant architecture 0.9.112 — une SPA active n’a pas à devenir silencieuse

Le test terrain 0.9.111 a exposé une erreur de modèle : après récupération React, ChatGPT peut continuer à modifier en permanence le contenu, les attributs, les compteurs ou les états de ses descendants. Exiger une fenêtre **globale** sans mutation revient donc à attendre un état qui peut ne jamais exister, même lorsque le HostRoot est déjà settled et que les nœuds structurants ne bougent plus.

Le gate post-HostRoot surveille maintenant uniquement ce qui est pertinent pour le risque d’hydratation : identité de `nav/aside`, `main` et du composer, deux tours idle, frames, puis nouvelle lecture du HostRoot courant et de l’ownership React. Une mutation non structurelle dans un message ou un attribut ne remet plus le boot à zéro. Un remount réel d’un des nœuds hôtes invalide toujours la tentative.

La régression MV3 `hydration-active-spa-v112.spec.js` démarre avec un HostRoot récupéré et settled, émet un #418 `HTML`, puis maintient une mutation d’attribut toutes les 120 ms. Sur 0.9.111 inchangée, ce test reste sans `data-ng100-hydration-proof` et sans rail après 12 s. En 0.9.112 il doit monter le rail tout en conservant les protections `hydration-scheduler-drain-v111` contre les remounts tardifs.

## Invariant ordre React 0.9.111 — HostRoot settled + scheduler réellement drainé

Le retour terrain de 0.9.110 a remis en évidence une course déjà rencontrée en 0.9.81 : React peut exposer un HostRoot courant apparemment stabilisé tout en conservant des commits différés dans son scheduler `MessageChannel` / `MessagePort`. La preuve HostRoot est donc **nécessaire mais plus suffisante à elle seule**.

Après une première preuve MAIN-world positive, `boot-gate-v100.js` impose désormais une barrière post-React déterministe : identité `nav/main/composer` stable pendant 1,6 s, vraie fenêtre de 1,2 s sans mutation (attributs compris), deux passages `requestIdleCallback` bornés, frames, pause inter-frame, puis comparaison stricte des mêmes identités hôtes. Le gate relit ensuite le HostRoot courant dans le monde MAIN et exige encore `rootFound && rootSettled && !rootDehydrated` avec les identités hôtes toujours possédées par React.

Toute mutation pendant la fenêtre calme invalide la tentative. Tout remount de `nav/main/composer` invalide l’identité. Le gate peut recommencer plusieurs tours bornés mais n’utilise ni polling agressif ni temporisation seule comme preuve. Si les internals React privés deviennent indisponibles, la même barrière scheduler/shell est exigée avant tout fallback par interaction utilisateur trusted.

La régression `hydration-scheduler-drain-v111.spec.js` charge l’extension MV3 réelle avec un HostRoot déjà « settled », puis déclenche encore deux remplacements hôtes tardifs via `MessageChannel`, dont un #418 `HTML`. Elle interdit tout `data-ng*`, rail ou runtime NiakGPT jusqu’à la fin de ces commits et exige ensuite le montage réel de `#ng8-rail`.

## Invariant hydratation React 0.9.110 — récupération #418 sans deadlock

Le gate lit le **HostRoot courant** dans le monde MAIN. Un `memoizedState.isDehydrated === true` explicite interdit toujours toute mutation NiakGPT. En revanche, après un mismatch React récupérable (#418), React peut basculer vers un rendu client où le HostRoot courant ne porte plus du tout la clé `isDehydrated`; cet état est désormais considéré comme **post-hydratation récupéré**, et non comme une attente infinie.

L’ownership React de `<html>` et `<body>` reste enregistré pour le diagnostic, mais n’est plus une condition de démarrage. Le gate exige toujours un HostRoot courant, au moins deux identités hôtes React (`nav/aside`, `main`, composer), une seconde confirmation après frames, puis une fenêtre de stabilité. Si le probe MAIN-world ne peut rien prouver, une interaction utilisateur **réelle** reste le fallback, avec un latch actif dès le chargement du content script afin qu’une interaction précoce ne soit pas perdue.

## Invariant styles 0.9.110 — zéro influence avant hydratation

Le manifest ne déclare plus aucune feuille CSS dans `content_scripts`. `background-v100.js` possède l’unique `STYLE_RUNTIME` et appelle `chrome.scripting.insertCSS()` seulement après réception de `niakgpt:inject-runtime-v100`, donc après le gate d’hydratation. Les styles et le JavaScript NiakGPT partagent désormais la même frontière temporelle : **rien de NiakGPT ne peut influencer le DOM ou sa mise en page avant la preuve d’hydratation**.

Le gate React ne lit plus les clés internes `__reactContainer$…` / `__reactFiber$…` depuis le monde isolé du content script. Le service worker exécute un probe sans mutation dans le monde `MAIN` et retrouve le HostRoot courant soit via `__reactContainer$…`, soit en remontant `.return` depuis les `__reactFiber$…` des nœuds hôtes ChatGPT. Un `isDehydrated:true` explicite reste bloquant ; l’absence de ce flag sur le HostRoot courant après recovery est acceptée comme rendu client stabilisé. Les marqueurs de `<html>` et `<body>` sont conservés pour le diagnostic mais ne déverrouillent ni ne bloquent à eux seuls. Une seconde confirmation HostRoot + identités hôtes est toujours requise. Les sentinelles volatiles `data-build` / `window.__reactRouterContext` ne constituent aucune voie de déverrouillage.

## Invariant hydratation React 0.9.110 — aucune mutation avant propriété de la racine document

Un DOM visuellement stable ne suffit pas : React peut encore hydrater ou récupérer un mismatch. `boot-gate-v100.js` demande donc au service worker un probe `chrome.scripting.executeScript(..., world:'MAIN')` qui vérifie le HostRoot courant et au moins deux nœuds hôtes React (`__reactFiber$…` / `__reactProps$…`) avant de poser le moindre attribut/nœud NiakGPT. Les expandos éventuels de `<html>` et `<body>` sont observés uniquement pour le diagnostic. Le content script isolé n’inspecte jamais directement ces internals. À défaut de preuve MAIN-world, il exige une surface native stable puis une interaction utilisateur réellement trusted, sans délai arbitraire de déverrouillage.

Le gate enregistre ensuite uniquement après cette preuve `data-ng100-hydration-proof=react-document-root-settled|trusted-interaction`. Une erreur d’hydratation React #418 observée avant activation reste mémorisée comme signal hôte, mais ne condamne plus définitivement NiakGPT : un HostRoot ensuite stabilisé dans le monde MAIN, ou à défaut une interaction native fiable, peut autoriser le démarrage sans mutation précoce.

## Invariants terrain actuels 0.9.110

- **Chat courant = zéro lecture via le broker réseau de la page.** La conversation affichée est sauvegardée immédiatement depuis le DOM visible. Après une minute de calme, le service worker MV3 peut compléter l’historique avec un GET strictement borné à `/backend-api/conversation/{id}` ; son jeton ChatGPT est éphémère et mémoire-only.
- **Peer chat = quarantaine ordinaire, exception mémoire bornée.** Depuis un onglet hors chat, seuls les GET `memoryBootstrap:true` de Project Memory (conversation complète ou inventaire ciblé d’un Project incomplet) peuvent traverser un peer visible mais inactif. `ng90PeerBusy`, génération, vérification ou incident réseau referment l’exception et annulent les GET en vol.
- **Complétude = identité + compte.** `indexed:true` ne suffit pas : si `knownConversationCount > cachedConversationCount`, Project Memory conserve la queue et réclame une réparation ciblée.
- **Pins dans une lane verticale pleine largeur.** `ux-v131.js` privilégie le scrollport ChatGPT `Historique de chat / Chat history`; `sidebar-projects-v121.js` remonte jusqu’à la section Chats complète et rejette tout parent de montage flex-row ou grid multi-colonne. `#ng8-pins` ne peut donc plus partager la ligne du titre Chats.
- **GitHub découplé des lectures ChatGPT.** Project Memory écrit immédiatement `PROJECTS.json` et les checkpoints depuis le cache local ; les payloads complets sont archivés de façon opportuniste et séquentielle. Un chat courant peut être capturé depuis le DOM sans lecture backend.
- **Cache local ≠ autorité Project canonique.** Des entrées locales/dom-only peuvent alimenter un fallback Pins, mais elles ne suffisent jamais à masquer la surface Projects native ni à inventer des `coreProjectIds`. Le passage à l’autorité NiakGPT n’a lieu qu’après présence d’identités canoniques `g-p-*`.
- **Remount sidebar = recréation, pas disparition silencieuse.** La suppression externe de `#ng8-pins` est traitée comme un événement de cycle de vie même pendant un epoch interne. v131 demande explicitement une réconciliation quand la sidebar active existe mais que le bloc Pins manque, puis le self-heal repeuple le fallback local sans lecture backend ChatGPT.
- **Privacy fail-closed sur l’arbre public.** La CI parcourt tous les fichiers texte suivis par Git et refuse les marqueurs privés connus, les e-mails non synthétiques, les chemins utilisateur locaux et les secrets/tokens plausibles.


NiakGPT est une extension Manifest V3 locale qui ajoute une couche power-user à l’interface web de ChatGPT. L’architecture 0.9.112 privilégie cinq propriétés : **faible coût runtime**, **priorité absolue au flux natif ChatGPT**, **priorité explicite à l’utilisateur**, **un seul propriétaire par surface**, et **dégradation sûre quand ChatGPT change**.

## Périmètre

Le manifest 0.9.112 déclare :

```text
https://chatgpt.com/*
https://api.github.com/*
https://github.com/login/*
https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/*
```

Le dernier host est le callback HTTPS exact dérivé de l’ID public et stable de l’extension ; il ne donne accès à aucun dépôt GitHub ni à aucune donnée utilisateur.

Aucun serveur NiakGPT n’est requis. Les caches, réglages, états de gouvernance et verrous restent dans le profil navigateur local. Project Memory utilise `api.github.com`, la permission `identity` et l’échange OAuth borné sur `github.com/login/*` uniquement après un geste explicite de connexion.

## Barrière d’hydratation React

Depuis 0.9.81, **aucun JavaScript NiakGPT n’est déclaré à `document_start`**. Le groupe bootstrap démarre à `document_idle`, puis `boot-gate-v100.js` exige plusieurs preuves avant d’émettre `niakgpt:host-hydrated-v100` : chargement complet, identité stable des nœuds `nav/main/composer`, longue période sans mutation, deux passages via `requestIdleCallback` (avec fallback borné), puis plusieurs frames.

Cette combinaison corrige un angle mort de 0.9.80 : React peut continuer son scheduler via `MessagePort` sans muter le DOM pendant plusieurs centaines de millisecondes. Un simple « DOM calme » ne prouve donc pas que l’hydratation est terminée.

Jusqu’au signal final, `composer-continuation-v128.js`, `long-run-watchdog-v129.js`, `pin-interaction-rescue-v129.js`, `project-menu-augment-v129.js` et `continuity-native-handoff-v129.js` restent dormants et ne lancent **aucun observer, timer, interception ou mutation DOM**.

Le gate `visual-lab/hydration-barrier-v080.mjs` reproduit maintenant deux remplacements tardifs du shell via `MessageChannel`, après de fausses périodes de calme, et exige que NiakGPT reste inactif jusqu’à la stabilité finale sur Chromium, Firefox et WebKit.


## Invariant Project Memory 0.9.102 — coffre écrit immédiatement, archive opportuniste et complète

`project-memory-v132.js` conserve une file persistante et un heartbeat local de secours de 30 s. La connexion au coffre écrit immédiatement un snapshot depuis le cache local. Sur le chat courant, les messages visibles sont archivés directement depuis le DOM avec `complete:false` ; un passage backend ultérieur peut remplacer cette version partielle. Hors chat, la synchro canonique reste séquentielle, espacée et suspendue dès que ChatGPT devient occupé.

La complétude est contrôlée par le compteur connu : un Project `indexed:true` mais `known > cached` déclenche `niakgpt:force-server-index` en mode `memoryBootstrap` ciblé. Si l’écart persiste, la queue reste en `inventory-incomplete` au lieu d’être supprimée.

## Invariant réseau 0.9.102 — exception mémoire minimale

`page-bridge.js` continue de bloquer le trafic NiakGPT ordinaire dès qu’une conversation visible existe. La seule exception cross-tab est un GET Project Memory explicitement marqué `memoryBootstrap:true`, exécuté depuis un onglet hors chat à côté d’un peer visible mais inactif. Elle couvre uniquement le détail d’une conversation et l’inventaire `/gizmos/<project>/conversations` nécessaire à la fermeture d’un count-gap. Une génération ou `ng90PeerBusy` annule immédiatement ces lectures.

## Invariant Pins 0.9.87 — le launcher Projects suffit

`sidebar-projects-v121.js` accepte le launcher natif visible `/projects` comme ancre autoritaire même lorsque ChatGPT n’a pas encore hydraté les liens `/g/g-p-*`. Le bloc est explicitement libellé **PINS · PROJECTS** afin d’éviter toute confusion avec la surface native.

## Invariant DOM 0.9.84 — hydratation tardive, remount direct, jamais de reparenting des Pins

Le bloc `#ng8-pins` n’est plus créé à un endroit provisoire puis déplacé. `sidebar-projects-v121.js` calcule d’abord son emplacement final dans la **sidebar visible et active**, puis crée le nœud directement à cet emplacement.

Si ChatGPT remonte sa sidebar pendant une conversation :

1. l’ancien bloc Pins reste dans l’ancien shell et est neutralisé sur place (`data-ng121-retired="1"`) ;
2. son ID actif est libéré sans déplacer ce nœud ;
3. un nouveau `#ng8-pins` est créé directement dans le nouveau shell ;
4. aucun même nœud Pins ne change de parent après son premier mount ;
5. les insertions internes passent par `safeInsert()`, qui refuse toute relation parent/descendant invalide.

`ux-v131.js` exclut les shells cachés/inertes/`aria-hidden` et privilégie le shell réellement hit-testable. En 0.9.84, `sidebar-projects-v121.js` **n’utilise plus de fallback générique au tail de la sidebar tant que la navigation primaire n’est pas identifiable**. Il reconnaît aussi les contrôles natifs par href ou libellé, accepte une surface Projects visible même avant que ses liens soient chargés, observe l’arrivée tardive des contrôles primaires, puis compare en continu le slot idéal au slot courant. Si ChatGPT révèle ensuite un meilleur emplacement, l’ancien bloc est retraité (`retired`) et un **nouveau** bloc est monté directement au bon endroit : aucun même nœud n’est reparenté. `pins-late-hydration-v084.mjs` couvre précisément le scénario terrain où NiakGPT arrive avant ChatGPT puis où les contrôles natifs et le slot Projects apparaissent en plusieurs phases.

## Deux mondes d’exécution

### MAIN world

Le monde MAIN est volontairement réduit à :

```text
page-bridge.js
```

Son rôle est borné aux intégrations qui exigent le même contexte JavaScript que l’application ChatGPT : bridge RPC gouverné, observation des mutations réseau utiles et signaux strictement nécessaires aux modules isolés.

**Invariant : NiakGPT ne remplace pas globalement `window.fetch`.** L’ancien hotcache/intercepteur global n’est pas réactivé.

### Isolated world

Le reste du produit vit dans le monde isolé :

- cache bus et garde de cache ;
- sanitation metadata ;
- index Projects et gouvernance ;
- classement / reclassement ;
- sidebar, pins, drawers et actions ;
- navigation, fil d’Ariane et continuité ;
- activité, panneaux natifs et visualiseur ;
- gros fils et performance ;
- coordination multi-onglets ;
- profils, Control Center, coach et diagnostics ;
- garde UX finale `ux-v131.js`.

Project Memory v132 vit bien dans le monde isolé, mais **hors du runtime critique** : `background-v100.js` termine d’abord `ISOLATED_RUNTIME` jusqu’à `ux-v131.js`, répond au boot principal, puis tente `OPTIONAL_RUNTIME = [project-memory-v132.js, project-memory-ui-v132.js]` en best-effort.

Les fichiers sont injectés séquentiellement par `background-v100.js` après le boot gate. `ux-v131.js` est volontairement le dernier runtime isolé : il vérifie le host réel et applique les invariants UX finaux sans reprendre la propriété métier des modules précédents.

## Project Memory v132 — transport privé opt-in

Project Memory sépare volontairement **le transport GitHub** de **la logique Project**.

`project-memory-background-v132.js` est chargé dans le service worker par un `importScripts()` protégé par `try/catch`. Son échec ne doit jamais empêcher le service worker principal d’enregistrer le bootstrap Projects. Il est l’unique propriétaire des appels `api.github.com` et de la gestion du token. Il :

- normalise dépôt, branche, racine et chemins ;
- refuse toute racine/path traversal ;
- vérifie `private: true` et refuse un dépôt archivé ;
- revérifie le caractère privé avant lecture/écriture ;
- possède le parcours principal **GitHub App Manifest → installation GitHub → OAuth → liste des dépôts autorisés → choix du coffre** ;
- crée une GitHub App privée propre au profil utilisateur, sans secret partagé dans le dépôt public ;
- valide les deux `state` et les callbacks `chromiumapp.org` avant échange du code ;
- conserve le user access token en session et le refresh token/client secret de cette GitHub App personnelle dans le profil local ; le PEM renvoyé par GitHub est jeté ;
- maintient le fine-grained PAT historique uniquement comme fallback avancé ;
- borne les batches Git et ne force jamais une ref de branche ;
- sait créer le premier blob/tree/commit/ref d’un dépôt privé totalement vide ;
- ne persiste token/configuration qu’après initialisation GitHub réussie.

`project-memory-v132.js` vit dans le monde isolé. Il possède :

- le bootstrap des Projects non vides déjà présents dans l’index NiakGPT ;
- la **création immédiate d’une queue persistante** dès la connexion du coffre, avant le travail réseau lourd ;
- la récupération automatique d’un coffre connecté mais sans `lastSyncAt` : au démarrage, la queue est recréée à partir de l’index local, sans demander une nouvelle connexion GitHub ;
- la queue persistante de synchronisation/reprise, exécutée par un seul onglet WORKER ;
- l’archive séquentielle des conversations ;
- l’extraction bornée de signaux tâches / décisions / architecture ;
- le `PROJECT_STATE.md` compact ;
- la synchro incrémentale basée sur le timestamp canonique du fil ;
- le cache local du checkpoint ;
- l’injection **une seule fois** du checkpoint au premier message d’un nouveau fil Project.

`project-memory-ui-v132.js` ne possède aucun transport. Il expose d’abord « Se connecter avec GitHub », puis le compte et les dépôts privés réellement autorisés ; le PAT manuel est relégué dans une section avancée. Il lance un rendu initial à son injection et écoute `niakgpt:control-center-rendered`, afin que Project Memory apparaisse même si le Centre de contrôle était déjà ouvert avant l’arrivée de l’OPTIONAL_RUNTIME. Il affiche la file persistante, la dernière synchro et la dernière erreur. Un échec conserve les valeurs utiles et ne remonte jamais comme erreur du runtime critique.

### Capture visible et lecture complète d’un fil

Le contrat historique « pas de GET conversation complet en fonctionnement normal » reste vrai.

Quand un chat Project est déjà affiché, `project-memory-v132.js` sérialise directement les blocs `[data-message-author-role]` visibles vers le coffre privé. Cette capture ne passe pas par `page-bridge.js` et n’émet donc **aucun trafic backend ChatGPT**. Elle est marquée `captureSource: live-dom`, `historyPartial: true`, `complete: false` : elle constitue une sauvegarde utile immédiatement, mais ne prétend pas prouver que les parties virtualisées/non rendues ont été capturées.

Pour l’archive canonique, `page-bridge.js` n’autorise `GET /backend-api/conversation/{id}` que si la requête porte explicitement `memoryBootstrap: true`. Le chat courant reste toujours quarantiné. Depuis un onglet hors chat, cette lecture mémoire peut coexister avec une conversation **visible mais inactive** dans un autre onglet ; `multitab-v090.js` distingue désormais `ng90PeerChatActive` de `ng90PeerBusy`. Dès qu’un peer génère, l’exception se ferme et les GET NiakGPT en vol sont annulés. Tous les autres modules restent bloqués par la présence du peer chat.

Le bootstrap cache GitHub fusionne l’index distant existant : une entrée ayant déjà `parts>0` et `messages>0` n’est jamais rétrogradée vers `0/0`. Une capture DOM partielle reste en revanche éligible à la synchronisation canonique suivante.

### Stockage canonique

```text
<root mémoire>/
├── niakgpt-memory.json
└── projects/<project-id>/
    ├── project.json
    ├── index.json
    ├── PROJECT_STATE.md
    └── conversations/<conversation-id>/
        ├── index.json
        └── part-001.md ...
```

L’historique complet est un stockage durable. Le checkpoint est la surface de contexte normale. NiakGPT ne réinjecte donc pas tout l’historique à chaque prompt.

**Invariant de confidentialité : le dépôt public NiakGPT n’est jamais une destination de mémoire utilisateur. Les fixtures publiques sous `test/` sont exclusivement synthétiques. Le dépôt public et ses GitHub Actions ne possèdent aucun credential vers un coffre utilisateur et ne connaissent pas son nom ; la GitHub App privée, ses identifiants, le choix de dépôt et les tokens n’existent que dans le profil navigateur/GitHub de l’utilisateur.**

## Invariant UI 0.9.84 — une sélection utilisateur ne doit pas être détruite par les diagnostics

`app-v090.js` peut recevoir des événements de diagnostic fréquents. Tant qu’un `Selection/Range` natif non vide se trouve dans le panneau Diagnostic, le panneau ne reconstruit plus son `innerHTML`. Les mises à jour sont différées par un timer borné puis reprennent dès que la sélection est relâchée. `diagnostic-selection-v083.mjs` vérifie la conservation du même nœud DOM et du texte sélectionné pendant des changements d’état.

## Invariant runtime 0.9.102 — un propriétaire actif par surface

`sidebar-projects-v121.js` est le seul propriétaire du placement Projects/Pins ; l’ancien `sidebar-ux-v119.js` reste dans l’historique du dépôt mais n’est plus injecté ni présent dans le ZIP. Pour les panneaux natifs de droite, `side-panels-v096.js` est le seul propriétaire actif ; `live-fixes-v104.js` est également retiré du runtime et du package. Ces deux retraits suppriment des chemins critiques qui ne faisaient plus de travail utile ou doublaient un observer/mutateur existant.

`live-fixes-v106.js` conserve son rôle de contexte Project mais son observer global est désormais filtré : les mutations ordinaires du flux de conversation ne déclenchent plus de balayage global des anciennes classes de migration. La même règle s’applique au garde de remount `sidebar-icons-v114.js` et à l’UI optionnelle Project Memory : ils rejettent désormais le churn de `<main>` avant toute recherche globale de sidebar/Control Center.

Un Project présent dans `hiddenProjectIds` reste connu comme identité canonique, mais il est exclu de `coreProjectIds` réparés et de toutes les cibles de classement normal, profond ou de nettoyage automatique. Le masquer ne peut donc plus le ressusciter comme destination automatique.

Le rattachement automatique des conversations n’a qu’une autorité réseau : `reclassify-v101.js` puis `reclassify-deep-v112.js`, tous deux sous `niakgpt-data-mutation-v100`. `project-governance-v090.js` ne possède plus d’`autoResync()` autonome ; il reste un outil de nettoyage **manuel** et prend le même verrou partagé avant toute mutation explicite.

La continuité suit la même règle de propriété : `continuity-v112.js` produit/injecte le pending enrichi, `continuity-v100.js` conserve la détection OUT et l’API de capsule, mais **aucun des deux ne PATCH plus le Project du nouveau chat**. `continuity-consumer-v124.js` est l’unique consommateur du pending partagé qui rattache le nouveau chat et persiste le verrou de gouvernance, sous `niakgpt-data-mutation-v100`. Le handoff natif v129 utilise un namespace distinct mais prend le même verrou avant son PATCH.

## Invariant 1 — sanitation du cache avant les consommateurs

L’ordre de démarrage critique est :

```text
cache-bus-v096.js
→ diagnostic-bus-v096.js
→ sidebar-metadata-v118.js
→ cache-guardian-v100.js
→ recovery-v100.js
→ server-index-v100.js
→ gouvernance / reclassement
→ UI
→ ux-v131.js
```

`sidebar-metadata-v118.js` est une IIFE async. Sa première sanitation du cache est attendue avant la fin de son injection. Comme l’injecteur attend chaque `chrome.scripting.executeScript`, les consommateurs suivants ne doivent jamais démarrer sur le snapshot sale que ce module sait reconnaître.

Le module metadata peut :

- convertir une date de sidebar en élément `<time>` ;
- supprimer un faux badge Project qui est en réalité une date ;
- supprimer du cache un pseudo-Project `domOnly` dont le nom est une date ;
- nettoyer un nom Project canonique pollué par les décorations NiakGPT (icône, date, compteur) ;
- réparer l’affectation d’un chat depuis son `href` canonique ;
- exposer aux abonnés du cache bus une vue nettoyée.

Il **ne doit jamais** masquer Projects, ajouter les marqueurs de l’autorité Projects, observer les attributs de toute la sidebar ou réintroduire les anciennes classes `ng107/ng108`.

## Invariant 2 — une seule autorité de visibilité Projects

`sidebar-projects-authority-v112.js` est l’unique propriétaire de la visibilité des Projects natifs.

Quand `#ng8-pins` existe et est sain, l’autorité reconnaît les surfaces Projects natives par :

- structure de sidebar ;
- lien `/projects` ;
- liens `/g/g-p-*` ;
- libellés `Projets / Projects` ;
- identité de plusieurs Projects réellement gérés par `#ng8-pins` ;
- remounts/rerenders de roots frères ou séparés.

Elle utilise le marqueur passif :

```text
data-ng112-native-projects="1"
```

Le CSS courant masque ce marqueur. L’autorité ne réécrit pas en boucle les classes natives, ne pose pas `aria-hidden` et n’observe pas les attributs globaux.

Les anciens propriétaires `sidebar-authority-v107.js` et `sidebar-expando-guard-v108.js` restent uniquement comme régressions historiques. Ils ne sont ni injectés ni empaquetés. `side-panels-v096.js` est l’unique propriétaire JavaScript des panneaux natifs Activité / Réflexion / Sources / Outputs ; il possède aussi l’offset du rail et la reprise BFCache. `live-fixes-v104.js` n’est plus injecté ni empaqueté (son CSS historique reste utilisé pour les règles visuelles communes). `live-fixes-v106.js` gère le contexte Project avec un observer filtré et retire ponctuellement les anciennes marques de migration, sans devenir une autorité concurrente.

## Invariant 3 — un seul host Projects géré, dans la vraie sidebar gauche

Il ne doit exister qu’un seul `#ng8-pins`.

Le host doit :

- vivre dans la sidebar native gauche réellement vérifiée ;
- être réutilisé à chaque redraw ;
- ne pas devenir visible tant que v131 n’a pas vérifié son host ;
- supprimer les doublons historiques ;
- ne jamais être inséré à côté du `<nav>` ou dans une fausse surface centrale par erreur.

`sidebar-projects-v121.js` possède le **catalogue et le placement** incrémental du host. `ux-v131.js` fournit `__NIAKGPT_FIND_SIDEBAR_V131__`, sélectionne la vraie sidebar par géométrie/structure et marque le host comme vérifié ; lorsque v121 est actif, v131 ne reparente pas lui-même le même conteneur et ne crée donc pas une seconde autorité de placement.

`pin-folders-v096.js` transforme chaque Project épinglé en dossier dépliable sans créer un second système Projects.

## Invariant 4 — scroll et identité DOM appartiennent à l’utilisateur

Un refresh de cache ou une mise à jour de timestamps ne doit pas reconstruire le catalogue Projects ni remettre son scroll à zéro.

`sidebar-projects-v121.js` :

- réutilise les nœuds Project existants ;
- conserve l’ordre de session tant que la composition réelle des Projects ne change pas ;
- mémorise le scroll du catalogue et celui des drawers indépendamment ;
- restaure un scroll pendant les réconciliations internes ;
- annule cette restauration dès qu’un nouveau geste utilisateur réel (`wheel`, `touchmove`, clavier de scroll) survient.

Un test qui programme directement `scrollTop` sans intention utilisateur ne doit pas être confondu avec le contrat de production : les gates humains simulent explicitement le geste correspondant.

## Invariant 5 — hitboxes atomiques et accessibilité clavier

Chaque ligne Project possède deux zones exclusives :

- le Project/drawer ;
- son bouton d’actions `…`.

Chaque conversation dans un drawer utilise `.ng96-chat-entry` avec :

- un lien conversation ;
- un bouton d’actions frère ;
- aucun bouton interactif imbriqué dans le lien ;
- aucune superposition de hitboxes ;
- une cible d’action d’au moins 24×24 px.

Les menus exposent `aria-haspopup`, `aria-expanded` et `aria-controls`; `Enter`, flèches, `Home`, `End` et `Escape` suivent le contrat menu. Les dialogues de renommage utilisent `role="dialog"`, `aria-modal`, un label explicite et un focus borné.

Le layout est mesuré par pixel (`getBoundingClientRect`, `elementFromPoint`) dans les gates courants.

## Invariant 6 — menus d’action isolés par session

Les actions de sidebar ne doivent jamais mélanger l’identité d’un Project et celle d’un chat.

Pour éviter les collisions :

1. une action NiakGPT photographie les menus déjà visibles ;
2. ces menus constituent la baseline et ne doivent jamais être déplacés ;
3. seuls les menus nouvellement visibles appartiennent à la session courante ;
4. le menu et ses sous-menus peuvent être promus hors du clipping de la sidebar ;
5. à la fermeture, NiakGPT retire toute propriété qu’il possède ;
6. un second clic sur le même déclencheur ferme la session ;
7. si React réutilise le même nœud, celui-ci doit reprendre sa géométrie native ;
8. un échec d’ouverture ou la fermeture d’un fallback termine immédiatement la session afin qu’aucun timer tardif ne capture un menu sans rapport.

Les mutations locales de renommage/déplacement sont ciblées sur l’entité exacte et horodatées afin qu’un snapshot canonique plus ancien ne les annule pas immédiatement.

## Invariant 7 — pas de polling global permanent

Les modules applicatifs ne doivent pas rescanner périodiquement tout le DOM « au cas où ».

Préférer :

1. événement réseau déjà observé ;
2. changement `chrome.storage.local` / cache bus ;
3. `BroadcastChannel` ;
4. navigation SPA ;
5. mutation ciblée du conteneur concerné ;
6. travail différé ponctuel avec `requestIdleCallback` ou `setTimeout`.

Un timer récurrent n’est acceptable que pour un état réellement temporel/distribué et ne doit jamais déclencher de scan large du DOM.

## Invariant 8 — un seul WORKER entre onglets

Lorsqu’un utilisateur ouvre plusieurs onglets ChatGPT :

- un seul onglet devient `WORKER` ;
- les autres restent `CLIENT` ;
- les CLIENT réutilisent les caches partagés ;
- indexation et traitements lourds ne doivent pas être multipliés ;
- un WORKER chargé par un gros fil peut céder son rôle ;
- Safe Mode doit également céder le rôle WORKER.

`navigator.locks` est utilisé lorsqu’il est disponible, avec fallback local et coordination `BroadcastChannel`.

## Invariant 9 — manuel > automatique

Un déplacement de conversation réalisé via l’interface native de ChatGPT est une décision utilisateur.

Le flux attendu :

1. détecter la mutation native fiable ;
2. vérifier la destination serveur quand le chemin l’autorise ;
3. enregistrer un verrou local persistant ;
4. exclure la conversation du reclassement automatique ;
5. ne lever le verrou que par action explicite.

Un déplacement vers **Hors projet** est valide.

`continuity-exact` est également prioritaire sur le recommender normal.

## Invariant 10 — aucune réussite supposée après une mutation

Les endpoints internes de ChatGPT sont non documentés. Une réponse HTTP atypique ne suffit pas toujours à prouver le résultat métier.

Les chemins sensibles doivent privilégier une confirmation de l’état réel, puis synchroniser le cache local.

## Invariant 11 — ne jamais inventer un cursor

Les conversations d’un Project utilisent une pagination opaque :

- première page sans cursor ajouté ;
- pages suivantes uniquement avec le cursor réellement renvoyé ;
- jamais de `cursor=0` fabriqué ;
- `limit` conservateur et fallback compatible si nécessaire.

## Invariant 12 — l’automatisation ne possède jamais un brouillon utilisateur

Les mécanismes de continuité et de long-run sont autorisés à écrire dans le composer uniquement avec des garanties explicites.

`composer-continuation-v128.js` :

- préfixe un envoi parallèle seulement si une activité existait avant l’envoi ;
- retire ensuite uniquement le préfixe NiakGPT si le composer contrôlé ne s’est pas vidé ;
- n’efface rien si l’utilisateur a modifié le texte après le clic natif.

`long-run-watchdog-v129.js` :

- attend 6 min 30 par défaut ;
- ne touche pas un composer contenant un brouillon utilisateur ;
- n’écrit rien tant qu’aucun candidat Envoyer réel n’existe ;
- ne laisse pas son texte en attente si le contrôle n’est pas utilisable ;
- nettoie uniquement les protocoles automatiques **exacts** qu’il connaît ;
- considère comme utilisateur tout protocole modifié, même s’il contient encore le marqueur NiakGPT ;
- n’efface après clic que le texte automatique exact qu’il possède ;
- se désarme sur une commande explicite d’arrêt/annulation.

## Cache et high-water marks

`cache-bus-v096.js` sérialise les écritures locales et publie l’état aux abonnés. `cache-guardian-v100.js` protège contre un effondrement brutal du nombre de Projects/chats/dates et peut restaurer un état de référence.

C’est précisément pour éviter qu’un faux Project-date ne soit enregistré comme high-water mark que la barrière metadata s’exécute avant le garde de cache.

Les modules qui enrichissent ou réparent le cache doivent conserver les données historiques utiles lors d’une réponse serveur partielle.

## Gros fils

La priorité reste la fluidité du runtime natif :

- historique froid ;
- queue récente bornée (`COLD_KEEP=44`) ;
- `content-visibility` / containment ;
- Matrix et décorations réduites pendant l’activité lourde ;
- traitements incrémentaux ;
- reprise via `requestIdleCallback` ;
- `conversation-load-guard-v113.js` qui relâche les optimisations tant que les tours natifs ne sont pas rendus.

`reclassify-deep-v112.js` reste strictement borné : peu de chats par cycle, un seul cas lourd simultané, extrait limité et suspension pendant la génération/429.

## États d’activité

Les états partagés sont :

```text
ready
loading
waiting
thinking
executing
error
```

Ils pilotent la ligne du chat, le Project, la capsule d’état, les suspensions de travaux et la coordination multi-onglets.

## Chrome UX v131

La couche v131 ne doit pas réserver en permanence de l’espace au host ChatGPT :

- `body.ng8-ready` n’ajoute plus de padding permanent ;
- le rail droit est un dock discret, partiellement rentré et masqué sur l’accueil/surfaces utilitaires ;
- le status est une capsule passive ; `BY SKYNET` reste dans le DOM comme easter egg mais n’est plus affiché dans cette capsule ;
- le panneau NiakGPT flotte au-dessus du contenu au lieu de réduire la largeur du chat ;
- le prompteur devient opt-in et son détail se replie avec `Escape` ;
- `prefers-reduced-motion` désactive les transitions non essentielles.

Les transforms visuels du dock ne doivent jamais augmenter `documentElement.scrollWidth` ni créer de scroll horizontal.

## Panneaux natifs

`live-fixes-v104.js` ne possède plus Projects. Il détecte et adapte uniquement les panneaux Activité / Réflexion / Sources / Outputs pour les maintenir lisibles à gauche du rail NiakGPT sans réserver inutilement la largeur du chat.

Le visualiseur image conserve un contrôle de fermeture dédié lorsque l’overlay natif le nécessite.

## Safe Mode

Safe Mode est une dégradation volontaire :

- Matrix ;
- coach ;
- animations ;
- travaux non essentiels ;
- rôle WORKER ;

peuvent être suspendus, tandis que composer, lecture, navigation et interface native restent disponibles.

## Tests comme partie de l’architecture

Une modification architecturale n’est considérée terminée que si le niveau de preuve correspondant existe.

La 0.9.84 utilise notamment :

1. `tools/check-hydration-v100.mjs` — invariants runtime et ordre de boot ;
2. `labs/static_validate_current.py` — syntaxe, manifest, package/runtime, propriétaires uniques ;
3. `ux-integral-v131.mjs` — vraie sidebar gauche, surfaces native-first, screenshots Chromium/Firefox/WebKit ;
4. `sidebar-human-ux-v123.spec.js` — session humaine complète : scroll, menus, clavier, rename/move, remount, interruptions, travail long ;
5. `sidebar-session-ux-v123.mjs` — contrat cross-engine du catalogue et des menus ;
6. `long-run-composer-residue-v131.spec.js` — résidus composer, vieux protocoles exacts et protection des modifications utilisateur ;
7. `live-stability-v129.spec.js` — watchdog, remount, Project context et handoff ;
8. `composer-continuation-runtime-v128.spec.js` / `parallel-continue-v128.mjs` — ajout parallèle et cleanup contrôlé ;
9. tests Chromium / Firefox / WebKit ;
10. matrice Ubuntu / Windows / macOS ;
11. extension MV3 réellement chargée sous Chromium sur les trois OS ;
12. gate prioritaire Brave stable réel sur macOS ;
13. `pins-primary-slot-v083.mjs` — placement Pins sous la navigation native même en présence de surfaces Projects cachées/précoces ;
14. `diagnostic-selection-v083.mjs` — sélection/copier stable pendant les mises à jour live du diagnostic ;
15. `project-memory-v132.mjs` — auto-render du coffre et recréation persistante de bootstrap pour un coffre connecté/non synchronisé ;
16. packaging propre et validation statique de l’autorité finale.

Les anciens labs restent disponibles pour les régressions historiques, même lorsque leurs anciens modules ne font plus partie du runtime de production.

## Dépendance à ChatGPT

NiakGPT s’appuie sur le DOM et certains endpoints internes de ChatGPT. Cette dépendance reste intrinsèquement fragile. La réponse architecturale est donc : propriétaires uniques, mutations minimales, fallback natif, tests sur remounts réels et garde-fous qui échouent bruyamment plutôt que d’empiler de nouveaux overrides concurrents.


## Maintenance du dépôt

Le dépôt sépare explicitement **runtime de production**, **outils/labs** et **patrimoine de régression**.

- `tools/package-extension.mjs` construit le ZIP depuis les fichiers réellement déclarés par le manifest et l’injecteur ;
- `tools/check-repository-hygiene.mjs` refuse les sorties générées, archives accidentelles et runtimes racine orphelins ;
- les anciens modules encore référencés par des labs restent dans le dépôt mais sont interdits dans le package installable ;
- un fichier JS/CSS racine qui n’est ni expédié ni référencé par un test/document est considéré comme inutile et doit être supprimé ;
- l’historique GitHub Actions est purgé automatiquement chaque semaine avec une courte fenêtre de rétention pour le diagnostic.

Cette distinction permet de garder l’historique utile sans transformer la release en accumulation de code mort.
