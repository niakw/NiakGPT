# Architecture de NiakGPT

NiakGPT est une extension Manifest V3 locale qui ajoute une couche power-user à l’interface web de ChatGPT. L’architecture 0.9.76 privilégie quatre propriétés : **faible coût runtime**, **priorité explicite à l’utilisateur**, **un seul propriétaire par surface**, et **dégradation sûre quand ChatGPT change**.

## Périmètre

Le manifest limite NiakGPT à :

```text
https://chatgpt.com/*
```

Aucun serveur NiakGPT n’est requis. Les caches, réglages, états de gouvernance et verrous restent dans le profil navigateur local.

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

Les fichiers sont injectés séquentiellement par `background-v100.js` après le boot gate. `ux-v131.js` est volontairement le dernier runtime isolé : il vérifie le host réel et applique les invariants UX finaux sans reprendre la propriété métier des modules précédents.

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

La 0.9.76 utilise notamment :

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
13. packaging propre et validation statique de l’autorité finale.

Les anciens labs restent disponibles pour les régressions historiques, même lorsque leurs anciens modules ne font plus partie du runtime de production.

## Dépendance à ChatGPT

NiakGPT s’appuie sur le DOM et certains endpoints internes de ChatGPT. Cette dépendance reste intrinsèquement fragile. La réponse architecturale est donc : propriétaires uniques, mutations minimales, fallback natif, tests sur remounts réels et garde-fous qui échouent bruyamment plutôt que d’empiler de nouveaux overrides concurrents.
