# NiakGPT

Extension Chrome/Chromium locale qui transforme ChatGPT en espace de travail power-user : Projects, tri automatique, Quick Open, sommaire, suggestions de prompts françaises et contextuelles, présentation IDE du code, DA forcée et optimisation des longues discussions.

## Installation

1. Télécharger le dépôt en ZIP ou le cloner.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Cliquer **Charger l’extension non empaquetée**.
5. Sélectionner **la racine du dossier `niakgpt`** : `manifest.json` est directement à la racine.
6. Après une mise à jour : **Recharger** la carte NiakGPT puis faire `Ctrl+Shift+R` sur `https://chatgpt.com`.

## Version actuelle

**0.7.0 — rebuild data/navigation + DA forcée**

Le runtime charge uniquement :

- `page-bridge.js` dans le contexte de la page pour les appels ChatGPT autorisés ;
- `app-v07.js` pour le moteur NiakGPT ;
- `theme-v07.css` pour toute la direction artistique.

Les anciens moteurs et thèmes v0.5/v0.6 ont été retirés de `main`.

## Indexation complète

La v0.7 ne considère plus la première réponse API comme la liste complète.

- pagination de `/backend-api/gizmos/snorlax/sidebar` avec son `cursor` jusqu’à épuisement ;
- pagination complète de `/backend-api/conversations` avec `offset`, `total`, `has_more` / `hasMore` ;
- pagination complète des conversations de **chaque Project** avec le cursor propre à `/gizmos/{project}/conversations` ;
- déduplication par identifiant ;
- fusion avec les éléments visibles du DOM comme filet de sécurité ;
- nombre exact de chats par Project lorsque l’endpoint du Project répond correctement ;
- une erreur sur un Project est signalée par `?` au lieu d’inventer un compteur.

Le diagnostic doit afficher des états vérifiables comme :

- `data · OK · N Projects · M chats` ;
- `projects · OK · N/N · X comptés` ;
- `quick · OK · N entrées`.

## Explorer / Quick Open

- l’Explorer utilise la même indexation exhaustive ;
- **tous** les Projects indexés sont affichés, y compris les anciens Projects génériques ;
- recherche des Projects ;
- compteur de conversations par Project ;
- `Alt+K` ouvre Quick Open ;
- Quick Open contient à la fois Projects et conversations ;
- recherche par titre, snippet et nom de Project ;
- navigation clavier `↑`, `↓`, `Entrée`, `Échap` ;
- préchargement d’une conversation au survol.

## Organisation automatique

NiakGPT ne contient aucun nom de Project personnel en dur. Il apprend dynamiquement à partir du compte ChatGPT.

Le profil d’un Project utilise :

- son nom ;
- sa description et ses instructions quand elles existent ;
- les titres/snippets de ses conversations ;
- le contenu du fil lorsque le titre est trop ambigu.

Règles de sécurité :

- un chat déjà présent dans un vrai Project est protégé ;
- les chats hors Project peuvent être classés avec un seuil de confiance élevé ;
- les chats placés dans des catégories génériques héritées (`Design`, `AI`, `Coding`, etc.) peuvent être réparés ;
- si la confiance est insuffisante, NiakGPT ne déplace rien ;
- chaque déplacement est **vérifié par GET après le PATCH**, y compris si ChatGPT renvoie une erreur HTTP après avoir tout de même appliqué le déplacement ;
- aucun Project n’est supprimé automatiquement.

Le classement s’exécute au démarrage après indexation, après une génération, périodiquement à l’état idle et via **Réparer le classement**.

## Épinglage des Projects

Deux niveaux sont volontairement distingués :

1. **ÉPINGLÉS · PROJECTS NiakGPT** : tous les Projects indexés sont toujours accessibles dans le bloc épinglé de la sidebar NiakGPT ;
2. **pin natif ChatGPT** : NiakGPT tente aussi l’action native `Épingler` lorsque le menu est réellement exposé dans le DOM.

Le diagnostic affiche séparément `N/N NiakGPT` et `X/N natifs` afin de ne jamais présenter un fallback visuel comme un pin natif réussi.

## Direction artistique

La DA v0.7 est volontairement prioritaire sur les préférences de couleur ChatGPT :

- variables de surfaces ChatGPT redéfinies ;
- sidebar gauche, header, menu, composer et fond principal forcés avec sélecteurs dédiés et `!important` ;
- lignes de conversations réellement zébrées façon tableau ;
- badge discret indiquant le Project de chaque chat visible ;
- Project = couleur stable + icône automatique + fond associé ;
- état actif et état génération jaune/orange ;
- messages utilisateur / NiakGPT avec fonds et textes distincts façon feed ;
- blocs de code façon Visual Studio Code ;
- rail latéral et Explorer façon IDE ;
- couleur du Project courant injectée dans l’environnement visuel ;
- barre d’état avec **BY SKYNET** ;
- petits easter eggs robot-skull ;
- fond Matrix vert animé plus visible derrière les zones libres.

## Coach de prompts

Le coach reste **dans le flux du composer** : aucune position fixe au-dessus de la saisie.

Il s’adapte à :

- ce que l’utilisateur tape ;
- les derniers échanges du fil ;
- le Project courant ;
- le type de tâche détecté ;
- la présence d’images ou fichiers joints.

Avec des pièces jointes, le coach passe en mode compact et reste au-dessus du formulaire au lieu de recouvrir les previews.

## Longues discussions / génération

- `content-visibility` et containment sur les tours anciens ;
- seuls les derniers tours sont retraités pendant le streaming ;
- scans complets et indexation reportés hors génération ;
- Matrix automatiquement ralenti pendant une génération lourde ;
- coach et easter eggs masqués pendant l’exécution ;
- suppression de l’ancien `perf-guard` expérimental : NiakGPT ne monkey-patche plus `MutationObserver` ni `requestAnimationFrame` globalement.

## Diagnostic

Modules exposés :

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

Les dernières erreurs d’indexation sont également affichables dans le panneau Diagnostic.

## Confidentialité

- exécution limitée à `https://chatgpt.com/*` ;
- aucune permission sur un autre domaine ;
- aucune analytics ;
- aucun serveur NiakGPT ;
- aucune identité, adresse, nom de personne ou nom de Project personnel intégré au code ;
- aucun abonnement ni API tierce payante.
