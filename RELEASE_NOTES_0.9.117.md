# NiakGPT 0.9.117 — Project Memory transient-fetch isolation

## Fixed

A single conversation returning HTTP 500 or a browser `Failed to fetch` no longer aborts and immediately restarts the whole Project. Project Memory retries that chat briefly, records a persistent deferred retry when it still fails, and continues with the following conversations and Projects.

Deferred retries use increasing delays instead of the previous fast restart loop. The Control Center shows the number of temporarily unavailable chats and the planned retry time rather than a fatal Project Memory error.

## Faster first transfer

Priority mode now groups several successful conversations into one durable GitHub checkpoint when size limits allow. This reduces branch/ref/commit overhead on Projects containing hundreds of chats while keeping a bounded checkpoint size.

## No duplicate conversations

The canonical vault path is based on Project ID + conversation ID. Re-importing or updating an existing conversation writes the same `conversations/<id>/part-NNN.md` and `index.json` paths. Git keeps revision history, but NiakGPT does not create a second current folder for the same conversation.

## Regression coverage

`visual-lab/project-memory-transient-fetch-v117.mjs` injects a 500 then `Failed to fetch` on one conversation, verifies that later chats continue and are batched, ensures the failing chat does not enter a tight retry loop, then releases its retry and verifies convergence without refetching already archived chats.
