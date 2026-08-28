# Confidentialité — NiakGPT

NiakGPT 0.9.76 est conçu comme une extension **local-first** pour l’interface web de ChatGPT.

## Résumé

- aucun serveur NiakGPT requis ;
- aucune analytics NiakGPT ;
- aucun SDK publicitaire ;
- aucun compte NiakGPT ;
- périmètre réseau limité à `https://chatgpt.com/*` ;
- préférences, index, gouvernance et états de reprise conservés dans le profil navigateur.

## Périmètre réseau

Le manifest autorise uniquement :

```text
https://chatgpt.com/*
```

NiakGPT utilise la session ChatGPT déjà ouverte dans le navigateur et un ensemble borné de surfaces/endpoints internes nécessaires à ses fonctions. Ces endpoints appartiennent à l’interface web de ChatGPT et peuvent évoluer.

NiakGPT n’envoie pas les données utilisateur vers un serveur NiakGPT, une plateforme publicitaire, un service d’analytics ou une API tierce.

## Données lues sur ChatGPT

Selon les fonctions activées, l’extension peut lire :

- le DOM visible de ChatGPT ;
- les titres et métadonnées de conversations ;
- les Projects accessibles à la session courante ;
- les inventaires légers nécessaires aux compteurs et classements ;
- l’état de navigation, de génération et du composer ;
- le contexte déjà présent dans le DOM pour préparer une continuité locale.

NiakGPT refuse les `GET /backend-api/conversation/{id}` complets initiés par l’extension. Le produit ne maintient pas un cache complet des conversations comme source de fonctionnement courante.

## Stockage local

NiakGPT utilise principalement :

- `chrome.storage.local` pour préférences, index, gouvernance, verrous manuels et états locaux ;
- `sessionStorage` pour certains incidents/reprises temporaires ;
- `localStorage` pour quelques miroirs de démarrage et mécanismes de coordination locale.

Ces données restent dans le profil navigateur sauf export explicite par l’utilisateur.

### Anciennes données

Des versions historiques ont pu écrire davantage de contenu en cache local, notamment via IndexedDB. Ces reliquats ne font plus partie du modèle runtime actuel et peuvent être supprimés via la réinitialisation/effacement des données NiakGPT.

## Composer, continuité et envoi automatique

Le prompteur local n’envoie jamais un prompt à lui seul.

Deux automatismes bornés peuvent toutefois déclencher un **tour ChatGPT** :

1. le watchdog de travail long peut envoyer une courte relance `↻ Reprise NiakGPT` après sa fenêtre de sécurité, uniquement si le composer est vide/sûr et qu’un vrai contrôle Envoyer est disponible ;
2. la continuité native à la limite d’un fil peut envoyer la capsule de continuité préparée dans le nouveau fil afin de conserver le travail et le Project exact lorsqu’il est connu.

Ces automatismes utilisent uniquement ChatGPT dans la session courante. Ils ne transmettent pas le contenu à un service NiakGPT externe.

Un brouillon utilisateur modifié est prioritaire et ne doit pas être effacé par le nettoyage des marqueurs automatiques.

## Synchronisation entre onglets

`BroadcastChannel`, `navigator.locks` et le stockage local peuvent coordonner plusieurs onglets ChatGPT afin d’éviter des tâches dupliquées. Cette coordination reste locale au navigateur.

## Diagnostics

**Copier diagnostic** produit un état technique destiné au support. Le diagnostic doit éviter le contenu brut des conversations et les secrets de session.

Avant de publier un diagnostic, vérifier malgré tout qu’il ne contient aucune donnée privée inutile.

## Export et suppression

L’export NiakGPT contient les préférences et, lorsqu’elle existe, la configuration locale de gouvernance. Ce n’est pas un export complet des conversations ChatGPT.

La suppression des données NiakGPT efface les données locales de l’extension ; elle ne supprime pas les conversations ou Projects stockés par ChatGPT.

## Services tiers futurs

Toute fonction future introduisant une synchronisation hors de `chatgpt.com` devra être :

- séparée du cœur local-first ;
- documentée avant activation ;
- assortie d’un consentement clair ;
- accompagnée d’une mise à jour de ce document et du modèle de sécurité.

## Voir aussi

- [SECURITY.md](SECURITY.md)
- [README.md](README.md)
- [README.fr.md](README.fr.md)
