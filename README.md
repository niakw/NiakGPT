<p align="center">
  <img src="assets/niakgpt-logo.svg" alt="NiakGPT — Power Workspace for ChatGPT" width="760">
</p>

<p align="center">
  <strong>Transforme ChatGPT en véritable espace de travail power-user.</strong><br>
  Projects plus lisibles, navigation rapide, état temps réel, continuité des longs fils et contrôle local.
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.9.57-4fc1ff">
  <img alt="Chrome Extension" src="https://img.shields.io/badge/Chrome-Extension-4ec9b0">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-100%25-c586c0">
  <img alt="No analytics" src="https://img.shields.io/badge/analytics-none-dcdcaa">
</p>

# NiakGPT

NiakGPT est une extension navigateur qui ajoute à ChatGPT une couche de **productivité, d’organisation et de contrôle** pensée pour les utilisateurs intensifs.

Elle travaille directement au-dessus de l’interface officielle de ChatGPT : pas de service parallèle, pas de compte supplémentaire, pas de serveur NiakGPT.

> **Version actuelle : 0.9.57** — liste Projects NiakGPT autoritaire, suppression complète du doublon Projects natif, métadonnées de dates fiabilisées, navigation Projects/nouvel onglet native, contexte Project stable et labs visuels multi-navigateurs.

## Ce que NiakGPT apporte

### Projects plus rapides

- Projects présentés comme de vrais dossiers de travail ;
- sous-listes de conversations directement accessibles ;
- couleurs, badges et dates ;
- recherche locale dans les gros Projects ;
- lien **PROJECTS** vers la page Projects de ChatGPT ;
- conversations des dossiers rendues comme de vrais liens : clic droit, clic molette et Ctrl/Cmd+clic restent natifs ;
- conservation prioritaire des déplacements manuels ;
- **la liste Projects NiakGPT est l’unique liste Projects visible lorsqu’elle est disponible** : les lignes, chats enfants et « Afficher plus » du système Projects natif sont masqués ;
- retour automatique de la navigation Projects native uniquement si le bloc NiakGPT disparaît réellement ;
- les dates de sidebar restent des métadonnées de date et ne peuvent plus devenir de faux Projects colorés ;
- auto-réparation du cache si une ancienne session a déjà créé un faux Project à partir d’une date.

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

## Autorité de la sidebar Projects

Depuis 0.9.57, la responsabilité visuelle de la zone Projects est explicite :

- si `#ng8-pins` est présent et exploitable, NiakGPT masque les surfaces Projects natives correspondantes ;
- les marqueurs de masquage 0.9.57 sont indépendants des anciens correctifs afin qu’un rerender React ou un autre module ne puisse pas réintroduire le doublon ;
- les URLs Project `g-p-*` sont reconnues directement ; les URLs opaques ne sont reconnues qu’après correspondance exacte avec un nom déjà connu dans la liste NiakGPT ;
- les liens `/g/...` qui correspondent à des GPT personnalisés ne sont pas assimilés à des Projects ;
- les chats enfants d’un Project natif et ses contrôles locaux « Afficher plus » disparaissent avec la zone native ;
- le « Afficher plus » de l’historique de chats reste intact ;
- si le bloc NiakGPT disparaît, tous les masques sont retirés et ChatGPT redevient immédiatement le filet de sécurité.

## Auto-réparation Projects et dates

Les garde-fous Projects restent événementiels :

- un cache local temporaire peut être promu vers les IDs Projects canoniques dès qu’ils réapparaissent dans le DOM ;
- une gouvernance persistée avec `0` Project principal est reconstruite si des Projects canoniques valides existent ;
- un fallback coloré local reste visible pendant la récupération au lieu d’afficher une sidebar NiakGPT vide ;
- les associations conversations → Projects sont remappées avec les IDs canoniques ;
- les verrous manuels et masquages encore valides sont conservés ;
- les dates de chronologie sont rendues comme de vrais éléments `<time>` et ne sont plus candidates au détecteur de noms de Projects ;
- un ancien Project DOM local dont le nom est uniquement une date (`17/08`, par exemple) est supprimé du cache, de ses compteurs et de l’index ;
- lorsque l’URL du chat contient encore son vrai Project, l’affectation est restaurée automatiquement.

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
- deux blocs Projects natifs et leurs contrôles « Afficher plus » face à la liste NiakGPT ;
- faux Project créé à partir d’une date de chat et réparation de son affectation ;
- garantie qu’un GPT personnalisé `/g/...` n’est jamais masqué comme Project ;
- fallback vers les Projects natifs si le bloc NiakGPT disparaît.

Les captures visuelles sont conservées comme artifacts GitHub Actions. Les anciens labs restent dans le dépôt.

## Confidentialité et sécurité

Voir :

- [`PRIVACY.md`](PRIVACY.md)
- [`SECURITY.md`](SECURITY.md)

NiakGPT dépend de l’interface et de certains endpoints internes de ChatGPT. Ces surfaces ne sont pas documentées ni garanties par OpenAI et peuvent évoluer.

## Licence

Aucune licence open source n’est déclarée pour le moment. Le fait que le dépôt soit public ne constitue pas une autorisation implicite de redistribution ou de réutilisation.
