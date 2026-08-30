# NiakGPT 0.9.78 — Project Memory hotfix

0.9.78 corrige deux régressions visibles de 0.9.77.

## Projects/sidebar

Project Memory est désormais **strictement optionnel**. Le runtime critique Projects/Pins/actions se charge et répond avant tout chargement mémoire. Une panne du backend GitHub, du script mémoire ou de son UI ne peut plus faire échouer le bootstrap principal.

## Dépôt GitHub privé neuf

Un dépôt privé sans aucun commit ni ref (cas normal juste après création) est initialisé automatiquement avec son premier commit/ref.

En cas d’échec de connexion :
- les valeurs du formulaire restent visibles ;
- le token n’est pas effacé de l’UI avant succès ;
- token/configuration ne sont pas persistés comme connexion valide ;
- un bouton de retry est immédiatement disponible.

## Validation renforcée

Les labs reproduisent maintenant explicitement :
- backend Project Memory qui plante au boot ;
- scripts mémoire qui échouent à s’injecter ;
- dépôt privé zéro commit ;
- connexion GitHub refusée visible dans l’UI ;
- retour immédiat à Pins/Projects et aux menus `...` après cet échec.

Ces scénarios rejoignent la matrice Chromium / Firefox / WebKit et Current Finalization.


## Stabilité ChatGPT / affichage sidebar

- les lignes Project ont désormais deux zones physiques explicites : titre/drawer et action `...`, avec contrôle human UX du hit-test, alignement et overflow ;
- le message `Nos systèmes effectuent quelques vérifications …` suspend immédiatement les requêtes NiakGPT ; aucune tentative de contournement n’est effectuée ;
- `Connexion interrompue. En attente de la réponse complète.` suspend également les RPC et Project Memory ;
- le brouillon et la fin de la réponse assistant déjà reçue sont conservés en session chiffrée ;
- au retour, NiakGPT utilise au plus une fois la reprise native ChatGPT lorsqu’elle existe ; sinon il propose une continuité exacte à partir de la fin reçue, sans envoi automatique ;
- la suite de régression inclut désormais ces deux textes exacts sur Chromium, Firefox et WebKit.
