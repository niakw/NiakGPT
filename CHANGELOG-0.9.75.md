# NiakGPT 0.9.75

- Adds an event-driven parallel-continuation guard at `document_start`.
- When a message is sent while the current conversation is already `waiting`, `thinking`, or `executing`, NiakGPT prepends `--- CONTINUE — AJOUT EN PARALLÈLE ---` plus a short instruction to preserve the work already in progress.
- Normal idle sends are never prefixed; a short same-send guard prevents the activity sensor's new `waiting` state from being mistaken for pre-existing work.
- Explicit cancellation messages such as `stop`, `arrête`, `annule`, or `laisse tomber` bypass the marker.
- Native `Stop generating` is used as a fallback activity signal when the NiakGPT activity state is unavailable.
- Supports textarea and modern contenteditable composers without adding any overlay or permanent polling.
- Adds targeted Chromium MV3 coverage plus Chromium/Firefox/WebKit logic and visual evidence, while retaining the full existing Current Finalization matrix.
