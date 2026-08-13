# Changelog

Les changements notables de NiakGPT sont regroupés ici. Le projet est encore en phase RC : les versions 0.x peuvent faire évoluer l’architecture interne rapidement.

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
