# NiakGPT 0.9.80

- Fix React #418 hydration mismatch/display corruption race.
- Hard host-hydration barrier before every document_start pre-runtime activation.
- No pre-hydration observers, timers, HTML attributes or DOM mutations.
- New Chromium/Firefox/WebKit SSR DOM immutability regression lab.
