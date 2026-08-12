# NiakGPT

Extension Chrome/Chromium locale pour transformer ChatGPT en workspace power-user : Projects, tri automatique, Quick Open, sommaire, suggestions contextuelles, DA VS Code × Instagram × Tableau, Matrix et optimisation des gros fils.

## Installation

1. Télécharger le dépôt en ZIP ou le cloner.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Cliquer **Charger l’extension non empaquetée**.
5. Sélectionner la racine du dossier `niakgpt`.
6. Après chaque mise à jour : **Recharger** NiakGPT puis `Ctrl+Shift+R` sur ChatGPT.

## Version actuelle

**0.8.0 — idle-safe rebuild**

Le manifest charge uniquement :

- `page-bridge.js` ;
- `app-v08-safe.js` ;
- `theme-v08.css`.

Aucun ancien moteur v0.7/v0.8 expérimental n'est chargé.

## Performance : priorité à ChatGPT

La v0.8 ne doit plus faire de travail lourd au pire moment.

- cache local chargé immédiatement ;
- UI et sidebar disponibles avant l'indexation complète ;
- liste des Projects récupérée séparément ;
- conversations des Projects indexées **une Project à la fois** ;
- indexation lancée via `requestIdleCallback` / période idle ;
- pause immédiate dès qu'une génération ChatGPT est détectée ;
- aucune réorganisation pendant le streaming ;
- reprise de l'indexation après la génération ;
- Matrix fortement ralenti sur gros fil en exécution ;
- coach et easter eggs masqués pendant l'exécution ;
- `content-visibility` sur les anciens tours ;
- aucun monkey-patch global de `MutationObserver` ou `requestAnimationFrame`.

Le but est simple : **fluidité ChatGPT > décor / indexation**.

## Projects et compteurs

- pagination complète des Projects ;
- chaque Project est compté via son propre endpoint de conversations ;
- l'échec éventuel de `/backend-api/conversations` ne bloque plus le comptage par Project ;
- compteurs mis en cache puis rafraîchis progressivement ;
- `?` signifie qu'un Project n'a pas pu être compté ;
- `…` signifie qu'il n'a pas encore été indexé ;
- détection des noms de Projects dupliqués ;
- les conversations d'un doublon peuvent être consolidées vers le Project canonique sans supprimer automatiquement le Project.

## Organisation automatique

NiakGPT ne contient aucun nom personnel ou nom de Project utilisateur en dur.

Le classement apprend à partir :

- nom du Project ;
- description / instructions disponibles ;
- conversations déjà rangées ;
- titre, snippet et, si nécessaire, contenu du fil.

Règles :

- un chat dans un vrai Project est protégé ;
- les chats hors Project et les anciens Projects génériques peuvent être réparés ;
- les doublons exacts sont consolidables ;
- seuil de confiance + marge minimale ;
- chaque déplacement est vérifié après le `PATCH` ;
- aucun Project n'est supprimé automatiquement ;
- classement automatique uniquement à l'état idle.

## Sidebar gauche

La DA ne dépend plus d'un wrapper ChatGPT précis : les styles sont appliqués **directement aux liens natifs**.

- conversations : alternance de fond ligne 1 / ligne 2 façon tableau ;
- accent vertical hérité du Project ;
- badge du Project sur les chats visibles ;
- couleur stable automatique par Project ;
- icône automatique par sémantique ;
- fond coloré par Project ;
- état actif renforcé ;
- génération jaune/orange ;
- anciens Projects génériques atténués ;
- doublons visuellement signalés.

## Projects épinglés

NiakGPT ajoute dans la sidebar réelle un bloc **PROJECTS ÉPINGLÉS** contenant tous les Projects indexés.

Il distingue clairement :

1. Projects visibles dans le bloc NiakGPT ;
2. Projects réellement épinglés par l'action native ChatGPT.

Le diagnostic affiche les deux nombres séparément afin de ne jamais annoncer un faux succès natif.

## Quick Open

`Alt+K` ouvre la palette Projects + conversations.

- fonctionne immédiatement avec le cache ;
- s'enrichit au fil de l'indexation ;
- recherche par conversation et Project ;
- navigation clavier ;
- préchargement au survol lorsqu'il est sûr de le faire.

## Direction artistique forcée

La v0.8 écrase explicitement les surfaces et accents ChatGPT :

- sidebar ;
- header ;
- menus ;
- composer ;
- bouton d'envoi ;
- fonds de messages ;
- liens / textes / code ;
- panneau droit ;
- barre d'état.

L'accent utilisateur ChatGPT (rose, vert, etc.) ne doit plus reprendre le dessus sur les composants gérés par NiakGPT.

### Mix visuel

- **Visual Studio Code** : structure, code, Explorer, palette ;
- **Tableau** : densité et zébrage des listes ;
- **Instagram / messagerie** : distinction feed utilisateur / assistant et états visuels ;
- couleur du Project courant injectée comme accent de contexte ;
- Matrix vert visible derrière les zones libres ;
- petits easter eggs robot ;
- **BY SKYNET** dans la barre d'état.

## Coach de prompts

Le coach reste dans le flux du composer, jamais en position fixe.

Il tient compte :

- du texte en cours ;
- des derniers échanges ;
- du Project courant ;
- du type de tâche ;
- des pièces jointes.

Avec images/fichiers, il devient compact et reste au-dessus du composer sans recouvrir les previews.

## Diagnostic

Modules :

- `bridge` ;
- `data` ;
- `projects` ;
- `organizer` ;
- `pins` ;
- `quick` ;
- `coach` ;
- `toc` ;
- `performance` ;
- `matrix` ;
- `ui`.

Les erreurs réseau/API sont conservées dans **Dernières erreurs**.

## Confidentialité

- uniquement `https://chatgpt.com/*` ;
- aucune permission autre domaine ;
- aucun serveur NiakGPT ;
- aucune analytics ;
- aucune identité ou nom de Project personnel dans le code ;
- aucun abonnement ou API tierce payante.
