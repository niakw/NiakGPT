# Architecture de NiakGPT

NiakGPT est une extension Chrome/Chromium locale qui ajoute une couche power-user à l’interface web de ChatGPT. L’architecture privilégie trois propriétés : **faible coût runtime**, **priorité explicite à l’utilisateur**, et **dégradation sûre lorsque ChatGPT change**.

## Périmètre

Le manifest limite NiakGPT à :

```text
https://chatgpt.com/*
```

Aucun serveur NiakGPT n’est requis. Les caches, réglages, états de gouvernance et verrous restent dans le profil navigateur local.

## Deux mondes d’exécution

### MAIN world

Les scripts MAIN doivent rester très petits. Ils existent uniquement lorsque l’intégration exige le même contexte JavaScript que l’application ChatGPT :

- bridge RPC vers les endpoints internes autorisés ;
- détection d’un déplacement Project effectué par l’utilisateur ;
- signal réseau d’activité d’une génération ;
- cache chaud des réponses de conversation.

Ces scripts ne doivent pas construire l’interface NiakGPT.

### Isolated world

Le reste du produit vit dans le monde isolé :

- UI et direction artistique ;
- Quick Open et Command Palette ;
- coordination multi-onglets ;
- Project Governance ;
- pins natifs ;
- chronologie ;
- coach ;
- sommaire ;
- Control Center ;
- profils de workspace ;
- onboarding ;
- états visuels.

## Invariant 1 — pas de polling global permanent

Les modules applicatifs ne doivent pas rescanner périodiquement tout le DOM « au cas où ».

Préférer, dans cet ordre :

1. événement réseau déjà observé ;
2. changement `chrome.storage.local` ;
3. `BroadcastChannel` ;
4. navigation SPA ;
5. mutation ciblée du conteneur concerné ;
6. travail différé avec `requestIdleCallback` ou `setTimeout` ponctuel.

Un timer récurrent n’est acceptable que pour maintenir un état réellement temporel/distribué, par exemple un heartbeat de coordination d’onglets. Même dans ce cas, il ne doit pas déclencher de scan large du DOM.

## Invariant 2 — un seul WORKER entre onglets

Lorsqu’un utilisateur ouvre plusieurs onglets ChatGPT :

- un seul onglet devient `WORKER` ;
- les autres sont `CLIENT` ;
- les clients utilisent les caches partagés ;
- indexation, auto-resync et synchronisation native ne doivent pas être multipliées par le nombre d’onglets ;
- un WORKER chargé par un gros fil peut céder son rôle ;
- Safe Mode doit également céder le rôle WORKER.

`navigator.locks` est utilisé lorsqu’il est disponible, avec fallback local.

## Invariant 3 — manuel > automatique

Un déplacement de conversation effectué avec l’interface native de ChatGPT est une décision utilisateur.

Le flux attendu est :

1. détecter le PATCH natif ;
2. relire la conversation côté serveur ;
3. vérifier le `gizmo_id` réellement appliqué ;
4. enregistrer un verrou local persistant ;
5. afficher un cadenas ;
6. exclure cette conversation de tout reclassement automatique.

Le verrou ne disparaît que par action explicite de l’utilisateur.

Un déplacement vers **Hors projet** est également une décision manuelle valide.

## Invariant 4 — aucune réussite supposée après un PATCH

Les endpoints internes de ChatGPT sont non documentés. Une réponse HTTP atypique ne prouve pas nécessairement qu’une opération a échoué ou réussi.

Pour les déplacements Project, **la relecture GET est la source de vérité**.

## Invariant 5 — ne jamais inventer un cursor

Les conversations d’un Project utilisent une pagination avec cursor opaque.

- première page : aucun cursor ajouté ;
- pages suivantes : uniquement le cursor réellement retourné par le backend ;
- ne jamais fabriquer `cursor=0` ;
- le `limit` doit rester conservateur ;
- un fallback compatible est autorisé si le backend rejette une variante avec `422`.

## Invariant 6 — un seul host Projects géré

Il ne doit exister qu’un seul `#ng8-pins`.

Le host doit :

- être situé **dans** la sidebar native ;
- être réutilisé à chaque redraw ;
- supprimer les doublons historiques s’ils sont détectés ;
- ne jamais être inséré à côté du `<nav>` par erreur.

`sidebar-host-v090.js` défend cet invariant.

## Invariant 7 — activité auto-résiliente

Les content scripts démarrent à `document_start`. Le `<body>` peut donc ne pas encore exister.

Toute boucle de suivi d’état doit :

- tolérer l’absence temporaire du body/main ;
- utiliser `document.documentElement` comme dernier fallback ;
- capturer une exception DOM ponctuelle ;
- toujours reprogrammer son prochain tick dans un `finally` ;
- ne jamais rester définitivement bloquée sur `CHARGEMENT` à cause d’une exception de bootstrap.

## Cache chaud

Le cache de conversations est distinct de l’index Projects/chats.

Objectifs :

- rendre immédiatement une conversation récemment chargée ;
- éviter de refaire un gros GET si la version connue est inchangée ;
- dédupliquer un même GET entre plusieurs onglets ;
- marquer un fil `DIRTY` après nouvelle activité ;
- limiter la taille et la durée de vie.

Le cache chaud n’invente pas un endpoint delta qui n’existe pas.

## Project Governance

La gouvernance conserve une structure principale par identifiants de Projects, jamais par noms personnels codés dans le dépôt.

Le nettoyage suit une politique conservatrice :

- doublon exact → Project canonique ;
- reliquat générique + forte confiance → Project principal ;
- faible confiance → Hors projet / À classer ;
- chat verrouillé manuellement → aucune modification ;
- aucun DELETE serveur de Project basé sur une hypothèse d’API.

Les anciens Projects vidés peuvent être masqués localement et désépinglés.

## Safe Mode

Safe Mode est une dégradation volontaire, pas un simple thème visuel.

Il doit réellement suspendre le travail non essentiel :

- Matrix ;
- coach ;
- animations ;
- pins natifs ;
- auto-resync ;
- rôle WORKER.

Les fonctions essentielles — composer, lecture, navigation et interface native — restent disponibles.

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

Ils servent de source de vérité commune pour :

- la ligne du chat ;
- le Project ;
- la barre basse ;
- la suspension de certains travaux ;
- la coordination multi-onglets.

## Stockage

Principales catégories :

- `chrome.storage.local` : préférences, index, gouvernance, verrous, lifecycle ;
- IndexedDB : cache chaud de conversations ;
- `localStorage` : miroirs de démarrage rapide et coordination locale lorsque nécessaire.

La distinction est importante : **la décision fresh install / update ne doit pas dépendre de données de page susceptibles d’être créées pendant le même chargement**. Le lifecycle de l’extension est la source de vérité.

## Tests comme partie de l’architecture

NiakGPT utilise plusieurs niveaux de QA :

1. invariants de source/manifest ;
2. syntaxe JavaScript ;
3. Visual Lab déterministe ;
4. extension réellement chargée en unpacked dans Chromium sur un `chatgpt.com` mocké ;
5. packaging minimal ;
6. Public Quality Gate sur un commit précis.

Une modification architecturale n’est considérée terminée que lorsque le niveau de test correspondant existe et passe.

## Dépendance à ChatGPT

NiakGPT s’appuie sur le DOM et sur des endpoints internes de ChatGPT. Cette dépendance reste intrinsèquement fragile.

La stratégie n’est pas de prétendre éliminer ce risque, mais de :

- limiter les hypothèses ;
- vérifier les opérations sensibles ;
- centraliser les sélecteurs critiques ;
- échouer sans corruption lorsqu’une hypothèse devient fausse ;
- disposer d’un banc de reproduction rapide.
