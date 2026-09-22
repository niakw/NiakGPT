# NiakGPT 0.9.104 — React hydration fuse

## Field evidence

A current ChatGPT session emitted React recoverable error #418 with the component stack reaching `body` / `html` and repeated scheduler work through `MessagePort`. The current host HTML is a full-document React Router stream, so stable DOM identities alone are not evidence that hydration is finished.

## Root cause

The previous boot barrier waited for document completion, stable host node identities, a quiet DOM, idle scheduler turns and animation frames. React can still continue full-document hydration without replacing those nodes. NiakGPT could therefore begin writing `data-ng*` attributes or mounting sidebar UI inside a React-owned document during that false-calm window.

## Fix

- Detect the current full-document React host from ChatGPT's document signature.
- Require real React ownership keys on the document/root and at least two host nodes before any NiakGPT DOM mutation.
- Keep all pre-runtime modules dormant until that ownership proof is present.
- Fail closed to a trusted user interaction if React internals are unavailable instead of relying on a guessed delay.
- Record the proof only after the barrier is safe as `data-ng100-hydration-proof`.
- Abort NiakGPT startup if a React hydration #418/failure is observed before activation.

## Regression proof

The cross-engine hydration lab now reproduces the important case missing from the previous test: the DOM remains structurally stable while `MessageChannel` keeps scheduling work beyond the old gate window. Chromium, Firefox and WebKit must show zero NiakGPT nodes/attributes before React ownership, then activate normally afterwards.

The Project Memory and full-width Projects/Chats fixes from 0.9.103 remain part of the same release candidate.
