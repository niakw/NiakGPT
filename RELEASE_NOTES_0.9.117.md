# NiakGPT 0.9.117 — Project Memory transient-fetch isolation

## Fixed

A single conversation returning HTTP 500 or a browser `Failed to fetch` no longer aborts and immediately restarts the whole Project. Project Memory retries that chat briefly, records a persistent deferred retry when it still fails, and continues with the following conversations and Projects.

Deferred retries use increasing delays instead of the previous fast restart loop. The Control Center shows the number of temporarily unavailable chats and the planned retry time rather than a fatal Project Memory error.

## Faster first transfer

The durable checkpoint remains per conversation. Speedups stay below that safety boundary: transcript chunks are larger (1,000,000 characters instead of 360,000), priority writes use GitHub Create Tree with inline file content so they no longer need one `/git/blobs` request per chunk, and private-repository verification is reused for five minutes during a bulk transfer. Large conversations therefore require substantially fewer GitHub requests without weakening resume semantics.

## No duplicate conversations

The canonical vault path is based on Project ID + conversation ID. Re-importing or updating an existing conversation writes the same `conversations/<id>/part-NNN.md` and `index.json` paths. Git keeps revision history, but NiakGPT does not create a second current folder for the same conversation.

## Regression coverage

`visual-lab/project-memory-transient-fetch-v117.mjs` injects a 500 then `Failed to fetch` on one conversation, verifies that later chats continue, ensures the failing chat does not enter a tight retry loop, then releases its retry and verifies convergence without refetching already archived chats.
