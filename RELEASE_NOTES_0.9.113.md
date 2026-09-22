# NiakGPT 0.9.113 — restore the field-proven boot boundary

## Why this release exists

The authenticated field report after 0.9.112 still showed React recoverable error #418 on HTML and, more importantly, the NiakGPT UI could remain entirely absent.

The regression boundary is now explicit:
- 0.9.103 still used the scheduler/host-stability bootstrap that had been in production since 0.9.81;
- 0.9.104 made startup depend on private React ownership state;
- 0.9.105 moved every stylesheet behind that same gate;
- 0.9.106–0.9.112 iterated on HostRoot/Fiber probing instead of removing the new single point of failure.

## What changed

0.9.113 restores the 0.9.103 startup architecture while keeping later product features:
- declarative CSS returns to the manifest at `document_start`;
- all JavaScript remains at `document_idle`;
- the boot gate waits for the ChatGPT shell, stable host identities, a bounded quiet window, two idle scheduler turns, frames and a final stability pass;
- no HostRoot, Fiber, `isDehydrated`, `__reactContainer$…` or `__reactFiber$…` proof is required;
- the service worker no longer injects CSS dynamically and no longer probes React internals in the MAIN world;
- packaging is again driven by manifest CSS plus the normal runtime lists.

## Regression strategy

The new `hydration-known-good-v113.spec.js` uses the real unpacked MV3 extension in Chromium/Brave. It deliberately exposes no private React markers, performs two delayed `nav/main` replacements through `MessageChannel`, verifies NiakGPT does not activate during those replacements, then requires the real `#ng8-rail` to mount after the host settles.

The 0.9.106–0.9.112 HostRoot/Fiber fixtures remain in repository history, but they no longer define the release gate because the authenticated field behavior contradicted that architecture.
