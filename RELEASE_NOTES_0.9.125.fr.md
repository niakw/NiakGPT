# NiakGPT 0.9.125 — compatibilité avec la refonte ChatGPT Web

> Release de compatibilité pour la nouvelle sidebar, le renderer de conversation groupé et le composer ProseMirror.

## Ce qui change

- Une autorité canonique de sidebar, fondée sur la géométrie et la sémantique, démarre désormais avant Projects, Pins et les consommateurs de métadonnées.
- Le finder reconnaît les conteneurs de navigation sémantiques ainsi que les lanes Épinglés, Projets et Récents en sortable/draggable.
- Une section Épinglés mixte conserve les chats épinglés ordinaires ; NiakGPT ne masque que les lignes Project natives qu'il remplace.
- Le nouveau `host-dom-v125.js` normalise l'ancien rendu `conversation-turn-*` et le renderer groupé `data-turn-key` / `data-content-search-unit-key`.
- Le suivi d'activité, les en-têtes des tours, les gardes de performance/chargement, la continuité, les interruptions, le scroll, Coach et Project Memory utilisent cet adaptateur commun.
- Le nouvel éditeur ProseMirror `data-composer-markdown` est reconnu par le runtime, le boot, le bridge MAIN, le watchdog de longue exécution et le handoff de continuité.
- Les régressions cross-engine couvrent les remounts de sidebar et une conversation ne contenant aucun des anciens sélecteurs de tours/composer.

## Limite de validation

La CI GitHub valide les invariants source, le package et des reproductions navigateur sous Chromium, Firefox et WebKit. La politique du navigateur connecté de cette session ne permet pas d'inspecter directement un onglet ChatGPT authentifié ; cette dernière validation réelle n'est donc pas revendiquée ici.
