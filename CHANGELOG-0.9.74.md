# NiakGPT 0.9.74 — recovery stable

- Restore the complete runtime/CSS/package snapshot of 0.9.70, the last baseline validated on the user's authenticated ChatGPT session.
- Remove the entire 0.9.71–0.9.73 overlay stack from the shipped tree: `native-ux-v125/v126`, `continuity-limit-v125`, `continuity-live-v126`, `sidebar-route-placement-v125`, `sidebar-truth-v127` and mascot injection.
- Preserve the later Code Scanning fixes in `interruption-guard-v119.js`: only allow-listed incident metadata is persisted; draft/chat/sample data is not written to sessionStorage.
- Keep `TESTING_TRUTH.md` and explicitly classify current browser/Brave CI as deterministic fixture evidence, not authenticated production evidence.
- Make continuity handoff version assertions read the manifest version so a recovery release does not require runtime behavior changes.
- Add release validators that reject reintroduction of the removed overlay stack.

This release intentionally does not claim to solve the remaining 0.9.70 UX imperfections. Its purpose is to recover a known usable base before any feature is reintroduced one at a time.
