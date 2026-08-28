# NiakGPT 0.9.76

0.9.76 est devenue la base **native-first v131** de NiakGPT.

## UX et Projects

- garde finale `ux-v131.js/css` : le bloc Projects n’est exposé qu’après vérification de la vraie sidebar gauche ;
- `sidebar-projects-v121.js` reste l’unique propriétaire du catalogue/placement ;
- scroll catalogue/drawers conservé pendant les refreshs, avec priorité immédiate au geste utilisateur ;
- hitboxes Project/chat durcies après remounts React et BFCache ;
- rail droit réduit à un dock discret ;
- ancienne barre plein écran remplacée par une capsule passive ;
- accueil et surfaces utilitaires débarrassés du chrome non essentiel.

## Composer et continuité

- prompteur adaptatif compact et opt-in ;
- ajout en parallèle raccourci en `↳ Suite en parallèle` ;
- nettoyage du préfixe après envoi confirmé sans effacer un brouillon modifié ;
- watchdog de travail long porté à **6 min 30** ;
- aucune reprise automatique écrite dans le composer tant qu’un vrai bouton Envoyer n’est pas disponible ;
- anciens protocoles automatiques exacts nettoyés sans toucher aux variantes modifiées par l’utilisateur ;
- continuité native de limite de fil conservant le Project exact lorsqu’il est connu.

## Robustesse

- observers Projects/actions restaurés après BFCache ;
- protection contre les restaurations de scroll obsolètes ;
- restauration async d’incident rendue race-safe ;
- actions Project/chat rendues click-ready avant la fin des décorations async.

## Validation

- static/runtime/package ;
- Chromium, Firefox et WebKit ;
- Linux, Windows et macOS ;
- extension MV3 réellement chargée dans les fixtures ;
- gate Brave stable macOS ;
- continuité parallèle, long-run, résidus composer, BFCache, scroll utilisateur, actions/remounts et UX v131.

La version du manifest reste **0.9.76**.
