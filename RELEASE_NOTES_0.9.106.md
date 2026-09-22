# NiakGPT 0.9.106 — MAIN-world hydration probe

## What regressed

After 0.9.105, NiakGPT could remain absent even though ChatGPT itself had finished rendering. The hydration gate was reading React expando properties from an MV3 isolated content-script world, while those properties live in the page JavaScript world.

## Fix

- React ownership and HostRoot settlement are probed by the service worker with `chrome.scripting.executeScript(..., world:'MAIN')`.
- The probe is read-only and returns only `fullDocument`, `rootSettled`, `needed`, and `ownedCount`.
- The isolated boot gate no longer reads React expandos directly.
- An early recoverable React #418 no longer permanently disables NiakGPT if the HostRoot later settles; trusted interaction remains the fail-closed fallback.
- Deferred CSS and the zero-pre-hydration-mutation boundary from 0.9.105 remain unchanged.

## Regression proof

A real Chromium/Brave MV3 test now loads the unpacked extension, creates the React container/fiber expandos only in the page world, performs no user click/key/touch, waits for `react-main-world-settled`, and requires the NiakGPT rail to mount.

## Native ChatGPT 410

`/backend-api/f/conversation/resume` remains absent from NiakGPT runtime code and is still rejected by static validation. A browser 410 on that route is a native ChatGPT resume request, not the NiakGPT hydration probe.
