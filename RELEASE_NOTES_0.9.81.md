# NiakGPT 0.9.81 — Late React scheduler hydration hotfix

0.9.80 prevented early NiakGPT DOM writes, but the live ChatGPT page exposed a deeper race: React can keep hydrating through scheduler / MessagePort work while the DOM appears quiet, then replace deferred nodes later.

## Fix

- JavaScript bootstrap content scripts now run at `document_idle`, never `document_start`.
- The boot gate waits for stable identities of the native `nav`, `main` and composer nodes.
- It then requires a 1.2s DOM quiet window, two idle scheduler turns, animation frames, and a final host-identity check.
- No NiakGPT observer, timer, interception or DOM mutation starts before the final host-hydrated signal.

## Regression proof

The hydration lab now schedules two delayed React-like shell replacements through `MessageChannel` after `load`, deliberately creating false quiet periods. NiakGPT must remain inactive through both replacements and activate only after the final node identities stabilize on Chromium, Firefox and WebKit.

This directly covers the live failure pattern reported with React #418 and “The deferred DOM Node could not be resolved to a valid node.”
