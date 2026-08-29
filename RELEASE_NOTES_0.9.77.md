# NiakGPT 0.9.77 — Project Memory privé

NiakGPT 0.9.77 ajoute **Project Memory v132**, une continuité durable optionnelle reposant sur un dépôt GitHub privé choisi par l’utilisateur.

## Nouveautés

- connexion depuis le Centre de contrôle à un dépôt privé `owner/repository` ;
- refus automatique des dépôts publics ou archivés ;
- bootstrap des Projects ChatGPT existants non vides ;
- sauvegarde de l’historique des conversations par Project ;
- génération d’un `PROJECT_STATE.md` compact contenant l’état courant, les tâches, décisions, contraintes, architecture et contexte récent ;
- synchronisation incrémentale ensuite ;
- reprise de la queue après interruption ;
- injection du checkpoint uniquement au premier message d’un nouveau fil Project ;
- token GitHub en session par défaut, mémorisation locale optionnelle.

## Confidentialité

Le dépôt public NiakGPT n’est jamais utilisé pour la mémoire utilisateur. Les fichiers de mémoire sont lisibles par les personnes/applications ayant accès au dépôt privé GitHub ; cette version n’ajoute pas de chiffrement E2E applicatif par-dessus GitHub.

## Performance

La synchronisation est séparée du chemin normal des prompts : elle se met en pause pendant l’activité ChatGPT et l’historique complet n’est pas envoyé à chaque requête.

## Validation

- gate dédié `tools/project-memory-v132.mjs` ;
- validation statique/runtime/package ;
- fixture synthétique `test/x.md` ;
- matrices navigateur et runtime MV3 existantes conservées.
