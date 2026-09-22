# NiakGPT 0.9.114 — durable Projects catalog recovery

## Field failure

A cold cache/reinstall could leave NiakGPT with only one canonical Project even though the private Project Memory vault still contained the other Project directories. The live `PROJECTS.json` bootstrap snapshot was then rewritten from that collapsed local cache, turning the temporary cache loss into a self-reinforcing one-Project state.

That single-catalog state had three visible consequences:

- the NiakGPT Projects block rendered only one Project;
- ChatGPT's current no-heading native Project-folder group could remain visible because only one Project identity was known;
- automatic classification had only the collapsed one-Project governance target.

## 0.9.114 fix

- Add a private durable `PROJECT_CATALOG.json` high-water inventory.
- Write that high-water file only from a real current server index (`serverIndexedAt > 0`).
- Recover a cold/collapsed cache from the durable catalog plus the existing `projects/g-p-*/project.json` directories.
- Keep a healthy current ChatGPT server index authoritative over historical vault data.
- Restore governance only for the exact collapsed 1/1 mirror case; preserve explicit partial/manual selections, hidden Projects and the classification queue.
- Keep Project instructions/descriptions out of the catalog recovery payload.
- Preserve stable durable Project ordering.
- Cover the current ChatGPT sidebar shape where Project folders have no heading and are followed by an “Afficher plus” row and a separate Chats section.

## Regression coverage

The release gates cover:

- durable catalog lookup when live `PROJECTS.json` is collapsed;
- cold-cache 1 → full-catalog recovery;
- no high-water overwrite from a vault-recovered cache;
- high-water write after a genuine server index becomes available;
- current server authority against stale vault membership;
- classification-governance recovery;
- native Project-folder suppression without hiding generic Chats;
- Project block placement in the native Projects slot instead of the bottom fallback.

The 0.9.113 field-proven startup boundary is unchanged.
