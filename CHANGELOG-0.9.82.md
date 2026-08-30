# NiakGPT 0.9.82

- Mount Pins directly once in the active ChatGPT sidebar; never reparent the same Pins node across React shells.
- Retire stale shell nodes in place and mount a fresh Pins block after late sidebar remounts.
- Fix GitHub App manifest startup so `launchWebAuthFlow` receives only HTTP(S) URLs.
- Add exact Chromium callback scope and dedicated DOM/auth regression tests.
