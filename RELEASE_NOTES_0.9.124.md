# NiakGPT 0.9.124 — bounded inventory convergence

## Field issue fixed

Project Memory could loop between:

`Transfert prioritaire 96% · conversation 22/23`

and:

`Transfert prioritaire en attente · 1 Project(s)`

when the Project's known conversation counter stayed above the conversations actually present in the local cache.

A stable counter gap is no longer treated as a reason to retry forever.

## New behavior

- Project Memory records a compact inventory-gap signature.
- The first unchanged observation may trigger the normal repair path.
- If the exact same gap is observed again, the queue is removed and the scheduler enters a bounded `inventory-stalled` state.
- The queue cannot be recreated while the cache signature remains unchanged.
- A real inventory/cache change automatically makes the Project eligible again.

Conversations moved to the manual retry pile now count as handled for the automatic pass. They remain incomplete until a manual retry succeeds, but they no longer hold automatic progress at 22/23 or 96%.

## Regression coverage

The priority-transfer browser test now includes a stable known-count/cache-count gap and requires convergence to idle with no queue and priority disabled.

The transient-fetch regression additionally requires automatic progress to reach the full chat count even when one conversation has been quarantined for manual retry.
