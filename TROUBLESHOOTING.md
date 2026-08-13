# Dépannage NiakGPT

Ce guide privilégie les diagnostics qui expliquent **quel module attend quoi**, plutôt qu’un simple état `ATTENTE` sans contexte.

## Mise à jour locale

Après avoir remplacé le dossier de l’extension :

1. ouvrir `chrome://extensions` ;
2. cliquer **Recharger** sur NiakGPT ;
3. recharger les onglets ChatGPT déjà ouverts ;
4. vérifier la version dans la barre basse.

Éviter de fusionner un ancien dossier avec un nouveau ZIP : remplacer le dossier complet permet de ne pas conserver d’anciens fichiers inutiles.

## Une conversation reste sur CHARGEMENT

Vérifier :

- le composer est-il monté ?
- les tours de conversation sont-ils visibles ?
- ChatGPT lui-même affiche-t-il encore un skeleton/chargement ?
- le diagnostic indique-t-il une erreur du tracker ?

Le tracker NiakGPT est conçu pour survivre à `document_start`, même lorsque `<body>` n’existe pas encore. Un état `CHARGEMENT` permanent est donc une régression à signaler.

## La barre basse affiche PRÊT alors que ChatGPT travaille

Les sources d’état sont :

1. requête de génération détectée → `ATTENTE` ;
2. réponse réseau/indices de raisonnement → `RÉFLEXION / ANALYSE` ;
3. croissance de la réponse → `EXÉCUTION` ;
4. erreur visible → `ERREUR`.

Si la barre et la sidebar divergent, relever :

- version NiakGPT ;
- état `data-ng86-activity` sur `<html>` ;
- présence du bouton Stop natif ;
- si la génération se produit dans le même onglet ou un autre.

## Plusieurs onglets deviennent WORKER

Le comportement attendu est **exactement un WORKER**.

Causes possibles :

- navigateur sans support `navigator.locks` et fallback défaillant ;
- onglets ouverts pendant une mise à jour de l’extension ;
- ancien script encore chargé dans un onglet non rechargé.

Action : recharger l’extension puis tous les onglets ChatGPT. Si le problème persiste, copier le diagnostic des deux onglets.

## Un gros fil ralentit

Activer **Safe Mode** depuis le Centre de contrôle.

Safe Mode doit couper :

- Matrix ;
- coach ;
- animations ;
- pins natifs ;
- auto-resync ;
- rôle WORKER.

Si le fil reste lourd en Safe Mode, la part restante est probablement principalement liée au rendu ChatGPT lui-même ou à la taille du fil.

## Le nombre de chats d’un Project affiche ?

`?` signifie que le Project n’a pas pu être compté de façon fiable.

Le chemin attendu :

- première requête sans cursor ;
- `limit=20` ;
- pages suivantes avec cursor opaque renvoyé par ChatGPT ;
- fallback sans `limit` si le backend retourne `422`.

Ne jamais corriger ce problème en ajoutant arbitrairement `cursor=0`.

## Le nombre reste …

`…` indique généralement que l’indexation du Project n’est pas encore passée.

Elle peut être volontairement différée si :

- l’onglet est CLIENT ;
- une génération est en cours ;
- Safe Mode est actif ;
- l’onglet est caché ;
- un autre Project est en cours d’indexation.

## Le bloc Projects apparaît plusieurs fois

Il doit exister **exactement un** `#ng8-pins`.

`sidebar-host-v090.js` est chargé pour réparer automatiquement :

- les hosts en dehors de la sidebar ;
- les doublons créés par une ancienne session ;
- les changements de structure de la sidebar.

Si plusieurs blocs persistent après reload complet, il s’agit d’une régression runtime.

## Un chat a été reclassé après un déplacement manuel

Cela ne doit pas arriver.

Un déplacement manuel doit :

1. être détecté ;
2. être relu côté serveur ;
3. recevoir un verrou local ;
4. afficher un cadenas ;
5. être exclu de l’auto-resync.

Si le cadenas n’apparaît pas, vérifier le diagnostic Governance et la destination serveur réelle.

## Le cadenas bloque un chat que je veux reclasser automatiquement

Cliquer explicitement sur le cadenas pour retirer le verrou. À partir de ce moment seulement, la conversation redevient candidate à l’automatisation.

## Les pins natifs ne se synchronisent pas

La synchro est volontairement suspendue lorsque :

- l’onglet n’est pas WORKER ;
- une génération est en cours ;
- Safe Mode est actif ;
- la fonction pins est désactivée ;
- l’onglet est caché.

NiakGPT ne doit annoncer un pin natif qu’après vérification dans l’interface native.

## Quick Open ne trouve pas un chat récent

Vérifier :

- si l’index global a terminé sa mise à jour ;
- si le chat existe dans le cache partagé ;
- si la conversation vient d’être créée dans un autre onglet ;
- si le titre a été mis à jour par ChatGPT après création.

Quick Open doit rester utilisable depuis le cache même sur un CLIENT.

## Le coach n’apparaît pas

Le coach est volontairement caché lorsque :

- le prompt contient trop peu de texte ;
- le composer n’est pas encore monté ;
- une phase active lourde est en cours ;
- Safe Mode est actif ;
- le réglage coach est désactivé.

Il ne doit jamais recouvrir le champ de saisie ou les pièces jointes.

## Le panneau Activité est difficile à fermer

NiakGPT ajoute un bouton de fermeture accessible au panneau détecté. Si le bouton n’apparaît plus, ChatGPT a probablement changé la structure du panneau.

Relever le texte/titre du panneau et, si possible, son `data-testid`/rôle plutôt que de créer un sélecteur basé sur une classe CSS générée.

## Les couleurs ChatGPT reviennent

NiakGPT force ses propres surfaces et variables, mais ChatGPT peut introduire de nouveaux composants qui n’utilisent pas les variables existantes.

Lors d’une régression, identifier le composant précis :

- bulle utilisateur ;
- bouton d’envoi ;
- icône Project ;
- menu ;
- focus ring ;
- panneau Activité.

Éviter un override global de tous les boutons : cibler le composant concerné.

## Cache chaud incohérent

Depuis le Centre de contrôle : **Purger cache chaud**, puis recharger.

Le cache chaud est une accélération. Une purge ne doit pas supprimer les conversations ChatGPT.

## Index Projects incohérent

Utiliser **Reconstruire l’index**. Cela efface l’index NiakGPT et le reconstruit progressivement ; cela ne supprime pas les Projects ChatGPT.

## Réinitialiser uniquement l’apparence

Utiliser **Réinitialiser préférences** dans le Centre de contrôle. Les verrous manuels et la gouvernance doivent rester conservés.

## Effacement complet NiakGPT

La commande d’effacement complet supprime les données locales NiakGPT après double confirmation.

Elle ne doit pas supprimer les conversations/Projects stockés par ChatGPT.

## Diagnostic à partager

Utiliser **Copier diagnostic**.

Avant partage, vérifier qu’il contient uniquement des métadonnées techniques. Ne jamais partager :

- cookies ;
- jetons ;
- contenu brut de `/api/auth/session` ;
- conversations privées ;
- exports complets non anonymisés.

## Après une mise à jour de ChatGPT

Si plusieurs fonctions cessent de fonctionner simultanément :

1. vérifier d’abord la structure DOM et les endpoints internes ;
2. reproduire dans le Visual Lab si possible ;
3. ajouter une fixture correspondant à la nouvelle structure ;
4. corriger le runtime ;
5. faire passer le test unpacked réel ;
6. refaire le Public Quality Gate.

Le but n’est pas de masquer rapidement le symptôme par un scan plus large, mais de rétablir une hypothèse précise et testée.
