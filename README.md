<p align="center">
  <img src="assets/niakgpt-logo.svg" alt="NiakGPT — Power Workspace for ChatGPT" width="760">
</p>

<p align="center">
  <strong>Transforme ChatGPT en véritable espace de travail power-user.</strong><br>
  Projects organisés, navigation rapide, longues conversations plus légères, continuité locale et outils pensés pour un usage intensif.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.9.64-4fc1ff">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4ec9b0">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-100%25-c586c0">
  <img alt="No analytics" src="https://img.shields.io/badge/analytics-none-dcdcaa">
</p>

# NiakGPT

NiakGPT est une extension navigateur qui ajoute à ChatGPT une couche de **productivité, d’organisation et de contrôle** pour les utilisateurs intensifs.

Elle fonctionne directement au-dessus de l’interface officielle de ChatGPT : **pas de service parallèle, pas de compte NiakGPT supplémentaire et pas de serveur NiakGPT pour les fonctions principales**.

> **Version actuelle : 0.9.64** — stabilité de navigation durcie après refresh/remount, menus de pins immédiatement interactifs, visualiseur image refermable, suppression plus robuste du dernier bloc Projects natif, icônes principales de sidebar réellement NiakGPT et correction CodeQL du sommaire DOM.

## Ce que NiakGPT apporte

### Projects comme espace de travail

- Projects colorés et immédiatement identifiables ;
- conversations accessibles directement en dépliant un Project ;
- recherche locale dans les gros Projects ;
- dates et compteurs visibles ;
- lien **PROJECTS** NiakGPT vers la page Projects de ChatGPT ;
- conversations rendues comme de vrais liens : clic droit, clic molette et Ctrl/Cmd+clic restent natifs ;
- **conversation courante mise en évidence** dans le Project ouvert ;
- **menu d’actions ChatGPT complet depuis les Projects et conversations du bloc NiakGPT** quand la ligne native existe, avec fallback chat borné pour renommer/déplacer si ChatGPT ne rend pas cette ligne ;
- **nouveaux messages / réponses terminées hors vue** clairement signalés dans les conversations et leur Project ;
- conversations marquées **OUT** reléguées après les conversations actives ;
- déplacements manuels et continuations protégés contre le reclassement automatique.

### Une seule liste Projects

Lorsque le bloc Projects NiakGPT est présent, **il devient l’unique système Projects visible dans la sidebar**.

`sidebar-projects-authority-v112.js` ne dépend plus uniquement des classes ou des `href` de ChatGPT. Il combine :

- structure de section et libellés `Projets / Projects` ;
- liens Project lorsqu’ils existent ;
- **identité des Projects réellement affichés par `#ng8-pins`** : si un bloc natif hors NiakGPT contient plusieurs mêmes noms de Projects, il est reconnu comme le doublon natif même si ChatGPT change encore son markup.

Depuis 0.9.63, `project-pins-v090.js` n’est plus injecté dans le runtime : aucun second propriétaire ne resynchronise les Projects natifs pendant que l’autorité sidebar les masque.

Les conversations **Récents** restent visibles. Si le bloc NiakGPT disparaît réellement, le natif est restauré comme fallback de sécurité.

### Classement automatique avec rattrapage progressif

NiakGPT classe les nouveaux chats vers le Project le plus pertinent tout en respectant les verrous manuels.

Le chemin normal reste léger : **titre, snippet et métadonnées locales**. Depuis 0.9.62, les cas qui résistent à ce classement — notamment un chat lié à un Project devenu inexistant — peuvent passer par un rattrapage profond très borné :

1. titre/snippet ;
2. premier message utilisateur si nécessaire ;
3. messages suivants uniquement tant que la confiance reste insuffisante.

Cette analyse profonde est réservée aux cas ambigus/orphelins, suspendue pendant une génération ChatGPT, limitée à **1 chat par cycle sur un gros fil / 2 sinon**, espacée côté réseau, et ne conserve qu’un extrait borné de la conversation. Dès qu’une destination est suffisamment claire, l’analyse s’arrête. Un Project fantôme non résolu est détaché plutôt que laissé comme affectation invalide.

### Navigation power-user

- `Alt+K` : ouverture rapide des Projects et conversations ;
- fil d’Ariane canonique et entièrement lié **Accueil > Project > conversation** ;
- `OUT` reste un état de continuité et ne peut pas remplacer le nom du Project dans le fil d’Ariane ;
- sommaire du fil courant ;
- barre d’état synchronisée avec le Project courant ;
- code enrichi avec langage, nombre de lignes et copie ;
- Centre de contrôle et Safe Mode pour les fils extrêmes.

### Titres de conversations et cache

`chat-state-authority-v113.js` maintient une source canonique monotone pour le titre et le Project d’une conversation :

- une donnée serveur/cache plus récente gagne ;
- à horodatage identique, un titre générique ou obsolète ne peut plus écraser un titre canonique déjà connu ;
- le titre de l’onglet navigateur sert uniquement de secours lorsqu’aucun vrai titre n’est encore disponible ;
- le Project porté par la route courante peut réparer une affectation locale incohérente.

Cela évite notamment qu’un nouveau chat affiche ensuite un autre nom à cause d’un ancien état de cache.

### Longues conversations et cache

La priorité est la fluidité du runtime natif ChatGPT :

- pas d’intercepteur global de `window.fetch` ;
- pas d’observation caractère par caractère de tout l’historique ;
- détection anticipée des fils lourds et **historique froid**, avec une queue récente seulement gardée chaude ;
- `content-visibility` / containment appliqués à l’historique froid ;
- Matrix coupée pendant la génération sur un gros fil et bots décoratifs désactivés ;
- traitements incrémentaux et reprise différée au retour à l’état prêt ;
- cache local sérialisé via `cache-bus-v096.js`, avec conservation de l’inventaire historique lors des mises à jour delta ;
- Safe Mode disponible pour réduire encore les fonctions décoratives.

Le vieux hotcache qui remplaçait/interceptait le trafic du monde MAIN **n’est pas réactivé** : il avait été retiré pour préserver la stabilité de ChatGPT. Le cache actuel sert l’index, les métadonnées, les affectations et les high-water marks sans rejouer tout l’historique rendu.

Depuis 0.9.63, `conversation-load-guard-v113.js` relâche les optimisations NiakGPT si une route de conversation est présente mais que les tours natifs ne sont pas encore rendus — en particulier lors d’un retour sur un autre onglet — afin que NiakGPT ne puisse pas maintenir artificiellement un état lourd/froid pendant le chargement natif.

### Entêtes TOI / CHATGPT

Les tours récents conservent systématiquement leur identité **TOI / CHATGPT**. Quand un horodatage fiable existe dans le DOM natif ou a été capturé au moment de l’envoi dans la session courante, l’entête affiche :

`TOI · JJ/MM/AA · HH:mm` / `CHATGPT · JJ/MM/AA · HH:mm`

NiakGPT ne fabrique pas une heure après rechargement si aucune source fiable n’est disponible. Le module d’entête garde la propriété de son horodatage afin qu’un autre décorateur ne puisse plus le remplacer ensuite par une valeur différente.

### Continuité des fils OUT

Lorsqu’un fil arrivé à sa limite est continué, NiakGPT prépare explicitement :

`Reprends la conversation nommée « NOMPROJECT > NOMCHAT » exactement là où elle s’est arrêtée.`

La capsule ajoute le contexte Project et l’historique local disponible. Le nouveau chat est ensuite **PATCHé sur le Project exact d’origine** puis protégé par un verrou de gouvernance `continuity-exact`. La recommandation normale de Project reste inchangée pour les nouveaux chats créés hors de ce bouton.

La détection automatique de la limite reste best-effort : elle dépend des signaux rendus par l’interface ChatGPT. Aucun envoi automatique n’est effectué.

### Accueil, Matrix et DA native

- le titre d’accueil n’est déplacé que si une mesure réelle de géométrie détecte un chevauchement avec le composer ;
- le fond Matrix est surveillé : priorité au canvas NiakGPT existant, fallback léger seulement s’il manque et si Matrix est activée ;
- `prefers-reduced-motion` est respecté ;
- les SVG/icônes natifs ChatGPT restent natifs, mais leur couleur, contraste, hover/focus et surfaces sont harmonisés avec la DA NiakGPT.

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
- **les anciens labs de régression sont conservés** : une nouvelle version ajoute de la couverture au lieu de nettoyer l’historique utile.

---

# Technique

## Architecture

NiakGPT est une extension **Manifest V3**.

Le runtime sépare :

- `page-bridge.js`, unique runtime général exécuté dans le monde MAIN ;
- le runtime DOM injecté en monde isolé après disponibilité du shell ChatGPT ;
- cache / index Projects / gouvernance ;
- navigation, tiroirs Projects et continuité ;
- activité et panneaux natifs ;
- coordination WORKER / CLIENT entre onglets ;
- garde-fous de compatibilité et d’auto-réparation.

NiakGPT ne remplace pas globalement `window.fetch`.

## Réseau et gros fils

Le bridge normal refuse les `GET /backend-api/conversation/{id}` complets initiés par les modules ordinaires. Gouvernance, index et classement normal utilisent des inventaires légers et des mutations ciblées.

**Exception introduite en 0.9.62 :** `analysis-bridge-v112.js` peut demander le détail d’un fil uniquement pour un reclassement ambigu/orphelin, au repos, avec cadence minimale, cache mémoire court et extraction bornée (**10 messages / 14 000 caractères maximum**). Ce chemin n’est pas utilisé pour le rendu des gros fils ni pour alimenter le cache d’interface.

Les traitements lourds sont suspendus ou différés lorsque ChatGPT charge, réfléchit, exécute une tâche, génère une réponse ou affiche une vérification native.

## Autorité Projects

`sidebar-projects-authority-v112.js` rend `#ng8-pins` autoritaire dès que ce bloc existe et est visible.

Le détecteur :

- reconnaît les vrais conteneurs `sidebar-expando-section` lorsqu’ils sont dédiés aux Projects ;
- reconnaît le raccourci natif `/projects` lorsqu’il existe ;
- gère `Projets / Projects` et les changements de markup ;
- compare aussi plusieurs noms de Projects du bloc natif aux noms réellement gérés par NiakGPT ;
- n’engloutit jamais un ancêtre qui contient de vraies conversations Récents ;
- exclut tout élément situé dans `#ng8-pins` ;
- suit le remplacement complet de la sidebar lors des rerenders SPA ;
- restaure le natif uniquement lorsque `#ng8-pins` disparaît.

Le suivi est événementiel via `MutationObserver`, navigation SPA et événements NiakGPT ; aucun `setInterval` permanent n’est ajouté.

## Actions natives depuis le bloc NiakGPT

`native-actions-v113.js` ajoute un bouton d’actions aux lignes Project et conversation gérées. Il privilégie le **menu ChatGPT natif complet** : configuration/édition Project, renommage et autres actions Project, ou actions de conversation dont le déplacement vers un autre Project.

La ligne native masquée peut être temporairement placée hors écran uniquement le temps d’invoquer son vrai bouton d’actions, sans faire réapparaître le doublon. Si ChatGPT ne rend aucune ligne native pour une conversation, un fallback NiakGPT borné conserve les actions critiques **Renommer** et **Déplacer vers**.

Aucun SVG/menu ChatGPT n’est cloné ou remplacé.

## Rattrapage du classement

`reclassify-v101.js` reste le propriétaire du rattrapage léger. `reclassify-deep-v112.js` ne prend que les cas qui restent ambigus, les conversations récentes non affectées ou celles dont le `projectId` ne correspond plus à un Project canonique.

Les locks manuels et `continuity-exact` restent prioritaires. Le traitement est sérialisé par `navigator.locks` quand disponible.

## WORKER / CLIENT et lifecycle

Quand plusieurs onglets ChatGPT sont ouverts :

- un onglet peut devenir **WORKER** ;
- les autres restent **CLIENT** ;
- les CLIENT réutilisent le cache partagé ;
- un WORKER lourd peut céder son rôle ;
- `BroadcastChannel` et `navigator.locks` sont utilisés quand disponibles ;
- les canaux/callbacks sont neutralisés lors d’un `pagehide`, BFCache ou contexte extension invalidé.

## Tests et labs

La 0.9.63 conserve une couche de preuve **DOM + HTML + visuelle** sur **Chromium, Firefox et WebKit**. Les artefacts cross-engine contiennent selon les scénarios :

- screenshot PNG ;
- HTML rendu ;
- JSON d’analyse DOM/métriques.

Les scénarios courants couvrent notamment :

- suppression du bloc Projects natif par identité tout en conservant Récents ;
- ouverture des **menus ChatGPT natifs complets** depuis nos lignes Project/chat, y compris le déplacement de conversation ;
- titre serveur/canonique protégé contre un ancien cache et contre un `document.title` différent ;
- fil d’Ariane lié `Accueil > Project > Chat` et exclusion de `OUT` comme nom de Project ;
- état de nouveau message et remise à zéro à l’ouverture, sans le perdre en ouvrant seulement le menu d’actions ;
- garde de chargement quand le contenu natif d’une conversation n’est pas encore présent ;
- réparation mesurée du titre d’accueil lorsque le composer le recouvre ;
- restauration du fond Matrix sans interception des clics ;
- fil de 120 tours : mode lourd, historique froid, entêtes TOI/CHATGPT et horodatage fiable ;
- cache de 120 conversations : mises à jour sérialisées sans perte de l’historique ;
- cas orphelin `TV job...` : titre insuffisant, premier message NiakVIO suffisant et analyse profonde bornée ;
- continuité OUT : capsule `Project > chat`, historique, Project exact, PATCH du nouveau chat et verrou `continuity-exact` ;
- runtime courant et bascule multi-onglets WORKER / CLIENT.

Les anciens labs restent disponibles comme régressions historiques. La CI courante conserve également les invariants d’hydratation, hot-path, syntaxe et packaging.

## CI GitHub

Avant ajout de CodeQL, le dépôt conserve volontairement quatre workflows :

- `check.yml` — validation rapide des PR et de `main` ;
- `current-finalization.yml` — gate UI/runtime courant et matrice Chromium / Firefox / WebKit ;
- `public-gate.yml` — certification de `main` et artefact installable ;
- `historical-regressions.yml` — anciennes suites, uniquement à la demande.

CodeQL peut s’ajouter comme cinquième workflow sans dupliquer les responsabilités ci-dessus.

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
