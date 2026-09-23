# NiakGPT 0.9.124 — Project Memory sait enfin quand s’arrêter

> **Une release de fiabilité pour celles et ceux qui utilisent ChatGPT comme un véritable espace de travail.**  
> La 0.9.124 permet à Project Memory de converger proprement, d’arrêter les reprises qui ne peuvent plus progresser automatiquement et d’afficher une progression fidèle à la réalité.

NiakGPT est conçu pour le travail au long cours : beaucoup de Projects, de longues conversations, de la continuité entre plusieurs fils et, si tu le souhaites, une mémoire privée que tu contrôles.

La version **0.9.124** renforce directement cette promesse : **lorsque Project Memory a terminé tout ce qu’il peut réellement traiter automatiquement, il s’arrête désormais proprement au lieu de tourner en boucle.**

---

## ⚡ Le changement principal

Avant la 0.9.124, un Project pouvait alterner entre :

```text
Transfert prioritaire 96% · conversation 22/23
```

et :

```text
Transfert prioritaire en attente · 1 Project(s)
```

Le compteur serveur pouvait annoncer davantage de conversations que le cache courant n’en rendait réellement disponibles. NiakGPT interprétait alors cet écart stable comme du travail restant et recréait la queue.

**La 0.9.124 change cette règle :** un écart d’inventaire stable devient un signal de réparation borné — jamais une permission de relancer indéfiniment.

---

## ✨ Ce qui change

| | Comportement 0.9.124 |
| --- | --- |
| **✅ Convergence automatique** | Un écart stable est observé, réparé de façon bornée puis passe en `inventory-stalled` au lieu de recréer éternellement la queue. |
| **📊 Progression fidèle** | Une conversation déjà placée dans la pile de retry manuel compte comme traitée pour la passe automatique ; un seul chat en quarantaine ne bloque plus artificiellement 22/23 ou 96 %. |
| **🔁 Reprise sur vrai changement** | Le Project ne redevient éligible que lorsque la signature réelle de son inventaire/cache évolue. |
| **🧯 Plus de boucle cachée** | Une fois le gap stable classifié, la queue persistante est supprimée et le mode prioritaire s’arrête. |
| **🧠 Archive cohérente** | Une conversation en quarantaine reste bien incomplète jusqu’à sa récupération ; elle cesse simplement de bloquer le reste du travail automatique. |
| **🧪 Régression couverte** | Les gates Chromium reproduisent les scénarios de gap stable et de chat en quarantaine et exigent une convergence vers `idle`. |

---

## 🧠 Pourquoi c’est important

Project Memory n’a pas de valeur simplement parce qu’il sait copier une conversation une fois. Il devient utile lorsqu’il peut servir de **couche de continuité durable** sans se battre en permanence contre le navigateur, ChatGPT ou sa propre logique de reprise.

Avec la 0.9.124 :

- le travail automatique possède une vraie condition de fin ;
- les conversations exceptionnelles restent visibles sans empoisonner toute la queue ;
- un vrai changement d’inventaire peut naturellement réveiller le Project plus tard ;
- l’archive reste privée et contrôlée par l’utilisateur ;
- l’usage normal de ChatGPT n’est plus retenu par une synchronisation qui n’a plus rien de nouveau à accomplir.

Project Memory se comporte ainsi davantage comme une brique fiable du workspace que comme un simple script d’import en arrière-plan.

---

## 🔒 Privé par conception

Project Memory reste **optionnelle et désactivée par défaut**.

Lorsqu’elle est activée, NiakGPT écrit les archives uniquement dans un **dépôt GitHub privé choisi par l’utilisateur**. Le dépôt public NiakGPT ne devient jamais une destination mémoire, et NiakGPT ne nécessite ni compte cloud propriétaire, ni analytics, ni télémétrie.

L’historique complet reste dans le dépôt privé. La continuité normale utilise uniquement un état compact et borné lorsque cela est nécessaire.

---

## 🧪 Validation de release

La release couvre désormais explicitement :

- déduplication des alias Project ;
- écarts stables entre compteur connu et conversations réellement présentes ;
- convergence du transfert prioritaire ;
- progression avec conversation mise en quarantaine ;
- retour à `idle` après la dernière unité de travail automatique ;
- suppression de la queue et `prioritySync:false` après convergence.

Le contrat est simple : **un Project qui ne peut plus progresser automatiquement ne doit plus prétendre qu’il le peut.**

---

## 🚀 NiakGPT en une phrase

**NiakGPT transforme ChatGPT en workspace local-first pour les Projects, les longues conversations, la continuité et la mémoire privée optionnelle — sans remplacer l’expérience native de ChatGPT.**

### Mise à jour

Aucune migration manuelle n’est requise pour la 0.9.124. Recharge simplement l’extension et les onglets ChatGPT déjà ouverts après la mise à jour.

Voir aussi : [CHANGELOG.md](CHANGELOG.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [PRIVACY.md](PRIVACY.md)
