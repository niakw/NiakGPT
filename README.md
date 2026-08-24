<p align="center">
  <img src="assets/niakgpt-logo.svg" alt="NiakGPT — Power Workspace for ChatGPT" width="760">
</p>

<p align="center">
  <strong>Transforme ChatGPT en véritable espace de travail power-user.</strong><br>
  Projects organisés, navigation rapide, longues conversations plus légères, continuité locale et outils pensés pour un usage intensif.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.9.76-4fc1ff">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4ec9b0">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-100%25-c586c0">
  <img alt="No analytics" src="https://img.shields.io/badge/analytics-none-dcdcaa">
  <img alt="License" src="https://img.shields.io/badge/license-GPL--3.0-c586c0">
</p>

# NiakGPT

NiakGPT est une extension navigateur qui ajoute à ChatGPT une couche de **productivité, d’organisation et de contrôle** pour les utilisateurs intensifs.

Elle fonctionne directement au-dessus de l’interface officielle de ChatGPT : **pas de service parallèle, pas de compte NiakGPT supplémentaire et pas de serveur NiakGPT pour les fonctions principales**.

> **Version actuelle : 0.9.76** — UX native-first plus discrète, bloc Projects vérifié dans la vraie sidebar gauche avec scroll stable, menus Project/chat fiables, prompteur opt-in, continuité compacte et reprise des travaux longs sans laisser de protocole automatique dans le composer.

## Ce que NiakGPT apporte

### Projects comme espace de travail

- Projects colorés et immédiatement identifiables ;
- conversations accessibles en dépliant un Project ;
- le clic sur le nom d’un Project déplie/replie ses chats sans naviguer vers la page Project ;
- bloc Projects replacé dans un slot stable de la sidebar après accueil, navigation SPA, remount React ou BFCache ;
- validation v131 de la **vraie sidebar gauche** avant d’exposer le bloc, afin d’éviter une insertion dans une fausse surface centrale ou transitoire ;
- scroll du catalogue Projects conservé pendant les mises à jour de cache, sans annuler un nouveau scroll réellement initié par l’utilisateur ;
- recherche locale dans les gros Projects ;
- dates et compteurs visibles ;
- conversation courante mise en évidence ;
- conversations `OUT` reléguées après les conversations actives ;
- nouveaux messages/réponses terminées hors vue signalés dans les conversations et leur Project ;
- déplacements manuels et continuations protégés contre le reclassement automatique ;
- menus d’actions Project/chat isolés, accessibles au clavier et sortis du clipping de la sidebar.

### Autorités Projects séparées et déterministes

Lorsque `#ng8-pins` est sain, `sidebar-projects-authority-v112.js` reste l’unique propriétaire de la **visibilité** des Projects natifs.

`sidebar-projects-v121.js` possède le catalogue NiakGPT et son placement incrémental. Il ne reconstruit pas destructivement les lignes à chaque rafraîchissement : identité DOM, ordre, focus et positions de scroll restent stables tant que les entités n’ont pas réellement changé.

`ux-v131.js` est la garde UX finale : il sélectionne la vraie sidebar gauche, n’expose `#ng8-pins` qu’après vérification et fournit ce root vérifié à v121. Il ne devient pas une seconde autorité de placement lorsque v121 est actif.

Les anciennes autorités `sidebar-authority-v107.js` et `sidebar-expando-guard-v108.js` restent uniquement comme patrimoine de régression historique : elles ne sont plus injectées ni empaquetées. `live-fixes-v104.js` et `live-fixes-v106.js` n’ont plus le droit de masquer Projects.

### Menus d’actions fiables et accessibles

Les actions Project/chat utilisent une couche dédiée qui conserve les primitives natives lorsqu’elles sont disponibles et fournit des fallbacks ciblés uniquement lorsque la mutation exacte peut être certifiée.

- le même bouton `…` ferme sa session au second clic au lieu de rouvrir immédiatement le menu ;
- clic extérieur et `Échap` ferment également la session ;
- les menus Project et chat gardent des identités et actions distinctes ;
- seuls les menus créés par l’action courante sont promus hors du clipping de la sidebar ;
- sous-menus et menus imbriqués restent cliquables ;
- les cibles d’action respectent le minimum WCAG 2.5.8 de 24×24 px ;
- clavier : `Enter`, flèches, `Home`, `End` et `Escape` suivent le contrat menu ;
- les dialogues de renommage sont modaux, étiquetés et gardent un focus borné ;
- renommage/déplacement mettent à jour l’entité exacte et conservent le scroll du drawer.

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
→ ux-v131 (garde UX finale)
```

La première sanitation du cache est **attendue avant de continuer l’injection**, afin qu’un `cache-guardian` ou un indexeur ne puisse pas mémoriser un snapshot sale comme état de référence.

### Classement automatique avec rattrapage progressif

NiakGPT classe les nouveaux chats vers le Project le plus pertinent tout en respectant les verrous manuels.

Le chemin normal reste léger : titre, snippet et métadonnées locales. Les cas ambigus/orphelins peuvent passer par `reclassify-deep-v112.js`, avec budget strict : **2 chats max par cycle, 1 sur gros fil, 10 messages / 14 000 caractères maximum**, cadence réseau minimale et suspension pendant l’activité ChatGPT.

### Navigation power-user

- `Alt+K` : Quick Open Projects/conversations ;
- `Alt+P` : ouvrir explicitement l’optimiseur local du prompt ;
- fil d’Ariane canonique **Accueil > Project > conversation** ;
- sommaire du fil courant ;
- capsule d’état discrète synchronisée avec le Project courant ;
- code enrichi avec langage, nombre de lignes et copie ;
- Centre de contrôle et Safe Mode ;
- navigation SPA, remounts React et BFCache pris en compte sans polling global permanent.

### Prompteur local, opt-in

Le prompteur adaptatif ne déploie plus automatiquement un gros panneau au-dessus du composer. Il apparaît comme un contrôle compact `Optimiser`, et son détail ne s’ouvre que sur action explicite ou via `Alt+P`.

- traitement local uniquement ;
- aucune requête réseau NiakGPT ;
- `Escape` replie le détail ;
- `Copier` conserve le brouillon ;
- `Remplacer` modifie le composer mais **n’envoie rien**.

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

Lorsqu’un fil est continué, NiakGPT prépare explicitement le contexte du fil précédent et poursuit dans un nouveau chat lorsque ChatGPT impose cette transition.

Si le fil possède déjà un Project, le nouveau chat est rattaché au **Project exact d’origine** puis protégé par un verrou `continuity-exact`. Si le fil était hors Project, NiakGPT peut recommander localement le Project le plus pertinent à partir du titre, de l’historique et du contexte Project disponible ; cette recommandation n’est jamais présentée comme le Project d’origine.

La continuité OUT prépare le contexte dans le composer mais **ne l’envoie pas automatiquement**.

### Travaux longs et ajout en parallèle

Pendant une génération déjà active, un nouveau message utilisateur peut être préfixé de façon compacte par `↳ Suite en parallèle` afin de signaler qu’il complète le travail en cours au lieu de le remplacer. Après l’envoi natif, NiakGPT retire uniquement son propre préfixe si ChatGPT laisse le brouillon contrôlé à l’écran ; toute modification utilisateur est préservée.

Pour un travail réellement long, `long-run-watchdog-v129.js` arme une fenêtre par défaut de **6 min 30**. À l’échéance :

- aucun texte automatique n’est écrit si le composer contient déjà un brouillon utilisateur ;
- aucun texte n’est laissé en attente si aucun vrai contrôle Envoyer n’est disponible ;
- si le composer est vide et qu’un contrôle Envoyer existe, NiakGPT peut envoyer une courte relance `↻ Reprise NiakGPT` ;
- les anciens protocoles automatiques exacts laissés par une version précédente sont nettoyés ;
- un protocole modifié par l’utilisateur n’est jamais effacé ;
- les commandes explicites d’arrêt/annulation désarment la reprise.

### Reprise après interruption ChatGPT

`interruption-guard-v119.js` reconnaît de façon bornée les signaux de fil arrivé à sa limite, de vérification et de connexion perdue.

- **limite de fil** : prépare la continuité OUT et expose `CONTINUER LE FIL` ;
- **vérification** : ne contourne pas le challenge et n’interagit pas avec son iframe ; une fois le signal disparu, le bouton natif Retry/Regenerate/Continue peut être déclenché une seule fois ;
- **connexion perdue** : même tentative native unique après retour de la connexion ;
- si aucune reprise native n’est possible, `REPRENDRE` prépare un message de reprise dans un composer vide, sans l’envoyer ;
- incident persistant chiffré en `sessionStorage` et protégé contre les écritures async obsolètes ;
- aucun `reload` automatique et aucun polling permanent.

### Panneaux natifs, accueil et DA

- le rail droit devient un dock discret et se masque sur l’accueil/surfaces utilitaires au lieu de réserver une colonne permanente ;
- la barre d’état plein écran devient une capsule passive ;
- Activité / Réflexion / Sources / Outputs restent bornés et positionnés sans voler la largeur du chat ;
- le visualiseur image conserve un contrôle de fermeture fiable ;
- les greetings natifs courts de l’accueil peuvent être masqués lorsqu’aucun message n’est présent afin d’éviter leur saut visuel ;
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
| Optimiseur local du prompt | `Alt+P` |
| Centre de contrôle | `Alt+,` |

## Architecture rapide

NiakGPT est une extension **Manifest V3**.

- **MAIN world** : `page-bridge.js` uniquement.
- **Isolated world** : cache, metadata, gouvernance, sidebar, navigation, continuité, UI et diagnostics.
- **Cache bus** : sérialise et partage l’état local.
- **Metadata barrier** : nettoie le cache avant les consommateurs métier.
- **Projects visibility authority** : `sidebar-projects-authority-v112.js` uniquement.
- **Projects catalog/placement** : `sidebar-projects-v121.js` ; `ux-v131.js` vérifie le root et reste la garde UX finale.
- **Menus/actions** : sessions flottantes isolées, hitboxes séparées et mutations ciblées.
- **Interruptions** : `interruption-guard-v119.js` orchestre la reprise autorisée sans contourner les contrôles de sécurité/service.
- **Long run** : `long-run-watchdog-v129.js` n’agit qu’après une fenêtre longue et protège toujours les brouillons utilisateur.
- **Multi-onglets** : coordination WORKER / CLIENT, `BroadcastChannel` et `navigator.locks` quand disponibles.

Voir [`ARCHITECTURE.md`](ARCHITECTURE.md) pour les invariants détaillés.

## Tests et CI

La validation courante conserve plusieurs niveaux :

1. invariants de source/manifest et syntaxe ;
2. packaging propre ;
3. Visual Lab déterministe ;
4. gate UX intégrale screenshot-driven sur Chromium / Firefox / WebKit ;
5. matrice expérience sur Ubuntu / Windows / macOS ;
6. extension réellement chargée sous Chromium sur les trois OS ;
7. gate prioritaire Brave stable réel sur macOS ;
8. continuations parallèle/long-run, résidus composer et protection des brouillons ;
9. régressions historiques à la demande.

Les scénarios couvrent notamment : autorité Projects et remounts, placement stable du bloc Projects, scroll utilisateur, hitboxes Project/chat, menus imbriqués, fermeture au second clic, clavier/focus/dialogues, isolation/cleanup des menus, barrière metadata/cache, preview image, greetings d’accueil, titres canoniques, non-lus, gros fils, classification profonde, continuité exacte/recommandée, reprise réseau/vérification, travaux >10 minutes logiques et multi-onglets.

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
