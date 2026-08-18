<p align="center">
  <img src="assets/niakgpt-logo.svg" alt="NiakGPT — Power Workspace for ChatGPT" width="760">
</p>

<p align="center">
  <strong>Transforme ChatGPT en véritable espace de travail power-user.</strong><br>
  Projects organisés, navigation rapide, longues conversations plus légères, continuité locale et outils pensés pour un usage intensif.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.9.60-4fc1ff">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4ec9b0">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-100%25-c586c0">
  <img alt="No analytics" src="https://img.shields.io/badge/analytics-none-dcdcaa">
</p>

# NiakGPT

NiakGPT est une extension navigateur qui ajoute à ChatGPT une couche de **productivité, d’organisation et de contrôle** pour les utilisateurs intensifs.

Elle fonctionne directement au-dessus de l’interface officielle de ChatGPT : **pas de service parallèle, pas de compte NiakGPT supplémentaire et pas de serveur NiakGPT pour les fonctions principales**.

> **Version actuelle : 0.9.60** — sidebar Projects à propriétaire unique, discussions Project stables et réellement cliquables, conversation courante mise en évidence, état OUT persistant, longues conversations allégées et labs navigateur permanents.

## Ce que NiakGPT apporte

### Projects comme espace de travail

- Projects colorés et immédiatement identifiables ;
- conversations accessibles directement en dépliant un Project ;
- recherche locale dans les gros Projects ;
- dates et compteurs visibles ;
- lien **PROJECTS** vers la page Projects de ChatGPT ;
- conversations rendues comme de vrais liens : clic gauche, clic droit, clic molette et Ctrl/Cmd+clic restent natifs ;
- **conversation courante mise en évidence** dans le Project ouvert ;
- renommage depuis le tiroir Project ;
- conversations arrivées à leur limite signalées par **OUT**, persistées localement et reléguées après les conversations actives ;
- déplacements manuels protégés contre le reclassement automatique.

### Une seule liste Projects

Lorsque NiakGPT est actif, **le bloc Projects natif de ChatGPT n’est pas affiché**. NiakGPT possède cette zone de la sidebar et masque structurellement le conteneur natif `group/sidebar-expando-section` contenant les lignes `group/project-unfurl-row`.

Les GPT personnalisés et la liste générale des discussions restent intacts.

### Discussions Project stables

Depuis 0.9.60, un seul module possède le DOM des tiroirs Project. Les anciens renderers restent dans le dépôt pour leurs labs historiques, mais sont neutralisés en production avant de pouvoir modifier le même DOM.

Conséquences :

- le titre reste ellipsé au lieu d’alterner entre version tronquée et complète ;
- la colonne date garde une largeur fixe ;
- le lien n’est plus remplacé sous le pointeur lors d’un rafraîchissement du cache ;
- l’identité DOM de la ligne est conservée lors des mises à jour ;
- l’état actif et l’état OUT sont appliqués sans reconstruire la ligne.

### Classement automatique avec rattrapage

NiakGPT peut classer les nouveaux chats vers le Project le plus pertinent tout en respectant les verrous manuels. Les conversations récentes non affectées peuvent être rattrapées sans télécharger le contenu complet du fil.

### Navigation power-user

- `Alt+K` : ouverture rapide des Projects et conversations ;
- fil d’Ariane Project → conversation ;
- sommaire du fil courant ;
- barre d’état synchronisée avec le Project courant ;
- code enrichi avec langage, nombre de lignes et copie ;
- Centre de contrôle et Safe Mode pour les fils extrêmes.

### Longues conversations

Les gros fils sont traités de façon conservatrice :

- aucun chargement complet du JSON d’une conversation par NiakGPT ;
- pas d’observation caractère par caractère de tout l’historique ;
- historique ancien laissé au repos pendant le streaming ;
- traitements incrémentaux et reprise différée au retour à l’état prêt ;
- réduction du travail de fond pendant Activité / Réflexion / génération ;
- Safe Mode disponible pour réduire encore les fonctions décoratives.

### Activité, Réflexion, Sources et Outputs

Les panneaux natifs de droite sont traités comme une même famille d’interface : largeur contenue, rail NiakGPT conservé, chat non écrasé et code gardant son scroll local.

### Continuité des fils

Lorsqu’une conversation atteint sa limite, NiakGPT peut la marquer **OUT**, conserver cet état dans le stockage local, la déplacer visuellement après les fils encore actifs et préparer une nouvelle conversation dans le même Project avec une capsule de continuité locale.

Aucun envoi automatique n’est effectué.

## Local-first

- aucune analytics NiakGPT ;
- aucun serveur NiakGPT nécessaire au fonctionnement principal ;
- aucun compte NiakGPT ;
- permissions limitées à ChatGPT et au stockage de l’extension ;
- cache, préférences, gouvernance et états conservés dans le navigateur.

## Installation

1. Télécharger ou cloner le dépôt.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Cliquer sur **Charger l’extension non empaquetée**.
5. Sélectionner la racine contenant `manifest.json`.
6. Recharger les onglets ChatGPT déjà ouverts.

Les workflows GitHub produisent également un ZIP installable à partir du runtime validé.

## Raccourcis

| Action | Raccourci |
|---|---|
| Quick Open | `Alt+K` |
| Centre de contrôle | `Alt+,` |

## Philosophie

- **utilisateur > automatisation** ;
- **performance avant décoration** ;
- **local-first** ;
- **un seul propriétaire par zone d’interface** ;
- **pas de polling global permanent** ;
- **les anciens labs de régression sont conservés** : une nouvelle version ajoute de la couverture au lieu de nettoyer l’historique.

---

# Technique

## Architecture

NiakGPT est une extension **Manifest V3**. `page-bridge.js` reste l’unique runtime exécuté dans le monde MAIN ; le reste du runtime DOM est injecté en monde isolé après disponibilité du shell ChatGPT. NiakGPT ne remplace pas globalement `window.fetch`.

## Sidebar 0.9.60

Deux invariants structurants ont été ajoutés :

- `sidebar-native-projects-v110.js/css` possède la suppression du système Projects natif et cible le conteneur structurel complet, sans dépendre d’un état « ready » des pins ;
- `project-drawer-v110.js/css` est l’unique propriétaire du tiroir des conversations d’un Project.

Les modules historiques `sidebar-authority-v107.js`, `sidebar-expando-guard-v108.js`, `sidebar-projects-authority-v109.js`, `pin-folders-v096.js` et `project-chat-ux-v109.js` restent conservés pour les régressions historiques, mais leurs mutations concurrentes sont désactivées dans le runtime 0.9.60.

Le tiroir 0.9.60 réconcilie les lignes par identifiant au lieu de reconstruire la liste : les nœuds existants sont conservés, le titre/date/statut sont patchés en place et les liens restent de vrais `<a>`.

## État OUT

`continuity-v100.js` reste la source canonique de l’état OUT dans `chrome.storage.local` sous `niakgpt-continuity-v100`. Le tiroir Project lit ce stockage directement : une conversation déjà marquée OUT reste identifiable après navigation ou redémarrage de la page.

## Réseau et gros fils

Le bridge refuse les `GET /backend-api/conversation/{id}` complets initiés par NiakGPT. Les fonctions de classement, gouvernance et renommage utilisent uniquement les opérations ciblées nécessaires. Les traitements lourds sont suspendus ou différés lorsque ChatGPT charge, réfléchit, exécute une tâche ou affiche une vérification native.

## WORKER / CLIENT et lifecycle

Quand plusieurs onglets ChatGPT sont ouverts, un onglet peut devenir **WORKER** et les autres restent **CLIENT**. `BroadcastChannel` et `navigator.locks` sont utilisés quand disponibles ; les canaux/callbacks sont neutralisés lors d’un `pagehide`, BFCache ou contexte extension invalidé.

## Tests et labs

Les labs sont permanents dans le dépôt. La CI combine contrôles Manifest/runtime, garde-fous hot-path/hydratation, Browser Matrix, Visual Lab, Runtime Diagnostics et matrices historiques.

La 0.9.60 ajoute deux niveaux qui manquaient auparavant :

1. une matrice **Chromium / Firefox / WebKit** qui charge volontairement les nouveaux modules à côté des anciens modules concurrents ;
2. un test Chromium avec **l’extension MV3 réellement chargée et son vrai service worker**, qui vérifie notamment : bloc Projects natif masqué, tiroir unique, identité DOM stable pendant les rafraîchissements du cache, date immobile, titre ellipsé, conversation active, OUT persistant, clics non interceptés et navigation réelle vers le chat.

Les captures produites sont conservées comme artifacts GitHub Actions.

## Documentation

- [`CHANGELOG.md`](CHANGELOG.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
- [`PRIVACY.md`](PRIVACY.md)
- [`SECURITY.md`](SECURITY.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Confidentialité et sécurité

NiakGPT dépend de l’interface web et de certains endpoints internes non documentés de ChatGPT. OpenAI peut modifier ces surfaces sans préavis ; les labs réduisent le risque de régression mais ne remplacent pas un smoke test sur une session authentifiée réelle.

## Licence

Aucune licence open source n’est déclarée pour le moment. Le fait que le dépôt soit public ne constitue pas une autorisation implicite de redistribution ou de réutilisation.
