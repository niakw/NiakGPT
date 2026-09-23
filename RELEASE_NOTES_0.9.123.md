# NiakGPT 0.9.123 — phantom Project loop fix

## Fixed

A stale Project identifier with a suffix could survive in the local cache as a second logical Project. Even when its single conversation had just reached 100%, that alias remained `indexed:false`, so Project Memory treated it as unresolved inventory and immediately re-queued one Project.

This produced the visible loop:

`Transfert prioritaire 100% · conversation 1/1`
→
`Transfert prioritaire en attente · 1 Project(s)`

## Architecture

NiakGPT now canonicalizes Project identities at both boundaries:

- the sidebar cache merge normalizes Project rows, chat assignments, counts and indexed Project IDs;
- Project Memory canonicalizes and deduplicates Project IDs again before building the persistent queue.

Historical suffix/slug aliases therefore collapse into the same canonical Project and cannot become a second scheduler unit.

## Regression

The priority-transfer browser regression now injects exactly this phantom-alias state and requires convergence to:

- `mode: idle`
- no persistent queue
- `prioritySync: false`

after the final conversation is archived.
