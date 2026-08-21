# NiakGPT testing truth

NiakGPT uses several test levels. Their names must describe what they really prove.

1. **Static/runtime contract** — syntax, packaging, runtime order and source invariants.
2. **Browser fixture interaction** — Chromium/Firefox/WebKit exercise deterministic ChatGPT-shaped DOM fixtures. These tests prove interaction logic, geometry, remount recovery and cross-engine behavior against the fixture; they are not an authenticated live ChatGPT session.
3. **MV3 extension-on-fixture runtime** — the packaged extension is loaded into a real Chromium/Brave process while ChatGPT network/document traffic is replaced by the deterministic runtime fixture. This proves extension bootstrap and browser integration, not compatibility with every current authenticated ChatGPT DOM revision.
4. **Authenticated live evidence** — only a real user/session capture or an explicitly authenticated live test can prove the current production ChatGPT DOM. CI does not currently possess user authentication and must never label fixture evidence as live/human production evidence.

A user screenshot that contradicts a fixture gate is therefore a release-blocking regression signal. The fixture must be updated to encode the observed production shape before the fix is considered covered.

**Legacy naming warning:** historical filenames and workflow labels containing words such as `human`, `real extension` or `live` do not upgrade the evidence level. Until an authenticated production test exists, those jobs remain level 2 or 3 above.

## Recovery rule (0.9.74+)

The 0.9.71–0.9.73 overlay stack is not a stable baseline. A recovery release must not reintroduce `native-ux-v125/v126`, `continuity-limit-v125`, `continuity-live-v126`, `sidebar-route-placement-v125` or `sidebar-truth-v127` without a new authenticated user validation cycle. Fixture CI alone cannot authorize their return.
