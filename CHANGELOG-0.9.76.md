# NiakGPT 0.9.76

- Adds a bounded long-run watchdog for analyses/executions that approach the observed 5–7 minute interruption window. At 4m40 it prepares a continuation turn; if ChatGPT is still actively generating and cannot accept the turn yet, the resume stays armed and is sent as soon as the composer becomes available.
- Preserves user drafts and disables automatic continuation after explicit cancellation (`stop`, `arrête`, `annule`, etc.).
- Uses the native ChatGPT Stop control as an additional busy signal so NiakGPT does not falsely return to idle during silent long work.
- Hardens pinned Project/chat interaction against React remounts between pointer down and click, especially in Brave/macOS.
- Enriches the Project `…` menu with Project context, instructions, native personalization access, and a direct new-chat action.
- Adds native conversation-limit handoff that carries the full continuity capsule into the same Project, sends it automatically, and then locks the new chat back to the exact Project.
- Makes turn headers prefer native timestamps and retain reliable live timestamps for new user/assistant turns.
- Speeds bootstrap by removing the long fixed post-load settling delay, while retrying runtime injection if the first attempt races ChatGPT hydration.
- Adds focused Chromium and macOS Brave stable regression coverage plus package/static invariants for the new runtime.
