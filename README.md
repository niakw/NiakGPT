<p align="center">
  <img src="assets/niakgpt-logo.svg" alt="NiakGPT — Power Workspace for ChatGPT" width="760">
</p>

<p align="center">
  <strong>Transforme ChatGPT en véritable espace de travail power-user.</strong><br>
  Projects plus lisibles, navigation rapide, état temps réel, continuité des longs fils et contrôle local.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.9.56-4fc1ff">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4ec9b0">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-100%25-c586c0">
  <img alt="No analytics" src="https://img.shields.io/badge/analytics-none-dcdcaa">
</p>

# NiakGPT

NiakGPT est une extension navigateur qui ajoute à ChatGPT une couche de **productivité, d’organisation et de contrôle** pensée pour les utilisateurs intensifs.

Elle travaille directement au-dessus de l’interface officielle de ChatGPT : pas de service parallèle, pas de compte supplémentaire, pas de serveur NiakGPT.

> **Version actuelle : 0.9.56** — sidebar Projects stabilisée contre les rerenders ChatGPT, contexte Project fiable, navigation Projects native, clic droit/nouvel onglet sur les conversations, cycle de vie extension durci et labs visuels multi-navigateurs.

## Ce que NiakGPT apporte

### Projects plus rapides

- Projects présentés comme de vrais dossiers de travail ;
- sous-listes de conversations directement accessibles ;
- couleurs, badges et dates ;
- recherche locale dans les gros Projects ;
- lien **PROJECTS** vers la page Projects de ChatGPT ;
- conversations des dossiers rendues comme de vrais liens : clic droit, clic molette et Ctrl/Cmd+clic restent natifs ;
- conservation prioritaire des déplacements manuels ;
- suppression du doublon entre l’interface Projects native et NiakGPT lorsque le bloc NiakGPT est disponible ;
- retour automatique de la navigation Projects native si le bloc géré NiakGPT est momentanément indisponible ;
- auto-réparation si le cache Projects et la gouvernance deviennent temporairement incohérents.

### Navigation power-user

- `Alt+K` : ouverture rapide des Projects et conversations ;
- fil d’Ariane Project → conversation ;
- sommaire du fil courant ;
- dates compactes dans la sidebar ;
- code enrichi avec langage, nombre de lignes et copie ;
- barre d’état compacte synchronisée avec le Project courant ;
- raccourcis et Centre de contrôle.

### État des conversations en temps réel

NiakGPT identifie les principales phases de travail :

- chargement ;
- attente ;
- réflexion / analyse ;
- exécution ;
- erreur.

L’état peut être partagé entre plusieurs onglets ChatGPT afin de savoir immédiatement quelle conversation travaille. Depuis 0.9.53, la coordination multi-onglet se désactive proprement lors d’un reload/update de l’extension et ne réutilise pas un `BroadcastChannel` ou un contexte Chrome devenu invalide.

### Longues conversations

Les gros fils sont traités de façon plus conservatrice :

- pas de chargement complet du JSON des conversations par NiakGPT ;
- pas d’observation caractère par caractère de tout l’historique ;
- traitement incrémental du DOM ;
- historique ancien laissé au repos pendant le streaming ;
- reprise différée lorsque ChatGPT revient à l’état prêt ;
- Safe Mode disponible pour les cas extrêmes.

### Activité, Réflexion, Sources et Outputs

Les panneaux natifs de droite sont traités comme une même famille d’interface :

- largeur contenue ;
- rail NiakGPT conservé ;
- chat non écrasé ;
- contenu long contenu dans le panneau ;
- accents visuels distincts selon le type de panneau.

### Local-first

NiakGPT est conçu pour rester local :

- aucune analytics NiakGPT ;
- aucun serveur NiakGPT ;
- aucun compte NiakGPT ;
- permissions limitées à ChatGPT et au stockage de l’extension ;
- caches et préférences conservés dans le navigateur.

## Installation

### Depuis le dépôt

1. Télécharger ou cloner le dépôt.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Cliquer sur **Charger l’extension non empaquetée**.
5. Sélectionner la racine du dépôt contenant `manifest.json`.
6. Recharger les onglets ChatGPT déjà ouverts.

Pour les versions empaquetées, le workflow GitHub de qualité construit également un ZIP propre de l’extension.

## Principaux raccourcis

| Action | Raccourci |
|---|---|
| Quick Open | `Alt+K` |
| Centre de contrôle | `Alt+,` |

## Safe Mode

Safe Mode réduit volontairement les fonctionnalités décoratives ou non essentielles sur les fils très lourds :

- Matrix coupé ;
- coach coupé ;
- animations coupées ;
- synchronisations secondaires suspendues ;
- cession du rôle WORKER si nécessaire.

Le composer, la navigation et les fonctions essentielles restent disponibles.

## Philosophie du projet

NiakGPT suit quelques règles simples :

- **utilisateur > automatisation** ;
- **performance avant décoration** ;
- **local-first** ;
- **un seul propriétaire par zone d’interface** ;
- **pas de polling global permanent** ;
- **les anciens labs de régression sont conservés** au lieu d’être supprimés.

---

# Technique

## Architecture

NiakGPT est une extension Manifest V3.

Le runtime sépare :

- un bridge MAIN minimal (`page-bridge.js`) ;
- le runtime DOM injecté après disponibilité du shell ChatGPT ;
- les fonctions de cache, Projects, activité, navigation et panneaux ;
- la coordination WORKER / CLIENT entre onglets ;
- les garde-fous de compatibilité et d’auto-réparation.

Le bridge refuse les `GET /backend-api/conversation/{id}` initiés par NiakGPT afin d’éviter de télécharger des conversations complètes uniquement pour enrichir l’interface.

## WORKER / CLIENT

Quand plusieurs onglets ChatGPT sont ouverts :

- un seul onglet peut devenir **WORKER** ;
- les autres restent **CLIENT** ;
- les CLIENT lisent le cache partagé ;
- un WORKER surchargé peut céder son rôle ;
- `BroadcastChannel` et `navigator.locks` sont utilisés lorsque disponibles ;
- les callbacks et canaux sont neutralisés lors d’un `pagehide` ou d’un contexte extension invalidé.

## Auto-réparation Projects

Les garde-fous Projects restent événementiels :

- un cache local temporaire peut être promu vers les IDs Projects canoniques dès qu’ils réapparaissent dans le DOM ;
- une gouvernance persistée avec `0` Project principal est reconstruite si des Projects canoniques valides existent ;
- un fallback coloré local reste visible pendant la récupération au lieu d’afficher une sidebar NiakGPT vide ;
- les associations conversations → Projects sont remappées avec les IDs canoniques ;
- les verrous manuels et masquages encore valides sont conservés ;
- en 0.9.56, les classes de suppression du bloc Projects natif sont réaffirmées après les rerenders concurrents ;
- si le bloc NiakGPT n’est plus exploitable, la navigation native n’est jamais laissée masquée.

## Navigation et liens natifs

La navigation du tiroir Project conserve les primitives du navigateur :

- le titre `PROJECTS` est un lien réel vers `/projects` ;
- chaque conversation développée est un véritable élément `<a href="…">` ;
- le clic gauche simple peut suivre le routage SPA existant ;
- clic droit, clic molette, Ctrl/Cmd+clic et autres clics modifiés ne sont pas interceptés.

## Tests et labs

Le dépôt conserve les anciens labs de régression et ajoute de nouveaux tests au fil des versions.

### Check NiakGPT

Contrôles statiques et hot-path :

- manifest et runtime ;
- syntaxe JavaScript ;
- absence de polling global réintroduit ;
- garde-fous longues conversations ;
- invariants Projects ;
- contenu du package final.

### Visual Lab

Playwright teste l’extension et les principales surfaces UI.

### Matrices multi-navigateurs

Les cas critiques sont exécutés sur :

- Chromium ;
- Firefox ;
- WebKit.

La couverture historique est conservée. Les régressions récentes ajoutent notamment :

- cache `5 Projects / 8 chats` avec gouvernance cassée à `0 principaux` ;
- fallback Projects local ;
- `BroadcastChannel` fermé ;
- `navigator.locks` levant une `DOMException` ;
- contexte Chrome invalidé pendant une écriture de cache ;
- ordre de chargement runtime réel ;
- sidebar Projects ;
- Activity / Sources ;
- longues conversations ;
- stabilité géométrique du chat et du rail ;
- course de rerender entre le renderer principal et le masque des Projects natifs ;
- contexte Project breadcrumb → barre d’état ;
- lien `/projects` ;
- clic droit / nouvel onglet sur les conversations des tiroirs Project ;
- fallback vers les Projects natifs si le bloc NiakGPT disparaît.

Les captures visuelles sont conservées comme artifacts GitHub Actions. Les anciens labs restent dans le dépôt.

## Confidentialité et sécurité

Voir :

- [`PRIVACY.md`](PRIVACY.md)
- [`SECURITY.md`](SECURITY.md)

NiakGPT dépend de l’interface et de certains endpoints internes de ChatGPT. Ces surfaces ne sont pas documentées ni garanties par OpenAI et peuvent évoluer.

## Licence

Aucune licence open source n’est déclarée pour le moment. Le fait que le dépôt soit public ne constitue pas une autorisation implicite de redistribution ou de réutilisation.
