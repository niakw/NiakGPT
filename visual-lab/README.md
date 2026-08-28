# NiakGPT Visual Lab

The Visual Lab is NiakGPT's deterministic browser-testing environment. It is a **development/test surface only** and is never injected into ChatGPT production pages.

## What it covers

Fixtures model the parts of ChatGPT that NiakGPT depends on:

- native left sidebar and Projects;
- Project/chat drawers and action menus;
- conversation content and long-thread states;
- composer, prompt coach and continuity markers;
- activity/status surfaces;
- route changes, React-style remounts and BFCache recovery;
- home, Project and conversation layouts.

The lab also contains real MV3 extension-on-fixture tests that load the unpacked extension in a browser process.

## Evidence boundary

A green Visual Lab proves behavior against its deterministic fixture. It does **not** prove the latest authenticated ChatGPT production DOM.

See [../TESTING_TRUTH.md](../TESTING_TRUTH.md).

## Local setup

```bash
cd visual-lab
npm ci
npx playwright install chromium
npm test
```

For manual exploration:

```bash
npm run serve
```

Then open:

```text
http://127.0.0.1:4173/visual-lab/
```

## Browser matrix

Targeted workflows exercise Chromium, Firefox and WebKit. Some runtime gates additionally load the actual MV3 extension in Chromium or Brave.

## Artifacts

CI screenshots and reports are uploaded as short-retention GitHub Actions artifacts. They are evidence, not repository source files, and must not be committed under `playwright-report/`, `test-results/` or generated artifact directories.

## Regression policy

A production screenshot that exposes a shape the fixture does not model should lead to a new/updated fixture before the corresponding runtime fix is considered covered.
