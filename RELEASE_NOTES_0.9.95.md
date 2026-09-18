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
