# NiakGPT 0.9.97 — Projects unique, Chats séparés, classification restaurée

Cette release part du défaut observé dans la sidebar réelle : le menu Projects natif pouvait rester visible pendant qu’un second bloc NiakGPT apparaissait décalé dans une sous-colonne, tandis que les identités Projects restaient locales et empêchaient le reclassement automatique.

## Ce qui change

- #ng8-pins est forcé à occuper toute la lane de la sidebar, même si ChatGPT introduit un parent display:grid.
- Le finder choisit le vrai shell gauche et non un wrapper interne simplement nommé « sidebar ».
- L’autorité Projects native se limite au vrai shell de conversation.
- Le self-heal reconnaît les liens Projects relatifs et absolus et récupère les IDs canoniques g-p-*.
- La récupération locale masque immédiatement le doublon natif, tandis que la section Chats reste indépendante.
- Les conversations non organisées déjà stabilisées sont à nouveau classées automatiquement dès que la quarantaine « conversation visible = zéro trafic NiakGPT » est levée.

## Preuve

visual-lab/user-reported-v133.mjs contient désormais un scénario reproduisant la géométrie à deux colonnes et l’état cache-only. Il échoue si le menu natif reste visible, si NiakGPT est demi-largeur/décalé, si un Chat générique fuit dans Projects, si les IDs canoniques ne reviennent pas ou si le reclassement ne produit pas exactement une mutation ciblée.
