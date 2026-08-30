# NiakGPT 0.9.80 — React hydration barrier hotfix

This hotfix addresses a real display regression reported with a minified React **#418 hydration mismatch**.

## Root cause

NiakGPT's heavy runtime already waited for ChatGPT hydration, but five pre-runtime content scripts were still loaded at `document_start` and could start observers, timers or DOM-facing behavior before React had finished reconciling the server-rendered HTML.

## Fix

- A single host-hydration barrier is owned by `boot-gate-v100.js`.
- The barrier waits for the ChatGPT shell, page load, a stronger DOM quiet window and additional animation frames.
- Only then does it set the host-hydrated state and dispatch `niakgpt:host-hydrated-v100`.
- All five pre-runtime modules defer their entire `init()` until that signal.
- Before the signal, those modules perform no DOM mutation, no HTML attribute change, no observer setup and no timer-based page logic.

## Regression proof

`visual-lab/hydration-barrier-v080.mjs` loads the full `document_start` sequence in manifest order — boot gate first, then the five pre-runtime scripts — against an SSR-shaped ChatGPT fixture. It snapshots the HTML during the boot gate quiet window and asserts byte-for-byte DOM stability with every pre-runtime still dormant. The real boot gate must then emit the host-hydrated signal itself, after which the lab verifies that all five modules activate.

The test runs across Chromium, Firefox and WebKit through the current Public Quality Gate.

## Other behavior

Project Memory GitHub sign-in, sidebar ownership, long-run continuation, Project menus and the PAT fallback are unchanged except that their pre-runtime helpers now activate only after host hydration.
