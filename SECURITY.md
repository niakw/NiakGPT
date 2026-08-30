# Sécurité — NiakGPT

## Modèle de sécurité

NiakGPT 0.9.83 est une extension Manifest V3 dont le cœur reste local-first. Project Memory v132 ajoute un canal GitHub **optionnel**, réservé à un dépôt privé choisi par l’utilisateur.

L’extension ne demande pas de clé API OpenAI et ne stocke volontairement ni cookie de session ChatGPT ni jeton d’accès ChatGPT dans un serveur NiakGPT externe.

## Permissions et domaines

Le manifest demande :

```text
storage
scripting
identity
https://chatgpt.com/*
https://api.github.com/*
https://github.com/login/*
https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/*
```

`api.github.com` est utilisé uniquement par Project Memory après configuration. `identity` ouvre les étapes GitHub HTTP(S), `github.com/login/*` est limité à l’échange/renouvellement OAuth, et le host `chromiumapp.org` est l’unique callback HTTPS exact de cette extension. Aucune permission globale `tabs` n’est demandée. Ajouter un domaine ou une permission reste une modification de sécurité qui doit être documentée et couverte par les gates.

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
13. les GitHub Actions du dépôt public NiakGPT ne reçoivent aucun secret, ne connaissent aucun dépôt coffre utilisateur et n’exécutent aucun smoke test contre un vrai coffre privé ;
14. le parcours GitHub App valide un `state` aléatoire et l’URL de retour Chromium avant tout échange de code ;
15. le sélecteur refuse tout dépôt qui n’est pas présent dans la liste des dépôts autorisés de l’installation GitHub App ;
16. la clé privée PEM de la GitHub App créée via manifest flow n’est jamais persistée ni utilisée.

Le dépôt privé protège l’accès par GitHub ; **NiakGPT 0.9.83 n’ajoute pas de chiffrement applicatif E2E des fichiers mémoire**. Toute personne ou application disposant d’un accès suffisant au dépôt peut lire son contenu.

## Intégrité du DOM pendant l’hydratation

Les content scripts JavaScript NiakGPT ne sont plus chargés à `document_start` : ils démarrent à `document_idle` puis restent inactifs jusqu’au signal d’hydratation émis par le boot-gate. Le gate vérifie aussi la stabilité d’identité des nœuds hôtes et laisse passer des tours idle du scheduler afin de ne pas confondre une pause DOM avec la fin réelle du travail React. Après démarrage, `#ng8-pins` suit un contrat **direct-once** : il est créé directement à son emplacement final et n’est jamais reparenté vers un autre shell ChatGPT ; un ancien shell est neutralisé sur place puis remplacé par un nouveau bloc dans le shell actif.

## Authentification GitHub

Le parcours recommandé utilise une **GitHub App privée créée pour l’utilisateur via le GitHub App Manifest flow**. L’amorce Manifest est une page d’extension ouverte dans un onglet normal, qui POSTe vers GitHub ; le service worker observe uniquement le retour vers son callback HTTPS exact `chromiumapp.org`. Les étapes installation/OAuth utilisent `chrome.identity.launchWebAuthFlow`, mais cette API ne reçoit désormais que des URL `http://` ou `https://`.

Propriétés de sécurité :

- aucun client secret OAuth/GitHub App partagé n’est compilé dans l’extension publique ;
- le `state` du manifest flow et ceux de l’installation/OAuth sont distincts, aléatoires et vérifiés ;
- une garde refuse explicitement tout appel `launchWebAuthFlow` dont le schéma n’est pas HTTP(S), empêchant la régression `chrome-extension://` ;
- la GitHub App demande uniquement **Contents: write** et **Metadata: read** ;
- GitHub affiche son propre écran d’installation et de sélection des dépôts ;
- les appels de lecture/écriture continuent à revérifier `private: true` et `archived: false` ;
- le user access token actif reste en `chrome.storage.session` ; le refresh token et le client secret de la GitHub App personnelle sont locaux au profil navigateur ;
- le PEM/private key renvoyé à la création n’est pas stocké ;
- les formats `github_pat_`, `ghp_`, `ghu_`, `ghr_` et autres préfixes GitHub connus sont nettoyés des erreurs exposées.

Un profil navigateur compromis peut exposer ces identifiants locaux. Le fallback **fine-grained PAT** reste disponible dans « Avancé » pour les environnements qui interdisent l’installation de GitHub Apps ; sa persistance locale reste opt-in.

## Historique complet ChatGPT

Les `GET /backend-api/conversation/{id}` complets restent **bloqués par défaut** dans `page-bridge.js`.

Ils ne sont autorisés que lorsqu’une requête Project Memory porte explicitement `memoryBootstrap: true`. Même dans ce cas :

- la requête utilise le broker réseau unique ;
- aucune récupération n’est lancée pendant une génération ChatGPT ou une vérification ;
- le circuit breaker/rate-limit reste actif ;
- le module de synchronisation travaille séquentiellement et reprend sa queue après interruption ;
- la file de premier bootstrap est persistée avant le travail réseau et est recréée au démarrage si le coffre est connecté mais qu’aucune `lastSyncAt` réussie n’existe.

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

Le Control Center ne doit pas se rerendre en boucle pendant la saisie d’un dépôt/token et un échec de connexion ne doit pas effacer les valeurs saisies. Project Memory doit toutefois rendre sa section immédiatement même si son runtime optionnel arrive après l’ouverture du Control Center, puis réagir aux événements `niakgpt:control-center-rendered` et mémoire. Le panneau Diagnostic ne doit pas reconstruire son DOM tant qu’une sélection texte native non vide est active.

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
