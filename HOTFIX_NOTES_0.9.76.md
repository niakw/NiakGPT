# NiakGPT 0.9.76 hotfix

This hotfix addresses live regressions reported after the 0.9.76 merge:

- hydration-safe runtime bootstrap to reduce React hydration collisions;
- shell retention when ChatGPT remounts and removes the NiakGPT right rail/panel/status nodes;
- long-run watchdog now primes the composer before resolving the native send/queue control, matching real Brave/ChatGPT behavior;
- Project menu now opens ChatGPT's real native **Paramètres du projet** dialog rather than approximating settings;
- native conversation-limit CTA inside the assistant turn is intercepted before ChatGPT's last-message-only handoff and sends the full NiakGPT continuity capsule/history;
- focused Chromium/Brave fixture coverage reproduces the real empty-composer send-control behavior, shell remount, native Project settings modal, and in-turn native limit CTA.

The specific console 404 reported for a slugged `/backend-api/gizmos/g-p-…-niakgpt/conversations` URL is not emitted by NiakGPT's normalized Project-conversation calls (NiakGPT strips the route slug before its own Project id requests). It is therefore tracked as a native ChatGPT request unless new evidence ties it to an extension RPC.
