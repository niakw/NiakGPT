# NiakGPT

Extension Chrome/Chromium locale pour transformer ChatGPT en workspace power-user : Projects gouvernés, Quick Open, sommaire, suggestions contextuelles, DA VS Code × Instagram × Tableau, Matrix, cache chaud et optimisation des gros fils.

## Installation

1. Télécharger le dépôt en ZIP ou le cloner.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Cliquer **Charger l’extension non empaquetée**.
5. Sélectionner la racine du dossier `niakgpt`.
6. Après chaque mise à jour : **Recharger** NiakGPT puis `Ctrl+Shift+R` sur les onglets ChatGPT déjà ouverts.

## Version actuelle

**0.8.5 — Project Governance + cache chaud + multi-onglets**

Le runtime est limité à `https://chatgpt.com/*` et sépare :

- MAIN world : bridge RPC, détection des déplacements manuels et cache chaud des conversations ;
- isolated world : coordination multi-onglets, Project Governance, pins gouvernés, moteur UI/perf, chronologie et coach.

## Performance : priorité à ChatGPT

- cache local de l’index Projects/chats ;
- UI disponible avant l’indexation complète ;
- conversations des Projects indexées une par une en idle ;
- pause pendant une génération ;
- aucun tri lourd pendant le streaming ;
- Matrix ralenti sur gros fil ;
- `content-visibility` sur les anciens tours ;
- un seul onglet `WORKER` exécute les tâches partagées ;
- les autres onglets sont `CLIENT` et utilisent le cache partagé.

### Cache chaud des conversations

NiakGPT intercepte le chargement de `GET /backend-api/conversation/{id}` avant le rendu React.

- 5 conversations chaudes maximum ;
- stockage local IndexedDB ;
- limite globale d’environ 96 Mo ;
- expiration automatique après 6 h ;
- switch vers un fil inchangé = réponse servie depuis le cache ;
- comparaison avec l’`update_time` déjà connu ;
- un nouveau message marque le fil `DIRTY` ;
- déduplication réseau entre onglets via `navigator.locks` + `BroadcastChannel` ;
- stockage du gros JSON reporté à l’état idle.

## Project Governance

Depuis la v0.8.5, le vieux classifieur n’a plus le droit de déplacer directement une conversation. Tous les déplacements NiakGPT passent par **Project Governance**.

### Structure principale

Le bouton **Nettoyer & reconstruire** apparaît dans l’Explorer.

NiakGPT propose automatiquement comme structure principale les Projects qui ne sont ni :

- catégories génériques héritées (`Design`, `Coding`, `Work`, etc.) ;
- doublons exacts ;
- Projects de type test/demo/temporaire.

Cette structure est ensuite modifiable avec des cases à cocher. Elle est stockée localement **par identifiant de Project** : aucun nom de Project personnel n’est intégré au code source.

### Nettoyage

Le plan de nettoyage :

1. détecte les doublons et reliquats ;
2. protège tous les placements manuels ;
3. réaffecte les chats à forte confiance vers un Project principal ;
4. sort les chats ambigus de leur reliquat vers **Hors projet / À classer** ;
5. masque localement les anciens Projects une fois vidés ;
6. relance ensuite la resynchronisation progressive.

Les Projects ne sont pas supprimés de force par une API non documentée. Les reliquats vidés sont masqués et désépinglés ; ils peuvent être réaffichés depuis Project Governance.

### Verrouillage manuel

**Règle absolue : utilisateur > automatisation.**

Quand un chat est déplacé manuellement avec l’interface native ChatGPT :

- NiakGPT détecte le changement ;
- vérifie la destination réelle ;
- enregistre un verrou local persistant ;
- affiche un petit cadenas sur la conversation ;
- l’auto-resync ne peut plus la déplacer.

Le cadenas peut être retiré explicitement pour rendre le chat à nouveau classable automatiquement. Un déplacement manuel vers **Hors projet** est également protégé.

## Pins natifs gouvernés

Project Governance est aussi la source de vérité pour les épinglages.

- l’ancien moteur qui essayait d’épingler tous les Projects est neutralisé ;
- tous les Projects marqués **principaux** sont épinglés nativement quand le menu ChatGPT le permet ;
- les reliquats et Projects masqués sont désépinglés ;
- le diagnostic affiche `CORE · X/Y natifs`.

## Projects et compteurs

- pagination complète des Projects ;
- chaque Project est compté via son endpoint de conversations ;
- fallback automatique en cas de `422` sur la limite de pagination ;
- l’échec éventuel de `/backend-api/conversations` ne bloque plus le comptage Project par Project ;
- `?` = Project impossible à compter ;
- `…` = pas encore indexé ;
- détection des noms de Projects dupliqués.

## Organisation automatique

La resynchronisation automatique de la v0.8.5 ne touche que les chats **Hors projet et non verrouillés**, avec seuil de confiance élevé.

- exécution uniquement sur l’onglet `WORKER` ;
- uniquement à l’état idle ;
- aucune exécution pendant un gros fil/génération ;
- maximum réduit par passe ;
- destination limitée à la structure principale choisie ;
- ambigu = aucun déplacement.

## Sidebar gauche

- conversations zébrées façon tableau ;
- tri par date du dernier échange ;
- date compacte visible dans la ligne ;
- couleur et badge du Project ;
- icône sémantique stable ;
- Project actif renforcé ;
- génération jaune/orange ;
- cadenas pour placement manuel ;
- reliquats masqués après nettoyage.

## Quick Open

`Alt+K` ouvre la palette Projects + conversations.

- fonctionne avec le cache ;
- tri chronologique ;
- recherche conversation + Project ;
- navigation clavier ;
- sur un onglet CLIENT, aucune requête lourde n’est lancée.

## Direction artistique

- surfaces ChatGPT forcées ;
- sidebar / header / composer / menus / panneaux harmonisés ;
- zebra rows ;
- fonds distincts utilisateur / NiakGPT ;
- code façon Visual Studio Code ;
- accent du Project courant ;
- Matrix vert ;
- easter eggs robots ;
- **BY SKYNET** dans la barre d’état.

## Coach de prompts

Le coach reste dans le flux du composer et tient compte :

- du prompt en cours ;
- des derniers échanges ;
- du Project courant ;
- du type de tâche ;
- des images/fichiers joints.

## Diagnostic

En plus des modules historiques, la v0.8.x ajoute notamment :

- `onglet · WORKER / CLIENT` ;
- `hotcache · HIT / MISS / NETWORK / …` ;
- `governance · N principaux · M manuels · X masqués` ;
- `pins · CORE · X/Y natifs`.

## Confidentialité

- uniquement `https://chatgpt.com/*` ;
- aucune analytics ;
- aucun serveur NiakGPT ;
- cache conversations uniquement local au navigateur ;
- aucune identité ou nom de Project personnel codé dans le dépôt ;
- aucun abonnement ou API tierce payante.
