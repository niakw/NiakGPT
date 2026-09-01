# NiakGPT 0.9.91 — sidebar remount fallback recovery

## Terrain
Cette release cible le cas observé où le cache contient encore plusieurs Projects locaux mais où ChatGPT remonte sa sidebar après l’hydratation et supprime le nœud Pins injecté.

Le runtime :
- recrée le bloc Pins dans la sidebar active quand il disparaît ;
- ne remplace plus un fallback local exploitable par un catalogue canonique vide ;
- demande explicitement au self-heal de repeupler les Projects locaux ;
- garde les Projects natifs visibles tant que l’identité canonique `g-p-*` n’est pas disponible ;
- ne génère aucun RPC ChatGPT pendant cette récupération sur une conversation visible.

## Preuve CI
Le lab `field-sidebar-cache-recovery-v090.mjs` charge maintenant l’autorité, v121, le self-heal et le garde UX v131 avec le CSS réel. Il vérifie d’abord la visibilité du fallback, remplace ensuite toute la sidebar par un clone sans `#ng8-pins`, attend la recréation automatique, puis simule l’upgrade canonique.

La CI reste une reproduction synthétique : elle valide le contrat NiakGPT, pas la stabilité future du DOM de production ChatGPT.
