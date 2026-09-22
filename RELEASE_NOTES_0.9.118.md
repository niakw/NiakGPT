# NiakGPT 0.9.118 — monotonic Project Memory indexes

## Fixed

A large Project can no longer appear to restart from 0 merely because its aggregate Project index was overwritten by a stale writer. The durable conversation folders remain the elementary source of truth.

Before a Project index is committed, the service worker now rereads the existing index from the exact Git parent SHA and unions the conversation rows. A complete archived conversation cannot be downgraded by a metadata-only or partial snapshot.

## Automatic recovery

If the local Project inventory contains more conversations than the current vault index, NiakGPT enumerates the existing `conversations/<id>` folders, rereads their individual `index.json` checkpoints with bounded concurrency, rebuilds the Project index and only then resumes history fetching. This prevents already archived conversations from being downloaded and rewritten again.

The recovery pass supports up to 1000 conversation directories per Project; there is no NiakGPT limit at 100 conversations.

## Regression coverage

- backend test: a stale writer tries to replace a 100-row Project index with a tiny snapshot; the committed tree must preserve the 100 rows and union the new row;
- browser test: the aggregate index starts at 2/5 while four per-conversation checkpoints are already durable; recovery must restore 4/5 and fetch only the fifth conversation.
