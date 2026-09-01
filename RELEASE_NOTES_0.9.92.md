# NiakGPT 0.9.92 — field Projects slot + worker errors

## Sidebar

ChatGPT can expose Project rows without a visible Projects heading and without canonical Project hrefs. The previous placement fallback could then classify a large sidebar container as the primary tail and mount Pins near the footer.

0.9.92 uses exact cached Project-name identities to locate the native Project host, rejects containers that also contain generic conversation links, and bounds primary-tail growth. The field fixture mirrors that morphology and requires the managed Pins block to stay immediately before the native Project block across a full React sidebar remount.

## Extension worker errors

The GitHub manifest-registration flow previously called `chrome.tabs.remove()` without consuming its Promise. A tab-close race could therefore surface as an unhandled service-worker rejection. The close is now awaited in a quiet helper.

Redacted service-worker errors are also retained in a small local ring and surfaced as `extension-errors` in the NiakGPT diagnostic.

## Native ChatGPT 410

NiakGPT does not call `/backend-api/f/conversation/resume`. The current static gate now rejects that route anywhere in the shipped runtime and still forbids replacing global `fetch`. A 410 reported by the browser on that endpoint is therefore a native ChatGPT resume attempt, not a NiakGPT backend call.
