# NiakGPT 0.9.84 — Late hydration + stable GitHub memory sync

## Régressions terrain — 2026-08-30

- correction du cas réel où **PROJECTS restait en haut de la sidebar** lorsque NiakGPT montait avant l’arrivée tardive de la navigation native ChatGPT ;
- suppression du fallback générique qui pouvait figer le catalogue dans une position transitoire : sans navigation primaire fiable, NiakGPT attend désormais au lieu de monter trop tôt ;
- détection des contrôles primaires par href **et** libellé natif, et détection d’un slot Projects visible même si ses liens internes ne sont pas encore chargés ;
- lorsqu’un slot plus autoritaire apparaît après coup, l’ancien bloc est neutralisé et un nouveau bloc est monté directement au bon endroit, sans reparenting du même nœud ;
- correction de la partie GitHub du Centre de contrôle qui pouvait **se volatiliser pendant la synchronisation** : les mises à jour d’état ne reconstruisent plus le DOM du formulaire tant que sa structure n’a pas réellement besoin de changer ;
- conservation du dépôt, de la branche, du dossier saisi, du focus et de l’état des contrôles pendant les événements de progression ;
- un état OAuth/session GitHub transitoire ne remplace plus brutalement le sélecteur de dépôt d’un coffre déjà configuré ;
- Project Memory n’attend plus le WORKER général : son verrou propre ne peut être pris que par un onglet visible ; une tab cachée ne peut plus conserver le verrou en restant bloquée à 0 % ;
- après connexion du coffre, l’onglet visible déclenche immédiatement la consommation de la file ; si la visibilité change, la file persistante est reprise sans perdre les commits déjà écrits ;
- progression affinée au niveau des conversations du Project courant et inventaire initial borné à 15 s avant première persistance ;
- nouveaux labs : `pins-late-hydration-v084.mjs`, `project-memory-ui-stability-v084.mjs`, `project-memory-visible-owner-v084.mjs`.
- le catalogue Projects répare immédiatement un déplacement externe avant le prochain paint, puis effectue une vérification bornée pour les DOM React transitoires ;
- la position de scroll du catalogue est capturée **synchroniquement avant tout retire/remount**, afin qu’un geste utilisateur ne revienne jamais à 0 pendant un remount tardif ;
- le renommage d’un Project via le menu natif est durci : délais adaptatifs, second essai borné et fermeture native par Escape plutôt que suppression de DOM.

---

# NiakGPT 0.9.83 — Pins slot + Project Memory bootstrap recovery

## Régressions terrain — 2026-08-30

- correction du bloc **PROJECTS** visible au-dessus du menu natif ChatGPT : une surface Projects native cachée, inert ou située avant/au-dessus de la navigation primaire ne peut plus servir d’ancre ;
- `primaryTail()` ne remonte plus dans un parent qui mélange navigation primaire et liens Projects/chats ; le fallback Pins reste sous les contrôles natifs ChatGPT ;
- nouveau lab `pins-primary-slot-v083.mjs` avec le scénario exact « faux Projects caché en haut → ChatGPT/Nouveau chat/Bibliothèque/Apps → Pins » sur Chromium/Firefox/WebKit ;
- restauration de la section **PROJECT MEMORY · COFFRE GITHUB PRIVÉ** quand son runtime optionnel arrive alors que le Centre de contrôle est déjà ouvert ;
- ajout de l’événement `niakgpt:control-center-rendered` et rendu initial immédiat de `project-memory-ui-v132.js` ;
- un coffre connecté crée maintenant immédiatement une **file de bootstrap persistante** ; le WORKER peut reprendre cette file après changement de rôle, masquage, reload ou session ultérieure ;
- un coffre déjà initialisé mais sans `lastSyncAt` recrée automatiquement sa file au démarrage de 0.9.83, sans reconnexion GitHub ;
- le Control Center affiche le nombre de Projects en attente, la dernière synchro et les erreurs de sync ;
- correction de la sélection qui sautait dans le Diagnostic : aucun rerender DOM du panneau pendant une sélection texte native active, puis reprise des métriques après relâchement ;
- nouveau lab `diagnostic-selection-v083.mjs` et extension du lab Project Memory pour couvrir l’auto-render + la récupération d’un coffre connecté/non synchronisé.

---

# NiakGPT 0.9.82 — Sidebar DOM stability + GitHub auth transport hotfix

## Régressions terrain — 2026-08-30

- correction du chargement Pins qui pouvait rester accroché à un ancien shell de conversation et nécessiter un passage par l’accueil + actualisation ;
- `#ng8-pins` suit désormais un contrat **direct-once** : calcul de l’emplacement final avant création, aucun reparenting du même nœud entre deux branches React ;
- lors d’un remount ChatGPT, l’ancien bloc est neutralisé sur place et un nouveau bloc est monté directement dans le shell visible actif ;
- ajout d’un garde `safeInsert()` refusant toute insertion parent/descendant invalide ;
- correction des erreurs terrain compatibles avec `Cannot moveNode ... new parent is already a descendant` et `Node cannot be found in the current page` ;
- nouveau lab `dom-node-stability-v082.mjs` : départ direct dans un chat, remount tardif du sidebar, aucun passage accueil/refresh, aucune réutilisation/reparenting du vieux nœud ;
- correction de **Connexion GitHub refusée · The auth url has an invalid scheme** : le launcher `chrome-extension://` n’est plus envoyé à `launchWebAuthFlow` ;
- l’amorce GitHub App Manifest s’ouvre dans un onglet normal, POSTe vers GitHub et revient par le callback HTTPS exact de l’extension ;
- `launchWebAuthFlow` est désormais encapsulé par une garde qui refuse tout schéma autre que HTTP(S) ;
- ajout du callback exact `https://lopeiincnbjihmoahcbogokeniojgobk.chromiumapp.org/*` aux host permissions, sans permission globale `tabs`.

---

# NiakGPT 0.9.81 — Late React scheduler hydration hotfix

## Hydration / affichage — 2026-08-30

- aucun JavaScript NiakGPT n’est désormais chargé à `document_start` ; le groupe bootstrap passe à `document_idle` ;
- la barrière ne se fie plus au seul « DOM calme » : elle exige une identité stable des nœuds `nav/main/composer`, une fenêtre sans mutation prolongée, deux passages idle du scheduler et plusieurs frames ;
- correction du cas réel où React continue sa réconciliation via `MessagePort` après une période sans mutation et remplace ensuite des nœuds différés ;
- le lab d’hydratation reproduit deux remplacements tardifs du shell via `MessageChannel` après `load` et échoue si NiakGPT s’active pendant cette fausse stabilité ;
- les modules continuité/watchdog/pins/menu/handoff restent dormants jusqu’au signal final `niakgpt:host-hydrated-v100`.

---

# NiakGPT 0.9.80 — React hydration barrier hotfix

## Hydration / affichage — 2026-08-30

- correction de la course pouvant provoquer **React recoverable error #418** et casser l’affichage ChatGPT lorsque NiakGPT est chargé à `document_start` ;
- `boot-gate-v100.js` impose désormais une barrière host-hydrated renforcée : chargement complet, calme DOM prolongé, frames de stabilisation puis signal `niakgpt:host-hydrated-v100` ;
- les cinq modules pré-runtime (`composer-continuation`, `long-run-watchdog`, `pin-interaction-rescue`, `project-menu-augment`, `continuity-native-handoff`) restent totalement dormants avant ce signal ;
- avant hydratation : aucun observer, timer, attribut HTML, interception ou mutation DOM NiakGPT ;
- ajout de `visual-lab/hydration-barrier-v080.mjs` : snapshot d’un DOM SSR-shaped, vérification d’immuabilité avant barrière puis activation après signal sur Chromium, Firefox et WebKit ;
- le nouveau lab est intégré au Public Quality Gate et les invariants statiques refusent toute réactivation précoce d’un module `document_start`.

---

# NiakGPT 0.9.79 — Connexion GitHub native et choix du coffre

## Project Memory GitHub UX — 2026-08-30

- le parcours principal Project Memory devient **Se connecter avec GitHub → autoriser → choisir le dépôt** ; plus de PAT à fabriquer/copier dans le flux normal ;
- ajout d’un GitHub App Manifest flow backendless : chaque profil crée son connecteur GitHub App privé, sans client secret partagé dans le dépôt public NiakGPT ;
- permissions minimales du connecteur : **Contents: write** et **Metadata: read** ; GitHub reste propriétaire de l’écran « All repositories / Only select repositories » ;
- ajout de la permission MV3 `identity` et du seul host supplémentaire `https://github.com/login/*` pour l’échange/renouvellement OAuth ;
- validation de deux `state` indépendants et des callbacks `chromiumapp.org` avant tout échange de code ;
- user access token GitHub App conservé en session, refresh token/client secret du connecteur personnel conservés localement ; la clé privée PEM renvoyée par le manifest flow n’est jamais persistée ;
- le sélecteur NiakGPT liste uniquement les dépôts privés non archivés réellement autorisés à l’installation GitHub App ;
- un dépôt demandé hors de cette liste est refusé côté service worker, même si l’UI est contournée ;
- le fine-grained PAT reste disponible sous **Avancé · PAT manuel** pour les organisations/comptes qui interdisent l’installation de GitHub Apps ;
- packaging, documentation Privacy/Security/Architecture et gates statiques/browser mis à jour pour couvrir ce nouveau modèle sans réintroduire de secret GitHub Actions.

---

# NiakGPT 0.9.78 — Hotfix Project Memory isolé et connexion dépôt neuf

## Correctifs critiques — 2026-08-30

- séparation stricte du coffre Project Memory : suppression du live smoke et de tout secret Actions reliant le dépôt public NiakGPT à un vrai dépôt privé utilisateur ; le nom du coffre et son secret d’accès restent exclusivement locaux au navigateur ;
- correction CodeQL du contrôle de domaines synthétiques dans `tools/check-fixture-privacy-v133.mjs` : validation par labels DNS, sans comparaison de sous-chaîne ambiguë ;

- Project Memory sort du runtime critique : `ISOLATED_RUNTIME` termine désormais jusqu’à `ux-v131.js`, puis Project Memory se charge dans `OPTIONAL_RUNTIME` en best-effort ;
- l’échec de `project-memory-background-v132.js` est capturé dans le service worker et ne peut plus empêcher le bootstrap Projects/sidebar ;
- le bootstrap principal répond avant toute injection Project Memory optionnelle : Pins, drawers et menus `...` ne dépendent plus de GitHub ;
- prise en charge des dépôts GitHub privés totalement neufs, sans branche ni commit : création du premier blob/tree/commit/ref ;
- token et configuration Project Memory ne sont persistés qu’après initialisation réussie ;
- un échec de connexion conserve dépôt, branche, dossier, token et préférence “mémoriser” dans le formulaire, avec bouton de retry visible ;
- nouveau gate `labs/project-memory-isolation-v133.mjs` : backend mémoire cassé et runtime mémoire cassé doivent laisser le bootstrap Projects vert ;
- le lab UX Project Memory teste désormais l’échec visible, la conservation du formulaire et le retry ;
- le lab global `sidebar-session-ux-v123.mjs` provoque un échec Project Memory puis reteste immédiatement le catalogue Pins/Projects et ses menus d’actions ;
- la release passe en 0.9.78 afin que le hotfix soit distribué comme une vraie mise à jour ;
- correction visuelle des lignes Project : colonne contenu + colonne action `...` explicites, hitboxes non chevauchantes et contrôle d’overflow/alignement dans le lab human UX ;
- reconnaissance explicite de `Nos systèmes effectuent quelques vérifications …` et `Connexion interrompue. En attente de la réponse complète.` ;
- toutes les RPC NiakGPT et la synchro Project Memory se suspendent pendant vérification ou interruption réseau ;
- brouillon et fin de réponse assistant partielle sont conservés chiffrés en session ; après retour réseau, NiakGPT privilégie une reprise native unique, sinon prépare une continuité exacte sans envoi automatique ;
- reprise réseau durcie par une fenêtre de stabilisation DOM bornée pour éviter les races WebKit/SPA.

---

# NiakGPT 0.9.77 — Project Memory GitHub privé et continuité durable

## Project Memory v132 — 2026-08-29

- ajout d’un **dépôt GitHub privé choisi par l’utilisateur** comme mémoire durable optionnelle des Projects ;
- vérification obligatoire `private: true` à la connexion puis avant les lectures/écritures ; dépôt archivé refusé ;
- fine-grained token conservé en session par défaut, persistance locale uniquement sur choix explicite ;
- bootstrap automatique de tous les Projects existants non vides : description/instructions, historique des fils, tâches, décisions, contraintes et signaux d’architecture ;
- historique complet découpé sous `projects/<id>/conversations/<id>/` et checkpoint compact `PROJECT_STATE.md` ;
- après bootstrap, synchronisation incrémentale des seuls fils dont le timestamp canonique a changé ;
- queue de synchronisation persistante et reprise après interruption ;
- pause des lectures lourdes pendant génération/vérification ChatGPT et conservation du broker/circuit breaker existant ;
- `GET /backend-api/conversation/{id}` complet toujours interdit hors requête explicite `memoryBootstrap: true` ;
- restauration du checkpoint une seule fois au premier message d’un nouveau fil Project, sans gonfler les prompts suivants ;
- intégration au Control Center avec connexion, synchro, resync complet, déconnexion et options dédiées ;
- ajout de la permission hôte `https://api.github.com/*`, sans trafic GitHub tant que Project Memory n’est pas configuré ;
- packaging renforcé pour inclure les workers chargés via `importScripts()` ;
- nouveaux gates statiques Project Memory + fixture publique synthétique `test/x.md` sans donnée utilisateur ni secret ;
- documentation Privacy/Security/Architecture mise à jour pour distinguer clairement dépôt privé, token, historique Git et absence de chiffrement E2E applicatif dans cette version.

---

# NiakGPT 0.9.76 — UX native-first intégrale et reprise longue sûre

## Documentation & maintenance refresh — 2026-08-28

- `README.md` becomes the primary English landing page and `README.fr.md` provides the full French version with reciprocal language links.
- Privacy, security, troubleshooting, contributing, testing and Visual Lab documentation were rewritten around the current 0.9.76/v131 behavior instead of historical 0.9.52/early-0.9.76 assumptions.
- Current 0.9.76 release/hotfix notes now reflect the 6m30 watchdog, composer-residue protection, BFCache recovery and native-first UX baseline.
- Added `tools/check-repository-hygiene.mjs` and wired it into the main check workflow.
- Removed four top-level runtime files with zero repository references and no production/package role.
- Added a weekly GitHub Actions purge workflow that keeps a short recent diagnostic window while removing older completed runs/artifacts.


- Ajout de `ux-v131.js/css` comme garde UX finale : sélection de la vraie sidebar gauche, exposition de `#ng8-pins` uniquement après vérification du host et disparition de la réservation permanente de largeur/hauteur autour de ChatGPT.
- `sidebar-projects-v121.js` reste propriétaire du catalogue/placement incrémental ; les nœuds Projects, leur ordre, le focus et les scrolls catalogue/drawers sont conservés pendant les rafraîchissements de cache, tout en laissant un nouveau geste utilisateur reprendre immédiatement la main.
- Rail droit transformé en dock discret, masqué sur l’accueil/surfaces utilitaires ; barre basse remplacée par une capsule passive. Les easter eggs Matrix/Terminator restent montés, mais `BY SKYNET` n’occupe plus la capsule passive.
- Prompteur adaptatif converti en contrôle compact opt-in `Optimiser`, ouvrable explicitement ou via `Alt+P`, repliable avec `Escape`, sans requête réseau ni envoi automatique.
- Continuité parallèle raccourcie en `↳ Suite en parallèle` ; après un envoi natif, seul le préfixe NiakGPT est retiré si le composer contrôlé ne s’est pas vidé, sans effacer un texte modifié par l’utilisateur.
- `long-run-watchdog-v129.js` passe à une fenêtre par défaut de 6 min 30, n’écrit rien tant qu’aucun vrai candidat Envoyer n’existe, protège tout brouillon utilisateur et ne nettoie que les protocoles automatiques exacts qu’il connaît. Une modification utilisateur, même contenant encore le marqueur NiakGPT, n’est jamais effacée.
- `interruption-guard-v119.js` restaure correctement l’incident chiffré asynchrone et empêche une écriture cryptographique obsolète d’écraser un état plus récent.
- Gates renforcés : session humaine complète, scroll réel, menus/hitboxes/clavier/dialogues, remounts, routes accueil/utilitaires/Project/chat, continuité de limite, erreurs réseau, travail logique >10 min, résidus composer et protection des modifications utilisateur.
- Nouvelle CI `NiakGPT UX Integral v131` screenshot-driven sur Chromium / Firefox / WebKit, validation focused Live Stability sur Chromium + Brave stable macOS, matrice Current Finalization multi-OS/multi-engine et packaging vérifié.
- README et architecture resynchronisés sur 0.9.76 avant livraison.

# NiakGPT 0.9.68 — Autorité Projects unique, menus isolés et boot cache déterministe

- `sidebar-projects-authority-v112.js` devient l’unique propriétaire de la visibilité des Projects natifs ; `sidebar-authority-v107.js` et `sidebar-expando-guard-v108.js` restent uniquement dans les régressions historiques et ne sont plus injectés/empaquetés.
- `live-fixes-v104.js` ne gère plus que les panneaux Activité / Réflexion / Sources / Outputs ; `live-fixes-v106.js` ne gère plus que le contexte Project et le nettoyage ponctuel des anciennes marques de migration.
- Ajout de `sidebar-metadata-v118.js/css` : normalisation des dates, suppression des faux Projects-date et réparation conservatrice du cache, sans aucune responsabilité de visibilité Projects.
- Le boot impose désormais `cache-bus → diagnostics → metadata v118 → cache-guardian/recovery/server-index → gouvernance/UI`.
- `sidebar-metadata-v118.js` est une IIFE async : sa première sanitation du cache est réellement attendue avant que l’injecteur ne passe aux consommateurs suivants.
- Les publications runtime du cache reçoivent un ordre monotone interne : une sanitation ancienne retardée par Web Locks ne peut plus écraser un snapshot externe plus récent, y compris lorsque les timestamps `at` sont identiques.
- `cache-bus-v096.js` conserve le snapshot externe le plus récent pendant une suspension BFCache, attend les écritures déjà en vol puis réhydrate l’état newest-first au `pageshow`.
- Les abonnés existants du cache-bus survivent désormais à un `pagehide` BFCache persistant : aucune notification n’est envoyée pendant la suspension, puis le snapshot le plus récent est republié à la reprise ; seul un vrai départ de page détruit les listeners.
- `native-actions-v113.js` isole chaque session de menu : les menus déjà visibles restent intacts, seuls les menus ouverts par l’action courante sont promus, et le cleanup retire Popover, top-layer, classe, variables CSS et datasets NiakGPT.
- La réutilisation d’un même nœud natif par React est couverte ; une seconde ouverture doit repartir d’un état natif propre.
- Le fallback local conversation termine maintenant sa session flottante exactement à la fermeture, afin qu’un menu apparu ensuite ne puisse pas être capturé par un timer tardif.
- Nouveaux/renforcés gates : `native-menu-session-v118`, `sidebar-metadata-v118`, lifecycle/concurrence/BFCache, autorité/remount, hitboxes atomiques, preview image, validateurs d’ordre de boot et exclusion des anciennes autorités du ZIP.
- Documentation README/architecture/changelog synchronisée avec le runtime 0.9.68 et la licence GPL-3.0.

# NiakGPT 0.9.67 — Hitboxes sidebar et menus flottants

- Sépare physiquement la zone cliquable du Project et son bouton `…`, sans chevauchement.
- Chaque conversation des drawers devient une ligne atomique `.ng96-chat-entry` contenant son lien et son bouton d’actions comme deux hitboxes sœurs.
- Les menus ChatGPT natifs sont promus hors des contextes de clipping de la sidebar, avec prise en charge des sous-menus.
- Suppression du bouton redondant d’ouverture Project et stabilisation des clics immédiats après remount/rerender.
- Nouveau gate pixel `sidebar-hitboxes-v117` et renforcement de la matrice réelle, y compris Brave stable visible sur macOS.

# NiakGPT 0.9.66 — Autorité sidebar passive et matrice OS/navigateurs

- Remplace l’autorité Projects agressive par un marquage passif `data-ng112-native-projects` + CSS.
- Retire l’observation globale des attributs/classes du document et limite les observers aux roots/sidebar utiles en `childList`.
- Les actions natives savent exposer temporairement hors écran une surface Projects masquée sans réintroduire de churn permanent.
- Renforce la matrice Ubuntu / Windows / macOS × Chromium / Firefox / WebKit, plus Brave stable réel sur macOS et profils cold/warm.

# NiakGPT 0.9.65 — Sidebar autoritaire et pins sans clignotement

- Étend la détection des Projects natifs aux roots/sous-arbres frères et variantes de markup réellement observées.
- Corrige le feedback loop entre dossiers épinglés et actions natives qui faisait clignoter/remplacer les boutons `…`.
- Le drawer existant est conservé tant que ses données n’ont pas changé ; les mutations coopérantes ne forcent plus sa reconstruction.
- Ajoute un gate « real shape » avec roots séparés, remount du bloc natif, actions et vérification anti-churn.

# NiakGPT 0.9.64 — Human navigation, stabilité live et sécurité

- Corrige l’alerte CodeQL `js/xss-through-dom` : le texte des tours du sommaire est maintenant injecté via `textContent` et n’est plus réinterprété comme HTML.
- Durcit les pins contre les remounts/rerenders React : dossiers et boutons d’actions se réhydratent de façon synchrone à chaque `niakgpt:pins-rendered`, avec garde du premier clic avant décoration.
- Réarme les actions après retour BFCache, visibilité et navigation SPA.
- Le visualiseur image détecte aussi les overlays plein écran sans ancien sélecteur dialog et restaure systématiquement le bouton de fermeture NiakGPT.
- L’autorité Projects masque aussi la ligne native `Projects` lorsqu’elle contient un bouton d’action frère.
- Les contrôles principaux de sidebar (nouvelle discussion, recherche, images, applications, Codex) reçoivent désormais des glyphes NiakGPT distinctifs au lieu de simples SVG ChatGPT recolorés.
- Nouveau stress test `human-nav-stress-v114` : 16 cycles de rerender/remount/navigation + menus natifs + fermeture image sur Chromium, Firefox et WebKit.

# NiakGPT 0.9.63 — Actions natives, état canonique et non-lus

- Remplace les anciens contrôles de renommage custom par les menus d’actions ChatGPT natifs complets pour Projects et conversations lorsque la ligne native est disponible.
- Retire `project-pins-v090.js` du runtime afin d’éviter un second propriétaire de synchronisation des Projects.
- Ajoute une autorité monotone pour les titres et affectations Project afin qu’un cache ancien ou un titre d’onglet obsolète ne remplace plus un titre serveur connu.
- Rend le fil d’Ariane canonique et entièrement lié : `Accueil > Project > Chat`, sans utiliser `OUT` comme nom de Project.
- Ajoute l’état non-lu, sa remise à zéro à l’ouverture et le signal immédiat lorsqu’une réponse se termine hors vue.
- Ajoute `conversation-load-guard-v113.js` pour relâcher les optimisations NiakGPT tant que le contenu natif de la conversation n’est pas encore rendu.
- Consolide les gates courants et réduit les workflows redondants avant l’ajout de CodeQL.

# NiakGPT 0.9.62 — Finalisation sidebar, continuité, classement et performances

- Le bloc Projects NiakGPT devient réellement autoritaire : détection du doublon natif par structure **et par identité des noms de Projects**, sans dépendre uniquement des classes ou des `href` ChatGPT ; Récents reste intact et le natif revient seulement si `#ng8-pins` disparaît.
- Ajout du renommage Project/conversation depuis le bloc NiakGPT ; le Project ouvre l’action **Renommer** du menu natif via une mise en scène hors écran du bloc natif masqué, tandis que les conversations conservent un fallback `PATCH {title}` ciblé.
- Continuité OUT renforcée : capsule commençant par `Reprends la conversation nommée « Project > chat »`, historique local et contexte Project, rattachement du nouveau chat au **Project exact** puis lock `continuity-exact`; les nouveaux chats normaux gardent le recommender habituel.
- Nouveau rattrapage profond strictement borné pour les chats ambigus/orphelins : titre/snippet d’abord, premier message ensuite, messages suivants uniquement si nécessaire ; 2 chats max/cycle, 1 sur gros fil, 10 messages/14k caractères max, cadence réseau minimale et suspension pendant génération/429.
- Les chats associés à un Project inexistant sont soit reclassés avec confiance, soit détachés du fantôme au lieu de rester dans un état invalide.
- Gros fils : garde 0.9.62 à 70 tours, historique froid avec queue chaude limitée à 44 tours, `content-visibility`/containment, Matrix coupée pendant génération lourde et éléments décoratifs désactivés ; aucun retour de l’ancien intercepteur global hotcache.
- Cache : validation transactionnelle avec 120 conversations et deux mises à jour sérialisées sans perte d’historique ; `cache-bus-v096.js` reste le propriétaire local des écritures séquentielles.
- Entêtes : `TOI / CHATGPT` redevient systématique sur les tours récents ; date/heure fiable `JJ/MM/AA · HH:mm` depuis le DOM natif ou l’envoi courant, sans heure inventée au reload ; le module répare aussi les écrasements tardifs d’un autre décorateur.
- Accueil : correctif mesuré du chevauchement `Par quoi commençons-nous ?` / composer, activé uniquement si les rectangles se recouvrent réellement.
- Matrix : gardien du canvas avec fallback léger, sans prise de contrôle de la géométrie des enfants de `main`, et respect de `prefers-reduced-motion`.
- DA : harmonisation des icônes/SVG natifs ChatGPT (couleurs, hover/focus, surfaces) sans remplacer les SVG ni leur logique.
- QA : nouveau gate 0.9.62 avec HTML rendu, analyse DOM JSON et screenshots sur Chromium / Firefox / WebKit ; scénarios dédiés au doublon Projects, renommage natif, accueil, Matrix, gros fil, cache long, DA native, cas `TV job...` et continuité Project exacte.

# NiakGPT 0.9.52 — Sidebar, native panels & long-thread stabilization

- Unifies the left sidebar around the NiakGPT coloured Projects block and suppresses native Project rows, open-project child conversations and their local “Show more” controls without hiding Recents.
- Detects ChatGPT Activity / Reflection / Sources / Outputs panels by label + viewport geometry, including anonymous DIV wrappers, and converts them to a fixed overlay left of the NiakGPT rail so chat width is not stolen.
- Long conversations use a cold-history model: initial decoration is capped to a 160-turn live tail and duplicate rescans coalesce instead of cancelling each other mid-scan.
- Continuity no longer observes `characterData` across the whole conversation; OUT checks run on structural alerts and when ChatGPT becomes idle.
- Adds screenshot-producing visual regression labs for sidebar, native panels and 500-turn conversations, designed to run on Chromium, Firefox and WebKit.
- Historical labs remain in the repository; 0.9.52 adds new gates instead of cleaning prior suites.

# NiakGPT 0.9.51 — Project UI + long-thread safety

- Keeps the colored NiakGPT Projects block as the only visible Project system; native ChatGPT Project rows/labels are suppressed with DOM-drift fallbacks.
- Confirms NiakGPT never calls `/backend-api/f/conversation/resume`; that route is not present in the extension.
- Adds a bridge circuit breaker so queued NiakGPT backend requests do not execute while ChatGPT is loading, waiting, thinking, executing, or showing a native verification challenge.
- Server Project refresh now waits for ChatGPT activity to return to ready; cached Projects remain available immediately.
- Long-thread activity tracking no longer observes character-data mutations across the entire conversation DOM; streamed-token observation is scoped to the current assistant turn.
- Existing labs are preserved; 0.9.51 adds regression coverage rather than replacing prior suites.

# NiakGPT 0.9.50

- Panneaux natifs Activité / Réflexion / Sources : overlay fixe 320 px à gauche du rail NiakGPT, sans réservation de largeur dans le chat.
- Le rail NiakGPT reste visible quand un panneau natif est ouvert.
- Sidebar : le bloc Projects NiakGPT remplace visuellement la section Projects native dupliquée ; un seul propriétaire de scroll vertical.
- Conversations : garde anti-duplication des nœuds de titre identiques dans une même ligne.
- Fond : Matrix nettement atténuée et gradient plus profond pour retrouver de la lisibilité.
- Labs conservés et étendus ; aucun nettoyage des labs.

# Changelog

Les changements notables de NiakGPT sont regroupés ici. Le projet est encore en phase RC : les versions 0.x peuvent faire évoluer l’architecture interne rapidement.

## 0.9.49 — Restauration 0.9.48, continuité OUT et labs multi-moteurs

- restauration du delta 0.9.48 sur le build 0.9.44 vérifié, avec conservation de la clé d’identité Chrome ;
- monde MAIN réduit à `page-bridge.js` uniquement ; les anciens intercepteurs `window.fetch` de hotcache/activity ne sont plus chargés ;
- refus avant réseau de tout `GET /backend-api/conversation/{id}` initié par NiakGPT ; mutations `PATCH` conservées avec accusé de réception local ;
- server-index piloté par événements : inventaire Projects léger immédiatement disponible, crawl détaillé suspendu pendant l’activité puis repris au retour à `PRÊT` ;
- gros fils : aucun traitement chaud massif pendant le streaming, reprise différée après stabilisation ;
- panneaux Activité / Réflexion / Sources / Outputs : géométrie native (`right`, `translate`, `max-width`) préservée et priorité temporaire sur le rail NiakGPT ;
- nouveaux chats : fenêtre de maturation de 8 s, classement avec un seul PATCH et sans GET complet ;
- conversations `OUT` : badge, tri en bas, bouton de continuation, capsule locale Project/URL/instructions/historique et rattachement du nouveau fil au même Project ;
- timestamps **TOI · HH:mm / CHATGPT · HH:mm** sans GET complet de conversation ;
- prompteur adaptatif local : contexte Project/fil, conservation des contraintes, profils dev/recherche/rédaction/comparaison/plan, actions COPIER/REMPLACER sans auto-send ;
- ajout d’un lab Playwright commun Chromium / Firefox / WebKit et d’une matrice CI dédiée, sans inclure les fichiers de lab dans le ZIP de l’extension.

## 0.9.44 — Bootstrap Projects anti-blocage et horodatage des messages

- suppression du deadlock `recovery=pending` qui pouvait bloquer indéfiniment l’index serveur pendant un état Activité ;
- inventaire Projects exécuté même pendant une génération/activité : les Projects et pins deviennent disponibles sans attendre le crawl des chats ;
- gouvernance automatique évolutive : un seed partiel de 10 Projects est élargi quand l’inventaire serveur complet arrive ;
- conservation des verrous manuels tant qu’un index serveur complet n’a pas validé les conversations ;
- diagnostic cache mis à jour dès que l’inventaire Projects est disponible ;
- ajout de `HH:mm` à côté de **TOI / CHATGPT** lorsque l’heure est disponible dans le DOM ou les métadonnées locales déjà disponibles ;
- aucune nouvelle boucle réseau : la récupération de timeline respecte le circuit breaker 429 et ne relance pas pendant une activité.

## 0.9.43 — Panneaux natifs bornés et démarrage frais plus réactif

- Activité / Sources / Sorties : suivi actif du panneau ouvert avec `ResizeObserver` local, sans observer global permanent ;
- clic sur une analyse/source/sortie déjà ouverte : détection des portails fixes secondaires créés par ChatGPT, même sans libellé « Activité » ;
- bord droit mesuré contre le rail NiakGPT et, si le diagnostic NiakGPT est ouvert, contre son bord gauche réel ;
- correction via la propriété CSS indépendante `translate` afin de ne pas écraser les transforms/animations natives de ChatGPT ;
- clipping du contenu normal au panneau ; seul `pre/code` conserve un scroll horizontal local ;
- même traitement pour Activité, Sources et Sorties ;
- réinstallation / cache neuf : les Projects serveur sont publiés dès leur inventaire, avant la fin de l’indexation de tous les chats/dates, afin que gouvernance et pins apparaissent rapidement ;
- diagnostic `cache-garde` : un cache `0 Projects / 28 chats / 0 dates` est désormais signalé `PARTIEL` au lieu de `OK`.

## 0.9.42 — Garde anti-effondrement du cache / démarrage déterministe

- nouveau `cache-guardian-v100.js`, injecté avant Recovery, index serveur et modules UI ;
- détection d’un cache effondré (Projects/chats/dates fortement inférieurs au dernier état complet) ;
- restauration locale depuis le high-water mark ou le snapshot pré-AUTO REBUILD avant tout rendu/indexation ;
- reconstruction de la gouvernance à partir des Projects restaurés lorsque les `coreProjectIds` ont été vidés ;
- `app`, sidebar, gouvernance, index serveur et reclassement attendent la fin du garde de cache ;
- l’index serveur devient strictement non destructif lorsqu’une réponse ChatGPT paraît partielle : aucun Project/chat/date connu n’est supprimé ;
- une réponse partielle déclenche une nouvelle tentative différée au lieu de publier un faux état complet ;
- récupération AUTO : inventaire général prioritaire pour réduire fortement les requêtes par Project et limiter les 429 ;
- conservation du broker 0.9.41 : déduplication, sérialisation et circuit breaker 429.

## 0.9.41 — Récupération AUTO / gouvernance / verrouillage fiable

- détection locale d’un état corrompu après AUTO REBUILD (Projects générés, gouvernance vide, accumulation anormale de verrous) et récupération **une seule fois** depuis le snapshot enregistré juste avant ce rebuild ;
- restauration des Projects et affectations précédentes par nom, recréation seulement si nécessaire, puis suppression uniquement des Projects explicitement enregistrés comme créés par l’AUTO et vérifiés vides ;
- conservation des vrais verrous manuels antérieurs et mise en quarantaine des verrous suspects générés après le snapshot, sans suppression silencieuse ;
- le détecteur de déplacement manuel exige désormais un geste utilisateur fiable dans l’UI Project/menu avant d’enregistrer un verrou ;
- AUTO REBUILD ne fabrique plus de Projects à partir de mots capitalisés récurrents comme `NiakGPT`, `Miorra` ou `Elias` : les cibles nommées doivent déjà exister côté serveur avec un historique réel ;
- récupération prioritaire : index serveur, gouvernance, reclassement et resynchronisation attendent sa fin avant de modifier l’état ;
- protection contre la réintroduction de Projects serveur supprimés via des ancres DOM obsolètes après récupération ;
- fil d’Ariane basé en priorité sur l’affectation serveur/cache du chat courant et nettoyage des libellés `Ouvrir le projet …` ;
- revalidation Chromium des pins, dates, Activité/Sources/Sorties, gros fils, viewer, onboarding, français/DA, cache stable et reclassement 54 chats.

## 0.9.38 — QA navigateur renforcée / panneaux natifs / accueil

- ne modifie plus la géométrie ni le positionnement des enfants directs de `main`, afin de préserver l’accueil ChatGPT et son titre au-dessus du composer ;
- panneaux natifs Activité / Sources / Sorties bornés à leur largeur visible, avec scroll horizontal local uniquement dans les blocs de code ;
- cartes Activité / Sources / Sorties intégrées aux réponses protégées contre les largeurs/min-width natives excessives ;
- reclassement après enrichissement moins strict mais toujours conditionné à un score et une marge positifs ; cooldown ambigu réduit ;
- validation dans Chromium avec l’extension MV3 réellement chargée sur une fixture `https://chatgpt.com/` interceptée localement.

## 0.9.37 — Convergence cache / verrous / QA renforcée

- sérialisation transactionnelle de toutes les écritures principales du cache afin d’éviter les pertes de chats, dates et affectations entre modules ;
- un seul propriétaire pour l’index serveur ; l’ancien indexeur backend de `app-v090.js` reste dormant ;
- verrou inter-onglets commun aux mutations Projects, AUTO REBUILD, gouvernance et reclassement, avec reprise bornée en cas de contention ;
- priorité aux données serveur pour les compteurs et affectations, sans écrasement par un snapshot DOM partiel ;
- nettoyage des conversations obsolètes uniquement après un inventaire serveur complet ; en cas de réponse partielle, le cache précédent est conservé ;
- pins NiakGPT renforcés dans la sidebar, auto-réparation après rerender React ; synchronisation des pins natifs conservatrice et non destructive ;
- Activité / Sources / Outputs protégés contre les règles visuelles génériques et contre les débordements du panneau latéral ;
- QA Chromium 144 : sidebar/pins/dates, liens Projects, file À classer, 54 chats + verrou manuel, gros fil 321 messages, onboarding court, panneau Activité/Sources, concurrence cache et reprise de verrou.

## 0.9.36 — QA navigateur réel et restauration UI

- Projects NiakGPT montés comme enfants directs de la sidebar afin d'éviter le clipping du bloc de pins dans la zone virtualisée des Récents.
- Synchronisation des pins natifs passée en best-effort : aucun spam de menus si ChatGPT ne rend pas la zone native correspondante.
- Reclassement enrichi avec alias de Projects (Niakvio, Films, Analyse, Tech, Business, Juridique, Maison, Auto, Travail, etc.) et seuil post-enrichissement prudent pour réduire les faux « ambigus » ; `chat/chats` reste exclu des signaux Perso pour ne pas confondre ChatGPT avec les animaux.
- Suppression du flattening CSS générique des cartes internes : Activité, Sources, fichiers et citations conservent leur structure native.
- Panneaux Activité/Sources : NiakGPT ne transforme plus un wrapper arbitraire de titre en header flex.
- Ajout d'une validation locale dans Chromium 144 réel : layout, gros fil + hydratation massive, pins auto-réparés, dates sans doublons, navigation Project, reclassement 11/54, Activité/Sources, panneau latéral et onboarding 1024×540.

## 0.9.35 — Sidebar, pins et file À classer

- un seul propriétaire DOM pour les pins NiakGPT ; montage juste avant la section Récents lorsque disponible ;
- suppression de la pollution d’index où un badge de date `14/08` pouvait être interprété comme un Project ;
- purge automatique des Projects DOM fantômes lors de la prochaine indexation serveur ;
- synchronisation des pins natifs désormais additive et non destructive ; si l’UI native n’expose pas l’action, NiakGPT cesse de boucler en erreur ;
- remise à zéro des tentatives de reclassement après indexation serveur et reprise planifiée des chats ambigus au lieu d’un blocage silencieux de 30 minutes.

## 0.9.34 — Récupération d’index et restauration sidebar

- réindexation serveur locale automatique lorsque le cache ne contient que les éléments visibles du DOM ;
- restauration des Projects complets, compteurs et dates à partir des endpoints ChatGPT déjà utilisés par NiakGPT ;
- le bouton « Réindexer maintenant » fonctionne même depuis un onglet CLIENT ;
- la synchronisation des pins ne désépingle plus quoi que ce soit tant que la gouvernance n’est pas initialisée ;
- reclassement « À classer » protégé par verrou inter-onglets mais non bloqué artificiellement par le rôle CLIENT ;
- fil d’Ariane : récupération du vrai nom du Project et du vrai titre du chat depuis le titre natif lorsque le cache est incomplet ;
- conservation du marqueur d’index serveur lors des mises à jour DOM du cache.

## 0.9.33 — Correctif local consolidé / fil d’Ariane

- correction conservée du crash `turnSel is not defined` sur les mutations des gros fils ;
- réparation de la coordination `requestIdleCallback` : plus de boucle de réveil toutes les 20 ms sur un fil lourd, et les tâches avec `timeout` finissent réellement par s’exécuter ;
- indexation Projects/dates capable de progresser même lorsqu’un seul onglet lourd est ouvert, sans polling permanent ;
- reclassement `À classer` maintenu sur onglet lourd en petits lots de 3, avec cadence ralentie ;
- récupération des verrous manuels depuis le miroir `localStorage` lors du changement d’identifiant d’une extension non empaquetée ;
- clics des Projects du panneau Explorer forcés vers la page Project canonique, jamais vers un chat ;
- dates de sidebar réappliquées après chaque publication du cache et diagnostic `dates` ajouté ;
- bloc Projects NiakGPT recréé automatiquement si un rerender React de la sidebar le retire ;
- les dossiers épinglés et leurs métadonnées se réhydratent explicitement après chaque recréation du bloc Projects ;
- migration d’une ancienne installation locale détectée via les miroirs du domaine afin de ne pas relancer l’onboarding inutilement ;
- ajout d’un fil d’Ariane fixe **NiakGPT › Project › Conversation** en haut, sans observer global ni polling ;
- le fil d’Ariane est masqué automatiquement pendant le visualiseur d’image.

## 0.9.32 — Correctif runtime / Projects / reclassement

- correction du crash `turnSel is not defined` dans le traitement incrémental des messages ;
- le worker multi-onglets ne reste plus bloqué dans un onglet masqué : le travail de fond passe à un onglet visible ;
- réparation du seed Governance lorsqu'une nouvelle installation locale avait mémorisé `0` Project principal avant le chargement du cache ;
- miroir de la gouvernance dans le stockage local du domaine pour mieux survivre aux changements de dossier d'une extension non empaquetée ;
- exclusion des pseudo-Projects DOM des listes de Projects cliquables afin qu'un Project n'ouvre plus par erreur une conversation ;
- liens de Projects serveur normalisés vers `/g/<id>/project` ;
- file `À classer` traitée par lots successifs au lieu de rester bloquée après le premier lot sans déplacement ;
- placement du bloc de Projects NiakGPT stabilisé dans la racine réelle de la sidebar ;
- identifiant d’extension local désormais stabilisé par une clé publique de manifest, pour éviter de perdre le stockage NiakGPT à chaque changement de dossier décompressé.

## 0.9.31 — Consolidation locale

- gros fils : mutations bornées à 10 unités réelles par lot ;
- fond/Matrix/viewer stabilisés ;
- AUTO REBUILD : DELETE et POST Projects gouvernés via le bridge ;
- reprise de phase après interruption ;
- À classer traité comme file d’attente, jamais comme projet principal ;
- onboarding français en 3 étapes, scrollable sur petite hauteur.

## 0.9.6 — Audit RC

### UX / navigation

- les Projects épinglés deviennent de vrais dossiers dépliables : clic Project = liste instantanée des conversations depuis le cache local, bouton `↗` séparé pour ouvrir la page Project complète ;
- conversations du sous-menu triées par dernière activité avec date visible et filtre local sur les gros Projects ;
- Quick Open en onglet CLIENT privilégie les liens SPA natifs au lieu d’un reload complet ;
- barre basse stabilisée : zones d’état, rôle WORKER/CLIENT, SAFE et `BY SKYNET` ne doivent plus se décaler lors des changements d’état ;
- Matrix légèrement plus visible au repos sans augmentation de cadence CPU, toujours fortement atténuée en activité/gros fil.

### Coach

- nouveau coach contextuel : le prompt courant domine le classement, Project/titre/derniers échanges servent uniquement à désambiguïser ;
- extraction de contraintes, technologies et entités réellement citées ;
- trois rôles distincts par recommandation : approche/diagnostic, angle mort/vérification, livrable/action ;
- recommandations spécialisées pour code, performance, design/UX, recherche, droit, comparaison, organisation, données et rédaction.

### Panneaux natifs

- traitement commun des panneaux **Activité**, **Sources** et **Sorties / Outputs** ;
- DA NiakGPT cohérente, header lisible et fermeture toujours accessible ;
- panneaux ouverts décalés à gauche du rail NiakGPT ;
- poignées/boutons repliés eux aussi déplacés pour ne jamais se chevaucher avec la barre latérale droite ;
- adaptation automatique lorsque le panneau NiakGPT droit est lui-même ouvert.

### Performance / architecture

- suppression du `routeTick` périodique du cœur ;
- navigation SPA pilotée par Navigation API / clic / `popstate` ;
- rebinding des observers uniquement quand les nœuds `main` ou sidebar changent réellement ;
- suppression des retries périodiques d’indexation sur les onglets qui ne peuvent pas travailler ;
- `CLIENT → WORKER`, retour à `PRÊT`, visibilité et navigation réveillent directement la file idle ;
- plus aucun polling permanent autorisé dans les nouveaux modules coach, dossiers épinglés ou panneaux latéraux.

### QA

- nouveaux invariants anti-`routeTick`, anti-retry périodique et anti-reload Quick Open CLIENT ;
- garde de géométrie pour la barre basse ;
- garde de coexistence rail droit / Activité / Sources / Sorties ;
- garde sur les dossiers épinglés instantanés et le coach contextuel.

## 0.9.5 — RC6

### Runtime / cycle de vie

- `manifest.json` devient la source de vérité de version pour les contrôles et le packaging ;
- ajout d’un service worker MV3 minimal pour distinguer installation neuve et mise à jour ;
- une mise à jour existante n’affiche jamais de force l’onboarding ;
- packaging du service worker avec vérification explicite dans le ZIP final.

### Workspace

- onboarding first-run en 4 étapes, ignorable et réservé aux nouvelles installations ;
- profils **Power**, **Code / IDE**, **Research**, **Focus / Writing**, **Analyst** et **High Contrast** ;
- Command Palette `Ctrl+Shift+P` pour Quick Open, Control Center, Safe Mode, Explorer, TOC, diagnostic, Governance, Matrix et profils ;
- profils accessibles depuis le Control Center ;
- raccourcis clavier et dialogues avec focus trap et restauration du focus.

### Performance / architecture

- cœur, chronologie, panneau Activité, Governance et pins natifs event-driven ;
- aucun polling permanent dans les modules applicatifs principaux ;
- WORKER / CLIENT partagé entre onglets ;
- Safe Mode coupe les tâches non essentielles et fait céder le WORKER ;
- cache chaud IndexedDB des conversations lourdes et déduplication réseau inter-onglets.

### Projects

- première page d’un Project sans `cursor=0` inventé ;
- pagination uniquement avec les cursors opaques réellement renvoyés ;
- `limit=20` avec fallback sans `limit` sur `422` ;
- compteurs réels + date de dernière activité ;
- nettoyage des reliquats/doublons et resynchronisation prudente ;
- priorité absolue aux déplacements manuels vérifiés et verrouillés.

### États / DA

- `CHARGEMENT`, `ATTENTE`, `RÉFLEXION / ANALYSE`, `EXÉCUTION`, `ERREUR`, `PRÊT` partagés entre onglets ;
- couleur d’activité sur la ligne du chat, le Project et la barre basse ;
- panneau Activité harmonisé et fermeture toujours accessible ;
- Matrix plus discret et adaptable ;
- profils visuels spécialisés sans dépendre des couleurs de thème ChatGPT.

### QA / release

- Visual Lab Playwright desktop/laptop/gros fil ;
- vraie extension non empaquetée chargée dans Chromium sur un `chatgpt.com` mocké ;
- tests de compteurs, pagination, activité, verrou manuel, Safe Mode et élection multi-onglets ;
- Public Quality Gate avec ZIP installable propre, garde de confidentialité et documentation obligatoire.

## 0.9.3 — RC4

### Performance / architecture

- cœur `app-v090.js` event-driven ;
- Governance et pins natifs 0.9 sans polling permanent ;
- chronologie et polish Activity sans boucle permanente ;
- garde unique du bloc Projects pour empêcher les duplications DOM ;
- coordination WORKER / CLIENT multi-onglets ;
- Safe Mode qui cède le rôle WORKER ;
- tracker d’activité auto-résilient au `document_start`.

### Projects

- première page de conversations Project sans `cursor=0` inventé ;
- pagination uniquement avec les cursors réellement renvoyés ;
- `limit=20` + fallback sur réponse `422` ;
- compteurs réels et date de dernière activité ;
- nettoyage des reliquats et doublons ;
- priorité absolue aux déplacements manuels vérifiés.

### UX

- Control Center ;
- Safe Mode ;
- états `CHARGEMENT`, `ATTENTE`, `RÉFLEXION / ANALYSE`, `EXÉCUTION`, `ERREUR` ;
- coloration du chat et du Project actifs ;
- panneau Activité harmonisé ;
- Matrix plus discret ;
- améliorations focus/accessibilité ;
- bloc Projects compact avec section secondaire.

### QA

- Visual Lab Playwright ;
- tests desktop/laptop/gros fil ;
- tests Control Center et Safe Mode ;
- lancement de la vraie extension non empaquetée dans Chromium sur un `chatgpt.com` mocké.

## 0.9.0 — Public RC architecture

- premier Control Center ;
- nouveau coordinateur multi-onglets faible coût ;
- export/import de configuration ;
- diagnostic sans contenu de conversation ;
- Safe Mode ;
- réglages Matrix, densité, coach, activités, pins et auto-resync.

## 0.8.7

- détection d’activité soutenue par le trafic réseau ;
- réduction des faux états `PRÊT` ;
- partage des états entre onglets.

## 0.8.6

- états visuels des conversations et Projects ;
- barre basse synchronisée sur l’activité réelle.

## 0.8.5

- Project Governance ;
- verrouillage des déplacements manuels ;
- nettoyage des reliquats ;
- pins natifs gouvernés.

## 0.8.4

- cache chaud IndexedDB des conversations ;
- déduplication réseau entre onglets.

## 0.8.3

- architecture WORKER / CLIENT multi-onglets.

## 0.8.2

- tri chronologique et dates visibles dans la sidebar.

## 0.8.1

- compatibilité compteur Project après erreurs `422` ;
- finitions DA et panneau Activité.

## 0.8.0

- reconstruction idle-safe du moteur ;
- indexation Project par Project ;
- cache-first ;
- Quick Open ;
- coach, sommaire, code, Matrix et DA NiakGPT.