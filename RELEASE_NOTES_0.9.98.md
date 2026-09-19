# NiakGPT 0.9.98 — Projects unique sans fuite sur les Chats

0.9.98 est une passe de régression effectuée après 0.9.97.

## Défaut retrouvé

Le self-heal local conservait une ancienne implémentation de masquage des Projects natifs. Son sélecteur « Afficher plus » était global à la sidebar : dans un état cache-only, il pouvait donc classer le bouton « Afficher plus » de la liste Chats comme s’il appartenait aux Projects.

Ce défaut a d’abord été ajouté comme test de non-régression et reproduit en CI avant modification du produit.

## Correction

- suppression de l’ancien `suppressNative()` dans le self-heal ;
- `sidebar-projects-authority-v112.js` reste l’unique propriétaire du masquage natif ;
- conservation des Chats génériques et de leurs contrôles sous le catalogue NiakGPT ;
- interdiction statique de réintroduire cette double autorité ;
- test du véritable ordre de bootstrap runtime ;
- validation d’un rattrapage automatique dépassant un batch de huit chats ;
- promotion du deep classifier au Current Finalization ;
- élargissement du workflow Project-switch réel aux fichiers d’autorité/self-heal/classement.

