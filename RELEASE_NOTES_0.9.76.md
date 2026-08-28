# Release notes — 0.9.76

NiakGPT 0.9.76 is the current native-first v131 baseline.

The release stabilizes Projects inside the verified ChatGPT left sidebar, keeps Project/drawer scroll under user control, hardens action menus across React remounts and BFCache, and replaces intrusive permanent chrome with a quiet dock/status capsule.

Parallel additions now use the compact `↳ Suite en parallèle` marker. The long-run watchdog uses a 6m30 safety window and never parks automatic resume text in the composer while ChatGPT is still generating. User-modified drafts are preserved.

The release is covered by static/package checks, Chromium/Firefox/WebKit fixtures, Linux/Windows/macOS experience runs, real MV3 browser fixtures and a focused macOS Brave stable gate.
