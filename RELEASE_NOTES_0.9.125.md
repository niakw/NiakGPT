# NiakGPT 0.9.125 — ChatGPT Web redesign compatibility

> Compatibility release for the redesigned sidebar, grouped conversation renderer and ProseMirror composer.

## What changed

- One canonical geometry/semantics-based sidebar authority now initializes before Projects, Pins and metadata consumers.
- The sidebar finder recognizes semantic navigation containers plus sortable/draggable Pinned, Projects and Recents lanes.
- Mixed Pinned sections keep ordinary pinned chats visible while NiakGPT suppresses only the native Project rows it replaces.
- New `host-dom-v125.js` normalizes both legacy `conversation-turn-*` messages and the grouped `data-turn-key` / `data-content-search-unit-key` renderer.
- Activity tracking, turn headers, performance guards, load guards, continuity, interruption recovery, scroll follow, Coach and Project Memory now consume that shared adapter.
- The modern `data-composer-markdown` ProseMirror editor is recognized by the core runtime, boot gate, MAIN-world bridge, long-run watchdog and continuity handoff.
- Cross-engine regression fixtures cover sidebar remounts and a conversation fixture containing no legacy turn/composer selectors.

## Validation boundary

GitHub CI validates source invariants, package construction and synthetic browser reproductions on Chromium, Firefox and WebKit. An authenticated production ChatGPT tab cannot be inspected by the connected-browser policy in this session, so that last live-session check is not claimed here.
