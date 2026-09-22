# NiakGPT 0.9.112

## Active ChatGPT pages no longer deadlock the boot gate

The 0.9.111 field report reproduced the same symptom after an authenticated reload: React recoverable #418 on `HTML` and no NiakGPT right rail.

This release changes the evidence model rather than extending another timeout.

## Reproduced before the fix

A new real unpacked MV3 regression starts from a current HostRoot that is already recovered and settled, emits a synthetic recoverable #418 on `HTML`, keeps `nav/main/composer` identities stable, and then performs an unrelated attribute update every 120 ms.

With the unmodified 0.9.111 runtime, the test times out after 12 seconds with no `data-ng100-hydration-proof` and no rail. That is the same failure class as the field symptom: the app is usable and structurally stable, but NiakGPT never authorizes itself.

## Root cause

0.9.111 required a global mutation-free window after the HostRoot proof. That condition is invalid for a continuously active SPA. ChatGPT can keep updating message descendants, state attributes, counters and other UI without remounting the structural hosts or re-entering hydration.

Normal application activity could therefore reset the gate forever.

## Fix

After the current HostRoot is proved or recovered, NiakGPT now waits only on evidence relevant to structural safety:

- stable identity of the native `nav/aside`, `main` and composer;
- two bounded idle scheduler turns;
- animation frames and a final identity comparison;
- a fresh MAIN-world revalidation of the current HostRoot and React host ownership.

A real host remount still invalidates the attempt. Unrelated subtree or attribute activity does not.

## Regression coverage

`hydration-active-spa-v112.spec.js` proves that the rail can mount while benign SPA activity continues continuously.

`hydration-scheduler-drain-v111.spec.js` remains in the same matrix and still proves that late `MessageChannel` / `MessagePort` host replacements block NiakGPT until the structural shell is actually stable.

Both regressions run in Chromium and Brave stable.
