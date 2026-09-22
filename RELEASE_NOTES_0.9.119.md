# NiakGPT 0.9.119 — ChatGPT conversation rate guard

## Field symptom

During a large priority Project Memory catch-up, ChatGPT could begin refusing normal conversation loads and show its native protection message indicating that requests were being sent too quickly. The priority history cadence was 900 ms between conversation reads, which was too aggressive for a long backlog.

## Fix

- all historical conversation reads are now paced at a minimum six-second interval;
- a persistent sliding-window guard caps historical reads at 10 per minute;
- priority sync no longer bypasses the conversation-read budget;
- HTTP 429 or a visible native rate-limit message opens a 15-minute account cooldown;
- the cooldown survives page reloads, is inherited by the queue, and blocks manual, automatic and priority history requests;
- GitHub-side acceleration and durable archive reconciliation remain enabled because they do not consume ChatGPT conversation endpoints.

## Regression coverage

The 0.9.119 browser regression injects a 429 on the first history fetch, requires a persisted cooldown longer than ten minutes, waits while the queue is armed, and proves that no second conversation request is emitted. The settings UI must show ChatGPT protection state and disable sync controls during the cooldown.
