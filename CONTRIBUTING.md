# Contributing to NiakGPT

Thank you for helping improve NiakGPT. The project aims for a dense power-user experience **without turning ChatGPT into a heavier or less predictable application**.

A contribution is evaluated on correctness, runtime cost, reversibility, accessibility and regression coverage.

## Read first

Before changing runtime behavior, read:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [PRIVACY.md](PRIVACY.md)
- [SECURITY.md](SECURITY.md)
- [TESTING_TRUTH.md](TESTING_TRUTH.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Non-negotiable rules

### Keep the host scope narrow

Do not add host permissions beyond `https://chatgpt.com/*` without an explicit security/privacy review.

### No silent telemetry

No analytics, tracking pixel, advertising SDK or implicit NiakGPT server upload.

### User intent beats automation

Never overwrite a user-modified draft, manual Project move, explicit cancellation or manually locked conversation.

### One owner per UI responsibility

Before adding a DOM observer or renderer, identify the existing authority. Do not create a second owner for the same Project visibility, placement, action menu or continuity state.

### No global polling

Do not add whole-document `setInterval` scanning. Prefer targeted MutationObservers, storage events, route events, `BroadcastChannel`, `navigator.locks` and bounded idle work.

### Do not invent internal APIs

New ChatGPT-internal endpoints must be observed on the real interface, narrowly allow-listed, fail-safe and regression-tested.

## Privacy in fixtures

Never commit:

- a real conversation body;
- personal email addresses;
- private Project names;
- cookies/tokens;
- raw authenticated session exports.

Use deterministic fictional fixtures.

## UX and accessibility

Custom interactive controls must have:

- an accessible name;
- visible keyboard focus;
- reasonable keyboard behavior;
- correct state semantics;
- predictable Escape/close behavior when relevant.

For significant UI changes, add or update a deterministic Playwright scene and inspect the generated evidence.

## Performance checklist

For any DOM-reactive feature, ask:

1. Can an existing event be reused?
2. Can observation be scoped to one container?
3. Can the work be delayed until idle?
4. Does every tab need to run it?
5. Should Safe Mode disable it?
6. What happens on an 80+ turn conversation?
7. What happens after React remount or BFCache restore?

## Repository hygiene

Do not commit generated output such as:

- `dist/`;
- `node_modules/`;
- `playwright-report/`;
- `test-results/`;
- temporary logs/backups;
- random ZIPs outside explicitly documented historical archives.

Top-level runtime JS/CSS must either be shipped or be referenced by a documented regression/test path. Unreferenced runtime files are treated as repository garbage.

Run:

```bash
node tools/check-repository-hygiene.mjs
```

## Local validation

### Runtime invariants

```bash
node tools/check-runtime.mjs
```

### Repository hygiene

```bash
node tools/check-repository-hygiene.mjs
```

### Packaging

```bash
node tools/package-extension.mjs
```

### Visual Lab

```bash
cd visual-lab
npm ci
npx playwright install chromium
npm test
```

## Selector changes

Prefer stable semantic signals in this order:

1. `data-testid`;
2. ARIA/role;
3. canonical href;
4. stable structural relationship;
5. generated CSS class only as a last resort.

Critical selector changes must include a reproduction fixture and a false-positive check.

## Release documentation

`manifest.json` is the runtime version source of truth.

For a release-facing change, keep synchronized:

- `README.md`;
- `README.fr.md`;
- `CHANGELOG.md`;
- current release notes;
- architecture/privacy/security docs when behavior changes.

Historical release notes should remain historical; correct them only when they contain a factual error about that release.

## Pull request acceptance

A substantial change is not complete because one screenshot looks right. It should pass the relevant combination of:

- static/runtime invariants;
- repository hygiene;
- clean packaging;
- deterministic browser fixtures;
- cross-engine experience gates;
- real MV3 runtime fixtures;
- focused Brave/macOS coverage when the change affects that path.

A real user screenshot that contradicts a fixture is a regression signal. Update the fixture to reproduce the production shape before declaring the fix covered.
