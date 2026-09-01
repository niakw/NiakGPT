# NiakGPT 0.9.90 — récupération Projects terrain + privacy fail-closed

## Correctif terrain

La 0.9.90 traite explicitement l’état observé en production où le cache local contient des Projects/chats mais où l’identité serveur canonique n’est pas encore disponible.

- un Project local/dom-only reste un **fallback de récupération** ;
- ce fallback n’est plus effacé par le renderer principal v121 ;
- le bloc **PINS · PROJECTS** est ancré avant la zone Projects native et donc au-dessus de Chats ;
- la surface Projects native reste visible tant que les identités canoniques `g-p-*` ne sont pas connues ;
- la gouvernance ne fabrique pas de `coreProjectIds` à partir de simples entrées locales ;
- le passage à l’autorité NiakGPT n’a lieu qu’après un vrai upgrade canonique.

Le lab `field-sidebar-cache-recovery-v090.mjs` reproduit la forme de sidebar concernée avec 5 Projects locaux, 9 chats, gouvernance vide et lignes Projects natives modernes sans liens canoniques. Il vérifie ensuite l’upgrade vers 5 Projects canoniques.

## Privacy du dépôt public

Le classifieur n’embarque plus d’alias propres à des projets privés : les heuristiques sont désormais génériques et basées sur le nom, la description et les instructions du Project.

Un nouveau garde `tools/check-public-tree-privacy-v134.mjs` scanne tous les fichiers texte suivis par Git et bloque la release si l’arbre public contient :
- un marqueur de projet/fixture privé connu ;
- une adresse e-mail non synthétique ;
- un chemin utilisateur local ;
- une valeur ressemblant à un token ou secret.

Ce garde est exécuté par **Check NiakGPT**, **Public Quality Gate** et **Current Finalization**.

## Ce que la CI prouve

La CI prouve le contrat du runtime NiakGPT et les scénarios synthétiques reproduits. Elle ne peut pas certifier l’état exact d’un compte ChatGPT authentifié réel : l’observation terrain après installation reste la preuve finale de compatibilité avec le DOM de production.
