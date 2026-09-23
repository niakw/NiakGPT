# NiakGPT 0.9.122 — monotonic Project Memory states

## What changed

Project Memory no longer lets a current-chat DOM save downgrade a conversation that already has a complete canonical backend archive.

A completed backend archive keeps its canonical `index.json` and `part-*.md` files. New visible messages from the active ChatGPT page are saved separately as `live-index.json` and `live-part-*.md` until the backend history pass catches up.

The durable state progression is therefore monotonic:

`metadata-only → partial/live → backend complete`

A backend-complete conversation cannot automatically move back to partial or metadata-only.

## Retry behavior

Historical conversation reads still use bounded immediate retries. A conversation that keeps failing is moved to the manual retry pile and does not re-enter the automatic queue by itself.

## Regression coverage

The Project Memory wake regression now verifies that:

- the Project index remains `complete:true` after a live DOM save;
- the per-conversation canonical index remains backend-owned;
- the live overlay is persisted separately and remains explicitly partial;
- the canonical transcript is not overwritten by the live DOM transcript.

This preserves immediate active-chat backup without allowing status oscillation or archive regression.
