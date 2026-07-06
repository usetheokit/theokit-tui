# Logged deviations — m2-tool-surface

| # | Task | Deviation | Why | Mitigation |
|---|---|---|---|---|
| DV-1 | T2.2 | Shell-envelope branch landed during T2.1 GREEN (EC-2 source-exclusivity forced `resolveContent` to understand `shell`, and the envelope came with it) — T2.2's 10 tests passed first-run (protection suite, not RED-first) | Parsimony miss at T2.1: implemented one task ahead | All 10 T2.2 oracles assert concrete strings/absences (not vacuous); EC-3/EC-7/EC-12 verified against implementation reading; flagged for /review cross-validation |
| DV-2 | T1.2/T2.1 | Two commits carried a follow-up (prettier pass / SEPA batch) instead of one atomic commit per task (SEPA F10) | gates run caught format after commit | Process fixed from T2.2 on: prettier BEFORE commit, commit only on gates=0 |
