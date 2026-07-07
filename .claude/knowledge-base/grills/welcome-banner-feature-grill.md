---
slug: welcome-banner
generated_by: roadmap-feature
date: 2026-07-07
status: completed
---

# Feature grill: welcome-banner

## Q1 — What & why now
**Answer (user-selected):** Banner + sistema de slots genérico — `WelcomeBanner`
no estilo Claude Code/gemini-cli (box com borda accent, nome/logo, versão,
cwd/modelo, hint rows) COM slots/children arbitrários para composição livre.
Why now: M8 (dogfood `examples/live-agent-tui` + TheoCode) precisa montar
exatamente esse padrão; entregar antes evita reinvenção por consumidor.

## Step 3 — Out-of-scope cross-check
**Overlap detected:** "Generic TUI components (… layout widgets)" ×
"sistema de slots genérico".
**Decision (user):** out_of_scope_overlap_false_positive: "Generic TUI
components (menus, tables, forms, generic spinners, layout widgets)" — o
banner é padrão AI-native; slots = children React idiomático, não framework
de layout. Item do out-of-scope permanece intacto.

## Q2 — Dependencies
**Answer (user-selected):** M6 (theme + robustness foundation) — dependência
técnica real: tokens de tema (accent/name) + degradação NO_COLOR. M9 fica
elegível quando o flip do M6 acontecer (release travado só pelo billing).

## Q3 — Definition of Done
**Answer (user-selected):** DoD completa — 5 bullets:
1. `WelcomeBanner` exportado do entry com props `name`/`version`/`tagline?`/`hints?`/`children` (slots).
2. Consome tokens do tema (accent/borda) e degrada limpo em NO_COLOR/term dumb — coberto na degrade-matrix.
3. Unit + integration via composition root + 1 snapshot ancorado.
4. `examples/` atualizado consumindo o banner + smoke subprocess.
5. Gates verdes; coverage do módulo 100% linhas; CHANGELOG.

## Q4 — Top 2 new risks
**Answer (user-selected):**
- **R1 scope-creep:** slots genéricos como porta de entrada para "generic
  layout widgets" (o out-of-scope). Mitigação: API mínima (children único,
  sem grid/colunas), guard explícito no review.
- **R2 largura de terminal:** banner com borda quebra em terminais estreitos
  (<40 cols) ou sem box-drawing. Mitigação: teste de largura mínima +
  cobertura na degrade-matrix.

## Step 5 — SOTA delta
**Decision (user):** mini SOTA pass. Added: opencode (MIT), oh-my-logo
(MIT+CC0-1.0), ascii-motion (MIT). Excluded by license gate: crush (FSL-1.1
source-available). Dispensed: aider (Python, trivial banner).

## Outcome
status: completed — M9 appended to ROADMAP.md on 2026-07-07.
