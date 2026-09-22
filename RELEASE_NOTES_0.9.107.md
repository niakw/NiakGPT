# NiakGPT 0.9.107 — document-root hydration ownership

## Why 0.9.106 was still insufficient

The MAIN-world probe fixed Chrome/Brave isolated-world visibility of React internals, but it could still authorize NiakGPT once the HostRoot reported `isDehydrated === false` and two functional host nodes were React-owned. The field error reported after that release is still React #418 with `HTML` as the mismatching server-rendered element.

That exposed a narrower full-document race: React can own `nav/main/composer` while the document root itself is not yet safe for extension attributes.

## Fix

On current full-document ChatGPT pages, the service-worker MAIN-world probe now requires all of the following before the isolated boot gate may mutate the page:

- HostRoot exists and `memoizedState.isDehydrated === false`;
- `document.documentElement` is React-owned;
- `document.body` is React-owned;
- at least two ChatGPT host identities are React-owned;
- the same document-root proof remains true after the confirmation frames.

Only then may NiakGPT set its hydration proof, insert deferred CSS, inject the MAIN/isolated runtimes, or mount sidebar UI.

## Regression proof

`visual-lab/tests/hydration-document-root-v107.spec.js` loads the real unpacked MV3 extension and intentionally creates this sequence:

1. React container exists;
2. nav/main/composer are already owned;
3. HostRoot becomes settled;
4. HTML/BODY remain unowned for several additional seconds;
5. HTML/BODY finally receive React ownership.

Before step 5 the test requires zero `data-ng*` attributes, zero `ng8-ready`, zero NiakGPT rail and no extension-owned node. After step 5 it requires `react-document-root-settled` and the normal rail.

The test runs in both Chromium and Brave Live Stability jobs.
