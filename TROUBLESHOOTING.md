# Dépannage — NiakGPT

Ce guide cible les pannes réellement utiles à diagnostiquer : **quel module attend quoi, quel état est propriétaire, et quel comportement est sûr**.

## 1. Après une mise à jour

1. ouvrir `chrome://extensions` ;
2. cliquer **Recharger** sur NiakGPT ;
3. recharger les onglets ChatGPT déjà ouverts ;
4. vérifier que la version affichée est bien **0.9.91**.

Éviter de fusionner un ancien dossier avec un nouveau ZIP. Remplacer le dossier complet empêche de conserver des fichiers obsolètes.

## 2. Projects n’apparaît pas ou apparaît au mauvais endroit

Le comportement attendu :

- un seul `#ng8-pins` ;
- uniquement dans la vraie sidebar gauche ;
- invisible tant que le host n’a pas été vérifié par v131 ;
- catalogue scrollable indépendamment lorsque nécessaire.

Actions :

1. recharger l’extension puis l’onglet ;
2. vérifier qu’aucun ancien dossier/ancienne version n’est encore chargé ;
3. ouvrir le diagnostic NiakGPT ;
4. relever les états `pins-ui`, `sidebar-ux-119` et `ux-v131`.

Si le bloc apparaît au centre de la page ou au-dessus du shell ChatGPT, c’est une régression à signaler avec capture d’écran.

## 3. Le scroll Projects remonte tout seul

Depuis la passe v131, un geste utilisateur réel doit avoir priorité sur toute restauration de scroll déjà programmée.

À relever :

- position avant/après ;
- si le mouvement arrive pendant un refresh de cache ;
- si un Project vient d’être ouvert/fermé ;
- navigateur et OS ;
- valeur éventuelle de `data-ng121-scroll-guard` sur `<html>`.

## 4. Le bouton “…” ne répond pas

Les actions Project/chat doivent rester cliquables même après un remount React ou un retour BFCache.

Tester :

- second clic sur le même bouton : le menu doit se fermer ;
- `Escape` : le menu doit se fermer ;
- clic extérieur : le menu doit se fermer ;
- après navigation retour/avant : le bouton doit rester fonctionnel.

Si le bouton est visible mais non cliquable, joindre une capture + diagnostic. Le v131 force les hitboxes du bloc vérifié à rester actives.

## 5. Une conversation reste en chargement

Vérifier :

- le composer natif est-il monté ?
- les tours sont-ils visibles ?
- ChatGPT affiche-t-il encore un skeleton/état de chargement ?
- le diagnostic indique-t-il une erreur du tracker ?

NiakGPT doit se retirer plutôt que masquer un contenu natif non prêt.

## 6. L’état NiakGPT semble faux pendant une génération

La capsule d’état utilise plusieurs signaux :

1. requête/génération active ;
2. indices de raisonnement ;
3. croissance de réponse ;
4. bouton Stop natif ;
5. erreurs visibles.

Si l’état diverge de ChatGPT, relever :

- version NiakGPT ;
- `data-ng86-activity` sur `<html>` ;
- présence du bouton Stop ;
- même onglet ou autre onglet.

## 7. Un message “Suite en parallèle” reste dans le composer

Cela ne doit pas arriver après un envoi confirmé.

Le runtime courant retire **uniquement son propre préfixe** lorsque ChatGPT laisse un composer contrôlé visuellement rempli. Il ne doit jamais effacer un texte que l’utilisateur a modifié.

Si un ancien protocole long est encore présent :

1. recharger l’extension ;
2. recharger l’onglet ;
3. ne pas modifier le brouillon avant de vérifier s’il est nettoyé ;
4. si le texte persiste, fournir le texte exact et une capture.

## 8. Une reprise longue occupe le composer pendant que ChatGPT travaille

Cela ne doit plus arriver.

Le watchdog ne doit pas écrire sa reprise tant qu’aucun vrai contrôle **Envoyer** n’est disponible. La présence du seul bouton **Arrêter de générer** signifie que la reprise reste armée en interne, sans polluer le champ.

Fenêtre par défaut actuelle : **6 min 30**.

## 9. Un brouillon utilisateur disparaît

C’est une régression critique.

NiakGPT doit conserver :

- tout brouillon présent avant une reprise automatique ;
- tout texte modifié par l’utilisateur ;
- tout brouillon qui ne correspond plus exactement au protocole automatique connu.

Joindre immédiatement une reproduction minimale, navigateur, OS et capture.

## 10. Plusieurs onglets deviennent WORKER

Le comportement attendu est **exactement un WORKER**.

Causes possibles :

- fallback `navigator.locks` défaillant ;
- onglets restés ouverts pendant une mise à jour ;
- ancien runtime encore chargé.

Action : recharger l’extension puis tous les onglets ChatGPT.

## 11. Un gros fil ralentit

Activer **Safe Mode** depuis le Centre de contrôle.

Safe Mode doit réduire/couper les surfaces non essentielles. Si le fil reste lent, la part restante est probablement liée au rendu natif ChatGPT ou à la taille de la conversation.

## 12. Compteurs Project incomplets

`?` signifie qu’un compteur fiable n’a pas pu être établi.

`…` signifie généralement que l’indexation n’est pas terminée ou est volontairement différée.

L’indexation peut attendre si :

- l’onglet est CLIENT ;
- une génération est en cours ;
- Safe Mode est actif ;
- l’onglet est caché ;
- une autre tâche Project est déjà active.

## 13. Un chat a été reclassé après un déplacement manuel

Cela ne doit pas arriver.

Un déplacement manuel récent doit être mémorisé et protégé contre l’automatisation. Vérifier le diagnostic Governance et l’état serveur léger.

## 14. Vérification/CAPTCHA ChatGPT

NiakGPT ne contourne pas et ne manipule pas les challenges.

Pendant une vérification, les fonctions NiakGPT dépendant du bridge doivent se mettre en attente ou échouer proprement. Une reprise native n’est autorisée qu’après disparition du signal de challenge.

## 15. Quick Open ne trouve pas une conversation récente

Vérifier :

- index global terminé ;
- conversation présente dans le cache partagé ;
- création récente dans un autre onglet ;
- titre modifié ensuite par ChatGPT.

Quick Open doit rester utilisable depuis le cache sur un CLIENT.

## 16. Réinitialisation

En dernier recours :

1. exporter la configuration si nécessaire ;
2. réinitialiser les données NiakGPT depuis le Centre de contrôle ;
3. recharger l’extension ;
4. recharger ChatGPT.

La réinitialisation NiakGPT ne supprime pas les conversations/Projects stockés par ChatGPT.

## Signaler une régression

Joindre idéalement :

- version NiakGPT ;
- navigateur + version ;
- OS ;
- route concernée (accueil, Project, conversation) ;
- étapes exactes ;
- capture ;
- diagnostic anonymisé.

Ne jamais publier cookies, tokens, contenu privé ou `Authorization`.

Voir aussi [TESTING_TRUTH.md](TESTING_TRUTH.md), [SECURITY.md](SECURITY.md) et [PRIVACY.md](PRIVACY.md).

## 9. Coffre GitHub connecté mais vide

En 0.9.88, ce n’est plus un état normal : la sélection d’un dépôt privé doit écrire immédiatement un snapshot local (`PROJECTS.json` et fichiers metadata Project) sans appeler le backend ChatGPT. Si l’écriture échoue, l’UI doit afficher une erreur explicite `cached_bootstrap_write_failed` au lieu de rester indéfiniment sur « bootstrap en attente ».

L’historique complet peut rester en file pendant une discussion : cela est volontaire et n’empêche plus le coffre de contenir immédiatement le snapshot local.
