# NiakGPT

Extension Chrome/Chromium locale qui transforme ChatGPT en espace de travail power-user : Projects, navigation rapide, sommaire, suggestions de prompts françaises et contextuelles, présentation IDE du code, direction artistique et optimisation des longues discussions.

## Installation

1. Télécharger le dépôt en ZIP ou le cloner.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Cliquer **Charger l’extension non empaquetée**.
5. Sélectionner **la racine du dossier `niakgpt`** : `manifest.json` est directement à la racine.
6. Après une mise à jour, cliquer **Recharger** sur la carte NiakGPT puis faire un rechargement complet de `https://chatgpt.com`.

## Version actuelle

**0.5.1 — moteur unique**

Le manifest ne charge plus les anciens moteurs v0.3/v0.4. Il charge uniquement :

- `page-bridge.js` dans le contexte de la page pour les appels internes ChatGPT autorisés ;
- `app-v05.js` pour toute la logique NiakGPT ;
- `theme-v05.css` pour toute la direction artistique.

## Workspace / UX

- branding **NiakGPT** à la place du label ChatGPT quand le DOM le permet ;
- rail de travail inspiré de Visual Studio Code ;
- panneau droit qui **réserve sa largeur et pousse le contenu** au lieu de recouvrir le chat ;
- barre d’état en bas avec **BY SKYNET** au centre ;
- `Alt+K` : Quick Open des conversations ;
- sommaire des longues discussions ;
- blocs de code façon IDE avec langage, nombre de lignes et copie ;
- lignes de conversations zébrées façon tableau ;
- messages utilisateur / assistant avec fonds et accents distincts ;
- Project actif et conversation en génération visuellement signalés ;
- couleur stable et icône automatique par Project ;
- fond Matrix animé léger dans la zone de conversation ;
- easter eggs robot-skull discrets.

## Suggestions de prompts

Le coach est **dans le flux du composer**, jamais en position fixe. Les images et fichiers joints peuvent donc agrandir le composer sans être recouverts par les suggestions.

Les suggestions utilisent :

- le texte actuellement saisi ;
- les derniers échanges visibles ;
- le Project courant quand il existe ;
- le type de tâche détecté : code, bug, design, UX, recherche, classement, comparaison, synthèse, etc.

Le texte proposé reprend le sujet en cours afin que les recommandations changent avec le prompt au lieu d’afficher toujours les mêmes phrases génériques.

## Organisation des Projects

NiakGPT ne contient **aucun nom de Project personnel en dur**. Les Projects sont détectés dynamiquement depuis le compte ChatGPT.

Le moteur apprend un profil par Project à partir :

- du nom du Project ;
- de sa description et de ses instructions quand elles existent ;
- des titres/snippets des conversations déjà correctement rangées ;
- du contenu d’une conversation lorsqu’un titre est trop ambigu.

Règles de sécurité :

- un chat déjà présent dans un **vrai Project métier/personnel** est protégé et n’est pas déplacé automatiquement ;
- les chats **hors Project** peuvent être classés avec un seuil de confiance élevé ;
- les chats enfermés dans d’anciens Projects génériques (`Design`, `AI`, `Coding`, etc.) peuvent être réparés automatiquement vers un Project principal seulement si le score et la marge sont suffisamment élevés ;
- chaque déplacement est vérifié après le `PATCH` ;
- aucun Project n’est supprimé automatiquement.

Les Projects génériques hérités apparaissent dans **LEGACY / À NETTOYER** et sont atténués visuellement.

## Épinglage des Projects

NiakGPT distingue deux niveaux :

1. **accessibilité garantie par NiakGPT** : tous les Projects principaux manquants dans la zone native `Épinglés` sont injectés dans un bloc `PROJETS` sous cette zone ;
2. **épinglage natif best-effort** : l’extension tente aussi le vrai bouton `Épingler` de ChatGPT lorsqu’il est exposé dans la sidebar ou sur la page Projects.

Le diagnostic indique séparément combien sont accessibles et combien sont réellement épinglés nativement.

## Performance longues discussions

- `content-visibility` sur les anciens tours ;
- containment `layout/paint/style` ;
- optimisation des gros blocs de code, tableaux et math ;
- images en lazy loading ;
- derniers tours gardés pleinement actifs ;
- Matrix limité à environ 18 FPS, stoppé quand l’onglet est masqué ;
- Matrix désactivé automatiquement avec `prefers-reduced-motion`.

## Diagnostic

Le panneau Diagnostic expose :

- `bridge` ;
- `projects` ;
- `organizer` ;
- `coach` ;
- `toc` ;
- `performance` ;
- `pins` ;
- `matrix` ;
- `ui`.

Les modules de classement et d’épinglage ne doivent plus rester silencieusement en `ATTENTE` : ils affichent `PRÊT`, `EN COURS`, `OK` avec compteurs, ou une erreur explicite.

## Confidentialité

- exécution limitée à `https://chatgpt.com/*` ;
- aucune permission sur un autre domaine ;
- aucune analytics ;
- aucun serveur NiakGPT ;
- aucune identité, adresse, nom de personne ou nom de Project personnel intégré au code ;
- aucun abonnement ni API tierce payante.
