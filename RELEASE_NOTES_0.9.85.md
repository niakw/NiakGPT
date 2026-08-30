# NiakGPT 0.9.85

## Native ChatGPT traffic first

- Abort NiakGPT-owned ChatGPT backend GETs as soon as a prompt is sent or native activity/verification/network recovery takes priority.
- Hold a quiet period after native activity before allowing background reads to resume.
- Never retry a transient fetch/network failure through an automatic XHR second transport.
- Increase GET spacing and use a much longer circuit-breaker after HTTP 429.

## Project Memory

- Project Memory is now opportunistic rather than continuous while the user is working.
- Require 45 seconds without trusted human interaction before background synchronization can run.
- Space full conversation-history reads by at least 8 seconds.
- Pause and persist the queue immediately on native-priority aborts, network failures or rate limits instead of retrying aggressively.

## Pins

- Treat a visible native `/projects` launcher as a safe authoritative anchor even before ChatGPT hydrates individual Project links.
- Render the custom header as **PINS · PROJECTS** so it cannot be mistaken for ChatGPT's native Projects surface.

## Regression coverage

- `visual-lab/native-priority-network-v085.mjs`
- `visual-lab/pins-launcher-only-v085.mjs`
