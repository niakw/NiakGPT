<p align="center">
  <img src="assets/niakgpt-logo.svg" alt="NiakGPT — Power Workspace for ChatGPT" width="760">
</p>

<p align="center">
  <strong>Transforme ChatGPT en véritable espace de travail power-user.</strong><br>
  Projects organisés, navigation rapide, longues conversations plus légères, continuité locale et outils pensés pour un usage intensif.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.9.68-4fc1ff">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4ec9b0">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-100%25-c586c0">
  <img alt="No analytics" src="https://img.shields.io/badge/analytics-none-dcdcaa">
  <img alt="License" src="https://img.shields.io/badge/license-GPL--3.0-c586c0">
</p>

# NiakGPT

NiakGPT est une extension navigateur qui ajoute à ChatGPT une couche de **productivité, d’organisation et de contrôle** pour les utilisateurs intensifs.

Elle fonctionne directement au-dessus de l’interface officielle de ChatGPT : **pas de service parallèle, pas de compte NiakGPT supplémentaire et pas de serveur NiakGPT pour les fonctions principales**.

> **Version actuelle : 0.9.68** — une seule autorité pour la visibilité des Projects natifs, menus d’actions ChatGPT isolés et restaurés proprement, nettoyage metadata/cache terminé avant les consommateurs du boot, navigation/sidebar durcies et matrice de régression multi-moteurs conservée.

## Ce que NiakGPT apporte

### Projects comme espace de travail

- Projects colorés et immédiatement identifiables ;
- conversations accessibles en dépliant un Project ;
- recherche locale dans les gros Projects ;
- dates et compteurs visibles ;
- conversation courante mise en évidence ;
- conversations `OUT` reléguées après les conversations actives ;
- nouveaux messages/réponses terminées hors vue signalés dans les conversations et leur Project ;
- déplacements manuels et continuations protégés contre le reclassement automatique ;
- menu d’actions ChatGPT complet depuis les lignes Project/chat lorsqu’une ligne native existe, avec fallback local borné pour les conversations.

### Une seule autorité Projects

Lorsque `#ng8-pins` est sain, `sidebar-projects-authority-v112.js` est **l’unique propriétaire de la visibilité des Projects natifs**.

Il reconnaît les variantes de markup ChatGPT par structure, liens, libellés `Projets / Projects` et identité des Projects réellement gérés par NiakGPT. Les conversations **Récents** restent intactes et le natif redevient visible si le bloc NiakGPT disparaît réellement.

Les anciennes autorités `sidebar-authority-v107.js` et `sidebar-expando-guard-v108.js` restent uniquement comme patrimoine de régression historique : elles ne sont plus injectées ni empaquetées. `live-fixes-v104.js` et `live-fixes-v106.js` n’ont plus le droit de masquer Projects.

### Menus d’actions natifs sans collision

`native-actions-v113.js` ouvre le vrai menu ChatGPT quand il est disponible, mais chaque ouverture est maintenant une **session isolée** :

- les menus déjà visibles avant l’action restent intacts ;
- seul le menu créé/ouvert par l’action courante est promu dans le top layer ;
- sous-menus et menus imbriqués restent cliquables hors de la sidebar ;
- à la fermeture, Popover, classes, variables de position et datasets NiakGPT sont retirés ;
- un nœud DOM réutilisé par React retrouve donc sa géométrie native ;
- le fallback local ferme immédiatement sa session pour qu’un autre menu apparu ensuite ne puisse pas être capturé par un timer tardif.

### Cache et metadata au démarrage

`sidebar-metadata-v118.js` est volontairement séparé de l’autorité Projects. Il ne fait que :

- normaliser les dates de sidebar ;
- supprimer les faux Projects dont le nom est en réalité une date ;
- réparer les références de cache associées ;
- exposer une vue nettoyée du cache aux consommateurs suivants.

L’ordre d’injection est déterministe :

```text
cache-bus
→ diagnostics
→ sidebar-metadata-v118 (barrière async)
→ cache-guardian
→ recovery / server-index
→ gouvernance / classement
→ UI
```

La première sanitation du cache est **attendue avant de continuer l’injection**, afin qu’un `cache-guardian` ou un indexeur ne puisse pas mémoriser un snapshot sale comme état de référence.

### Classement automatique avec rattrapage progressif

NiakGPT classe les nouveaux chats vers le Project le plus pertinent tout en respectant les verrous manuels.

Le chemin normal reste léger : titre, snippet et métadonnées locales. Les cas ambigus/orphelins peuvent passer par `reclassify-deep-v112.js`, avec budget strict : **2 chats max par cycle, 1 sur gros fil, 10 messages / 14 000 caractères maximum**, cadence réseau minimale et suspension pendant l’activité ChatGPT.

### Navigation power-user

- `Alt+K` : Quick Open Projects/conversations ;
- fil d’Ariane canonique **Accueil > Project > conversation** ;
- sommaire du fil courant ;
- barre d’état synchronisée avec le Project courant ;
- code enrichi avec langage, nombre de lignes et copie ;
- Centre de contrôle et Safe Mode ;
- navigation SPA, remounts React et BFCache pris en compte sans polling global permanent.

### Titres, non-lus et gros fils

`chat-state-authority-v113.js` maintient une source canonique monotone pour le titre et le Project d’une conversation. Une donnée plus récente gagne ; un vieux cache ou `document.title` ne doit plus écraser un titre serveur connu.

Pour les gros fils :

- historique froid et queue récente gardée chaude ;
- `content-visibility` / containment ;
- Matrix et décorations réduites pendant les phases lourdes ;
- traitements incrémentaux et reprise différée ;
- `conversation-load-guard-v113.js` relâche les optimisations si le contenu natif n’est pas encore rendu.

NiakGPT **ne remplace pas globalement `window.fetch`**. Le monde MAIN est réduit à `page-bridge.js`.

### Continuité des fils OUT

Lorsqu’un fil est continué, NiakGPT prépare explicitement :

`Reprends la conversation nommée « NOMPROJECT > NOMCHAT » exactement là où elle s’est arrêtée.`

Le nouveau chat est ensuite rattaché au Project exact d’origine puis protégé par un verrou `continuity-exact`. Aucun envoi automatique n’est effectué.

### Panneaux natifs, accueil et DA

- Activité / Réflexion / Sources / Outputs restent bornés et positionnés sans voler la largeur du chat ;
- le visualiseur image conserve un contrôle de fermeture fiable ;
- le titre d’accueil n’est déplacé qu’en cas de chevauchement mesuré ;
- Matrix respecte `prefers-reduced-motion` ;
- les icônes/SVG ChatGPT restent natifs, avec harmonisation NiakGPT du contraste, hover/focus et surfaces.

## Local-first

- aucune analytics NiakGPT ;
- aucun serveur NiakGPT requis pour le fonctionnement principal ;
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

## Architecture rapide

NiakGPT est une extension **Manifest V3**.

- **MAIN world** : `page-bridge.js` uniquement.
- **Isolated world** : cache, metadata, gouvernance, sidebar, navigation, continuité, UI et diagnostics.
- **Cache bus** : sérialise et partage l’état local.
- **Metadata barrier** : nettoie le cache avant les consommateurs métier.
- **Projects authority** : `sidebar-projects-authority-v112.js` uniquement.
- **Menus natifs** : sessions top-layer isolées, réversibles et testées sur réutilisation DOM.
- **Multi-onglets** : coordination WORKER / CLIENT, `BroadcastChannel` et `navigator.locks` quand disponibles.

Voir [`ARCHITECTURE.md`](ARCHITECTURE.md) pour les invariants détaillés.

## Tests et CI

La validation courante conserve plusieurs niveaux :

1. invariants de source/manifest et syntaxe ;
2. packaging propre ;
3. Visual Lab déterministe ;
4. Chromium / Firefox / WebKit pour les gates DOM/UX profonds ;
5. matrice expérience sur Ubuntu / Windows / macOS ;
6. extension réellement chargée sous Chromium sur les trois OS ;
7. gate prioritaire Brave stable réel sur macOS ;
8. régressions historiques à la demande.

Les scénarios couvrent notamment : autorité Projects et remounts, hitboxes Project/chat, menus imbriqués, isolation/cleanup des menus, barrière metadata/cache, preview image, titres canoniques, non-lus, gros fils, classification profonde, continuité exacte et multi-onglets.

## Philosophie

- **utilisateur > automatisation** ;
- **performance avant décoration** ;
- **local-first** ;
- **un seul propriétaire par zone d’interface** ;
- **pas de polling global permanent** ;
- les anciens labs utiles restent disponibles pour empêcher le retour de régressions historiques.

## Documentation

- [`CHANGELOG.md`](CHANGELOG.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)
- [`PRIVACY.md`](PRIVACY.md)
- [`SECURITY.md`](SECURITY.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Confidentialité et sécurité

NiakGPT dépend de l’interface web et de certains endpoints internes non documentés de ChatGPT. Ces surfaces peuvent évoluer ; les labs réduisent le risque de régression mais ne remplacent pas un smoke test sur une session réelle.

## Licence

NiakGPT est distribué sous **GNU General Public License v3.0 (GPL-3.0)**. Voir [`LICENSE`](LICENSE).
