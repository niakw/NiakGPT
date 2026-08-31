# Architecture de NiakGPT

NiakGPT est une extension Manifest V3 locale qui ajoute une couche power-user à l’interface web de ChatGPT. L’architecture 0.9.85 privilégie cinq propriétés : **faible coût runtime**, **priorité absolue au flux natif ChatGPT**, **priorité explicite à l’utilisateur**, **un seul propriétaire par surface**, et **dégradation sûre quand ChatGPT change**.

## Périmètre

Le manifest 0.9.85 déclare :

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


## Invariant réseau 0.9.85 — ChatGPT natif gagne toujours

`page-bridge.js` traite désormais tout envoi, génération, vérification, incident réseau ou reprise de connexion comme une priorité native. Les GET NiakGPT déjà en vol sont annulés, les nouveaux appels internes sont bloqués pendant une fenêtre calme, et une erreur réseau n’est plus rejouée via un second transport XHR. `analysis-bridge-v112.js` ne possède plus de transport ChatGPT direct : analyse, indexation et Project Memory convergent vers ce broker unique. Project Memory est opportuniste : il attend l’inactivité humaine et espace les lectures complètes d’historique. Une lecture de drawer explicitement déclenchée par l’utilisateur peut ignorer uniquement la fenêtre post-réponse une fois ChatGPT réellement `ready`; elle reste interdite pendant génération, vérification ou incident réseau. `interruption-guard-v119.js` ne clique plus automatiquement sur « Réessayer ».

## Invariant Pins 0.9.85 — le launcher Projects suffit

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

### Lecture complète d’un fil

Le contrat historique « pas de GET conversation complet en fonctionnement normal » reste vrai.

`page-bridge.js` n’autorise `GET /backend-api/conversation/{id}` que si la requête porte explicitement `memoryBootstrap: true`. Cette exception reste dans le broker unique, respecte `nativeBusy`, les gaps réseau et le circuit breaker 429. Elle sert uniquement à la copie privée activée par l’utilisateur.

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

Les anciens propriétaires `sidebar-authority-v107.js` et `sidebar-expando-guard-v108.js` restent uniquement comme régressions historiques. Ils ne sont ni injectés ni empaquetés. `live-fixes-v104.js` gère les panneaux natifs ; `live-fixes-v106.js` gère le contexte Project et retire ponctuellement les anciennes marques de migration, sans devenir une autorité concurrente.

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
