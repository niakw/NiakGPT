# Confidentialité — NiakGPT

NiakGPT est conçu comme une extension **local-first** pour l’interface web de ChatGPT.

## Périmètre réseau

Le manifest limite l’extension à :

```text
https://chatgpt.com/*
```

NiakGPT n’envoie pas de données vers un serveur NiakGPT, un service d’analytics, une plateforme publicitaire ou une API tierce.

## Données auxquelles l’extension accède

Pour fournir ses fonctions, NiakGPT peut lire sur `chatgpt.com` :

- le DOM visible de ChatGPT ;
- les métadonnées des conversations et Projects accessibles à la session courante ;
- certaines réponses des endpoints internes de ChatGPT utilisés par l’interface web ;
- l’état de navigation, de génération et du composer.

Le cache chaud peut contenir localement la réponse JSON d’une conversation déjà chargée.

## Stockage local

NiakGPT utilise notamment :

- `chrome.storage.local` pour les préférences, l’index Projects/chats, la gouvernance et les verrous manuels ;
- `IndexedDB` pour le cache chaud des conversations ;
- `localStorage` pour quelques miroirs/états locaux nécessaires au démarrage rapide et à la coordination multi-onglets.

Ces données restent dans le profil navigateur local sauf action explicite de l’utilisateur, par exemple un export de configuration.

## Cache chaud

Le cache chaud est volontairement limité :

- jusqu’à 5 conversations ;
- environ 96 Mo au total ;
- expiration après environ 6 heures ;
- éviction des entrées anciennes lorsque nécessaire.

Le Centre de contrôle permet de le purger.

## Synchronisation entre onglets

`BroadcastChannel` et `navigator.locks` peuvent être utilisés pour coordonner les onglets ChatGPT et éviter le travail réseau/DOM dupliqué. Cette coordination reste locale au navigateur.

## Diagnostics

La fonction **Copier diagnostic** produit un résumé technique des états NiakGPT. Elle est conçue pour ne pas inclure le contenu des conversations.

## Export de configuration

L’export contient les préférences NiakGPT et, lorsqu’elle existe, la configuration locale de Project Governance. Il ne doit pas être considéré comme un export du contenu des conversations ChatGPT.

## Suppression des données

Le Centre de contrôle propose :

- purge du cache chaud ;
- reconstruction de l’index ;
- réinitialisation des préférences ;
- effacement complet des données locales NiakGPT avec double confirmation.

La suppression des données locales NiakGPT ne supprime pas les conversations ou Projects stockés chez ChatGPT.

## Services tiers

NiakGPT n’intègre actuellement aucun service tiers, aucune télémétrie et aucune dépendance réseau nécessaire à son fonctionnement après installation.

## Évolution

Toute future fonction qui introduirait une transmission de données hors de `chatgpt.com` devrait être documentée explicitement et nécessiter une réévaluation de cette politique avant publication.
