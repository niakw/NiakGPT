# NiakGPT 0.9.100 — Field sidebar shell + deterministic SPA wake

## What changed

The remaining field screenshot regression was not a CSS-width problem. ChatGPT could expose a narrow nested semantic `nav/aside` while the real left-sidebar shell was an unlabelled `div`. NiakGPT correctly applied `grid-column: 1 / -1`, but only inside the wrong half-width parent.

0.9.100 promotes that enclosing left shell when geometry and native controls prove it owns the same sidebar. The direct-once rule is preserved: v121 retires the stale node and creates a fresh Projects block in the newly authoritative host rather than reparenting a live React-adjacent node.

Canonical server indexing and both automatic classifiers now also listen to SPA `navigation.navigatesuccess`. A classifier pass that was intentionally blocked while a conversation was visible can therefore restart after leaving the chat without waiting for an unrelated storage/activity event.

## Verification targets

- nested semantic half-column fixture becomes full-width after v131 verification;
- generic Chats remain outside the managed Projects block;
- shallow classification is blocked in-chat, its first timer is allowed to die, then SPA navigation alone restarts it;
- static gates require the new shell-promotion and SPA-wake invariants;
- existing hydration, Projects authority, scroll, accessibility and browser-matrix gates remain required.
