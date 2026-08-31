# NiakGPT 0.9.87

## ChatGPT conversation network safety

0.9.87 changes the default from “background work may run when ChatGPT looks idle” to a hard safety boundary: **automatic NiakGPT GETs to ChatGPT’s internal backend do not run while a visible ChatGPT conversation is active**.

### What changed

- server indexing no longer starts ~80 ms after extension activation;
- rapid bootstrap force-index retries are removed;
- automatic background GETs are rejected centrally on conversation routes and when another visible tab/window is chatting;
- Project Memory waits five quiet minutes off conversation routes and spaces full-history reads by at least 20 seconds;
- its local wake heartbeat is reduced to one check per minute;
- user-triggered Project drawer hydration remains available while ChatGPT is genuinely idle.

### Regression coverage

`visual-lab/native-chat-zero-background-v087.mjs` fails if chat startup emits any automatic NiakGPT RPC, auth-session read or backend GET. It also checks cross-tab quarantine and verifies that an explicit foreground read still yields to native generation.

### Testing scope

The gate is synthetic and proves NiakGPT’s own traffic contract. It is not a substitute for an authenticated production-account field test, and release claims must keep that distinction explicit.
