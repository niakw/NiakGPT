# NiakGPT 0.9.124 — Project Memory that knows when it’s done

> **A reliability release for people who use ChatGPT as a real workspace.**  
> 0.9.124 makes Project Memory converge cleanly, stop retrying work that cannot progress automatically, and keep automatic progress honest.

NiakGPT is built for long-running work: many Projects, large conversations, continuity across threads and an optional private memory that you control.

Version **0.9.124** focuses on one thing that matters deeply for that promise: **when Project Memory reaches the end of the work it can actually perform, it now stops cleanly instead of looping forever.**

---

## ⚡ The headline

Before 0.9.124, a Project could visibly bounce between:

```text
Transfert prioritaire 96% · conversation 22/23
```

and:

```text
Transfert prioritaire en attente · 1 Project(s)
```

The remaining gap could come from a server-side conversation count that no longer matched the conversations available in the current cache. NiakGPT kept treating that stable mismatch as new work.

**0.9.124 changes the contract:** a stable inventory gap is a bounded repair signal — not permission to retry forever.

---

## ✨ What changes

| | 0.9.124 behavior |
| --- | --- |
| **✅ Automatic convergence** | A stable inventory mismatch is observed, retried in a bounded way, then moved to an explicit `inventory-stalled` state instead of rebuilding the queue forever. |
| **📊 Honest progress** | Conversations already moved to the manual retry pile count as handled by the automatic pass, so one quarantined chat no longer keeps the UI artificially stuck at 96% or 22/23. |
| **🔁 Resume on real change** | NiakGPT only makes the Project eligible again when the cache/inventory signature actually changes. |
| **🧯 No hidden retry loop** | Once the stable gap is classified, the persistent queue is removed and priority mode ends. |
| **🧠 Archive semantics stay correct** | A quarantined conversation is still incomplete until it is recovered; it simply stops blocking unrelated automatic work. |
| **🧪 Regression-backed** | Chromium release gates reproduce the stable-gap and quarantined-chat scenarios and require convergence to idle. |

---

## 🧠 Why this matters

Project Memory is not useful because it can copy conversations once. It is useful when it can become a **durable continuity layer** without constantly fighting the browser, ChatGPT or its own recovery logic.

0.9.124 strengthens that model:

- automatic work has a clear end state;
- exceptional conversations remain visible instead of poisoning the whole queue;
- real inventory changes can still wake the Project later;
- the archive remains private and user-controlled;
- normal ChatGPT usage is not held hostage by a memory transfer that has nothing new to do.

That makes Project Memory behave less like a background import script and more like part of a reliable workspace.

---

## 🔒 Private by design

Project Memory remains **optional and disabled by default**.

When enabled, NiakGPT writes Project archives only to a **private GitHub repository selected by the user**. The public NiakGPT repository never becomes a memory destination, and NiakGPT does not require its own cloud account, analytics service or telemetry backend.

The full conversation archive stays in the private repository. Normal prompt continuity uses only bounded compact state when needed.

---

## 🛠 Under the hood

0.9.124 introduces a compact inventory-gap signature based on the canonical Project identity, known conversation count, cached conversation count and indexed state.

The scheduler now follows a bounded sequence:

1. detect the unresolved inventory gap;
2. allow the normal repair/refresh path;
3. compare the resulting inventory signature;
4. if the exact same gap remains stable, stop automatic requeueing;
5. wait for a real cache/inventory change before making the Project eligible again.

Conversations moved to the manual retry pile are considered **handled by the automatic pass**, while remaining explicitly incomplete in the archive until a manual recovery succeeds.

---

## 🧪 Release confidence

The release gate now covers the exact failure modes that motivated 0.9.124:

- Project alias deduplication;
- stable known-count/cache-count gaps;
- priority transfer convergence;
- quarantined conversation progress;
- idle state after the final automatic unit of work;
- queue removal and `prioritySync:false` after convergence.

The regression contract is simple: **a Project that cannot make further automatic progress must not keep pretending that it can.**

---

## 🚀 NiakGPT in one sentence

**NiakGPT turns ChatGPT into a local-first power workspace for Projects, long conversations, continuity and optional private memory — without replacing the native ChatGPT experience.**

### Upgrade notes

No migration step is required for 0.9.124. Reload the extension and existing ChatGPT tabs after updating.

For the full technical history, see [CHANGELOG.md](CHANGELOG.md).  
For the architecture and ownership model, see [ARCHITECTURE.md](ARCHITECTURE.md).  
For privacy guarantees, see [PRIVACY.md](PRIVACY.md).
