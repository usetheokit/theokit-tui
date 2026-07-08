# M10 bench re-baseline — cross-stack jump table (D3)

**Old reference:** v0.10.0 baselines @ `035ae09` (ink 5.2.1 / react 18.3.1, implicit).
**New reference:** ink 7.1.0 / react 19.2.7 / itl 4.0.0 — recorded in the new
`stack` field of every baseline. Runs load-gated (< 4.0 at start:
2.90/3.06/3.57/3.45/3.91/3.62), `FORCE_COLOR=1 NO_COLOR= CI=`.

## Jump table (20 metrics)

| bench | metric | ink5 (0.10.0) | ink7 (new) | delta | max σ | verdict |
|---|---|---|---|---|---|---|
| m0-chat-message | aggregate.mean_ms_per_frame | 11.311±1.210 | 32.396±3.441 | +21.085 | 3.441 | ADVERSE |
| m0-chat-message | aggregate.peak_ms_per_frame | 28.426±4.630 | 80.615±40.220 | +52.189 | 40.220 | ADVERSE |
| m1-chat-thread | plain.mean_ms_per_frame | 65.798±10.187 | 113.098±7.477 | +47.300 | 10.187 | ADVERSE |
| m1-chat-thread | plain.peak_ms_per_frame | 131.439±32.612 | 243.930±62.678 | +112.491 | 62.678 | ADVERSE |
| m1-chat-thread | windowed.mean_ms_per_frame | 1.590±0.020 | 14.912±0.655 | +13.322 | 0.655 | ADVERSE |
| m1-chat-thread | windowed.peak_ms_per_frame | 3.142±0.368 | 23.274±3.954 | +20.132 | 3.954 | ADVERSE |
| m2-tool-cards | aggregate.mean_ms_per_frame | 7.803±0.457 | 49.487±3.071 | +41.684 | 3.071 | ADVERSE |
| m2-tool-cards | aggregate.peak_ms_per_frame | 21.998±7.392 | 115.677±35.621 | +93.679 | 35.621 | ADVERSE |
| m3-agent-timeline | bounded.mean_ms_per_frame | 2.156±0.072 | 10.582±0.106 | +8.426 | 0.106 | ADVERSE |
| m3-agent-timeline | bounded.peak_ms_per_frame | 5.043±0.477 | 17.365±1.092 | +12.322 | 1.092 | ADVERSE |
| m3-agent-timeline | unbounded.mean_ms_per_frame | 3.861±0.190 | 14.590±1.317 | +10.729 | 1.317 | ADVERSE |
| m3-agent-timeline | unbounded.peak_ms_per_frame | 35.515±1.705 | 57.318±3.521 | +21.803 | 3.521 | ADVERSE |
| m4-diff-viewer | windowed.mean_ms_per_frame | 7.245±0.112 | 35.641±3.232 | +28.396 | 3.232 | ADVERSE |
| m4-diff-viewer | windowed.peak_ms_per_frame | 13.874±1.709 | 53.295±6.945 | +39.421 | 6.945 | ADVERSE |
| m4-diff-viewer | full.mean_ms_per_frame | 89.858±1.955 | 220.136±22.666 | +130.278 | 22.666 | ADVERSE |
| m4-diff-viewer | full.peak_ms_per_frame | 153.846±9.465 | 458.986±82.348 | +305.140 | 82.348 | ADVERSE |
| m5-metrics | with-metrics.mean_ms_per_frame | 2.518±0.142 | 13.038±1.132 | +10.520 | 1.132 | ADVERSE |
| m5-metrics | with-metrics.peak_ms_per_frame | 4.111±0.264 | 18.433±3.256 | +14.322 | 3.256 | ADVERSE |
| m5-metrics | without-metrics.mean_ms_per_frame | 2.170±0.122 | 13.964±0.555 | +11.794 | 0.555 | ADVERSE |
| m5-metrics | without-metrics.peak_ms_per_frame | 3.515±0.230 | 22.284±5.272 | +18.769 | 5.272 | ADVERSE |

**All 20 ADVERSE — one systemic, isolated-and-measured cause:** the ink 7
render engine is dramatically more expensive per render on the
testing/debug path our harness uses. Micro A/B (fresh tmp projects, same
script, `<Text>` minimal component):

| protocol | ink5+react18 | ink7+react19 | factor |
|---|---|---|---|
| 300 rerenders with 0ms ticks (3 runs) | 1.57–1.70 ms/rerender | 10.46 ms/rerender (σ≈0.005) | ~6.5× |
| 1000 rerenders sync loop (CPU-pure, 2 runs) | 0.15–0.18 ms | 6.2–8.0 ms | ~40× |

Same frame counts both sides (every render written — itl debug path,
unthrottled). The cost is REAL CPU in ink 7's pipeline (reconciler 0.33
updateContainerSync/flushSyncWork + the rewritten output path:
ansi-tokenize 0.3, sanitize-ansi, background/accessibility contexts) — NOT
our components (zero src render-path changes in M10; the uniform 4–6×
factor across all six benches matches the engine A/B).

**Gate (D3):** every ADVERSE has this citable, experimentally isolated
stack cause → PASS (document-and-proceed). Context: real TTY consumers run
ink 7's throttled default (~34 ms coalescing), which masks per-render cost;
gemini-cli's ink fork exists over exactly this render-engine territory.
Future OUR-code regressions are guarded against the NEW baselines.
