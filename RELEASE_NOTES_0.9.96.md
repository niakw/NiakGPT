# NiakGPT 0.9.96 — GitHub invalid-context + adaptive live scroll

## GitHub connection

A stale ChatGPT tab left open across an extension update can invalidate the old content-script context. In 0.9.95, the GitHub button could then stay on **“Ouverture de GitHub…”** because `chrome.runtime.connect()` could throw synchronously before the auth promise installed its normal terminal handlers.

0.9.96:
- catches synchronous runtime-connect failure;
- converts `Extension context invalidated` into a terminal, actionable state;
- re-enables the GitHub CTA instead of leaving it disabled;
- keeps a bounded auth-flow deadline in addition to port disconnect handling.

## Live answer scroll

The previous guard still had two field gaps:
- a late native ChatGPT scroll correction could be misclassified as deliberate user reading solely from scroll position;
- the real scroll owner could move from one wrapper to another while `main` stayed mounted.

0.9.96 makes explicit user input the authority for disengaging follow mode, restores unexplained/native upward corrections while generation is active, and rebinds the current scroll root when its ancestor ownership changes.

## Regression evidence

The browser labs now reproduce:
- synchronous `Extension context invalidated` during GitHub login;
- a native upward scroll after the last streaming DOM mutation;
- a live scroll-root migration without replacing `main`.

Current Finalization collects screenshots for these field scenarios.
