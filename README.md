# NiakGPT

Extension Chrome/Chromium locale pour transformer ChatGPT en espace de travail power-user : navigation rapide, Projects, sommaire, suggestions de prompts en français, mise en valeur du code et optimisation des longues discussions.

## Installation

1. Télécharger le dépôt en ZIP ou le cloner.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Cliquer **Charger l’extension non empaquetée**.
5. Sélectionner **la racine du dossier `niakgpt`** — le fichier `manifest.json` est directement à la racine.
6. Recharger `https://chatgpt.com`.

## Ce qui doit apparaître

- barre d’activité sombre à droite, inspirée de Visual Studio Code ;
- barre d’état bleue en bas ;
- panneau Explorer des Projects ;
- suggestions de prompts en français au-dessus du champ de saisie ;
- `Alt+K` pour ouvrir la recherche rapide de conversations ;
- sommaire des longues discussions ;
- présentation IDE des blocs de code ;
- optimisation des anciens blocs hors écran.

## Organisation des Projects

NiakGPT ne contient **aucun nom de Project personnel en dur**. Il détecte les Projects présents dans le compte ChatGPT et apprend un profil local à partir des titres déjà rangés.

Règle de sécurité :

- un chat déjà présent dans un Project n’est **jamais déplacé automatiquement** ;
- seuls les chats hors Project peuvent être classés automatiquement, avec un seuil de confiance élevé ;
- l’onglet Audit peut suggérer une réorganisation d’un chat déjà rangé, mais le déplacement nécessite une action explicite ;
- les Projects génériques/vides restent visibles dans une section secondaire et ne sont jamais supprimés automatiquement.

L’épinglage natif des Projects actifs est effectué en best-effort via l’interface ChatGPT. Le panneau NiakGPT garde de toute façon les Projects actifs immédiatement accessibles.

## Performance

Le mode performance applique des techniques réversibles côté navigateur :

- `content-visibility` ;
- containment de layout/paint ;
- optimisation des blocs lourds (code, tableaux, math) ;
- médias en chargement différé ;
- conservation des derniers tours pleinement actifs.

Il ne modifie ni ne supprime les données des conversations côté serveur.

## Confidentialité

- l’extension s’exécute uniquement sur `https://chatgpt.com/*` ;
- aucune permission sur d’autres domaines ;
- aucune analytics ;
- aucun serveur NiakGPT ;
- aucune identité, adresse, nom de personne ou nom de Project personnel intégré au code ;
- les réglages sont stockés localement via `chrome.storage.local`.

## Raccourcis

- `Alt+K` : Quick Open conversations
- `Alt+1` : Explorer
- `Alt+2` : Sommaire
- `Alt+3` : Coach de prompts
- `Alt+4` : Performance

## Version

0.3.1
