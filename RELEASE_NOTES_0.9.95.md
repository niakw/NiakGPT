# NiakGPT 0.9.95 — authoritative GitHub ref reads

## Field regression fixed

A vault could still report:

`cached_bootstrap_write_failed:github_http_422:Update is not a fast forward`

even though 0.9.93 already retried non-fast-forward responses.

The remaining race was at the ref-read layer. Mutable `refs/heads/<branch>` responses must be authoritative; a browser HTTP cache can otherwise make every retry rebuild on the same stale parent.

## 0.9.95 behavior

- GitHub Project Memory API requests use `cache: 'no-store'`.
- After creating a candidate commit, NiakGPT re-reads the branch head immediately before PATCH.
- If the head changed, it rebuilds on the new parent without issuing a doomed PATCH.
- A race in the final read→PATCH window is still handled by bounded 409/422 retry.
- Retry budget is 8 with a maximum 3 s backoff.
- No force-push path is introduced.

## Runtime diagnostic cleanup

The browser-standard ResizeObserver delivery warnings are no longer classified as NiakGPT extension failures. Other runtime errors remain visible and are covered by the field regression gate.


## Real Brave/macOS field fixes

The first 0.9.95 candidate exposed a testing gap: Brave/macOS was present in CI, but the exact user-reported scroll and local-recovery sidebar paths were still exercised only through synthetic Chromium/cross-engine fixtures.

The release gate now runs that exact regression script with Brave stable on macOS.

### Live answer scrolling

- Detect the scroll container by walking upward from the last real conversation turn.
- Include wrappers above `main`, matching current ChatGPT shell layouts.
- Arm follow mode at user send intent, before native activity state necessarily appears.
- Survive native post-send and late-frame scroll corrections with a bounded settle.
- Preserve explicit upward reading immediately.

### Projects sidebar

Local-only recovery no longer makes ChatGPT's native Project tree the visible authority. The local fallback and canonical catalogue are two data states of the same NiakGPT Projects surface. As soon as that surface is usable, v112 hides native Project surfaces synchronously. This removes the mixed ChatGPT/NiakGPT menu state seen in the field.
