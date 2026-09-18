# NiakGPT 0.9.94 — post-0.9.93 audit hardening

## Live-generation scroll

The conversation scroll guard now selects only a genuinely scrollable element. Non-scrollable wrappers that happen to have a large `scrollHeight` can no longer become the authority.

User intent is scoped to the active conversation scroller:

- wheel input on another surface such as the sidebar is ignored;
- Arrow/Page/Home/End and Space inside editable controls are treated as text editing, not conversation navigation;
- `Shift+Space` outside an editable control releases bottom-follow as an upward navigation gesture;
- touch start/move direction is tracked so upward reading releases the follow state and returning to the bottom re-arms it.

## Projects recovery

A recent conversation whose title happens to equal a Project name is no longer accepted as evidence that ChatGPT has rendered the native Projects surface. Generic `/c/...` rows are excluded before the local fallback is hidden.

## Regression coverage

The user-reported cross-engine gate now includes:

- a false native-Projects mirror made only of chat titles;
- a large non-scrollable decoy around fake assistant content;
- sidebar scrolling while a live answer grows;
- composer keyboard navigation;
- touch release/re-arm behavior;
- `Shift+Space` upward reading.

The 0.9.93 GitHub write serialization, cold canonical recovery and full historical classification behavior remain unchanged.
