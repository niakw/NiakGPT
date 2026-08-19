# Architecture de NiakGPT

NiakGPT est une extension Manifest V3 locale qui ajoute une couche power-user à l’interface web de ChatGPT. L’architecture 0.9.68 privilégie quatre propriétés : **faible coût runtime**, **priorité explicite à l’utilisateur**, **un seul propriétaire par surface**, et **dégradation sûre quand ChatGPT change**.

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
- profils, Control Center, coach et diagnostics.

Les fichiers sont injectés séquentiellement par `background-v100.js` après le boot gate.

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

## Invariant 3 — un seul host Projects géré

Il ne doit exister qu’un seul `#ng8-pins`.

Le host doit :

- vivre dans la sidebar native ;
- être réutilisé à chaque redraw ;
- supprimer les doublons historiques ;
- ne jamais être inséré à côté du `<nav>` par erreur.

`sidebar-host-v090.js` défend cet invariant. `pin-folders-v096.js` transforme chaque Project épinglé en dossier dépliable sans créer un second système Projects.

## Invariant 4 — hitboxes atomiques

Chaque ligne Project possède deux zones exclusives :

- le Project/drawer ;
- son bouton d’actions `…`.

Chaque conversation dans un drawer utilise `.ng96-chat-entry` avec :

- un lien conversation ;
- un bouton d’actions frère ;
- aucun bouton interactif imbriqué dans le lien ;
- aucune superposition de hitboxes.

Le layout est mesuré par pixel (`getBoundingClientRect`, `elementFromPoint`) dans les gates courants.

## Invariant 5 — menus natifs par session

`native-actions-v113.js` privilégie le vrai menu ChatGPT lorsque la ligne native est disponible.

Pour éviter les collisions :

1. une action NiakGPT photographie les menus déjà visibles ;
2. ces menus constituent la baseline et ne doivent jamais être déplacés ;
3. seuls les menus nouvellement visibles appartiennent à la session courante ;
4. le menu et ses sous-menus peuvent être promus via Popover dans le top layer ;
5. à la fermeture, NiakGPT retire toute propriété qu’il possède : Popover, top-layer dataset, classe flottante, variables de position et index ;
6. si React réutilise le même nœud, celui-ci doit donc reprendre sa géométrie native ;
7. un échec d’ouverture ou la fermeture du fallback termine immédiatement la session afin qu’aucun timer tardif ne capture un menu sans rapport.

Le fallback conversation est limité aux actions sûres nécessaires lorsque la ligne native n’existe pas.

## Invariant 6 — pas de polling global permanent

Les modules applicatifs ne doivent pas rescanner périodiquement tout le DOM « au cas où ».

Préférer :

1. événement réseau déjà observé ;
2. changement `chrome.storage.local` / cache bus ;
3. `BroadcastChannel` ;
4. navigation SPA ;
5. mutation ciblée du conteneur concerné ;
6. travail différé ponctuel avec `requestIdleCallback` ou `setTimeout`.

Un timer récurrent n’est acceptable que pour un état réellement temporel/distribué et ne doit jamais déclencher de scan large du DOM.

## Invariant 7 — un seul WORKER entre onglets

Lorsqu’un utilisateur ouvre plusieurs onglets ChatGPT :

- un seul onglet devient `WORKER` ;
- les autres restent `CLIENT` ;
- les CLIENT réutilisent les caches partagés ;
- indexation et traitements lourds ne doivent pas être multipliés ;
- un WORKER chargé par un gros fil peut céder son rôle ;
- Safe Mode doit également céder le rôle WORKER.

`navigator.locks` est utilisé lorsqu’il est disponible, avec fallback local et coordination `BroadcastChannel`.

## Invariant 8 — manuel > automatique

Un déplacement de conversation réalisé via l’interface native de ChatGPT est une décision utilisateur.

Le flux attendu :

1. détecter la mutation native fiable ;
2. vérifier la destination serveur quand le chemin l’autorise ;
3. enregistrer un verrou local persistant ;
4. exclure la conversation du reclassement automatique ;
5. ne lever le verrou que par action explicite.

Un déplacement vers **Hors projet** est valide.

`continuity-exact` est également prioritaire sur le recommender normal.

## Invariant 9 — aucune réussite supposée après une mutation

Les endpoints internes de ChatGPT sont non documentés. Une réponse HTTP atypique ne suffit pas toujours à prouver le résultat métier.

Les chemins sensibles doivent privilégier une confirmation de l’état réel, puis synchroniser le cache local.

## Invariant 10 — ne jamais inventer un cursor

Les conversations d’un Project utilisent une pagination opaque :

- première page sans cursor ajouté ;
- pages suivantes uniquement avec le cursor réellement renvoyé ;
- jamais de `cursor=0` fabriqué ;
- `limit` conservateur et fallback compatible si nécessaire.

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

Ils pilotent la ligne du chat, le Project, la barre basse, les suspensions de travaux et la coordination multi-onglets.

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

La 0.9.68 utilise notamment :

1. `tools/check-hydration-v100.mjs` — invariants runtime et ordre de boot ;
2. `labs/static_validate_current.py` — syntaxe, manifest, package/runtime, propriétaires uniques ;
3. `sidebar-hitboxes-v117` — géométrie et hit testing ;
4. `native-menu-session-v118` — isolation, cleanup, réutilisation DOM et fermeture fallback ;
5. `sidebar-metadata-v118` — sanitation metadata/cache et barrière async mesurée ;
6. `live-ui-regressions-v114` — autorité Projects + preview image + metadata ;
7. `experience-gate-v116` et stress/remounts ;
8. tests Chromium / Firefox / WebKit ;
9. extension MV3 réellement chargée sur Chromium Ubuntu / Windows / macOS ;
10. gate prioritaire Brave stable réel sur macOS ;
11. packaging propre et Public Quality Gate sur `main`.

Les anciens labs restent disponibles pour les régressions historiques, même lorsque leurs anciens modules ne font plus partie du runtime de production.

## Dépendance à ChatGPT

NiakGPT s’appuie sur le DOM et certains endpoints internes de ChatGPT. Cette dépendance reste intrinsèquement fragile. La réponse architecturale est donc : propriétaires uniques, mutations minimales, fallback natif, tests sur remounts réels et garde-fous qui échouent bruyamment plutôt que d’empiler de nouveaux overrides concurrents.
