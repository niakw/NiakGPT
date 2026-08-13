# Changelog

Les changements notables de NiakGPT sont regroupés ici. Le projet est encore en phase RC : les versions 0.x peuvent faire évoluer l’architecture interne rapidement.

## 0.9.6 — Audit RC

### UX / navigation

- les Projects épinglés deviennent de vrais dossiers dépliables : clic Project = liste instantanée des conversations depuis le cache local, bouton `↗` séparé pour ouvrir la page Project complète ;
- conversations du sous-menu triées par dernière activité avec date visible et filtre local sur les gros Projects ;
- Quick Open en onglet CLIENT privilégie les liens SPA natifs au lieu d’un reload complet ;
- barre basse stabilisée : zones d’état, rôle WORKER/CLIENT, SAFE et `BY SKYNET` ne doivent plus se décaler lors des changements d’état ;
- Matrix légèrement plus visible au repos sans augmentation de cadence CPU, toujours fortement atténuée en activité/gros fil.

### Coach

- nouveau coach contextuel : le prompt courant domine le classement, Project/titre/derniers échanges servent uniquement à désambiguïser ;
- extraction de contraintes, technologies et entités réellement citées ;
- trois rôles distincts par recommandation : approche/diagnostic, angle mort/vérification, livrable/action ;
- recommandations spécialisées pour code, performance, design/UX, recherche, droit, comparaison, organisation, données et rédaction.

### Panneaux natifs

- traitement commun des panneaux **Activité**, **Sources** et **Sorties / Outputs** ;
- DA NiakGPT cohérente, header lisible et fermeture toujours accessible ;
- panneaux ouverts décalés à gauche du rail NiakGPT ;
- poignées/boutons repliés eux aussi déplacés pour ne jamais se chevaucher avec la barre latérale droite ;
- adaptation automatique lorsque le panneau NiakGPT droit est lui-même ouvert.

### Performance / architecture

- suppression du `routeTick` périodique du cœur ;
- navigation SPA pilotée par Navigation API / clic / `popstate` ;
- rebinding des observers uniquement quand les nœuds `main` ou sidebar changent réellement ;
- suppression des retries périodiques d’indexation sur les onglets qui ne peuvent pas travailler ;
- `CLIENT → WORKER`, retour à `PRÊT`, visibilité et navigation réveillent directement la file idle ;
- plus aucun polling permanent autorisé dans les nouveaux modules coach, dossiers épinglés ou panneaux latéraux.

### QA

- nouveaux invariants anti-`routeTick`, anti-retry périodique et anti-reload Quick Open CLIENT ;
- garde de géométrie pour la barre basse ;
- garde de coexistence rail droit / Activité / Sources / Sorties ;
- garde sur les dossiers épinglés instantanés et le coach contextuel.

## 0.9.5 — RC6

### Runtime / cycle de vie

- `manifest.json` devient la source de vérité de version pour les contrôles et le packaging ;
- ajout d’un service worker MV3 minimal pour distinguer installation neuve et mise à jour ;
- une mise à jour existante n’affiche jamais de force l’onboarding ;
- packaging du service worker avec vérification explicite dans le ZIP final.

### Workspace

- onboarding first-run en 4 étapes, ignorable et réservé aux nouvelles installations ;
- profils **Power**, **Code / IDE**, **Research**, **Focus / Writing**, **Analyst** et **High Contrast** ;
- Command Palette `Ctrl+Shift+P` pour Quick Open, Control Center, Safe Mode, Explorer, TOC, diagnostic, Governance, Matrix et profils ;
- profils accessibles depuis le Control Center ;
- raccourcis clavier et dialogues avec focus trap et restauration du focus.

### Performance / architecture

- cœur, chronologie, panneau Activité, Governance et pins natifs event-driven ;
- aucun polling permanent dans les modules applicatifs principaux ;
- WORKER / CLIENT partagé entre onglets ;
- Safe Mode coupe les tâches non essentielles et fait céder le WORKER ;
- cache chaud IndexedDB des conversations lourdes et déduplication réseau inter-onglets.

### Projects

- première page d’un Project sans `cursor=0` inventé ;
- pagination uniquement avec les cursors opaques réellement renvoyés ;
- `limit=20` avec fallback sans `limit` sur `422` ;
- compteurs réels + date de dernière activité ;
- nettoyage des reliquats/doublons et resynchronisation prudente ;
- priorité absolue aux déplacements manuels vérifiés et verrouillés.

### États / DA

- `CHARGEMENT`, `ATTENTE`, `RÉFLEXION / ANALYSE`, `EXÉCUTION`, `ERREUR`, `PRÊT` partagés entre onglets ;
- couleur d’activité sur la ligne du chat, le Project et la barre basse ;
- panneau Activité harmonisé et fermeture toujours accessible ;
- Matrix plus discret et adaptable ;
- profils visuels spécialisés sans dépendre des couleurs de thème ChatGPT.

### QA / release

- Visual Lab Playwright desktop/laptop/gros fil ;
- vraie extension non empaquetée chargée dans Chromium sur un `chatgpt.com` mocké ;
- tests de compteurs, pagination, activité, verrou manuel, Safe Mode et élection multi-onglets ;
- Public Quality Gate avec ZIP installable propre, garde de confidentialité et documentation obligatoire.

## 0.9.3 — RC4

### Performance / architecture

- cœur `app-v090.js` event-driven ;
- Governance et pins natifs 0.9 sans polling permanent ;
- chronologie et polish Activity sans boucle permanente ;
- garde unique du bloc Projects pour empêcher les duplications DOM ;
- coordination WORKER / CLIENT multi-onglets ;
- Safe Mode qui cède le rôle WORKER ;
- tracker d’activité auto-résilient au `document_start`.

### Projects

- première page de conversations Project sans `cursor=0` inventé ;
- pagination uniquement avec les cursors réellement renvoyés ;
- `limit=20` + fallback sur réponse `422` ;
- compteurs réels et date de dernière activité ;
- nettoyage des reliquats et doublons ;
- priorité absolue aux déplacements manuels vérifiés.

### UX

- Control Center ;
- Safe Mode ;
- états `CHARGEMENT`, `ATTENTE`, `RÉFLEXION / ANALYSE`, `EXÉCUTION`, `ERREUR` ;
- coloration du chat et du Project actifs ;
- panneau Activité harmonisé ;
- Matrix plus discret ;
- améliorations focus/accessibilité ;
- bloc Projects compact avec section secondaire.

### QA

- Visual Lab Playwright ;
- tests desktop/laptop/gros fil ;
- tests Control Center et Safe Mode ;
- lancement de la vraie extension non empaquetée dans Chromium sur un `chatgpt.com` mocké.

## 0.9.0 — Public RC architecture

- premier Control Center ;
- nouveau coordinateur multi-onglets faible coût ;
- export/import de configuration ;
- diagnostic sans contenu de conversation ;
- Safe Mode ;
- réglages Matrix, densité, coach, activités, pins et auto-resync.

## 0.8.7

- détection d’activité soutenue par le trafic réseau ;
- réduction des faux états `PRÊT` ;
- partage des états entre onglets.

## 0.8.6

- états visuels des conversations et Projects ;
- barre basse synchronisée sur l’activité réelle.

## 0.8.5

- Project Governance ;
- verrouillage des déplacements manuels ;
- nettoyage des reliquats ;
- pins natifs gouvernés.

## 0.8.4

- cache chaud IndexedDB des conversations ;
- déduplication réseau entre onglets.

## 0.8.3

- architecture WORKER / CLIENT multi-onglets.

## 0.8.2

- tri chronologique et dates visibles dans la sidebar.

## 0.8.1

- compatibilité compteur Project après erreurs `422` ;
- finitions DA et panneau Activité.

## 0.8.0

- reconstruction idle-safe du moteur ;
- indexation Project par Project ;
- cache-first ;
- Quick Open ;
- coach, sommaire, code, Matrix et DA NiakGPT.