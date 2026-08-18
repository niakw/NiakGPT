# NiakGPT 0.9.60 — Sidebar integration stabilization

Draft release note used while the 0.9.60 branch is under validation.

- One production owner for Project drawers: `project-drawer-v110.js` disables the historical `pin-folders-v096.js` and `project-chat-ux-v109.js` mutators before they can compete for the same DOM.
- Native ChatGPT Projects are hidden structurally by `sidebar-native-projects-v110.js/css`, independently of Project readiness heuristics.
- Project chat rows keep stable DOM identities during cache refreshes; titles remain ellipsized and date/status columns have fixed geometry.
- Project conversations remain native anchors for ordinary navigation, right click, middle click and Ctrl/Cmd click.
- The current conversation gets a distinct active state and `aria-current=page`.
- Conversations detected at the context/message limit keep a persistent local `OUT` state from the continuity store, receive a visible status and are sorted after usable conversations.
- Adds a permanent Chromium / Firefox / WebKit integration lab that intentionally loads both the new and historical sidebar modules together to prevent the false-green isolation gap seen in 0.9.59.
