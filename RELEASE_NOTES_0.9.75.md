# Release notes — 0.9.75

0.9.75 keeps the restored 0.9.74 baseline intact and adds one isolated behavior: messages sent while an analysis/execution is already in progress are marked as parallel additions so they do not semantically replace the task already underway. The feature is deliberately event-driven, has explicit cancel bypasses, and is covered by dedicated MV3, cross-engine and visual tests.
