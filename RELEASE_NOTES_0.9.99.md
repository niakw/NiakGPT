# NiakGPT 0.9.99 — troisième passe de régression

Cette version est une nouvelle passe d’audit réalisée après la 0.9.98, avec priorité à la suppression des chemins concurrents et au coût runtime sur les longues conversations.

## Corrections

- retrait de `sidebar-ux-v119.js` du runtime critique et du package : v121 reste le seul propriétaire du placement Projects/Pins ;
- retrait de `live-fixes-v104.js` du runtime et du package : `side-panels-v096.js` devient l’unique propriétaire JavaScript des panneaux Activité / Réflexion / Sources / Outputs ;
- reprise BFCache explicite des panneaux natifs et calcul de leur offset de rail dans le même module ;
- observer de `live-fixes-v106.js` filtré pour ignorer le DOM courant des réponses ;
- filtres de pertinence ajoutés aux observers globaux de `sidebar-icons-v114.js` et `project-memory-ui-v132.js`, afin qu’un stream de réponse ordinaire ne déclenche plus de recherche globale sidebar/Control Center ;
- exclusion stricte de `hiddenProjectIds` de toutes les destinations de classement automatique et de reconstruction des Projects principaux.
- suppression du second moteur automatique `project-governance-v090.js::autoResync()` ; les mutations automatiques appartiennent uniquement à v101/v112 et le nettoyage manuel partage le même verrou de mutation.

Le CSS historique `live-fixes-v104.css` reste empaqueté : il ne contient aucune autorité JavaScript et fournit encore des règles visuelles partagées pour les panneaux et le coach.

## Gates ajoutés

- `live-fixes-context-v106.mjs`
- `side-panels-owner-v096.mjs`
- `hidden-project-classification-v099.mjs`

Ces scénarios sont exécutés dans Current Finalization avant qu’une release soit considérée cohérente.
