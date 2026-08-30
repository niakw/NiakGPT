# Confidentialité — NiakGPT

NiakGPT 0.9.84 conserve un **cœur local-first** et ajoute Project Memory v132, une synchronisation GitHub privée **optionnelle et explicitement activée par l’utilisateur**.

## Résumé

- aucun serveur NiakGPT requis ;
- aucune analytics NiakGPT ;
- aucun SDK publicitaire ;
- aucun compte NiakGPT ;
- le fonctionnement standard reste local dans le navigateur et sur `chatgpt.com` ;
- Project Memory n’émet aucun trafic GitHub tant qu’il n’est pas configuré ;
- lorsqu’il est activé, NiakGPT refuse d’utiliser comme mémoire un dépôt GitHub public ;
- l’historique complet reste dans le dépôt privé choisi ; seul un checkpoint compact est normalement ajouté à un nouveau fil.

## Périmètre réseau

Le manifest 0.9.84 déclare :

```text
https://chatgpt.com/*
https://api.github.com/*
https://github.com/login/*
https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/*
```

### ChatGPT

NiakGPT utilise la session ChatGPT déjà ouverte et un ensemble borné de surfaces/endpoints internes nécessaires aux Projects, à la continuité et à l’indexation. Ces endpoints appartiennent à l’interface web de ChatGPT et peuvent évoluer.

### GitHub

`https://api.github.com/*` est réservé à Project Memory. `https://github.com/login/*` sert uniquement à l’échange/renouvellement OAuth déclenché par la connexion GitHub. Le host `chromiumapp.org` déclaré est le callback HTTPS exact et stable de l’extension, utilisé uniquement pour recevoir les codes temporaires/state du flux GitHub ; il ne donne aucun accès générique à un compte ou dépôt. **Sans action explicite de connexion Project Memory, le module n’effectue pas de trafic GitHub.**

Lors de la connexion, NiakGPT vérifie le dépôt sélectionné via l’API GitHub. Si le dépôt n’est pas privé, l’initialisation est refusée. Si le dépôt privé est neuf et ne contient encore aucun commit, NiakGPT peut créer son premier commit/ref pour initialiser la mémoire. La confidentialité du dépôt est à nouveau vérifiée avant les lectures et écritures mémoire.

NiakGPT n’utilise pas le dépôt public `niakw/NiakGPT` pour stocker les données privées d’un utilisateur. **Le dépôt public et ses GitHub Actions ne connaissent pas le dépôt coffre configuré par l’utilisateur et n’y accèdent jamais.** Le nom du coffre et son secret d’accès sont fournis localement dans le navigateur.

## Données lues sur ChatGPT

Le fonctionnement normal peut lire :

- le DOM visible ;
- les titres et métadonnées de conversations ;
- les Projects accessibles ;
- les inventaires légers nécessaires aux compteurs, dates et classements ;
- l’état de navigation, de génération et du composer ;
- le contexte déjà présent dans le DOM pour les mécanismes de continuité.

En fonctionnement normal, NiakGPT continue de refuser les `GET /backend-api/conversation/{id}` complets initiés par l’extension.

### Exception Project Memory

Après activation explicite de Project Memory, le bootstrap ou une synchronisation peut lire le payload complet d’une conversation afin d’en créer une copie privée durable. Cette exception est marquée `memoryBootstrap`, passe par le broker réseau unique, et reste soumise aux pauses pendant génération/vérification ainsi qu’aux limites de débit.

La connexion au coffre écrit d’abord son marqueur d’initialisation puis crée localement une **file persistante** de Projects à synchroniser. Un seul onglet **visible et utilisable** exécute la file à la fois, protégé par un `navigator.locks` dédié à Project Memory. Le verrou n’est plus couplé au WORKER général : un onglet caché ne peut donc plus monopoliser la synchronisation en attendant indéfiniment de redevenir visible. Si l’onglet actif devient caché, la file reste persistante et la reprise se fait sur un onglet visible. Si un coffre est déjà connecté mais qu’aucune synchronisation réussie n’a encore été enregistrée, 0.9.84 recrée automatiquement cette file au démarrage. Après le bootstrap, NiakGPT tente de ne relire que les conversations dont le timestamp d’activité a changé.

## Données enregistrées dans le dépôt privé

Sous la racine choisie, Project Memory peut enregistrer :

```text
.niakgpt-memory/
├── niakgpt-memory.json
└── projects/
    └── <project-id>/
        ├── project.json
        ├── index.json
        ├── PROJECT_STATE.md
        └── conversations/
            └── <conversation-id>/
                ├── index.json
                └── part-001.md ...
```

Cela peut contenir du **contenu privé de conversations**, les instructions/description d’un Project, des tâches, contraintes, décisions et éléments d’architecture détectés dans les échanges.

Le dépôt Git conserve un historique de versions : une ancienne version d’un fichier peut donc rester accessible dans l’historique Git jusqu’à suppression/réécriture volontaire de cet historique par le propriétaire du dépôt.

Project Memory n’ajoute pas de chiffrement applicatif de bout en bout par-dessus GitHub dans la 0.9.84. La protection repose sur les contrôles d’accès du dépôt privé GitHub et du compte GitHub de l’utilisateur.

## Checkpoint envoyé à ChatGPT

L’historique complet n’est pas ajouté à chaque prompt.

Si l’option correspondante reste active, NiakGPT charge `PROJECT_STATE.md` et peut l’ajouter **une seule fois au premier message d’un nouveau fil appartenant au Project**. Ce checkpoint est borné en taille et contient principalement l’état courant, les tâches, décisions, contraintes, architecture et contexte récent.

Au moment où l’utilisateur envoie ce message, ce checkpoint devient naturellement une partie du contenu transmis à ChatGPT, comme le reste du prompt.

## Authentification GitHub

Le parcours recommandé est **Se connecter avec GitHub**. NiakGPT utilise le GitHub App Manifest flow pour créer une GitHub App privée appartenant à l’utilisateur, puis l’écran GitHub permet de sélectionner les dépôts accessibles.

NiakGPT ne possède donc **aucun client secret partagé** dans son dépôt public, ses releases ou ses GitHub Actions. Pour le connecteur privé créé par l’utilisateur :

- le client ID et le client secret de cette GitHub App personnelle sont conservés dans `chrome.storage.local` ;
- le user access token courant est conservé dans `chrome.storage.session` ;
- lorsque GitHub fournit un refresh token, il est conservé localement afin de renouveler la session sans demander un nouveau login à chaque redémarrage ;
- le PEM/private key renvoyé lors de la création de la GitHub App n’est ni utilisé ni persisté par NiakGPT ;
- le sélecteur NiakGPT ne conserve que les métadonnées minimales des dépôts autorisés (nom complet, branche par défaut, identifiant d’installation).

Comme tout secret stocké dans un profil navigateur, ces éléments peuvent être exposés si le profil ou la machine est compromis. Déconnecter GitHub de NiakGPT supprime les identifiants locaux, mais ne désinstalle pas automatiquement la GitHub App dans le compte GitHub.

Le **fine-grained PAT** reste disponible dans la section avancée comme fallback. Dans ce mode historique, il reste en session par défaut et n’est copié dans `chrome.storage.local` que si l’utilisateur choisit explicitement de le mémoriser.

## Stockage local

NiakGPT utilise notamment :

- `chrome.storage.local` pour préférences, index, gouvernance, queues de reprise, checkpoints locaux et identifiants/refresh material de la GitHub App privée créée pour l’utilisateur ;
- `chrome.storage.session` pour le user access token GitHub actif et le PAT non persistant du fallback ;
- `sessionStorage` pour certains états de continuité temporaires, notamment un brouillon ou un extrait final de réponse partielle pendant une interruption réseau ; ces données sont bornées et chiffrées par le mécanisme d’incident avant persistance de session ;
- `localStorage` / IndexedDB pour certains caches et mécanismes historiques encore utilisés par le runtime ;
- `BroadcastChannel` et `navigator.locks` pour la coordination locale multi-onglets, notamment afin qu’un seul WORKER exécute la synchronisation automatique Project Memory.

## Déconnexion, suppression et export

**Déconnecter Project Memory** arrête l’utilisation du dépôt sans détruire les fichiers déjà présents dans GitHub. **Déconnecter GitHub** efface en plus les identifiants GitHub App stockés localement ; la GitHub App/installation reste gérable ou supprimable depuis GitHub.

**Effacer les données locales NiakGPT** ne supprime pas le contenu du dépôt GitHub et ne supprime pas les conversations/Projects stockés par ChatGPT.

Pour effacer définitivement une mémoire GitHub, le propriétaire du dépôt doit supprimer les fichiers ou le dépôt ; pour faire disparaître également les anciennes révisions, une réécriture de l’historique Git peut être nécessaire.

## Diagnostics et CI

Les fixtures publiques et artefacts CI ne doivent jamais contenir de conversation réelle, token, cookie ou nom de dépôt mémoire privé. `test/x.md` est volontairement une fixture synthétique sans donnée utilisateur.

## Voir aussi

- [SECURITY.md](SECURITY.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [README.md](README.md)
- [README.fr.md](README.fr.md)
