# Runtime integration scenarios

The Visual Lab tests more than static screenshots. Its runtime suites exercise deterministic ChatGPT-shaped surfaces and, for selected gates, load the real unpacked Manifest V3 extension.

Reference scenarios include:

- first install and upgrade behavior;
- `document_start` bootstrap and hydration races;
- exactly one managed NiakGPT Projects block;
- verified left-sidebar placement instead of central/temporary lookalikes;
- stable Project order and catalogue/drawer scroll;
- user scroll taking priority over stale restoration timers;
- Project/chat action menus across remounts and BFCache;
- waiting/thinking/executing activity transitions;
- Project move, manual lock and explicit unlock;
- Safe Mode and WORKER/CLIENT coordination;
- Command Palette/Quick Open;
- two-tab coordination with exactly one WORKER;
- composer continuation residue cleanup;
- long-run watchdog behavior and user-draft protection;
- quiet home-shell geometry and accessibility;
- conversation-limit continuity and exact Project targeting.

A regression in a declared scenario should fail the relevant workflow rather than be hidden by a looser assertion.

See [../TESTING_TRUTH.md](../TESTING_TRUTH.md) for the evidence level of each test class.
