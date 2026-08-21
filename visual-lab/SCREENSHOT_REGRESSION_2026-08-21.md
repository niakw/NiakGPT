# Production screenshot regression — 2026-08-21

Observed on authenticated ChatGPT with NiakGPT enabled:

- managed Projects header showed `1` and only `Films` while the custom catalog had not proved a complete Project inventory;
- ChatGPT's native Project surface had already been suppressed;
- native sidebar controls such as Bibliothèque / Planification / Plugins visibly inherited NiakGPT border/shadow decoration.

0.9.73 release contract:

- an unverified or partially rendered managed Project inventory stays hidden;
- native ChatGPT Projects remain available until server inventory is verified and the managed renderer contains at least the verified count;
- one Project cannot self-certify on the first inventory scan;
- native sidebar rows must not inherit NiakGPT borders/shadows;
- fixture-based CI is described as fixture testing, not authenticated live/human validation.
