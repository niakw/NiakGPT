# Runtime integration scenarios

Le Visual Lab ne valide pas seulement des captures statiques. `tests/runtime-extension.spec.js` charge la vraie extension non empaquetée dans Chromium sur un `https://chatgpt.com` mocké.

Les scénarios de référence couvrent notamment :

- première installation : onboarding visible, dismissible et persistant après reload ;
- upgrade : aucun onboarding forcé lorsqu’un état NiakGPT persistant existe déjà ;
- bootstrap de l’extension à `document_start` ;
- un seul bloc Projects géré par NiakGPT ;
- compteurs Projects avec première page sans cursor inventé et pagination opaque ;
- état réseau `ATTENTE` puis `RÉFLEXION / ANALYSE` ;
- déplacement natif d’un chat, vérification serveur, verrou manuel et déverrouillage explicite ;
- Safe Mode : surfaces non essentielles coupées et rôle WORKER cédé ;
- Command Palette : raccourci clavier et changement réel de profil ;
- deux onglets ChatGPT : exactement un WORKER.

Une régression sur l’un de ces comportements doit faire échouer le workflow Visual Lab plutôt que d’être masquée par une assertion plus permissive.
