# NiakGPT — Human UX audit correction (2026-08-22)

## Finding

The existing CI labels used the phrase **human UX** too broadly. `sidebar-human-ux-v123.spec.js` is a valuable automated user-journey test running the real MV3 extension in Chromium/Brave, but the ChatGPT surface is a controlled fixture with mocked backend routes. It is **not** a literal human/manual test on an authenticated live ChatGPT session.

Visual inspection of the stored CI evidence also exposed lab-only quality problems that automated assertions did not report:

- a fixture screenshot renders `RÃ©cents` (encoding defect in the lab surface);
- `human-nav-stress.png` contains intentionally sparse/unrealistic native markup and a broken/empty media rectangle;
- `experience-v116/final.png` is primarily raw fixture markup and is not representative enough to certify production visual UX.

These are not automatically production NiakGPT bugs, but they prove that a green DOM gate must not be presented as a complete human visual UX certification.

## New evidence contract

From now on, the CI language must distinguish:

1. **Automated user journey** — functional/DOM/accessibility assertions driven by Playwright.
2. **Visual evidence** — screenshots captured at meaningful interaction states.
3. **Live/manual human UX** — reserved for an actually authenticated live ChatGPT session reviewed by a human; CI cannot claim this by itself.

For issue #55 specifically, automated UX coverage must include rapid Project switching while backend requests overlap, a ChatGPT `thinking` transition during the bridge network gap, recovery after returning idle, and preservation of focus/scroll/menu usability.
