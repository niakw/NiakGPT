# NiakGPT Visual Lab

Environnement local de contrôle visuel pour la DA et les layouts NiakGPT. Il ne fait pas partie du runtime de l'extension et ne s'exécute jamais sur ChatGPT.

Le labo charge directement les CSS de production du dépôt sur une fixture qui reproduit les zones importantes de ChatGPT : sidebar, Projects, Récents, conversation, code, composer, coach, panneau Activité, barre d'état et Project Governance.

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

## Local

```bash
cd visual-lab
npm install
npx playwright install chromium
npm test
```

Pour explorer manuellement :

```bash
npm run serve
```

Puis ouvrir `http://127.0.0.1:4173/visual-lab/`.

## CI

Le workflow Visual Lab lance Chromium, vérifie les débordements/chevauchements essentiels et produit des captures dans l'artefact `niakgpt-visual-lab`. Les screenshots sont destinés à être inspectés après chaque modification importante de DA.

Le labo ne remplace pas un test final sur le vrai site ChatGPT : il sert de boucle rapide et déterministe pour éliminer la majorité des régressions visuelles avant le test réel.
