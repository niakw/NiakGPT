# Contribuer à NiakGPT

NiakGPT vise une expérience power-user dense sans faire payer cette puissance par un runtime lourd ou imprévisible. Les contributions sont donc évaluées autant sur leur **coût permanent** et leur **réversibilité** que sur leur résultat visuel.

## Avant de modifier le runtime

Lire :

- [`ARCHITECTURE.md`](ARCHITECTURE.md) ;
- [`PRIVACY.md`](PRIVACY.md) ;
- [`SECURITY.md`](SECURITY.md) ;
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

## Règles non négociables

### ChatGPT uniquement

Ne pas ajouter de domaine à `host_permissions` sans nécessité explicite et revue de confidentialité/sécurité.

### Pas de télémétrie silencieuse

Aucune analytics, aucun pixel, aucun serveur NiakGPT, aucune transmission externe implicite.

### Manuel > automatique

Ne jamais modifier une conversation verrouillée manuellement sans action explicite de l’utilisateur.

### Ne pas inventer des APIs

Les endpoints internes sont fragiles. Une fonction basée sur un endpoint nouveau doit être :

- observée sur l’interface réelle ;
- limitée à un chemin précis dans le bridge ;
- testée avec un comportement d’échec sûr ;
- vérifiée après écriture lorsque c’est pertinent.

### Pas de polling global

Une nouvelle fonction ne doit pas introduire un `setInterval` qui rescane le document ou la sidebar.

Préférer événements, mutations ciblées, storage changes, BroadcastChannel et travail idle.

## Données privées

Ne jamais committer :

- nom réel d’un utilisateur ;
- adresse e-mail personnelle ;
- noms de Projects privés ;
- contenu de conversation réel ;
- cookies ou jetons ;
- exports bruts de session.

Les fixtures du Visual Lab doivent utiliser des noms génériques.

## Direction artistique

La couleur doit transmettre de l’information :

- Project ;
- état d’activité ;
- sélection ;
- niveau de priorité.

Éviter de transformer chaque surface en accent différent. La DA doit rester cohérente avec une logique de workspace/IDE.

Lors d’un changement visuel important, ajouter ou mettre à jour une scène Playwright et inspecter le screenshot généré.

## Accessibilité

Tout contrôle custom interactif doit avoir :

- un nom accessible ;
- un focus visible ;
- un usage clavier raisonnable ;
- un état ARIA si l’apparence masque l’élément natif ;
- une fermeture accessible pour les dialogues.

Les dialogues doivent restituer le focus lorsque c’est possible.

## Performance

Pour toute nouvelle fonctionnalité qui réagit au DOM, demander :

1. Est-ce que l’événement existe déjà ?
2. Peut-on écouter uniquement le conteneur concerné ?
3. Le travail peut-il être reporté en idle ?
4. Un CLIENT doit-il vraiment l’exécuter ?
5. Safe Mode doit-il la désactiver ?
6. Quel est son comportement sur un fil de 80+ tours ?

## Tests locaux

### Invariants

```bash
node tools/check-runtime.mjs
```

### Syntaxe

Les fichiers réellement chargés par le manifest doivent passer `node --check`.

### Visual Lab

```bash
cd visual-lab
npm ci
npx playwright install chromium
npm test
```

Le Visual Lab inclut des tests avec la vraie extension unpacked chargée dans Chromium.

### Packaging

```bash
node tools/package-extension.mjs
```

Le ZIP installable doit :

- avoir `manifest.json` à sa racine ;
- ne contenir aucun fichier de test ;
- ne contenir aucun ancien moteur inactif ;
- inclure tous les scripts déclarés dans le manifest, y compris le service worker.

## Modifier un sélecteur ChatGPT

Éviter les sélecteurs basés sur des classes CSS générées lorsqu’un `data-testid`, un attribut ARIA, un href stable ou une structure sémantique existe.

Si un sélecteur critique change :

- ajouter une fixture/reproduction ;
- tester l’absence de faux positifs ;
- prévoir un fallback raisonnable ;
- ne pas étendre un sélecteur à tout le document juste pour « être sûr ».

## Ajouter une automatisation

Une automatisation doit toujours préciser :

- quelles conversations sont candidates ;
- quelles conversations sont protégées ;
- le seuil de confiance ;
- le comportement ambigu ;
- la vérification de résultat ;
- son comportement multi-onglets ;
- son comportement Safe Mode.

## Versions

Le manifest est la source de vérité de la version runtime. La documentation dérivée doit être synchronisée automatiquement plutôt que modifiée à plusieurs endroits manuellement.

## Critère d’acceptation

Une contribution importante n’est pas « finie » parce qu’elle fonctionne sur une capture ou une seule session.

Elle doit idéalement passer :

- invariants statiques ;
- tests visuels concernés ;
- tests unpacked réels concernés ;
- packaging ;
- Public Quality Gate avant release.
