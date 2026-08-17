# NiakGPT Visual Lab

Environnement local de contrôle visuel et runtime pour NiakGPT. Il ne fait pas partie du package de l'extension et ne s'exécute jamais sur ChatGPT en production.

Le labo charge les CSS/JS du **checkout courant** sur des fixtures qui reproduisent les zones importantes de ChatGPT : sidebar, Projects, Récents, conversation, gros fils, code, composer, coach, Activité/Réflexion/Sources/Sorties, barre d'état, multitab et Project Governance.

## Suites

```bash
cd visual-lab
npm ci
npx playwright install chromium
npm run test:current
```

`test:current` est la gate de production : elle liste explicitement les specs applicables au runtime actuel. Aucun test actif n'est masqué par un `grep-invert` générique.

Les deux specs `hotcache-*` sont **conservées comme historique** parce que le hotcache MAIN-world a été retiré du runtime à partir de 0.9.49. Elles restent exécutables séparément :

```bash
npm run test:legacy-hotcache
```

Elles documentent l'ancienne architecture mais ne constituent plus une exigence du package actuel. Elles ne doivent pas être supprimées du dépôt.

## Scènes

Les paramètres d'URL permettent de reproduire rapidement des états :

- `?state=ready`
- `?state=loading`
- `?state=waiting`
- `?state=thinking`
- `?state=executing`
- `?state=error`
- `?scene=heavy&state=executing`
- `?scene=activity&state=executing`
- `?scene=governance`

## Exploration manuelle

```bash
npm run serve
```

Puis ouvrir `http://127.0.0.1:4173/visual-lab/`.

## CI multi-navigateurs

La validation est répartie en trois niveaux complémentaires :

- **Visual Lab** : Chromium + vraie extension MV3 décompressée pour les interactions et le cycle de vie.
- **Visual Matrix 0.9.52** : Chromium, Firefox et WebKit sur les surfaces visuelles critiques et les gros fils.
- **Browser Matrix** : Chromium, Firefox et WebKit sur le checkout courant pour le bridge, les panneaux, le cache/index Projects, la continuité et la stabilité des fils lourds.

Les artefacts visuels sont conservés par GitHub Actions pour inspection. Les dossiers `visual-lab/` et `labs/` sont des actifs de validation persistants : un nettoyage de release ne doit jamais les effacer.
