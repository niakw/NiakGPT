# Sécurité — NiakGPT

## Modèle de sécurité

NiakGPT s’exécute uniquement sur `https://chatgpt.com/*` et s’appuie sur la session ChatGPT déjà ouverte dans le navigateur.

L’extension ne demande pas de clé API OpenAI et ne stocke pas volontairement le jeton d’accès de session dans `chrome.storage` ou sur un serveur externe.

## Endpoints internes

Certaines fonctions utilisent des endpoints internes employés par l’interface web de ChatGPT. Ces endpoints ne constituent pas une API publique garantie.

Conséquences :

- leur schéma peut changer ;
- une réponse HTTP inhabituelle ne doit jamais être interprétée comme une réussite sans garde ;
- les requêtes passent par le bridge et une liste de chemins autorisés ;
- le broker gère la sérialisation, la déduplication utile et le circuit breaker 429 ;
- **tout GET complet `/backend-api/conversation/{id}` initié par NiakGPT est refusé avant réseau**.

## Project Governance

Un déplacement automatisé de conversation :

1. passe par le garde Governance ;
2. effectue un `PATCH` vers la destination ;
3. utilise l’accusé de réception de la mutation et met à jour l’état local ;
4. laisse l’inventaire serveur léger ultérieur confirmer la convergence globale, sans relire la conversation complète.

Un déplacement manuel n’est verrouillé localement qu’après un geste utilisateur fiable et récent.

NiakGPT n’essaie pas de supprimer automatiquement un Project serveur à partir d’un endpoint supposé ou non vérifié.

## Injection et contenu

Les textes dynamiques insérés dans les interfaces NiakGPT sont échappés lorsqu’ils proviennent de titres, noms de Projects ou métadonnées externes. Les composants qui n’ont pas besoin de HTML privilégient `textContent`.

Le prompteur et la continuité n’envoient jamais automatiquement le contenu du composer.

## Données locales

La 0.9.52 ne maintient plus de cache complet JSON de conversations. Les versions historiques pouvaient laisser des données IndexedDB dans le profil navigateur ; ces reliquats doivent être considérés comme des données locales sensibles jusqu’à leur purge.

Un utilisateur ayant accès au profil navigateur local peut potentiellement accéder aux préférences, index et capsules locales de la même manière qu’aux autres données de site locales.

## Permissions

Toute nouvelle permission Chrome ou tout nouveau domaine dans `host_permissions` doit être considéré comme une modification de sécurité et justifié explicitement.

## Signalement d’un problème

Le dépôt étant public, un rapport de bug public ne doit jamais contenir de données de conversation, cookies, jetons ou identifiants de session. Pour une vulnérabilité ou un rapport sensible, utiliser un canal privé de sécurité lorsqu’il est disponible.

Un rapport technique non sensible peut contenir :

- version NiakGPT ;
- navigateur et version ;
- étapes minimales de reproduction ;
- comportement attendu et observé ;
- diagnostic NiakGPT après vérification qu’il ne contient aucune donnée sensible.

## Secrets

Ne jamais joindre :

- cookies de session ;
- en-têtes `Authorization` ;
- contenu brut de `/api/auth/session` ;
- exports de conversation non anonymisés ;
- données personnelles non nécessaires à la reproduction.
