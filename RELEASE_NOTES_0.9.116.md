# NiakGPT 0.9.116 — Priority Project Memory first transfer

## What changed

Large Project Memory backlogs no longer lose their visible progress when a pause or GitHub write error occurs in the middle of a Project. NiakGPT now persists the Project conversation index after every successfully archived canonical chat, so the next pass skips everything already complete and resumes at the first unresolved conversation.

The Control Center adds **Forcer la synchro des chats** for initial migration. This is intentionally different from rebuilding all history: it keeps incremental semantics, promotes the existing remaining queue when possible, and does not refetch conversations that are already complete and current.

While this explicit priority mode is active, safe background conversation reads use a 900 ms minimum gap, busy retries use 1 second, front-side GitHub batches are larger within a byte ceiling, and independent blob creation is parallelized with a bound of six. GitHub branch commits remain serialized and non-forced, and ChatGPT generation, verification, network failures and rate limits still pause the transfer.

## Resume guarantee

A successful chat now advances both its conversation index and the Project index durably. The regression test deliberately fails the write of a later chat and then verifies that the previously checkpointed chat is not fetched again on resume.

## Validation

The dedicated browser regression is `visual-lab/project-memory-priority-sync-v116.mjs`. It is wired into the Project Memory workflow and the current finalization gate on Chromium, alongside the existing active-chat catch-up regression.
