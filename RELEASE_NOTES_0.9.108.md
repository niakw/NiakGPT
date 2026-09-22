# NiakGPT 0.9.108

## Preuve d’hydratation React strictement positive

0.9.107 a renforcé le démarrage en exigeant l’ownership React de `<html>` et `<body>`, mais un ancien chemin « legacy host » pouvait encore contourner toute cette preuve lorsque ChatGPT ne fournissait ni `data-build` sur `<html>` ni `window.__reactRouterContext`.

0.9.108 supprime entièrement ce raccourci. Le probe MAIN-world ne classe plus la page selon ces sentinelles volatiles : il renvoie uniquement des faits React positifs. Le runtime ne peut démarrer que si un conteneur React réel est trouvé, si le HostRoot expose `memoizedState.isDehydrated === false`, si React possède explicitement `<html>` et `<body>`, si au moins deux identités hôtes sont possédées par React, puis si une seconde lecture MAIN-world confirme encore cet état.

La régression MV3 réelle reproduit désormais précisément le cas terrain : aucune sentinelle `data-build` / React Router, un HostRoot maintenu déshydraté pendant 6,5 secondes, et une vérification après 5 secondes que NiakGPT n’a posé ni preuve d’hydratation ni rail. Le test document-root de 0.9.107 reste également actif afin d’empêcher toute mutation tant que React n’a pas revendiqué `<html>` et `<body>`.

Les fixtures qui testent des fonctions post-hydratation fournissent maintenant explicitement un HostRoot déjà stabilisé ; elles ne dépendent plus d’un bypass du code produit.

Le `410 /backend-api/f/conversation/resume` observé dans la console reste une requête native ChatGPT et n’est pas émis par NiakGPT.
