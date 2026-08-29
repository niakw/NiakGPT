# Confidentialité — NiakGPT

NiakGPT 0.9.77 conserve un **cœur local-first** et ajoute Project Memory v132, une synchronisation GitHub privée **optionnelle et explicitement activée par l’utilisateur**.

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

Le manifest 0.9.77 déclare :

```text
https://chatgpt.com/*
https://api.github.com/*
```

### ChatGPT

NiakGPT utilise la session ChatGPT déjà ouverte et un ensemble borné de surfaces/endpoints internes nécessaires aux Projects, à la continuité et à l’indexation. Ces endpoints appartiennent à l’interface web de ChatGPT et peuvent évoluer.

### GitHub

`https://api.github.com/*` est réservé à Project Memory. **Sans dépôt configuré, le module n’effectue pas de requête GitHub.**

Lors de la connexion, NiakGPT vérifie le dépôt sélectionné via l’API GitHub. Si le dépôt n’est pas privé, l’initialisation est refusée. La confidentialité du dépôt est à nouveau vérifiée avant les lectures et écritures mémoire.

NiakGPT n’utilise pas le dépôt public `niakw/NiakGPT` pour stocker les données privées d’un utilisateur.

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

Après le bootstrap, NiakGPT tente de ne relire que les conversations dont le timestamp d’activité a changé.

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

Project Memory n’ajoute pas de chiffrement applicatif de bout en bout par-dessus GitHub dans la 0.9.77. La protection repose sur les contrôles d’accès du dépôt privé GitHub et du compte GitHub de l’utilisateur.

## Checkpoint envoyé à ChatGPT

L’historique complet n’est pas ajouté à chaque prompt.

Si l’option correspondante reste active, NiakGPT charge `PROJECT_STATE.md` et peut l’ajouter **une seule fois au premier message d’un nouveau fil appartenant au Project**. Ce checkpoint est borné en taille et contient principalement l’état courant, les tâches, décisions, contraintes, architecture et contexte récent.

Au moment où l’utilisateur envoie ce message, ce checkpoint devient naturellement une partie du contenu transmis à ChatGPT, comme le reste du prompt.

## Token GitHub

NiakGPT recommande un **fine-grained personal access token** limité au dépôt mémoire choisi, avec les droits minimaux nécessaires aux métadonnées et au contenu du dépôt.

Par défaut :

- le token est conservé dans `chrome.storage.session` ;
- il doit être ressaisi après la fin de la session navigateur.

Si l’utilisateur active **Mémoriser le jeton sur cet appareil**, une copie est conservée dans `chrome.storage.local`. Cette option augmente la commodité mais aussi l’impact d’un accès malveillant au profil navigateur.

Le token n’est pas écrit dans le dépôt mémoire ni dans les diagnostics NiakGPT. Les erreurs connues sont nettoyées des formats de token GitHub avant affichage.

## Stockage local

NiakGPT utilise notamment :

- `chrome.storage.local` pour préférences, index, gouvernance, queues de reprise et checkpoints locaux ;
- `chrome.storage.session` pour le token GitHub non persistant ;
- `sessionStorage` pour certains états de continuité temporaires ;
- `localStorage` / IndexedDB pour certains caches et mécanismes historiques encore utilisés par le runtime ;
- `BroadcastChannel` et `navigator.locks` pour la coordination locale multi-onglets, notamment afin qu’un seul WORKER exécute la synchronisation automatique Project Memory.

## Déconnexion, suppression et export

**Déconnecter Project Memory** arrête l’utilisation du dépôt et retire le token local/session selon le chemin de déconnexion, mais ne détruit pas automatiquement les fichiers déjà présents dans GitHub.

**Effacer les données locales NiakGPT** ne supprime pas le contenu du dépôt GitHub et ne supprime pas les conversations/Projects stockés par ChatGPT.

Pour effacer définitivement une mémoire GitHub, le propriétaire du dépôt doit supprimer les fichiers ou le dépôt ; pour faire disparaître également les anciennes révisions, une réécriture de l’historique Git peut être nécessaire.

## Diagnostics et CI

Les fixtures publiques et artefacts CI ne doivent jamais contenir de conversation réelle, token, cookie ou nom de dépôt mémoire privé. `test/x.md` est volontairement une fixture synthétique sans donnée utilisateur.

## Voir aussi

- [SECURITY.md](SECURITY.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [README.md](README.md)
- [README.fr.md](README.fr.md)
