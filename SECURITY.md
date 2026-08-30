# Sécurité — NiakGPT

## Modèle de sécurité

NiakGPT 0.9.78 est une extension Manifest V3 dont le cœur reste local-first. Project Memory v132 ajoute un canal GitHub **optionnel**, réservé à un dépôt privé choisi par l’utilisateur.

L’extension ne demande pas de clé API OpenAI et ne stocke volontairement ni cookie de session ChatGPT ni jeton d’accès ChatGPT dans un serveur NiakGPT externe.

## Permissions et domaines

Le manifest demande :

```text
storage
scripting
https://chatgpt.com/*
https://api.github.com/*
```

`api.github.com` est utilisé uniquement par Project Memory après configuration. Ajouter un domaine ou une permission reste une modification de sécurité qui doit être documentée et couverte par les gates.

## Frontière Project Memory

Règles obligatoires :

1. aucune destination mémoire n’est implicite ;
2. le dépôt est fourni par l’utilisateur ;
3. la connexion échoue si GitHub ne déclare pas le dépôt `private: true` ;
4. la confidentialité du dépôt est revérifiée avant les lectures/écritures ;
5. un dépôt archivé est refusé ;
6. les chemins sont normalisés et les traversées `..` sont rejetées ;
7. les écritures sont bornées en nombre de fichiers et en taille ;
8. la mise à jour de branche n’utilise pas `force: true` ;
9. un conflit de tête de branche provoque au plus une reconstruction/retry, jamais un écrasement forcé ;
10. le dépôt public NiakGPT n’est jamais une destination spéciale ou par défaut ;
11. un dépôt privé sans commit est initialisé par un premier commit/ref sans exiger une branche préexistante ;
12. Project Memory est optionnel : une erreur de son backend ou de ses scripts ne peut pas rendre le bootstrap Projects/sidebar en échec ;
13. les GitHub Actions du dépôt public NiakGPT ne reçoivent aucun secret, ne connaissent aucun dépôt coffre utilisateur et n’exécutent aucun smoke test contre un vrai coffre privé.

Le dépôt privé protège l’accès par GitHub ; **NiakGPT 0.9.78 n’ajoute pas de chiffrement applicatif E2E des fichiers mémoire**. Toute personne ou application disposant d’un accès suffisant au dépôt peut lire son contenu.

## Token GitHub

Le modèle recommandé est un **fine-grained PAT limité au seul dépôt mémoire**. Ce PAT est le secret d’accès du coffre côté navigateur ; ce n’est pas un Repository secret du dépôt public NiakGPT.

Le token doit disposer uniquement des droits nécessaires aux métadonnées et au contenu du dépôt. Éviter les tokens classiques ou les droits organisation/account inutiles.

Par défaut, le token vit dans `chrome.storage.session`. La persistance dans `chrome.storage.local` n’est utilisée que si l’utilisateur active explicitement « Mémoriser le jeton sur cet appareil ».

Conséquences :

- un profil navigateur compromis peut exposer le token ;
- un token mémorisé augmente la fenêtre d’exposition ;
- révoquer le token dans GitHub invalide immédiatement les futures synchronisations ;
- le token ne doit jamais être copié dans un diagnostic, une issue ou une fixture.

Les erreurs retournées à l’UI nettoient les préfixes de tokens GitHub connus.

## Historique complet ChatGPT

Les `GET /backend-api/conversation/{id}` complets restent **bloqués par défaut** dans `page-bridge.js`.

Ils ne sont autorisés que lorsqu’une requête Project Memory porte explicitement `memoryBootstrap: true`. Même dans ce cas :

- la requête utilise le broker réseau unique ;
- aucune récupération n’est lancée pendant une génération ChatGPT ou une vérification ;
- le circuit breaker/rate-limit reste actif ;
- le module de synchronisation travaille séquentiellement et reprend sa queue après interruption.

Cette exception existe uniquement pour créer/actualiser l’archive privée demandée par l’utilisateur.

## Prompt et restauration de contexte

Le contexte GitHub complet n’est pas injecté dans le composer.

`PROJECT_STATE.md` est borné et peut être ajouté une seule fois au premier prompt d’un nouveau fil Project. Le chemin d’envoi doit rester synchrone au geste Envoyer afin d’éviter qu’un clic natif parte avant l’injection.

Le texte utilisateur reste prioritaire et Project Memory ne doit pas transformer les messages suivants du même fil.

## Project Governance

Les mutations de rattachement Project restent sous le contrat de gouvernance existant : une action manuelle récente reste prioritaire, les destinations sont exactes et aucune suppression/mutation destructive n’est inventée.

## Endpoints internes ChatGPT

Les autres règles du bridge restent inchangées :

- chemins autorisés explicitement ;
- pas de remplacement global de `window.fetch` ;
- réponses inhabituelles = échec, pas réussite implicite ;
- déduplication et circuit breaker ;
- mutations Projects gouvernées ;
- aucune mutation destructive inventée.

## DOM, HTML et UI

Les données dynamiques doivent utiliser `textContent` ou être échappées avant interpolation HTML.

Le Control Center ne doit pas se rerendre en boucle pendant la saisie d’un dépôt/token et un échec de connexion ne doit pas effacer les valeurs saisies : la section Project Memory est réinsérée uniquement lorsque le Control Center apparaît ou lorsqu’un événement mémoire réel nécessite un rafraîchissement.

## Vérifications et challenges

NiakGPT ne contourne jamais CAPTCHA, challenge ou iframe de vérification ChatGPT.

Pendant une vérification, les requêtes NiakGPT — y compris Project Memory — sont suspendues ou échouent proprement. NiakGPT ne clique jamais sur le challenge lui-même. Après disparition du challenge, une éventuelle action native ChatGPT de reprise peut être utilisée une seule fois.

Le même circuit de pause s’applique aux interruptions réseau natives détectées. Les brouillons et extraits de continuité temporaires restent bornés et chiffrés dans `sessionStorage`; aucune reprise de texte préparée par NiakGPT n’est envoyée automatiquement.

## Secrets à ne jamais publier

Ne jamais joindre à une issue, PR, fixture ou diagnostic public :

- token GitHub ;
- cookies de session ;
- en-têtes `Authorization` ;
- contenu brut de `/api/auth/session` ;
- conversation réelle non anonymisée ;
- nom d’un dépôt mémoire privé inutile à la reproduction ;
- données personnelles non nécessaires.

Le fichier public `test/x.md` est réservé à des données synthétiques.

## Signaler une vulnérabilité

Pour un problème non sensible, ouvrir une issue avec version, navigateur, étapes minimales et diagnostic anonymisé.

Pour un rapport sensible, utiliser un canal privé GitHub Security lorsqu’il est disponible.

## Voir aussi

- [PRIVACY.md](PRIVACY.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [TESTING_TRUTH.md](TESTING_TRUTH.md)
