# NiakGPT 0.9.76 — consolidated hotfix notes

The 0.9.76 line received several post-merge hardening passes that are now part of the v131 baseline.

## Fixed

- hydration-safe runtime bootstrap and retry;
- shell recovery after ChatGPT remounts;
- verified left-sidebar placement before Projects become visible;
- Project catalogue/drawer scroll stability during cache churn;
- active user scroll cancelling stale restoration work;
- Project/chat action hit-testing and remount-safe menu ownership;
- BFCache observer rebinding;
- native Project settings routing;
- controlled-composer residue cleanup;
- long-run watchdog safety around Stop/Send controls;
- user-modified draft protection;
- native conversation-limit continuity with exact Project preservation;
- async interruption-state race protection.

## Current long-run behavior

The original 4m40 experimental timing is no longer the release behavior. The current default watchdog window is **6 min 30**.

Automatic resume text is not written while only a native Stop control is available. A short resume can be sent only when the composer is safe and a real Send candidate exists.

## Validation

The consolidated baseline is exercised by static/runtime/package gates, cross-engine UX fixtures, MV3 runtime fixtures, BFCache/scroll/action regressions and focused macOS Brave stable coverage.
