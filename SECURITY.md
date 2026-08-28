# Sécurité — NiakGPT

## Modèle de sécurité

NiakGPT 0.9.76 s’exécute uniquement sur `https://chatgpt.com/*` et utilise la session ChatGPT déjà ouverte dans le navigateur.

L’extension ne demande pas de clé API OpenAI et ne stocke volontairement ni cookie de session ni jeton d’accès dans un serveur NiakGPT externe.

## Permissions

Le manifest courant demande uniquement :

```text
storage
scripting
https://chatgpt.com/*
```

Toute nouvelle permission Chrome ou tout nouveau domaine dans `host_permissions` est une modification de sécurité et doit être justifié, documenté et testé explicitement.

## Endpoints internes ChatGPT

Certaines fonctions utilisent des endpoints internes employés par l’interface web de ChatGPT. Ils ne constituent pas une API publique garantie.

Règles :

- chemins bornés par le bridge ;
- pas de remplacement global de `window.fetch` ;
- réponses inhabituelles traitées comme échec, pas comme réussite implicite ;
- déduplication/circuit breaker sur les chemins concernés ;
- **tout GET complet `/backend-api/conversation/{id}` initié par NiakGPT est refusé avant réseau** ;
- mutation sensible suivie d’une convergence/vérification adaptée lorsqu’elle est disponible.

## Project Governance

Un déplacement automatisé de conversation :

1. passe par les gardes Governance ;
2. cible une destination exacte ;
3. utilise l’accusé de réception de la mutation ;
4. met à jour l’état local avec une autorité temporelle cohérente ;
5. laisse les inventaires légers confirmer la convergence globale.

Une action manuelle récente reste prioritaire sur l’automatisation.

NiakGPT n’invente pas d’endpoint de suppression de Project et ne doit jamais lancer une mutation destructive non observée/certifiée.

## Injection, DOM et HTML

Les données dynamiques issues de titres, Projects et métadonnées sont insérées avec des primitives sûres lorsque du HTML n’est pas nécessaire.

Les modules doivent préférer `textContent` et éviter toute interpolation HTML de contenu utilisateur non maîtrisé.

## Automatisation du composer

Le prompteur est opt-in et n’envoie rien automatiquement.

Les automatismes de continuité/reprise sont bornés :

- aucun envoi si un brouillon utilisateur est présent ou a été modifié ;
- aucun envoi tant qu’un vrai contrôle Envoyer n’est pas disponible ;
- nettoyage limité aux marqueurs automatiques exacts connus ;
- commandes explicites d’arrêt/annulation prioritaires ;
- pas de boucle de reload automatique.

## Vérifications, challenges et sécurité du service

NiakGPT ne contourne jamais un challenge, CAPTCHA ou iframe de vérification ChatGPT.

Pendant une vérification native, les requêtes NiakGPT doivent se mettre en attente/échouer proprement. Une reprise native éventuelle ne peut être tentée qu’après disparition du signal de challenge.

## Données locales sensibles

Les index et états locaux doivent être traités comme des données privées du profil navigateur. Un utilisateur ou logiciel ayant accès au profil navigateur peut potentiellement lire ces données.

Les fixtures, logs et artefacts CI ne doivent contenir ni conversation réelle, ni Project privé, ni cookie, ni token.

## Secrets à ne jamais publier

Ne jamais joindre à une issue, PR ou diagnostic public :

- cookies de session ;
- en-têtes `Authorization` ;
- contenu brut de `/api/auth/session` ;
- exports de conversation non anonymisés ;
- identifiants privés inutiles ;
- données personnelles non nécessaires à la reproduction.

## Signaler une vulnérabilité

Pour un problème non sensible, ouvrir une issue avec :

- version NiakGPT ;
- navigateur/version ;
- étapes minimales ;
- résultat attendu/observé ;
- diagnostic anonymisé.

Pour une vulnérabilité ou un rapport contenant des informations sensibles, utiliser un canal privé de sécurité GitHub lorsqu’il est disponible au lieu d’une issue publique.

## Voir aussi

- [PRIVACY.md](PRIVACY.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [TESTING_TRUTH.md](TESTING_TRUTH.md)
