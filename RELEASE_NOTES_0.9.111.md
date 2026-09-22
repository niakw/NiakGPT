# NiakGPT 0.9.111

## React boot ordering is protected again

0.9.110 corrected the post-#418 HostRoot state, but the authenticated field report still showed the same React #418 on `HTML` and the NiakGPT rail remained absent. The stack is dominated by `MessagePort`, which matches an older failure mode already fixed in 0.9.81: React may continue delayed scheduler work after the DOM and HostRoot briefly look stable.

## Root cause

The 0.9.110 gate treated a positive current-HostRoot proof as sufficient, followed only by a short host-stability / quiet phase. That accidentally removed the stronger scheduler drain introduced in 0.9.81. A current HostRoot can therefore be settled while delayed `MessageChannel` / `MessagePort` commits are still pending.

## Fix

After a positive MAIN-world HostRoot proof, NiakGPT now requires all of the following before any DOM or CSS mutation:

- the same native `nav/main/composer` identities for 1.6 seconds;
- a genuine 1.2-second mutation-free window, including attribute mutations;
- two bounded idle scheduler turns;
- animation frames plus a final host-identity comparison;
- a fresh MAIN-world re-read of the current HostRoot and React ownership.

A timeout is not treated as a quiet-window success. A late host remount restarts the fence. If private React attachment points are unavailable, the deterministic shell/scheduler fence still runs before the trusted-interaction fallback.

## Regression coverage

`visual-lab/tests/hydration-scheduler-drain-v111.spec.js` loads the real unpacked MV3 extension with an already-settled HostRoot, then continues delayed host replacements through `MessageChannel`, including a synthetic #418 on `HTML`. It requires zero NiakGPT mutation during both late commits and only permits the real `#ng8-rail` after the scheduler is done.

The test is wired into both Chromium and Brave stable Live Stability jobs and exposes the checkpoint:

`HYDRATION_SCHEDULER_DRAIN_V111_CHECKPOINT PASS`

## Field-proof status

CI can validate the exact MV3 ordering and browser behavior, but GitHub-hosted runners cannot reproduce the authenticated ChatGPT session because direct live attempts are stopped before the app. The user's real ChatGPT profile remains the final field check for the original #418/sidebar symptom.
