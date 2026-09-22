# NiakGPT 0.9.110

## React #418 recovery no longer deadlocks the boot gate

0.9.109 could remain closed after a recoverable React hydration mismatch because it required the current HostRoot to expose the literal state `memoizedState.isDehydrated === false` and also required React ownership markers on both `<html>` and `<body>`.

React can recover from a hydration mismatch by abandoning SSR hydration and switching the current HostRoot to client rendering. In that recovered state, the `isDehydrated` key may be absent entirely. 0.9.110 therefore treats only an explicit `isDehydrated:true` as still blocked, normalizes through `stateNode.current`, and keeps HTML/BODY ownership as diagnostic information rather than a boot requirement.

The gate still requires a current HostRoot, at least two stable React-owned ChatGPT host identities, a confirmation probe, and a post-proof stability window before NiakGPT mutates DOM or injects CSS. If MAIN-world proof is unavailable, a real user interaction remains the fallback; that interaction is now latched from startup so an early click is not lost.

## Regression coverage

`visual-lab/tests/hydration-recovery-v110.spec.js` reproduces a dehydrated root that recovers to `memoizedState={}` with no React expandos on `<html>` or `<body>`. It asserts zero NiakGPT mutation before recovery and then requires the real rail to mount. The test is wired into both Chromium and Brave stable Live Stability jobs.
