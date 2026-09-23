# NiakGPT 0.9.120 — remove the artificial Project Memory rate cap

## Change

0.9.119 introduced a NiakGPT-owned history-read budget of 10 requests per minute plus a persistent 15-minute cooldown. That policy is removed in 0.9.120.

Priority Project Memory catch-up now returns to the 0.9.118 transport behavior:

- normal background history gap: 4 seconds;
- priority history gap: 900 ms;
- no persistent account-level rate ledger;
- no NiakGPT-enforced 10/minute budget;
- no NiakGPT-enforced 15-minute cooldown;
- sync controls are not disabled by a local rate-guard state.

Durable per-chat checkpoints, transient per-chat retry isolation, large Project-index recovery, archive reconciliation and monotonic Git index merging remain unchanged.

## Regression coverage

The 0.9.119 rate-guard regression and workflow step are removed. Existing Project Memory tests continue to require priority resume, transient-failure isolation and clobbered-index recovery without replaying durable chats.
