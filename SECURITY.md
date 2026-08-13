# Sécurité — NiakGPT

## Modèle de sécurité

NiakGPT s’exécute uniquement sur `https://chatgpt.com/*` et s’appuie sur la session ChatGPT déjà ouverte dans le navigateur.

L’extension ne demande pas de clé API OpenAI et ne stocke pas volontairement le jeton d’accès de session dans `chrome.storage` ou dans un serveur externe.

## Endpoints internes

Certaines fonctions utilisent des endpoints internes employés par l’interface web de ChatGPT. Ces endpoints ne constituent pas une API publique garantie.

Conséquences :

- leur schéma peut changer ;
- une réponse HTTP inhabituelle ne doit jamais être interprétée comme une réussite sans vérification ;
- les opérations sensibles de Project Governance relisent l’état serveur après modification ;
- les requêtes sont limitées à une liste de chemins autorisés dans le bridge.

## Project Governance

Un déplacement automatisé de conversation :

1. passe par le garde Governance ;
2. effectue la modification ;
3. relit la conversation ;
4. considère la destination relue comme source de vérité.

Un déplacement manuel détecté est également vérifié avant la création du verrou local.

NiakGPT n’essaie pas de supprimer automatiquement un Project serveur à partir d’un endpoint supposé ou non vérifié.

## Injection et contenu

Les textes dynamiques insérés dans les interfaces NiakGPT doivent être échappés avant insertion HTML lorsqu’ils proviennent de titres, noms de Projects ou métadonnées externes.

Les composants qui n’ont pas besoin de HTML doivent privilégier `textContent`.

## Cache

Le cache chaud contient potentiellement le JSON d’une conversation. Il est stocké localement dans IndexedDB et limité en durée/taille. Un utilisateur ayant accès au profil navigateur local peut potentiellement accéder à ces données de la même manière qu’aux autres données de site locales.

## Permissions

Toute nouvelle permission Chrome ou tout nouveau domaine dans `host_permissions` doit être considéré comme une modification de sécurité et justifié explicitement.

## Signalement d’un problème

Pour un dépôt privé, utiliser de préférence les mécanismes privés disponibles sur la plateforme d’hébergement du dépôt. Éviter de publier publiquement un rapport contenant des données de conversation, des jetons, des identifiants de session ou d’autres secrets.

Un rapport utile doit contenir :

- version NiakGPT ;
- version Chrome/Chromium ;
- étapes minimales de reproduction ;
- comportement attendu et observé ;
- diagnostic NiakGPT lorsque possible, après vérification qu’il ne contient pas de donnée sensible.

## Secrets

Ne jamais joindre :

- cookies de session ;
- en-têtes `Authorization` ;
- contenu brut de `/api/auth/session` ;
- exports de conversation non anonymisés ;
- données personnelles non nécessaires à la reproduction.
