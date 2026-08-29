# NiakGPT Project Memory v132 — synthetic lab fixture

> Synthetic test data only. This file is not connected to a real ChatGPT Project and must never contain user conversation content or secrets.

## Purpose

Exercise the Project Memory GitHub sync contract without touching a live user's private memory repository.

## Synthetic project

- project_id: `g-p-lab0001`
- name: `NiakGPT Memory Lab`
- non_empty: true
- conversations: 3
- last_sync: `2026-08-29T17:00:00Z`

## Expected compact state

### Current focus
Validate private GitHub-backed Project continuity.

### In progress
- Private repository verification.
- Initial import for existing non-empty Projects.
- Compact checkpoint generation.
- Conflict-safe incremental sync.

### Architecture
- NiakGPT runtime stays local-first by default.
- GitHub Project Memory is explicit opt-in.
- Production memory writes are refused when the selected repository is public.
- Raw full conversation exports are not the default memory format.
- A compact state is used for normal prompt continuity.
- History is stored separately and retrieved only when needed.

### Tasks
- [x] Discover Project inventory.
- [ ] Bootstrap existing non-empty Projects.
- [ ] Verify checkpoint round-trip.
- [ ] Verify conflict merge.
- [ ] Verify disconnect leaves ChatGPT/NiakGPT usable.

## Privacy assertions

- No real user text.
- No auth token.
- No ChatGPT session token.
- No private repository name.
- No personal identifiers.
