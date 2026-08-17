<p align="center">
  <img src="assets/niakgpt-logo.svg" alt="NiakGPT — Power Workspace for ChatGPT" width="760">
</p>

<p align="center">
  <strong>Transforme ChatGPT en véritable espace de travail power-user.</strong><br>
  Projects organisés, navigation rapide, longues conversations plus légères, continuité locale et outils pensés pour un usage intensif.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.9.59-4fc1ff">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4ec9b0">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-100%25-c586c0">
  <img alt="No analytics" src="https://img.shields.io/badge/analytics-none-dcdcaa">
</p>

# NiakGPT

NiakGPT est une extension navigateur qui ajoute à ChatGPT une couche de **productivité, d’organisation et de contrôle** pour les utilisateurs intensifs.

Elle fonctionne directement au-dessus de l’interface officielle de ChatGPT : **pas de service parallèle, pas de compte NiakGPT supplémentaire et pas de serveur NiakGPT pour les fonctions principales**.

> **Version actuelle : 0.9.59** — Projects NiakGPT autoritaires, focus/renommage/état OUT dans les discussions Project, rattrapage automatique des chats récents non classés, navigation native et labs multi-navigateurs permanents.

## Ce que NiakGPT apporte

### Projects comme espace de travail

- Projects colorés et immédiatement identifiables ;
- conversations accessibles directement en dépliant un Project ;
- recherche locale dans les gros Projects ;
- dates et compteurs visibles ;
- lien **PROJECTS** vers la page Projects de ChatGPT ;
- conversations rendues comme de vrais liens : clic droit, clic molette et Ctrl/Cmd+clic restent natifs ;
- **conversation courante mise en évidence** dans le Project ouvert ;
- **renommage d’une conversation directement depuis le tiroir Project** ;
- conversations arrivées à leur limite signalées par **OUT** et reléguées après les conversations actives ;
- déplacements manuels protégés contre le reclassement automatique.

### Une seule liste Projects

Lorsque le bloc Projects NiakGPT est présent, **il devient l’unique système Projects visible dans la sidebar**.

NiakGPT masque le bloc Projects natif de ChatGPT dans son ensemble — titre, lignes, conversations enfants et contrôles associés — au lieu d’essayer de reconnaître chaque Project séparément. Cette règle couvre également la structure récente de ChatGPT basée sur `group/sidebar-expando-section` et les lignes `group/project-unfurl-row` sans lien.

Si le bloc NiakGPT disparaît réellement, le bloc Projects natif est restauré comme filet de sécurité. Les GPT personnalisés et la liste générale des discussions ne sont pas masqués.

### Classement automatique avec rattrapage

NiakGPT peut classer les nouveaux chats vers le Project le plus pertinent tout en respectant les verrous manuels.

Depuis 0.9.59, le classement ne dépend plus uniquement d’un chat observé en direct ou d’un Project « À classer » : un **rattrapage léger des conversations récentes non affectées** est effectué au démarrage et à la reprise. Il utilise les métadonnées locales déjà disponibles et des mutations `PATCH` ciblées, **sans télécharger la conversation complète**.

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

Les panneaux natifs de droite sont traités comme une même famille d’interface :

- largeur contenue ;
- rail NiakGPT conservé ;
- chat non écrasé ;
- contenu long borné au panneau ;
- code conservant son scroll local.

### Continuité des fils

Lorsqu’une conversation atteint sa limite, NiakGPT peut :

- la marquer **OUT** ;
- la déplacer visuellement après les fils encore actifs ;
- préparer une nouvelle conversation dans le même Project ;
- injecter localement une capsule de continuité avec le contexte utile disponible.

Aucun envoi automatique n’est effectué.

## Local-first

NiakGPT est conçu pour rester local :

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

NiakGPT est une extension **Manifest V3**.

Le runtime sépare :

- `page-bridge.js`, unique runtime exécuté dans le monde MAIN ;
- le runtime DOM injecté en monde isolé après disponibilité du shell ChatGPT ;
- cache / index Projects / gouvernance ;
- navigation, tiroirs Projects et continuité ;
- activité et panneaux natifs ;
- coordination WORKER / CLIENT entre onglets ;
- garde-fous de compatibilité et d’auto-réparation.

NiakGPT ne remplace pas globalement `window.fetch`.

## Réseau et gros fils

Le bridge refuse les `GET /backend-api/conversation/{id}` complets initiés par NiakGPT. Les fonctions de classement, gouvernance et renommage utilisent uniquement les opérations ciblées nécessaires.

Les traitements lourds sont suspendus ou différés lorsque ChatGPT charge, réfléchit, exécute une tâche ou affiche une vérification native.

## Autorité Projects 0.9.59

`sidebar-projects-authority-v109.js` rend `#ng8-pins` autoritaire dès que ce bloc existe et est connecté. Il ne dépend plus du nombre de pins reconnus au moment exact du rendu.

Le détecteur :

- recherche un heading `Projets` / `Projects` hors de l’UI NiakGPT ;
- remonte au token exact `group/sidebar-expando-section` lorsqu’il existe ;
- possède un fallback structurel borné ;
- masque le conteneur complet ;
- restaure le natif uniquement lorsque `#ng8-pins` disparaît.

Le suivi est événementiel via `MutationObserver`, navigation SPA et événements NiakGPT ; aucun `setInterval` permanent n’est ajouté.

## Discussions Project 0.9.59

`project-chat-ux-v109.js` complète les vrais liens produits par `pin-folders-v096.js` :

- `aria-current="page"` + focus coloré sur la conversation courante ;
- bouton de renommage avec `PATCH { title }` puis mise à jour du cache local ;
- lecture de l’état OUT de `niakgpt-continuity-v100` ;
- badge OUT et ordre visuel après les conversations actives ;
- clic droit et clics modifiés laissés au navigateur.

## Rattrapage du classement

`reclassify-v101.js` traite maintenant deux catégories :

1. les conversations présentes dans une file de classement explicite ;
2. les conversations racine/non affectées suffisamment récentes — fenêtre de rattrapage actuelle : **72 h**.

Un chat déjà relié à un Project par son URL n’est pas considéré comme racine. Les locks manuels restent prioritaires. Les déplacements utilisent un `PATCH` ciblé et ne nécessitent aucun GET complet du fil.

## WORKER / CLIENT et lifecycle

Quand plusieurs onglets ChatGPT sont ouverts :

- un onglet peut devenir **WORKER** ;
- les autres restent **CLIENT** ;
- les CLIENT réutilisent le cache partagé ;
- un WORKER lourd peut céder son rôle ;
- `BroadcastChannel` et `navigator.locks` sont utilisés quand disponibles ;
- les canaux/callbacks sont neutralisés lors d’un `pagehide`, BFCache ou contexte extension invalidé.

## Tests et labs

Les labs sont permanents dans le dépôt.

La CI combine :

- contrôles Manifest/runtime et syntaxe ;
- garde-fous hot-path / hydratation ;
- Browser Matrix ;
- Visual Lab ;
- Runtime Diagnostics ;
- matrices historiques 0.9.52+ ;
- matrice 0.9.59 Chromium / Firefox / WebKit.

Le lab 0.9.59 couvre notamment :

- bloc Projects natif actuel masqué même lorsque l’ancien prédicat de pins « ready » serait faux ;
- restauration native lorsque le bloc NiakGPT disparaît ;
- GPT personnalisés préservés ;
- focus de la conversation active ;
- bouton renommer et mutation de titre ;
- badge OUT + ordre en bas ;
- clic droit natif ;
- trois conversations récentes hors Project rattrapées automatiquement ;
- une conversation ancienne laissée intacte ;
- aucune lecture complète de conversation pour ce rattrapage.

Les captures produites par les trois moteurs sont conservées comme artifacts GitHub Actions.

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
