# NiakGPT 0.9.125 — ChatGPT sidebar redesign compatibility

> A compatibility release for the redesigned ChatGPT Web navigation.

NiakGPT 0.9.124 was released before the major ChatGPT Web sidebar change observed at the end of September 2026. The extension already had a geometry-aware sidebar finder, but it was initialized too late: metadata, Projects, Pins and icon modules could run first and fall back to assumptions about the older DOM.

## What changed

- The v131 sidebar finder now initializes before every sidebar consumer.
- Detection accepts semantic navigation containers and the newer Pinned / Projects / Recents sortable or draggable structure.
- Nested navigation columns are promoted to the full left sidebar shell when geometry shows they are only an internal lane.
- Sidebar metadata, native icon decoration and Projects authority reuse the same finder before any legacy fallback.
- A dedicated regression fixture models the post-September structure without relying on `data-testid="conversation-sidebar"`.
- The fixture also remounts the semantic navigation like a SPA update and verifies that NiakGPT remains attached to the full left shell.
- Current Finalization runs the new scenario on Chromium, Firefox and WebKit.

## Validation boundary

The release gates validate source invariants, packaging and a browser-level synthetic reproduction of the redesigned sidebar. They do not claim an authenticated production ChatGPT session was exercised from this run because the connected browser policy does not expose the live chatgpt.com DOM to the assistant.
