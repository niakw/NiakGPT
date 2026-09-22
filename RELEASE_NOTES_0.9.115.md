# NiakGPT 0.9.115 — Project Memory active-history catch-up

## Why this release exists

0.9.114 fixed the collapsed Project catalogue and restored a durable private high-water inventory. A second field defect remained visible in the vault itself: hundreds of conversations were known in Project indexes, but only a handful had complete transcript directories under `conversations/`.

The history worker already had a safe extension-background transport for individual conversation reads, but the automatic scheduler still applied the same 60-second human-idle gate used for page-sensitive work. In normal use, clicks, typing, scrolling and navigation kept resetting that timer, so the backlog could remain effectively permanent.

## What changed

### Safe background history no longer waits for 60 seconds of human silence

When all of these are true:

- the current page is a conversation;
- the extension-background history probe succeeds;
- ChatGPT is not generating;
- no verification/network interruption is active;
- no peer tab owns conflicting work;
- the tab is visible and still owns Project Memory;

the historical backlog may progress without waiting for `HUMAN_QUIET_MS`.

This exemption applies only to the isolated worker transport. Page/RPC history paths keep the original quiet requirement.

### Throttling and safety remain in place

- individual conversation fetches still respect `BACKGROUND_HISTORY_FETCH_GAP_MS`;
- temporarily busy active-chat catch-up retries after `ACTIVE_HISTORY_RETRY_MS = 5000`;
- 429/network failures keep the existing long backoff;
- active generation and ownership changes still suspend the worker;
- no broad conversation-list endpoint is added to the worker.

## Regression evidence

`visual-lab/project-memory-active-catchup-v115.mjs` starts immediately after page load, so the 60-second quiet window is deliberately not satisfied. With the background transport available, it requires at least one historical conversation fetch and one durable `conversations/.../part-001.md` write within eight seconds.

That scenario is intentionally red on the 0.9.114 scheduling model and green on 0.9.115.
