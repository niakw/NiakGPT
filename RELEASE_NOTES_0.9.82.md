# NiakGPT 0.9.82 — Sidebar DOM stability + GitHub auth transport

This hotfix addresses three failures reproduced from the live ChatGPT extension:

- `Cannot moveNode ... new parent is already a descendant`;
- `Node cannot be found in the current page`;
- GitHub connection failing because `launchWebAuthFlow` received a `chrome-extension://` URL.

## Sidebar / React ownership

Pins now use a **direct-once mount policy**. NiakGPT resolves the active visible ChatGPT sidebar and the final insertion target before creating `#ng8-pins`. The same Pins node is never moved to a different parent later.

When ChatGPT remounts its sidebar while a conversation is open, the old Pins node is retired in place and a fresh Pins block is mounted directly in the new shell. Hidden, inert and `aria-hidden` sidebar candidates are excluded, and hit-testing favors the genuinely active shell.

All internal structural inserts go through a cycle-safe `safeInsert()` guard.

## GitHub connection

The GitHub App Manifest starter is an extension page and therefore has a `chrome-extension://` URL. Chrome's `launchWebAuthFlow` only accepts HTTP(S) auth URLs, so that starter must not be passed to it.

0.9.82 opens the starter in a normal extension tab, posts the manifest to GitHub, then observes only the exact HTTPS Chromium callback for the temporary code and state. Installation and OAuth still use `launchWebAuthFlow`, behind a scheme guard that rejects non-HTTP(S) URLs.

No shared backend or public OAuth secret was introduced. The public repository and CI still never know the user's private vault name or credentials.

## Regression proof

`visual-lab/dom-node-stability-v082.mjs` starts directly on a conversation, mounts Pins, remounts the ChatGPT sidebar late while the old shell remains connected, and requires:

- Pins to appear in the new shell without visiting Home or refreshing;
- exactly one direct mount per shell;
- the old node to remain in its old parent until the host removes that shell;
- no same-node parent change;
- no `Cannot moveNode`, `Node cannot be found`, or hierarchy errors.

The GitHub contract tests also reject any `chrome-extension://` input to the web-auth wrapper and simulate the exact manifest callback lifecycle. During the Manifest tab step, a bounded long-lived runtime port sends a heartbeat so Chrome's MV3 service worker does not depend on the user completing GitHub's screen within the normal idle window.
