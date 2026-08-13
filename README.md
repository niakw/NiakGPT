# NiakGPT

NiakGPT transforme l’interface web de ChatGPT en workspace power-user local : Projects gouvernés, navigation rapide, cache chaud, états temps réel, sommaire, coach contextuel, outils code, organisation assistée et DA dense inspirée des IDE.

> **État actuel : 0.9.8 RC** — architecture en validation intensive. L’extension utilise des endpoints internes de ChatGPT qui ne sont pas documentés publiquement par OpenAI et peuvent changer sans préavis.

## Principes

- **local-first** : aucun serveur NiakGPT, aucune analytics, aucun compte supplémentaire ;
- **ChatGPT uniquement** : permissions limitées à `https://chatgpt.com/*` ;
- **utilisateur > automatisation** : tout déplacement manuel d’une conversation verrouille son affectation ;
- **performance d’abord** : pas de polling global permanent dans les modules applicatifs, travail partagé entre onglets, indexation idle et Safe Mode ;
- **réversible** : export/import de configuration, purge ciblée des caches et réinitialisation séparée des préférences.

## Installation développeur

1. Télécharger ou cloner le dépôt.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Choisir **Charger l’extension non empaquetée**.
5. Sélectionner la racine du dépôt, là où se trouve `manifest.json`.
6. Après une mise à jour : **Recharger** l’extension puis recharger les onglets ChatGPT déjà ouverts.

## Ce que change NiakGPT

### Workspace et navigation

- `Alt+K` : Quick Open Projects + conversations ;
- tri des conversations par date du dernier échange ;
- date compacte directement dans la sidebar ;
- couleur, badge et icône sémantique par Project ;
- zebra rows et densité de type tableau ;
- sommaire du fil courant ;
- barres de code avec langage, nombre de lignes et copie ;
- barre basse d’état avec Project courant et état du runtime ;
- **Projects épinglés transformés en dossiers instantanés** : clic sur le Project = sous-menu de ses conversations, sans page intermédiaire ;
- bouton `↗` distinct pour ouvrir volontairement la page Project complète ;
- conversations du sous-menu triées par dernière activité, avec date et recherche locale pour les gros Projects.

### États temps réel

La conversation qui travaille est identifiable dans la sidebar et dans son Project :

- **bleu** — `CHARGEMENT` ;
- **orange** — `ATTENTE` ;
- **violet** — `RÉFLEXION / ANALYSE` ;
- **cyan/vert** — `EXÉCUTION` ;
- **rouge** — `ERREUR`.

Le capteur combine un signal réseau léger dans le monde MAIN et des indices DOM ciblés. L’état est partagé entre les onglets ChatGPT via `BroadcastChannel`.

La barre basse réserve désormais des zones fixes à l’état, au rôle WORKER/CLIENT, au badge SAFE et à `BY SKYNET`, afin qu’un changement de libellé ne provoque plus de décalage horizontal.

## Performance

### Cœur event-driven

Le runtime 0.9 remplace les anciennes boucles de rescans par des déclencheurs ciblés :

- mutations des éléments réellement ajoutés ;
- changements du cache local ;
- navigation SPA ;
- événements de génération ;
- saisie dans le composer ;
- visibilité de l’onglet.

Les modules cœur, chronologie, polish, Governance, pins natifs, coach et panneaux latéraux n’utilisent pas de `setInterval` permanent.

Depuis 0.9.6 :

- le `routeTick` périodique a été supprimé ;
- les onglets CLIENT ne se réveillent plus périodiquement pour retenter l’indexation ;
- `CLIENT → WORKER`, retour à `PRÊT`, navigation et visibilité réveillent directement la file idle ;
- les observers `main/sidebar` sont rebranchés uniquement si leurs nœuds changent réellement.

Depuis 0.9.8, les hooks réseau MAIN et les CSS restent chargés tôt, mais tout le runtime dépendant du DOM est injecté à `document_idle`. Cela empêche le cas où le thème visuel apparaît alors que le shell NiakGPT ne s'est jamais initialisé.

### WORKER / CLIENT

Avec plusieurs onglets ChatGPT :

- un seul onglet devient **WORKER** ;
- les autres restent **CLIENT** et lisent le cache partagé ;
- le WORKER peut céder son rôle si son fil devient lourd ;
- les onglets CLIENT n’indexent pas les Projects en doublon ;
- `navigator.locks` est utilisé quand disponible, avec fallback local.

### Cache chaud des conversations

NiakGPT intercepte `GET /backend-api/conversation/{id}` avant le rendu de l’application :

- maximum : **5 conversations chaudes** ;
- stockage : **IndexedDB local** ;
- plafond approximatif : **96 Mo** ;
- expiration : **6 h** ;
- conversation inchangée : réponse servie depuis le cache ;
- nouvelle activité : fil marqué `DIRTY` ;
- requêtes concurrentes entre onglets dédupliquées.

Il n’existe pas de véritable endpoint delta public connu pour récupérer uniquement les nouveaux nœuds d’un fil ; NiakGPT ne prétend donc pas en inventer un.

## Safe Mode

Le Centre de contrôle (`Alt+,` ou ⚙) fournit un **Safe Mode** pour les fils extrêmes.

Quand il est actif :

- Matrix coupé ;
- coach coupé ;
- animations coupées ;
- auto-resync suspendu ;
- synchronisation des pins suspendue ;
- l’onglet cède le rôle WORKER.

Le composer, la navigation et les fonctions essentielles restent disponibles.

## Project Governance

### Structure principale

NiakGPT détecte les Projects existants et propose une structure principale basée sur des contextes durables. Les catégories génériques héritées (`Design`, `Coding`, `Work`, etc.), doublons et Projects temporaires ne sont pas promus automatiquement.

Aucun nom de Project personnel n’est codé dans le dépôt : la configuration est stockée localement par identifiant de Project.

### Nettoyer & reconstruire

Le panneau Governance peut :

1. détecter les doublons et reliquats ;
2. conserver tous les placements manuels ;
3. réaffecter les cas à forte confiance ;
4. sortir les cas ambigus vers **Hors projet / À classer** ;
5. masquer localement les anciens reliquats vidés ;
6. relancer ensuite une resynchronisation prudente.

NiakGPT **ne supprime pas automatiquement les Projects serveur** via un endpoint interne supposé.

### Verrou manuel

Lorsqu’un chat est déplacé via l’interface native de ChatGPT :

- le changement est détecté ;
- la destination est relue côté serveur ;
- un verrou local persistant est enregistré ;
- un cadenas apparaît ;
- l’auto-classement ne peut plus déplacer ce chat.

Le cadenas peut être retiré explicitement.

## Compteurs Projects

Chaque Project est compté via son endpoint de conversations, un Project à la fois.

La pagination respecte les cursors opaques retournés par ChatGPT :

- première requête : **aucun cursor inventé** ;
- pages suivantes : seulement le cursor réellement renvoyé ;
- `limit=20` par défaut ;
- fallback sans `limit` si le backend répond `422`.

Affichage : date de dernière activité puis nombre, par exemple `13/08 [27]`.

## Coach de prompts

Le coach reste dans le flux du composer et ne recouvre pas les pièces jointes.

Depuis 0.9.6, il ne repose plus sur trois templates génériques :

- le **prompt courant** pèse beaucoup plus que l’historique ;
- le Project, le titre du chat et les derniers échanges servent surtout à désambiguïser ;
- contraintes, technologies et entités réellement citées sont reprises dans les recommandations ;
- les trois cartes ont des rôles distincts : **approche/diagnostic**, **angle mort/vérification**, **livrable/action** ;
- profils spécialisés : code, performance, design/UX, recherche, juridique, comparaison, organisation, données et rédaction.

Le coach est volontairement masqué pendant les phases actives lourdes afin de ne pas ajouter du travail inutile.

## Panneaux Activité, Sources et Sorties

NiakGPT traite les panneaux natifs de droite comme une même famille UI :

- thème sombre cohérent avec NiakGPT ;
- header lisible ;
- fermeture toujours accessible ;
- accent sémantique différent pour Activité, Sources et Sorties ;
- panneau ouvert décalé à gauche du rail NiakGPT ;
- poignée/bouton replié lui aussi décalé, afin de ne jamais se retrouver sous la barre latérale droite ;
- adaptation supplémentaire lorsque le panneau NiakGPT droit est ouvert.

## Control Center

Le Centre de contrôle permet de régler :

- intensité Matrix ;
- densité ;
- animations ;
- couleurs d’activité ;
- coach ;
- dates et badges Projects ;
- barre d’état ;
- auto-resync ;
- pins natifs ;
- Safe Mode.

Il permet aussi :

- export/import de configuration ;
- copie d’un diagnostic sans contenu de conversation ;
- purge du cache chaud ;
- reconstruction de l’index ;
- réinitialisation des préférences seulement ;
- effacement complet des données locales avec double confirmation.

## Direction artistique

NiakGPT force sa propre couche visuelle sur les principales surfaces ChatGPT :

- sidebar tableau + zebra ;
- Project courant fortement identifiable ;
- messages utilisateur / assistant différenciés ;
- code façon IDE ;
- panneaux Activité / Sources / Sorties harmonisés ;
- Matrix visible mais adaptatif : plus présent au repos, fortement atténué pendant activité et gros fils ;
- états colorés comme information, pas comme décoration ;
- easter eggs SKYNET facultatifs.

## Tests

Deux chaînes principales GitHub Actions sont utilisées.

### Check NiakGPT

Contrôles statiques :

- manifest et ordre de chargement ;
- séparation stricte `document_start` / `document_idle` ;
- syntaxe JavaScript ;
- absence des anciens moteurs dans le runtime ;
- invariants performance ;
- sécurité des cursors ;
- Governance et priorité manuelle ;
- confidentialité du code ;
- hooks d’accessibilité ;
- absence de `routeTick` et retries périodiques d’indexation ;
- géométrie fixe de la barre basse ;
- présence des dossiers Projects instantanés et de l’adaptateur de panneaux natifs.

### NiakGPT Visual Lab

Playwright exécute :

- scènes visuelles desktop/laptop ;
- tous les états d’activité ;
- gros fil ;
- panneaux Activité / Sources / Sorties ;
- Governance ;
- Control Center ;
- Safe Mode ;
- **vraie extension non empaquetée chargée dans Chromium** sur un `chatgpt.com` mocké ;
- un smoke test d'accueil calé sur la structure actuelle de ChatGPT qui exige le shell complet et interdit le cas « CSS chargé mais runtime absent ».

Le banc runtime vérifie notamment le bootstrap réel, les chats récents, les Projects, les compteurs, la pagination sans `cursor=0`, les états réseau, les verrous manuels, Safe Mode, l’élection WORKER/CLIENT, les dossiers Projects sans navigation intermédiaire, la stabilité de la barre basse et le coach contextuel.

La 0.9.8 verrouille explicitement les régressions Matrix, les trois easter eggs Terminator, `BY SKYNET`, les diagnostics `organizer/pins`, les pièces jointes du composer, le handoff d’un WORKER lourd vers un CLIENT léger et le montage complet de NiakGPT sur la page d'accueil actuelle.

## Limites connues

NiakGPT dépend de l’interface et de certains endpoints internes de ChatGPT. Ils sont **non documentés et non garantis**. Une modification de ChatGPT peut donc casser des sélecteurs ou des appels malgré la batterie de tests locale.

Le Visual Lab réduit fortement ce risque mais ne remplace pas une validation ponctuelle sur le site réel après une évolution importante de ChatGPT.

## Confidentialité et sécurité

Voir [`PRIVACY.md`](PRIVACY.md) et [`SECURITY.md`](SECURITY.md).

Résumé : aucune analytics, aucun serveur NiakGPT, aucune revente de données, aucun appel vers un service tiers NiakGPT. Les données de travail et caches restent dans le profil navigateur local.

## Licence

Aucune licence open source n’est déclarée tant qu’un choix explicite de licence n’a pas été effectué. Le fait que le code soit visible dans un dépôt ne doit pas être interprété comme une autorisation de redistribution.