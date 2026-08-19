# NiakGPT v120 — user regression matrix

This gate is intentionally based on the concrete failures reported against the live ChatGPT sidebar rather than a synthetic happy path.

- legacy `sidebar-host-v090` first places `#ng8-pins` before the native navigation; `sidebar-resilience-v120` must move it back to the native Projects slot
- Projects remain present on chat routes, home, Library and Projects pages
- a Project name toggles its drawer and must never navigate to the Project landing page
- a Project with 14 conversations has an independently scrollable drawer and the final row is reachable
- route changes select the exact active conversation and scroll it into view
- repeated composer input and streamed DOM growth must not change the Projects slot geometry or parent/sibling identity
- Project and chat ellipsis buttons expose ChatGPT's native menu only; a second click closes it and no NiakGPT fallback menu appears
- the disposable home greeting is hidden so it cannot cause layout jumps
- native verification sets the bridge pause flag exactly to `1`; NiakGPT never attempts to bypass the verification and may only use native Retry after the check disappears
- a transient connection-lost state preserves the draft and may invoke ChatGPT's native Retry once after recovery
- a conversation-limit signal is converted into continuity state
- exact continuity inserts the new chat into `chats` and `projectChats`, updates counts/index state, keeps the Project drawer open, and locks the new chat to the source Project

Executable gate: `visual-lab/sidebar-user-regressions-v120.mjs`.
