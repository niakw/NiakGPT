# NiakGPT 0.9.109

## HostRoot React retrouvé depuis les vraies chaînes Fiber

Les versions 0.9.106 à 0.9.108 ont progressivement fermé les mutations pré-hydratation, supprimé le bypass heuristique et ajouté l’ownership React de `<html>` + `<body>`. Le retour terrain montre néanmoins que la sidebar peut rester absente sur le ChatGPT authentifié actuel.

La cause visée par 0.9.109 est plus structurelle : le probe MAIN-world ne savait localiser le HostRoot qu’à partir d’un `__reactContainer$…` présent sur `document`, `<html>` ou `<body>`. Les fixtures précédentes plaçaient toujours ce marqueur à cet endroit, donc elles ne pouvaient pas détecter un déplacement de l’autorité React dans le DOM réel.

0.9.109 sait désormais partir des `__reactFiber$…` attachés aux nœuds réellement rendus et remonter leur chaîne `.return` jusqu’au HostRoot (`tag === 3`). La voie `__reactContainer$…` reste supportée mais n’est plus obligatoire.

Le gate reste fail-closed : il exige un HostRoot trouvé, `memoizedState.isDehydrated === false`, aucune racine candidate encore déshydratée, ownership React de `<html>` + `<body>`, au moins deux identités hôtes possédées et une seconde confirmation après deux frames.

Une nouvelle régression MV3 réelle ne définit **aucun** `__reactContainer$…` et laisse le HostRoot déshydraté pendant 6,5 secondes. Elle exige zéro rail avant settlement, puis `react-fiber-root-settled` et le rail NiakGPT après settlement, sur Chromium et Brave.

Si la preuve échoue encore sur un profil réel, le gate écrit un diagnostic compact dans `sessionStorage['niakgpt-hydration-probe-v109']` et affiche `[NiakGPT hydration blocked]` dans la console sans mutation DOM. Cela permet de distinguer précisément `rootFound`, `rootSettled`, `documentRootOwned`, `rootSource` et les ownership counts.

Une tentative de comparaison automatique directement sur `chatgpt.com` depuis GitHub Actions a été menée : Cloudflare bloque le runner avant l’application réelle. Ce test n’est donc pas considéré comme une preuve de correction.
