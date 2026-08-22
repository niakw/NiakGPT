# NiakGPT — Human UX audit correction (2026-08-22)

## Finding

The existing CI labels used the phrase **human UX** too broadly. `sidebar-human-ux-v123.spec.js` is a valuable automated user-journey test running the real MV3 extension in Chromium/Brave, but the ChatGPT surface is a controlled fixture with mocked backend routes. It is **not** a literal human/manual test on an authenticated live ChatGPT session.

Visual inspection of the stored CI evidence also exposed lab-only quality problems that automated assertions did not report:

- a fixture screenshot renders `RÃ©cents` (encoding defect in the lab surface);
- `human-nav-stress.png` contains intentionally sparse/unrealistic native markup and a broken/empty media rectangle;
- `experience-v116/final.png` is primarily raw fixture markup and is not representative enough to certify production visual UX.

These are not automatically production NiakGPT bugs, but they prove that a green DOM gate must not be presented as a complete human visual UX certification.

## Regression found when the UX gate was actually rerun

The corrected audit immediately found a genuine interaction regression in the existing automated sidebar journey: after the chat action trigger was remounted/replaced, clicking the same semantic `…` action could reopen its menu instead of closing it. The menu owner compared the trigger by DOM-node identity (`state.button === button`) even though ChatGPT/NiakGPT remounts can replace that node between the two clicks.

The runtime fix now identifies an open action by stable semantic identity (`kind + id`) and updates the stored trigger to the current connected replacement before closing/focus restoration. A deterministic remount regression test was added so this behavior cannot silently return.

## New evidence contract

From now on, the CI language must distinguish:

1. **Automated user journey** — functional/DOM/accessibility assertions driven by Playwright.
2. **Visual evidence** — screenshots captured at meaningful interaction states.
3. **Live/manual human UX** — reserved for an actually authenticated live ChatGPT session reviewed by a human; CI cannot claim this by itself.

For issue #55 specifically, automated UX coverage includes rapid Project switching while backend requests overlap, a ChatGPT `thinking` transition during the bridge network gap, recovery after returning idle, preservation of focus/scroll/menu usability, and action-menu behavior across trigger remounts.
