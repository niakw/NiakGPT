# NiakGPT 0.9.125 — compatibilité avec la nouvelle sidebar ChatGPT

> Une release de compatibilité avec la navigation ChatGPT Web remaniée.

NiakGPT 0.9.124 est sorti avant le changement majeur de sidebar ChatGPT Web observé fin septembre 2026. L’extension possédait déjà un finder géométrique robuste, mais il était initialisé trop tard : metadata, Projects, Pins et les icônes pouvaient démarrer avant lui et retomber sur des hypothèses liées à l’ancien DOM.

## Ce qui change

- Le finder v131 est maintenant initialisé avant tous les consommateurs de sidebar.
- La détection accepte les conteneurs de navigation sémantiques et la structure récente Épinglés / Projets / Récents en `sortable` ou `draggable`.
- Une sous-navigation imbriquée est remontée vers le shell gauche complet lorsque la géométrie montre qu’il ne s’agit que d’une lane interne.
- Metadata, les icônes natives et l’autorité Projects réutilisent la même détection avant leurs fallbacks historiques.
- Une fixture dédiée reproduit la structure post-septembre sans dépendre de `data-testid="conversation-sidebar"`.
- La fixture remonte aussi la navigation comme lors d’une transition SPA et vérifie que NiakGPT reste dans le shell gauche pleine largeur.
- Current Finalization exécute ce scénario sous Chromium, Firefox et WebKit.

## Limite de validation

Les gates de release valident les invariants source, le packaging et une reproduction navigateur de la nouvelle sidebar. Ils ne prétendent pas avoir exécuté cette version dans une session ChatGPT authentifiée : la politique du navigateur connecté de cette session n’autorise pas l’accès direct au DOM de chatgpt.com.
