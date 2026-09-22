# NiakGPT 0.9.103 — Project Memory active-chat archive + stable Projects placement

## Field evidence

The 0.9.102 vault refresh proved that metadata completeness was not archive completeness. NiakVIO reached 171 known / 171 cached conversations with clean Project names, yet the private repository still contained no files below any `conversations/` directory and every sampled conversation index remained `parts: 0`, `messages: 0`, `bootstrapMetadataOnly: true`.

The supplied current ChatGPT home DOM also exposes the visible sidebar as a vertical `nav[aria-label="Historique de chat"]`, separate from the inert tiny rail. The existing placement code could still choose an inner Chats title row as its insertion parent.

## Root causes

1. Full Project Memory history was deliberately deferred on every current conversation route. In normal use, staying inside a chat could therefore keep the vault metadata-only forever.
2. A pre-0.9.103 queue or `lastSyncAt` could survive an upgrade without proving that any transcript body had ever been archived.
3. Current Project route IDs were not canonicalized before DOM capture, so slugged `g-p-<id>-<slug>` routes could miss a new/current chat that was not already cached.
4. Projects placement validated geometry but did not reject horizontal flex/grid mount parents. A Chats heading row could therefore become the insertion lane.

## Fix

- Add an isolated MV3 service-worker transport for a strictly allow-listed `GET /backend-api/conversation/<id>`.
- Keep the ChatGPT bearer ephemeral in worker memory only; never persist it or send it to GitHub.
- Continue full-history sync from a visible current-chat tab after one minute of calm while retaining the page broker's current-chat quarantine.
- Canonicalize slugged Project IDs for live DOM capture.
- Migrate old metadata-only queues to a versioned full-history queue and record completion only with `historyCompletedAt + historyCacheSignature`.
- Requeue when the local Project/chat cache changes after a completed archive.
- Prefer ChatGPT's visible History scrollport and reject horizontal flex / multi-column grid parents for `#ng8-pins`.
- Mount Projects before the complete Chats section rather than beside its title row.

## Regression proof

- Node contract tests exercise the direct background transport, endpoint allow-list, credentials, no-store behavior and memory-only bearer.
- Browser Project Memory tests archive both a slugged current chat from DOM and a historical cached chat through the extension worker with zero page RPC.
- Field sidebar regression reproduces a tall horizontal Chats heading row; Projects must become its previous sibling in the full-width lane.
- Existing page-bridge quarantine, peer-busy, Project inventory and cross-browser regressions remain release-critical.
