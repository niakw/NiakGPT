# Confidentialité — NiakGPT

NiakGPT est conçu comme une extension **local-first** pour l’interface web de ChatGPT.

## Périmètre réseau

Le manifest limite l’extension à :

```text
https://chatgpt.com/*
```

NiakGPT 0.9.52 n’envoie pas de données vers un serveur NiakGPT, un service d’analytics, une plateforme publicitaire ou une API tierce. Le prompteur adaptatif fonctionne localement et n’effectue aucun appel réseau.

## Données auxquelles l’extension accède

Pour fournir ses fonctions, NiakGPT peut lire sur `chatgpt.com` :

- le DOM visible de ChatGPT ;
- les métadonnées des conversations et Projects accessibles à la session courante ;
- les inventaires légers nécessaires aux Projects, dates et classements ;
- l’état de navigation, de génération et du composer.

Depuis 0.9.48, NiakGPT refuse les `GET /backend-api/conversation/{id}` complets initiés par l’extension. La continuité d’un fil et le prompteur utilisent le contenu déjà présent dans le DOM et les métadonnées locales disponibles.

## Stockage local

NiakGPT utilise principalement :

- `chrome.storage.local` pour les préférences, l’index Projects/chats, la gouvernance, les verrous manuels et l’état des conversations OUT ;
- `sessionStorage` pour la capsule temporaire de continuité lors de l’ouverture d’un nouveau fil ;
- `localStorage` pour quelques miroirs/états locaux nécessaires au démarrage rapide et à la coordination multi-onglets.

Ces données restent dans le profil navigateur local sauf action explicite de l’utilisateur, par exemple un export de configuration.

### Anciennes données de cache

Des versions antérieures à 0.9.48 pouvaient créer un cache IndexedDB contenant des réponses complètes de conversation. La 0.9.52 ne lit plus, ne remplit plus et ne dépend plus de ce cache. Une purge des données NiakGPT permet de supprimer ces reliquats locaux.

## Continuité des fils

Quand NiakGPT détecte qu’un fil est arrivé à sa limite, il peut enregistrer localement une capsule de continuité composée du Project, du titre, de l’URL source, des instructions Project disponibles et de l’historique déjà présent dans le DOM. Si l’historique est très long, la capsule conserve la tête et la fin dans une limite d’environ 30 000 caractères.

La capsule est injectée dans le composer du nouveau fil **sans envoi automatique**.

## Synchronisation entre onglets

`BroadcastChannel` et `navigator.locks` peuvent être utilisés pour coordonner les onglets ChatGPT et éviter le travail réseau/DOM dupliqué. Cette coordination reste locale au navigateur.

## Diagnostics

La fonction **Copier diagnostic** produit un résumé technique des états NiakGPT. Elle est conçue pour ne pas inclure le contenu brut des conversations.

## Export de configuration

L’export contient les préférences NiakGPT et, lorsqu’elle existe, la configuration locale de Project Governance. Il ne doit pas être considéré comme un export du contenu des conversations ChatGPT.

## Suppression des données

Le Centre de contrôle propose des opérations de reconstruction/réinitialisation et l’effacement des données locales NiakGPT avec confirmation.

La suppression des données locales NiakGPT ne supprime pas les conversations ou Projects stockés chez ChatGPT.

## Services tiers

NiakGPT n’intègre actuellement aucun service tiers, aucune télémétrie et aucune dépendance réseau nécessaire à son fonctionnement après installation.

## Évolution vers le SaaS

Toute future fonction Supporter/Plus qui introduirait une synchronisation hors de `chatgpt.com` devra être isolée du cœur Free local, documentée explicitement et soumise à un consentement distinct avant activation.
