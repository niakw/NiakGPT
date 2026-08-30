<div align="center">
  <img src="assets/niakgpt-logo.svg" alt="NiakGPT — Power Workspace for ChatGPT" width="760">

  <p><a href="README.md">English</a> · <strong>Français</strong></p>
  <p><strong>Un espace de travail power-user local-first pour ChatGPT.</strong></p>
  <p>Projects · performance des longs fils · continuité · navigation · productivité ciblée</p>

  <p>
    <img alt="Version" src="https://img.shields.io/badge/version-0.9.81-4fc1ff">
    <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-4ec9b0">
    <img alt="Local first" src="https://img.shields.io/badge/local--first-100%25-c586c0">
    <img alt="Analytics" src="https://img.shields.io/badge/analytics-none-dcdcaa">
    <img alt="Licence" src="https://img.shields.io/badge/license-GPL--3.0-c586c0">
  </p>
</div>

---

# NiakGPT

NiakGPT est une extension navigateur qui transforme l’interface web de ChatGPT en **véritable espace de travail pour un usage intensif et organisé par Projects**, sans remplacer ChatGPT.

Elle ajoute une couche native-first pour les Projects, la navigation, les longues conversations, la continuité, les diagnostics et la productivité locale. Les fonctions principales s’exécutent dans le navigateur : **aucun compte NiakGPT, aucune analytics NiakGPT et aucun serveur NiakGPT ne sont nécessaires**.

> **Version actuelle : 0.9.81.** L’hydratation React initiale de ChatGPT passe désormais derrière une barrière stricte avant toute mutation NiakGPT ; Project Memory reste optionnel et privé.

## Points forts

### Démarrage protégé contre les erreurs d’hydratation

Le JavaScript NiakGPT ne s’exécute plus à `document_start` : le bootstrap démarre désormais à `document_idle`, puis attend l’identité stable des nœuds hôtes, une longue période de calme DOM, deux passages idle du scheduler et plusieurs frames avant toute mutation. Un lab Chromium/Firefox/WebKit simule du travail React tardif via `MessageChannel` et échoue si NiakGPT s’active pendant une fausse période de calme.

### Projects intégrés à ChatGPT

- catalogue complet des Projects dans la vraie sidebar native gauche vérifiée ;
- conversations accessibles directement en dépliant un Project ;
- le clic sur le nom ouvre/ferme le tiroir sans navigation surprise ;
- ordre, identité DOM, focus et scroll conservés pendant les refreshs de cache, remounts React, navigation SPA et retours BFCache ;
- conversation courante, dates, compteurs et états d’attention visibles ;
- recherche locale dans les gros Projects ;
- menus Project/chat sortis du clipping de la sidebar et utilisables à la souris comme au clavier ;
- déplacements manuels et verrous de continuité prioritaires sur le classement automatique.

Les responsabilités sont volontairement séparées :

- `sidebar-projects-authority-v112.js` gère la visibilité des Projects natifs ;
- `sidebar-projects-v121.js` possède le catalogue NiakGPT et son placement ;
- `ux-v131.js` vérifie la vraie sidebar et applique les dernières gardes UX/hit-testing.

Cela évite que plusieurs modules se battent pour la même zone d’interface.

### Navigation rapide

- **Alt+K** — Quick Open pour les Projects et conversations ;
- fil d’Ariane canonique **Accueil → Project → conversation** ;
- sommaire du fil courant ;
- état local compact ;
- navigation Project-aware lors des changements de route ChatGPT.

### Performance sur les longs fils

NiakGPT réduit le travail non essentiel lorsque les conversations deviennent lourdes :

- containment de l’historique froid et traitements incrémentaux ;
- décorations réduites pendant les phases de forte activité ;
- événements ciblés à la place d’un polling global permanent ;
- Safe Mode pour couper rapidement les surfaces non essentielles ;
- guards de chargement qui se retirent lorsque le contenu natif ChatGPT n’est pas prêt.

NiakGPT **ne remplace pas globalement `window.fetch`**. Le monde MAIN est volontairement limité à `page-bridge.js`.

### Continuité et travaux longs

NiakGPT distingue trois cas :

1. **Ajout en parallèle** — un message envoyé pendant une génération active peut recevoir le marqueur compact `↳ Suite en parallèle` pour compléter le travail en cours.
2. **Reprise d’un travail long** — après la fenêtre bornée du watchdog (actuellement 6 min 30), NiakGPT peut envoyer une courte relance `↻ Reprise NiakGPT` uniquement si un vrai bouton Envoyer est disponible et que le composer peut être utilisé sans risque.
3. **Continuité à la limite d’un fil** — si ChatGPT impose un nouveau fil, NiakGPT peut transporter la capsule de continuité et conserver le Project exact lorsqu’il est connu.

Le texte utilisateur reste toujours prioritaire : un brouillon modifié n’est jamais effacé simplement parce qu’il contient encore un marqueur NiakGPT.

### Project Memory privé (optionnel)

NiakGPT 0.9.81 peut associer, depuis le Centre de contrôle, un **dépôt GitHub privé choisi par l’utilisateur** à la continuité des Projects, avec un parcours normal **Se connecter avec GitHub** puis choix du dépôt.

- connexion explicite et désactivée par défaut ;
- parcours normal **Se connecter avec GitHub → autorisation GitHub → choix du dépôt**, sans copier-coller de PAT ;
- NiakGPT crée via le manifest flow GitHub une GitHub App privée propre au profil navigateur, limitée à **Contents: write** et **Metadata: read** ;
- l’écran d’installation GitHub contrôle les dépôts autorisés et le sélecteur NiakGPT n’affiche que les dépôts privés non archivés réellement accordés ;
- un dépôt privé **neuf sans aucun commit** est initialisé automatiquement à la première connexion ;
- le dépôt sélectionné est vérifié comme **privé avant l’initialisation puis avant chaque lecture/écriture** ;
- à la première connexion, tous les Projects ChatGPT existants non vides déjà indexés par NiakGPT sont amorcés ;
- description/instructions du Project, snapshots d’historique, signaux de tâches/décisions/architecture et checkpoint compact `PROJECT_STATE.md` sont stockés sous une racine mémoire dédiée ;
- après le bootstrap, seuls les fils dont le timestamp a changé sont relus ;
- l’historique complet reste dans GitHub et **n’est pas réinjecté à chaque prompt** ;
- dans un nouveau fil du Project, NiakGPT peut ajouter une seule fois le checkpoint borné au premier message utilisateur ;
- la synchro se met en pause pendant une génération, une attente, une exécution ou une vérification ChatGPT, et une file interrompue peut reprendre ensuite.

Le dépôt public `niakw/NiakGPT` n’est jamais utilisé pour stocker la mémoire utilisateur et ses GitHub Actions ne reçoivent ni le nom du coffre ni ses identifiants. Les identifiants de la GitHub App et les éléments de renouvellement restent dans le profil navigateur local. Le fine-grained PAT reste uniquement comme fallback avancé lorsque l’installation d’une GitHub App est interdite.

### Interface discrète et native-first

La couche UX v131 retire l’effet « seconde application autour de ChatGPT » :

- aucune colonne droite réservée en permanence ;
- outils droits réduits à un petit dock à la demande ;
- ancienne barre pleine largeur remplacée par une capsule passive ;
- prompteur local compact et opt-in ;
- surfaces d’accueil/utilitaires débarrassées du chrome NiakGPT non essentiel ;
- focus visible et `prefers-reduced-motion` intégrés au contrat.

### Cœur local-first, synchro privée optionnelle

Le cœur de NiakGPT reste local-first. La version 0.9.81 déclare :

```text
storage
scripting
identity
https://chatgpt.com/*
https://api.github.com/*
https://github.com/login/*
```

Aucune télémétrie NiakGPT, aucun SDK publicitaire, aucune analytics et aucun compte cloud NiakGPT. Les endpoints GitHub ne sont utilisés **qu’après une action explicite de connexion Project Memory**. La permission `identity` pilote la fenêtre d’autorisation interactive et `github.com/login/*` sert uniquement à l’échange OAuth. Préférences, index, gouvernance et reprise restent locaux, tandis que le dépôt mémoire optionnel reste sous le contrôle de l’utilisateur.

Voir [Confidentialité](PRIVACY.md) et [Sécurité](SECURITY.md) pour le modèle exact des données, du token et du réseau.

## Installation

### Extension non empaquetée

1. Télécharger ou cloner le dépôt.
2. Ouvrir `chrome://extensions` dans Chrome, Brave ou un navigateur Chromium compatible.
3. Activer **Mode développeur**.
4. Cliquer **Charger l’extension non empaquetée**.
5. Sélectionner la racine contenant `manifest.json`.
6. Recharger les onglets ChatGPT déjà ouverts.

### Package de release

Le script de packaging fabrique un ZIP propre à partir du runtime réellement déclaré :

```bash
node tools/package-extension.mjs
```

Les labs, anciens runtimes et artefacts de test ne sont pas inclus dans le ZIP installable.

## Raccourcis

| Action | Raccourci |
|---|---:|
| Quick Open | `Alt+K` |
| Optimiseur local du prompt | `Alt+P` |
| Centre de contrôle | `Alt+,` |

## Architecture

NiakGPT est une extension **Manifest V3** avec une surface de privilèges volontairement réduite.

- **Monde MAIN :** `page-bridge.js` uniquement.
- **Monde isolé :** cache, metadata, gouvernance, classement, sidebar, navigation, continuité, UI et diagnostics.
- **Barrière de boot :** la sanitation metadata se termine avant les consommateurs downstream du cache.
- **Projects :** une autorité de visibilité, un propriétaire du catalogue/placement, une garde UX finale.
- **Multi-onglets :** coordination WORKER/CLIENT via des primitives locales du navigateur.
- **Reprise :** chemins natifs bornés ; aucun contournement de challenge et aucune boucle de reload automatique.
- **Project Memory :** runtime optionnel chargé après le cœur ; une panne backend/UI mémoire ne peut plus bloquer Projects, Pins ou leurs menus d’actions. Vérification du dépôt privé obligatoire et contexte normal limité à un checkpoint compact.

Voir [ARCHITECTURE.md](ARCHITECTURE.md) pour l’ordre runtime et les invariants détaillés.

## Tests

NiakGPT distingue explicitement les niveaux de preuve :

1. invariants statiques/runtime/package ;
2. fixtures navigateur déterministes sous Chromium, Firefox et WebKit ;
3. vraie extension MV3 chargée dans des processus navigateur contre une surface ChatGPT contrôlée ;
4. preuve ChatGPT authentifiée uniquement lorsqu’une vraie session authentifiée est effectivement utilisée.

La CI couvre Linux, Windows et macOS, les gates Chromium/Firefox/WebKit, des runs MV3 réels, les reprises/continuités ciblées et un gate macOS Brave stable.

Une fixture verte ne remplace **jamais** une capture utilisateur réelle qui la contredit. Voir [TESTING_TRUTH.md](TESTING_TRUTH.md) et le [Visual Lab](visual-lab/README.md).

## Maintenance du dépôt

- les ZIP installables sont construits uniquement à partir des fichiers runtime déclarés ;
- les anciens runtimes ne peuvent pas fuiter dans le package de release ;
- l’hygiène du dépôt bloque les fichiers générés inutiles et les runtimes racine orphelins ;
- les labs historiques de régression sont conservés volontairement ;
- l’historique GitHub Actions est purgé automatiquement une fois par semaine tout en gardant une courte fenêtre récente de diagnostic.

## Documentation

| Document | Rôle |
|---|---|
| [README.md](README.md) | README anglais |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Architecture runtime et invariants de propriété |
| [CHANGELOG.md](CHANGELOG.md) | Historique détaillé |
| [RELEASE_NOTES_0.9.81.md](RELEASE_NOTES_0.9.81.md) | Résumé de la release courante |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Diagnostic et reprise |
| [PRIVACY.md](PRIVACY.md) | Données locales et comportement réseau |
| [SECURITY.md](SECURITY.md) | Modèle de sécurité et signalement |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Règles de contribution |
| [TESTING_TRUTH.md](TESTING_TRUTH.md) | Ce que chaque niveau de test prouve réellement |

## Statut du projet

NiakGPT dépend de l’interface web ChatGPT et d’un ensemble borné d’endpoints internes utilisés par cette interface. Ils peuvent évoluer sans préavis. Le projet privilégie donc la **dégradation sûre, les responsabilités explicites et les régressions reproductibles** plutôt que les interceptions globales.

NiakGPT est un projet communautaire indépendant, non affilié à OpenAI et non approuvé par OpenAI.

## Licence

NiakGPT est distribué sous **GNU General Public License v3.0 (GPL-3.0)**. Voir [LICENSE](LICENSE).
