# Edge-Case Review — m3-agent-surface plan (2026-07-06)

Fresh-eyes adversarial pass (agent) over plan v1.0 → all findings ABSORBED into plan v1.1.

| Severity | IDs | Disposition |
|---|---|---|
| MUST-FIX | EC-1 (output⊕shell conflict — mid-render swallow), EC-2 (role/status validated at boundary, not in children), EC-3 (thought="" contradiction — `\|\|` normative) | D8 widened to FULL per-variant validation; D4 fixed; RED oracles added |
| SHOULD | EC-4 (floor fractional), EC-5 (empty-id parity), EC-6 (clamp knobs), EC-7 (unreachable switch default — scoped pragma note in D3), EC-8 (same-ref push pin), EC-9 (per-mode EC-15 guard), EC-10 (formatElapsed export site) | Absorbed (oracles/notes) |
| NICE | EC-11 (no days unit), EC-12 (extra props tolerated), EC-13 (ANSI pass-through JSDoc), EC-14 (test-count fix ~41) | Absorbed |

Root cause of the 3 MUST-FIX: variant-field validation delegated to child guards that fire
mid-render (Ink swallows — F10). Fix: one full structural check at the AgentTimeline
boundary (~10 lines), errors prefixed `AgentTimeline:`. Requires additive exports
CHAT_ROLES (chat-message) + TOOL_CALL_STATUSES (tool-call). Full agent report in transcript.
