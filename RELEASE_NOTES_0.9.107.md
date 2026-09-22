# NiakGPT 0.9.107

## Correctif terrain React #418

0.9.106 avait corrigé l’isolation MV3 du probe React, mais conservait un bypass hérité : si le ChatGPT courant ne présentait ni `data-build` sur `<html>` ni `window.__reactRouterContext`, le gate classait la page comme hôte legacy et autorisait le runtime sans preuve React.

0.9.107 retire ce bypass. Le démarrage exige désormais une preuve MAIN-world positive : un conteneur React réel, un HostRoot avec `memoizedState.isDehydrated === false`, au moins deux nœuds hôtes possédés par React, puis une seconde confirmation avant toute mutation NiakGPT.

Le test MV3 réel a été durci pour reproduire précisément le défaut : aucune sentinelle `data-build` / React Router, HostRoot maintenu déshydraté pendant 6,5 secondes, et assertion que ni la preuve `data-ng100-hydration-proof` ni le rail NiakGPT n’apparaissent avant le règlement du root.

Le `410 /backend-api/f/conversation/resume` observé dans la console n’est pas émis par NiakGPT ; les validateurs interdisent toujours cette route dans le runtime de l’extension.
