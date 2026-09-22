# NiakGPT 0.9.118 — durable Project Memory resume index

## What failed in the field

A large Project reached 180 indexed conversations with 89 complete archives. Its Project index had grown to roughly 3.13 million characters because it duplicated detailed signal summaries for every archived conversation. The durable conversation folders remained intact, but a later read of the oversized index through GitHub Contents no longer returned an inline base64 payload. The runtime treated that read failure like a missing index and rebuilt from an empty object, making the transfer visibly restart from the beginning.

This was not a 100-conversation limit.

## Fix

- large memory files fall back from GitHub Contents to the immutable Git blob identified by the file SHA;
- the Project index is now compact resume metadata only; detailed signals stay in each conversation index;
- every Project-index write is union-merged against the current Git HEAD so stale tabs/writers cannot delete checkpoints they do not know about;
- before a Project resumes, NiakGPT lists durable conversation directories and recovers only missing per-chat indexes with bounded concurrency;
- recovered archives are applied before progress is calculated, so the UI resumes from the durable checkpoint count instead of zero.

## Regression coverage

The 0.9.118 browser regression starts with a Project index containing one conversation while three durable conversation archives exist. It requires progress to start at 3/4 and permits a backend fetch only for the fourth conversation. Backend tests additionally simulate a 3.1 MB Contents response without inline content and verify Git-blob fallback plus monotonic index merging.
