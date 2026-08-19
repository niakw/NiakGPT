# Runtime Project targeting invariant

Real-browser runtime labs must select a Project by its stable `g-p-*` identifier or canonical href. They must never assume that the first visible Project is a fixed Project: NiakGPT intentionally sorts Projects by core status, recency, then name, so progressive indexing can change visual order during startup.
