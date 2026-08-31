# NiakGPT 0.9.86

## Project Memory bootstrap wake reliability

- Fix a lost-wake race that could leave a connected private vault indefinitely on `bootstrap en attente` with a persistent queue.
- Add a 15-second local wake heartbeat while automatic synchronization is enabled.
- The heartbeat performs no ChatGPT conversation request while native ChatGPT is busy; it only checks local queue state and calls the guarded resume path when a visible tab is eligible.
- Early pauses caused by busy/native activity, visibility/ownership changes, or an unavailable `navigator.locks` lock now always re-arm a future attempt.
- The bootstrap `finally` path also guarantees a future wake whenever pending Projects remain.
- Expose `data-ng132-wake-beat` as a lightweight diagnostic timestamp.

## Regression coverage

- `visual-lab/project-memory-wake-v086.mjs` starts with ChatGPT busy, clears the busy state without emitting any event, refuses the first lock acquisition, and requires the persistent queue to self-resume and finish.
