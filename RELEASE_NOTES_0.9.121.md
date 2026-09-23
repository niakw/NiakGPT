# NiakGPT 0.9.121 — manual retry pile for failed conversations

## Why this changes again

0.9.120 correctly removed the artificial 10/minute quota and 15-minute cooldown. The remaining problem was different: a specific conversation that repeatedly returns `500`, `Failed to fetch` or an empty mapping could stay part of Project Memory's automatic recovery path and be retried again later, even though healthy chats had already progressed.

There is no documented public numeric limit for ChatGPT conversation-history reads that NiakGPT can safely hard-code. The extension therefore no longer guesses one.

## Behaviour

- normal and priority history cadence remain the 0.9.120 values;
- each failing conversation gets at most two immediate attempts in one pass;
- after those attempts it moves to a local manual retry pile and leaves the automatic Project queue;
- healthy chats continue normally;
- the Control Center exposes **Retry failed chats (N)** / **Réessayer les chats en échec (N)** and targets only those IDs;
- a real ChatGPT 429 places the current queue on a manual hold with no NiakGPT-owned timeout;
- the user explicitly releases that hold with **Reprendre après restriction ChatGPT** once native conversation access is working again.

## Regression proof

The updated transient-failure regression injects a 500 followed by `Failed to fetch`, proves the later conversations are archived, waits and proves no automatic retry occurs, then uses the manual retry button and requires only the failed chat to be fetched again.

A new 0.9.121 regression injects HTTP 429 on the first historical read, proves the request count stays frozen while the queue is held, then enables the backend, clicks manual resume and requires full convergence.
