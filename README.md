# NiakGPT

NiakGPT transforme l’interface web de ChatGPT en **espace de travail avancé local** : projets gouvernés, navigation rapide, cache chaud, états en temps réel, sommaire, coach contextuel, outils code, organisation assistée et direction artistique dense inspirée des IDE.

> **État actuel : 0.9.11 RC** — architecture en validation intensive. L’extension utilise certains endpoints internes de ChatGPT qui ne sont pas documentés publiquement par OpenAI et peuvent changer sans préavis.

## Principes

- **local uniquement** : aucun serveur NiakGPT, aucune analytique, aucun compte supplémentaire ;
- **ChatGPT uniquement** : permissions limitées à `https://chatgpt.com/*` ;
- **utilisateur > automatisation** : tout déplacement manuel d’une conversation verrouille son affectation ;
- **performance d’abord** : pas de polling global permanent dans les modules applicatifs, travail partagé entre onglets, indexation au repos et Mode sûr ;
- **réversible** : export/import de configuration, purge ciblée des caches et réinitialisation séparée des préférences.

## Installation développeur

1. Télécharger ou cloner le dépôt.
2. Ouvrir `chrome://extensions`.
3. Activer **Mode développeur**.
4. Choisir **Charger l’extension non empaquetée**.
5. Sélectionner la racine du dépôt, là où se trouve `manifest.json`.
6. Après une mise à jour : **Recharger** l’extension puis recharger les onglets ChatGPT déjà ouverts.

## Ce que change NiakGPT

### Espace de travail et navigation

- `Alt+K` : ouverture rapide projets + conversations ;
- tri des conversations par date du dernier échange ;
- date compacte directement dans la barre latérale ;
- couleur, badge et icône sémantique par projet ;
- lignes alternées et densité de type tableau ;
- sommaire du fil courant ;
- barres de code avec langage, nombre de lignes et copie ;
- barre basse d’état avec projet courant et état du runtime ;
- **projets épinglés transformés en dossiers instantanés** : clic sur le projet = sous-menu de ses conversations, sans page intermédiaire ;
- bouton `↗` distinct pour ouvrir volontairement la page projet complète ;
- conversations du sous-menu triées par dernière activité, avec date et recherche locale pour les gros projets.

### Conversations et direction artistique

La 0.9.11 stabilise l’affichage des fils très longs :

- fond sombre NiakGPT fixé au viewport au lieu de dépendre de la hauteur gigantesque de la conversation ;
- Matrix fixée au viewport et fortement ralentie sur les fils lourds ;
- messages utilisateur et assistant présentés comme des lignes de flux plus lisibles, avec labels **TOI / YOU** et **CHATGPT** ;
- bulles et grosses cartes ChatGPT aplaties : rayons fortement réduits, bordures neutralisées et ombres supprimées ;
- visualiseur d’image prioritaire sur tous les overlays NiakGPT avec une croix de fermeture garantie ;
- panneaux et overlays NiakGPT temporairement masqués pendant un zoom image.

### États en temps réel

La conversation qui travaille est identifiable dans la barre latérale et dans son projet :

- **bleu** — `CHARGEMENT` ;
- **orange** — `ATTENTE` ;
- **violet** — `RÉFLEXION / ANALYSE` ;
- **cyan/vert** — `EXÉCUTION` ;
- **rouge** — `ERREUR`.

Le capteur combine un signal réseau léger dans le monde MAIN et des indices DOM ciblés. L’état est partagé entre les onglets ChatGPT via `BroadcastChannel`.

La barre basse réserve des zones fixes à l’état, au rôle WORKER/CLIENT, au badge du Mode sûr et à `BY SKYNET`, afin qu’un changement de libellé ne provoque pas de décalage horizontal.

## Performance

### Cœur piloté par événements

Le runtime remplace les anciennes boucles de rescans par des déclencheurs ciblés :

- mutations des éléments réellement ajoutés ;
- changements du cache local ;
- navigation SPA ;
- événements de génération ;
- saisie dans le composer ;
- visibilité de l’onglet.

Les modules cœur, chronologie, polish, gouvernance, pins natifs, coach, localisation et panneaux latéraux n’utilisent pas de `setInterval` permanent.

La 0.9.11 ajoute plusieurs gardes spécifiques aux conversations extrêmes :

- le bootstrap n’attend plus le silence de **tout** le DOM : il vérifie uniquement la stabilité du shell `main + composer + sidebar` ;
- suppression du délai fixe de 2,5 s qui précédait l’ancien contrôle de silence global ;
- le capteur d’activité n’observe plus tout `<main>` pendant un simple `CHARGEMENT` de navigation ; l’observer profond n’est armé que pendant une vraie génération ;
- le coach met en cache les derniers échanges au lieu de rescanner tout le fil à chaque frappe ;
- les panneaux natifs ne font pas leurs scans pendant `CHARGEMENT / ANALYSE / EXÉCUTION` ;
- le loader rétro ralentit nettement ses repaint sur les fils lourds ;
- les scans de traduction après interaction sont limités aux menus/dialogues et surfaces NiakGPT ouverts.

Depuis 0.9.6 :

- le `routeTick` périodique a été supprimé ;
- les onglets CLIENT ne se réveillent plus périodiquement pour retenter l’indexation ;
- `CLIENT → WORKER`, retour à `PRÊT`, navigation et visibilité réveillent directement la file au repos ;
- les observers `main/sidebar` sont rebranchés uniquement si leurs nœuds changent réellement.

Depuis 0.9.8, les hooks réseau MAIN et les CSS restent chargés tôt, mais le runtime dépendant du DOM est injecté seulement après chargement et stabilisation du shell ChatGPT. La 0.9.11 remplace l’ancien contrôle de silence global du document par une vérification bornée de l’identité des nœuds structurants.

### WORKER / CLIENT

Avec plusieurs onglets ChatGPT :

- un seul onglet devient **WORKER** ;
- les autres restent **CLIENT** et lisent le cache partagé ;
- le WORKER peut céder son rôle si son fil devient lourd ;
- les onglets CLIENT n’indexent pas les projets en doublon ;
- `navigator.locks` est utilisé quand disponible, avec fallback local.

### Cache chaud des conversations

NiakGPT intercepte `GET /backend-api/conversation/{id}` avant le rendu de l’application :

- maximum disque : **5 conversations chaudes** ;
- cache mémoire borné séparément ;
- stockage : **IndexedDB local** ;
- plafond approximatif disque : **96 Mo** ;
- expiration : **6 h** ;
- conversation inchangée : réponse servie depuis le cache ;
- nouvelle activité : fil marqué `DIRTY` ;
- requêtes concurrentes entre onglets dédupliquées.

Il n’existe pas de véritable endpoint delta public connu pour récupérer uniquement les nouveaux nœuds d’un fil ; NiakGPT ne prétend donc pas en inventer un.

## Mode sûr

Le Centre de contrôle (`Alt+,` ou ⚙) fournit un **Mode sûr** pour les fils extrêmes.

Quand il est actif :

- Matrix coupée ;
- coach coupé ;
- animations coupées ;
- resynchronisation automatique suspendue ;
- synchronisation des pins suspendue ;
- l’onglet cède le rôle WORKER.

Le composer, la navigation et les fonctions essentielles restent disponibles.

## Gouvernance des projets

### Structure principale

NiakGPT détecte les projets existants et propose une structure principale basée sur des contextes durables. Les catégories génériques héritées (`Design`, `Coding`, `Work`, etc.), doublons et projets temporaires ne sont pas promus automatiquement.

Aucun nom de projet personnel n’est codé dans le dépôt : la configuration est stockée localement par identifiant de projet.

### « À classer » est une file, pas une catégorie

La 0.9.11 traite **À classer** comme une file d’attente transitoire :

- elle ne peut plus être apprise comme projet récurrent ;
- elle est retirée des projets principaux de Gouvernance si une ancienne configuration l’y avait enregistrée ;
- les conversations non verrouillées sont reclassées par petits lots uniquement vers de vrais projets serveur ;
- un cas ambigu reste dans la file plutôt que d’être rangé au hasard ;
- tout placement manuel reste prioritaire et verrouillé.

### Nettoyer & reconstruire

Le panneau de gouvernance peut :

1. détecter les doublons et reliquats ;
2. conserver tous les placements manuels ;
3. réaffecter les cas à forte confiance ;
4. sortir les cas ambigus vers **Hors projet / À classer** ;
5. masquer localement les anciens reliquats vidés ;
6. relancer ensuite une resynchronisation prudente.

La reconstruction automatique complète conserve une séquence sûre : détachement et vérification des chats, vérification des projets vides, suppression, recréation de la structure puis classement. En 0.9.11, les déplacements sont exécutés par petits lots concurrents et utilisent l’accusé du PATCH quand il confirme déjà la destination, au lieu d’ajouter systématiquement plusieurs lectures réseau.

### Verrou manuel

Lorsqu’un chat est déplacé via l’interface native de ChatGPT :

- le changement est détecté ;
- la destination est relue côté serveur ;
- un verrou local persistant est enregistré ;
- un cadenas apparaît ;
- l’auto-classement ne peut plus déplacer ce chat.

Le cadenas peut être retiré explicitement.

## Compteurs projets

Chaque projet est compté via son endpoint de conversations, un projet à la fois.

La pagination respecte les cursors opaques retournés par ChatGPT :

- première requête : **aucun cursor inventé** ;
- pages suivantes : seulement le cursor réellement renvoyé ;
- `limit=20` par défaut ;
- fallback sans `limit` si le backend répond `422`.

Affichage : date de dernière activité puis nombre, par exemple `13/08 [27]`.

## Coach de prompts

Le coach reste dans le flux du composer et ne recouvre pas les pièces jointes.

- le **prompt courant** pèse beaucoup plus que l’historique ;
- le projet et les derniers échanges servent surtout à désambiguïser ;
- contraintes, technologies et entités réellement citées sont reprises dans les recommandations ;
- les trois cartes ont des rôles distincts : **approche/diagnostic**, **angle mort/vérification**, **livrable/action** ;
- profils spécialisés : code, performance, design/UX, recherche, juridique, comparaison, organisation, données et rédaction ;
- le contexte récent est mis en cache et invalidé uniquement après une nouvelle réponse ou un changement de conversation.

Le coach est volontairement masqué pendant les phases actives lourdes afin de ne pas ajouter de travail inutile.

## Panneaux Activité, Sources et Sorties

NiakGPT traite les panneaux natifs de droite comme une même famille UI :

- thème sombre cohérent avec NiakGPT ;
- en-tête lisible ;
- fermeture toujours accessible ;
- accent sémantique différent pour Activité, Sources et Sorties ;
- panneau ouvert décalé à gauche du rail NiakGPT ;
- poignée/bouton replié lui aussi décalé ;
- adaptation supplémentaire lorsque le panneau NiakGPT droit est ouvert ;
- aucun scan global de ces panneaux pendant une génération active.

## Centre de contrôle

Le Centre de contrôle permet de régler :

- intensité Matrix ;
- densité ;
- animations ;
- couleurs d’activité ;
- coach ;
- dates et badges projets ;
- barre d’état ;
- resynchronisation automatique ;
- pins natifs ;
- Mode sûr.

Il permet aussi :

- export/import de configuration ;
- copie d’un diagnostic sans contenu de conversation ;
- purge du cache chaud ;
- reconstruction de l’index ;
- réinitialisation des préférences seulement ;
- effacement complet des données locales avec double confirmation.

## Localisation française

NiakGPT traduit ses propres écrans en français et normalise également plusieurs actions natives ChatGPT qui peuvent encore apparaître en anglais dans un environnement français, notamment `Add to project`, `Move to project`, `Create project`, `More options`, etc.

La traduction est volontairement limitée aux contrôles, menus, dialogues et surfaces NiakGPT : **le contenu des conversations n’est jamais traduit ou réécrit**.

## Tests

### Check NiakGPT

Exécuté sur les pull requests et sur `main` lorsque GitHub fournit un runner :

- invariants du runtime et du chemin chaud ;
- vérification de la syntaxe de **tous les fichiers JavaScript réellement injectés**, y compris les modules chargés dynamiquement depuis `background-v100.js` ;
- packaging et contrôle du ZIP propre ;
- absence des anciens moteurs dans le runtime ;
- sécurité des cursors ;
- priorité manuelle de la gouvernance ;
- gardes spécifiques aux conversations lourdes.

### NiakGPT Visual Lab

Exécuté sur pull request ou manuellement :

- scènes visuelles desktop/laptop ;
- tous les états d’activité ;
- gros fil ;
- onboarding sur écrans peu hauts ;
- fond fixe et style `TOI / CHATGPT` ;
- visualiseur d’image et priorité de z-index ;
- bootstrap sous mutations continues d’un gros fil ;
- vérification que `CHARGEMENT` n’arme pas l’observer profond de génération ;
- reclassement de `À classer` et respect des verrous manuels ;
- localisation française des actions de projet ;
- panneaux Activité / Sources / Sorties ;
- gouvernance, Centre de contrôle et Mode sûr ;
- vraie extension non empaquetée chargée dans Chromium sur un `chatgpt.com` mocké.

### Workflows coûteux

Pour limiter les minutes GitHub Actions :

- le packaging autonome est manuel ;
- le Quality Gate complet est manuel ;
- les diagnostics runtime spécialisés sont manuels ;
- Visual Lab ne se relance plus automatiquement après le merge sur `main` puisqu’il a déjà été exécuté sur la PR.

## Limites connues

NiakGPT dépend de l’interface et de certains endpoints internes de ChatGPT. Ils sont **non documentés et non garantis**. Une modification de ChatGPT peut donc casser des sélecteurs ou des appels malgré la batterie de tests.

Le Visual Lab réduit fortement ce risque mais ne remplace pas une validation ponctuelle sur le site réel après une évolution importante de ChatGPT.

## Confidentialité et sécurité

Voir [`PRIVACY.md`](PRIVACY.md) et [`SECURITY.md`](SECURITY.md).

Résumé : aucune analytique, aucun serveur NiakGPT, aucune revente de données, aucun appel vers un service tiers NiakGPT. Les données de travail et caches restent dans le profil navigateur local.

## Licence

Aucune licence open source n’est déclarée tant qu’un choix explicite de licence n’a pas été effectué. Le fait que le code soit visible dans un dépôt ne doit pas être interprété comme une autorisation de redistribution.
