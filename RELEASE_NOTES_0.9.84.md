# NiakGPT 0.9.84

- Wait for ChatGPT's real primary navigation instead of mounting Projects into a transient sidebar fallback.
- Detect late native navigation/Projects hydration and retire/remount a fresh Pins block into the authoritative slot without reparenting the same DOM node.
- Keep Project Memory GitHub controls mounted during live progress/state updates, including transient GitHub token/session refresh states.
- Let a visible tab own the dedicated Project Memory sync lock; hidden tabs preserve the queue and yield instead of holding a 0% sync.
- Start the persistent bootstrap queue immediately from the visible tab after vault connection and expose conversation-level progress.
- Add dedicated Chromium/Firefox/WebKit field-regression coverage for late sidebar hydration and stable GitHub controls, plus a Chromium visible-owner queue test.
