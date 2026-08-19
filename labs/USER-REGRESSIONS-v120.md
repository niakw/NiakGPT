# NiakGPT — matrice de régressions utilisateur

Ce gate reproduit les problèmes réellement signalés sur la sidebar ChatGPT. Un correctif n'est pas considéré comme validé si le scénario correspondant n'a pas d'assertion exécutable.

Gate exécutable : `visual-lab/user-reported-regressions-v120.mjs`.

Couverture obligatoire :

- le bug historique où le bloc Projects se retrouve au-dessus de l'identité ChatGPT est d'abord reproduit, puis le runtime doit replacer Projects après les entrées principales et avant les Projects natifs ;
- le bloc Projects reste présent et au même emplacement sur l'accueil, Bibliothèque, Projects et les routes de conversation ;
- le nom d'un Project ouvre/ferme uniquement son tiroir et ne navigue jamais vers la page du Project ;
- un Project contenant 14 conversations possède un vrai scroll indépendant et la dernière conversation reste atteignable au-delà des 8 premières ;
- une conversation active/continuée hors du viewport du tiroir est sélectionnée (`aria-current`) et automatiquement révélée ;
- 100 mutations de saisie + croissance simulée d'une réponse en streaming ne changent ni la géométrie ni le parent/frères du bloc Projects ;
- les `...` Project et conversation ouvrent exclusivement le menu natif ChatGPT, sans fallback custom, et un second clic ferme le menu ;
- le message d'accueil natif est masqué lorsqu'il provoque un décalage inutile de l'interface ;
- lors d'une vérification ChatGPT, NiakGPT ne touche jamais au challenge, positionne le drapeau exact lu par `page-bridge.js`, et une requête NiakGPT reçoit `native_busy / bridge-pause` sans trafic réseau ;
- une fois la vérification libérée, le bouton natif Retry ne peut être déclenché qu'une fois ;
- une perte de connexion conserve le brouillon, le restaure si le composer a été remounté/vidé, puis utilise le Retry natif au maximum une fois ;
- une limite de conversation déclenche l'état OUT/continuité ;
- la continuité exacte crée elle-même le nouveau chat dans `chats` et `projectChats`, met à jour le compteur/index Project, conserve le tiroir du Project ouvert et pose le verrou de gouvernance exact.

Le gate est injecté au début de `npm run test:current`, donc la finalisation Chromium lance aussi cette matrice sur Chromium, Firefox et WebKit avant la suite du lab historique.
