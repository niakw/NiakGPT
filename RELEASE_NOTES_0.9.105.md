# NiakGPT 0.9.105 — zero-touch React hydration boundary

## Field evidence

React recoverable error #418 still reproduced after 0.9.104. That invalidated the previous assumption that finding React internal ownership keys was enough to prove hydration completion.

Two early surfaces remained:

1. React attaches `__reactContainer$…` / `__reactFiber$…` before the HostRoot necessarily leaves its dehydrated state.
2. NiakGPT still declared 34 CSS files as static content-script styles at `document_start`, so layout/style influence existed before the JavaScript hydration gate.

## Fix

- Require the React HostRoot to expose `memoizedState.isDehydrated === false`.
- Keep the existing host-fiber checks so a settled root alone cannot authorize a detached/stale host.
- Remove every static CSS content script from the manifest.
- Move all 34 styles into a single `STYLE_RUNTIME` owned by the service worker.
- Inject those styles with `chrome.scripting.insertCSS()` only after the hydration gate asks for runtime injection.
- Keep a trusted-interaction fallback when current React internals cannot prove completion.
- Teach the package builder and static validators about deferred styles.

## Regression proof

The hydration fixture now has three distinct phases:

1. late MessageChannel scheduler work with stable DOM;
2. React ownership keys present while the synthetic HostRoot is still `isDehydrated:true`;
3. the same HostRoot switching to `isDehydrated:false`.

NiakGPT must stay completely absent through phases 1 and 2: no runtime flag, no `data-ng*`, no NiakGPT nodes. It may activate only in phase 3.

Static release gates also fail if any CSS reappears in `manifest.content_scripts`, if any deferred stylesheet disappears from `STYLE_RUNTIME`, or if the ZIP builder stops packaging deferred styles.

The 0.9.103 Project Memory and Projects/Chats placement corrections remain unchanged.
