# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Fixed

- **The edge-case coverage analyzer counts what a plan declares, and finds the tests the plan names
  (B-018).** Its ratio gates a release — below 0.80 the review returns `NEEDS_DEEPER` — and it was
  reporting 13 cases for a plan declaring 4 (ratio 0.385) and 27 for one declaring 7 (0.222). Both
  now report their real count and 1.0. Three defects: the same bullet extracted twice in two
  spellings, every keyword-bearing bullet anywhere in the document counted as an edge case
  (including Baseline Context citations and Unresolved Questions), and a matcher demanding all five
  longest words co-occur in one file — which missed three cases whose named tests exist. The
  analyzer now reads the `#### TDD` block that names the covering test, and the script has its first
  test file: 14 tests, 7 mutants, 7 detected.

### Added

### Changed

### Deprecated

### Removed

### Fixed

- **A stale `## [Unreleased]` section was sitting in the middle of this file (B-046).** It lived
  between the 0.52.0 and 0.51.0 releases and repeated an entry already filed under 0.52.0, so the
  file had two sections claiming to hold unreleased work. Nothing was actually unreleased and
  nothing was undocumented — it was residue from an old promote that copied instead of moving — but
  a reader had no way to know that without checking which heading each sat under.

  The release tool matched the first heading and stopped, so the second was never seen rather than
  skipped with a warning. It now refuses a CHANGELOG carrying more than one, naming both line
  numbers, instead of promoting past it in silence.

### Security

## [0.64.0] - 2026-08-18

### Added

- **`ComponentBoundary` — a component failure no longer takes the whole application, the user's
  session, and the shell's idea of success with it (B-031).** Measured against real `ink@7.1.0`: a
  component that throws from a prop guard unmounted the ENTIRE tree, printed ink's ERROR panel to
  the end user with an absolute source path and a source excerpt, and left the process exiting
  **0** — a CLI that died reporting success to its shell, so any script, CI job or supervisor
  treated the crash as a clean run.

  Wrapped, the same failure renders one dim line, the siblings survive, and the process exits
  non-zero:

  ```tsx
  import { ComponentBoundary } from "@theokit/tui";

  <ComponentBoundary component="SelectList">
    <SelectList items={items} window={window} onSubmit={onSubmit} />
  </ComponentBoundary>;
  ```

  It records what it caught, and it does not overwrite a narrower exit code you already set — a CLI
  that exited `2` for a usage error still exits `2`. An optional `onError(error, info)` prop routes
  the error wherever you keep them; it does not suppress the record.

  **Nothing changes until you wrap something.** This package does not wrap its own components: a
  boundary renders a fallback, so doing it for you would change what 21 components render on
  failure — and whether to keep going after one is a policy you own, not one a library should take.

## [0.63.1] - 2026-08-18

### Fixed

- **The exported `VERSION` constant matched the previous release, not the current one.**
  `src/index.ts` carried `0.62.0` while `package.json` said `0.63.0` — a package that would have
  announced itself to consumers as a version it was not. Caught by `prepublishOnly`, which runs the
  contract test that compares the two, and which is the first time in ten versions that gate has run
  at all.

  0.63.0 was tagged and never published for exactly this reason. The tag stays as the record of a
  release the gate stopped; it is not rewritten, and it is not republished under the same number.

## [0.63.0] - 2026-08-18 [NOT PUBLISHED — see 0.63.1]

### Changed

- **The test suite is deterministic at default worker count again (B-057).** `pnpm gates` now exits
  0 on three consecutive runs; it had been failing intermittently on a different test each time.
  The cause was a test helper that waited for the rendered frame to STOP CHANGING — a condition
  satisfied trivially in the window between a keystroke and the render, so it handed back a stale
  frame and the assertion after it read one. It now waits for the reaction to be observed first.

  Test infrastructure only; no consumer-visible behaviour changes. Recorded because it is what
  makes the gate above trustworthy, and because the gate is what `prepublishOnly` runs.

- **The repository's own quality gate is green again, and now means the same thing on every
  machine (B-051).** `pnpm gates` had been red since v0.54.0 — which is also the first version that
  never reached npm — and `format:check` is its first link, so `lint`, `typecheck`, `test` and
  `build` had not run in any publish attempt for ten versions. 24 files were reformatted.

  The larger half is that both `format:check` and `lint` walked the FILESYSTEM rather than the git
  index, so their result depended on whatever untracked files a machine happened to have: a cache
  directory, a stray scratch file. Both now read `git ls-files`, and both refuse an empty list
  rather than reporting success — the first repair had left them exiting 0 outside a git repository,
  having inspected nothing.

  A regression test runs the real gate against a throwaway three-file repository: an untracked bad
  file is ignored, a tracked bad file is caught, and no `.git` fails closed.

  No consumer-visible behaviour changes. Recorded here because the gate is what `prepublishOnly`
  runs, so this is what unblocks publishing at all.

- **`SelectList` now shows HOW MANY rows are hidden, not just that some are (B-022).** The
  overflow chrome went from a bare `▲` / `▼` to `▲ 3` / `▼ 8`, matching what `WindowedList`
  already rendered from the identical model. Both components consume the same view object;
  one was reading the counts and the other was reading booleans derived from those same
  counts, so the same list under two public components told the user two different things
  about the same state. A boolean cannot be turned back into a number, which is why the
  counts replaced the booleans in the model in the first place — this view had kept
  discarding them.

  **API docs corrected in the same change.** `WindowedList`'s TSDoc asserted that "`SelectList`
  renders a bare `▲` and throws away the `hiddenBefore`". That shipped: `tsup` builds declarations,
  so the sentence reached `dist/index.d.ts` and consumers read it as hover text. It is now three
  lines stating what the model carries and what this component renders — no version numbers, no
  history. A package whose CHANGELOG says a divergence is fixed while its API docs say it exists has
  told the reader two things.

  A third view — the slash / mention menu inside `ChatComposer` — still renders bare arrows.
  It is not part of this change: its `SlashMenu` type hand-re-declares the window contract
  instead of extending `WindowView`, so the counts arrive at runtime but are absent from the
  type. Registered as a followup rather than silently included, so that "both components
  consume the same view object" above is not read as "every arrow in the package now carries
  a count".

  **Blast radius, measured:** `grep -rn "SelectList" modelo/TheoCode/` → **6 hits, 0
  affected**. The single render passes 4 items and no `window`, against a default of 5, so
  nothing is hidden and no arrow is drawn either before or after this change.

  **Width cost:** none, and the guarantee is structural rather than a measurement of one case.
  The count lands on the arrow row, and the counter row (`(7/12)`) is always wider than the
  arrow row for every list size — so the arrow row can never be the widest line in the frame,
  at any count. Review measured this from 10 to 100,000 items with one-character labels: the
  arrow row grows from 3 to 7 columns while the widest line goes 9 → 10, never the arrow.

  The first version of this entry claimed the weaker thing and claimed it wrongly: it said the
  row "grows from 1 to 3 bytes" using `awk '{ print length }'`, which counts bytes, where `▼`
  is 3 bytes and `▼ 8` is 5 — so 1 → 3 was a column count wearing a byte label. It also gave
  a false reason ("a menu whose labels are shorter than `▼ 999` would widen"). Corrected here
  rather than quietly dropped, because the wrong version shipped in this section.

## [0.62.0] - 2026-08-18

### Changed

- **`windowFor` and `SelectList` refuse a window they cannot describe (B-021).** The hidden-row
  counts are a partition of the list, and a non-positive or fractional window made them describe
  something else: `window = 0` put `windowStart` past the selection so nothing rendered while both
  arrows still claimed rows, `window = -1` made the counts sum to 21 in a list of 20, and `2.5` hid
  seven and a half rows. `SelectList` exposes `window` publicly and passed it through unvalidated,
  so a consumer could get a menu that advertised contents it never drew. `windowFor`,
  `deriveSelectList` and `SelectList` now all throw a typed error naming the entry point the caller
  actually used.

  **What that means concretely, measured under `ink@7.1.0` rather than described as "throws":** a
  throw from a component's render tears the whole app down, a developer stack with absolute paths
  prints to stdout, and the process exits **0**. `render()` itself returns normally — but
  `waitUntilExit()` REJECTS with the guard's own error, so a consumer awaiting it does receive it.
  An earlier draft of this paragraph said the consumer "cannot catch it", which this package's own
  probe (`guard-sink.integration.test.tsx`) and `error-handling.md` § 3.1 both contradict. That is the package idiom across 21 guarded components and it is worse than the
  wording "throws a typed error" suggests, so it is stated plainly here rather than discovered. **Refused rather than clamped**, because the
  counts exist precisely to stop information being destroyed (U-10) and clamping would destroy the
  caller's mistake instead. Blast radius measured before shipping: the only known consumer renders
  `SelectList` without a `window` prop, and its `windowFor` mentions are comments explaining why it
  does NOT use it — `grep -rn "windowFor\|SelectList" modelo/TheoCode/` → 12 hits, 0 affected.
  (b021-window-invariant-2026-08-18)

## [0.61.0] - 2026-08-18

### Added

- **`reportGuardFailure` and `GuardSink` in `@theokit/tui` (B-025).** A boundary guard that fires
  now leaves one **durable** record — `[theokit/tui] <ISO-8601> <Component>: <message>` — on a sink
  that defaults to `process.stderr` and is injectable. It buys **persistence, not visibility**, and
  the distinction is the whole point: ink's own `ErrorBoundary` already prints an `ERROR` panel with
  a stack when a guard throws, but that panel is transient stdout, erased by the next repaint or
  lost to scrollback, and `installStderrGuard` does not capture it — so an operator debugging an
  intermittent guard has nothing to read. The record is **sanitised** (the offending value is
  untrusted by construction: interpolated verbatim it injected control bytes into the terminal and
  forged a second record via an embedded newline) and carries a **timestamp**, because the blessed
  destination is a log rotating at 10 MB across 10 generations. Reporting is additive — the return
  type is `never`, so the existing throw contract is unchanged. What this does NOT fix is filed as
  **B-031**: one invalid prop still unmounts the whole app, shows the end user a developer stack,
  and exits 0. (b025-silent-guards-2026-08-18)

### Changed

- **The guard record is sanitised against every line-breaking code point, and a malformed `error` is
  refused (B-025).** `JSON.stringify` escapes C0 only, so 33 code points reached the record raw —
  including U+0085, U+2028 and U+2029, which are Unicode line terminators: a reader that splits
  Unicode-aware still saw a second, well-formed, correctly-timestamped `[theokit/tui]` record, and
  U+009B / U+009D are the 8-bit CSI and OSC introducers. `reportGuardFailure` also read
  `error.message` without checking it, so a malformed argument threw from outside the guarded
  region — no record, no loss counted, and the guard's own diagnostic replaced by a `TypeError`
  about the reporter. Both are now refused, and both are pinned: reverting either turns four tests
  red, where before each was covered by nothing. (b025-silent-guards-2026-08-18)

- **`UsagePanel` refuses an unknown `order` section (B-025).** It crashed with
  `SECTION_RENDERERS[section] is not a function` — no record, no attribution, and a message naming a
  module-private constant the caller cannot see. A repeated name still draws twice and an empty list
  still draws nothing, both documented as deliberate; an unknown name is a typo and now says so,
  naming the component and the value. (b025-silent-guards-2026-08-18)

- **`GuardSink.write` returns `boolean`, and lost records are counted (B-025).** `false` is how
  `process.stderr` and this package's own `installStderrGuard` report a write that was LOST, and
  discarding it made a dead sink silent — the very failure the sink exists to prevent, one layer
  down. Losses are now counted and readable via `lostGuardRecords()`.

  Not marked BREAKING, and the earlier draft of this entry was wrong to: it claimed
  `reportGuardFailure` "shipped in 0.60.1" with a two-argument signature. Measured with
  `git ls-tree`, `src/status/guard-sink.ts` is absent from v0.59.0, v0.60.0 AND v0.60.1 — the whole
  surface is new and has never been published, so there is no consumer to break and the entry was
  positioned to derive a false MAJOR bump. Caught by review (F-dom-7).

- **`UsagePanel` now validates every `usage` field it forwards (B-025).** It guarded `contextWindow`
  and stopped there, so a non-finite `inputTokens` failed from inside `ContextWindowBar` and a bad
  `cost` from inside `CostMeter` — both naming a component the caller never wrote. `inputTokens`,
  `outputTokens` and the optional `cacheReadTokens` / `reasoningTokens` / `cost` are now refused at
  the panel's own boundary with an error that names `UsagePanel`, using the shared
  `assertFiniteNonNegative` rather than a re-inlined copy of it. Absent optional fields still pass
  and a present `0` is still accepted: absent stays absent, and `0` is a measurement the agent
  reported. No rendering changed. (b025-silent-guards-2026-08-18)

### Fixed

- **The last two guessed budgets in the suite become measured ones (B-034).** `degrade-matrix`
  spawns `pnpm exec tsx` three times per run and budgeted 20000 ms with nothing recorded beside it;
  one spawn measures 2621 ms at load 13, so that 7.6x margin still failed with `ETIMEDOUT` at load 30. Now 60000 ms, with the measurement in the code and the better fix named rather than
  overlooked: pre-compiling the probe and spawning `node` would take it to ~100 ms and remove the
  sensitivity instead of budgeting for it. `typeUntil` in the composer suite carried the third copy
  of the 2000 ms bound that B-033 measured expiring on a correct frame, and now shares the one
  budget. Measured after: **five consecutive `npm test` runs at default workers, loads 11.46 to
  31.07, all green** — where the suite previously failed routinely at load 13.
  (b034-measured-budgets-2026-08-18)

- **Tests wait for a condition instead of for a number of milliseconds (B-033).** 13 files slept a
  fixed duration and then asserted — encoding "the effect completes within N ms", which is true on
  an idle laptop and false on a loaded one. A shared `waitFor` polls the condition each site was
  really about and fails naming what never happened, which is how a defect in a different slice was
  identified rather than mistaken for a slow test. Five fixed-duration waits remain, each carrying a
  written reason: two are poll intervals inside bounded waits (already the target idiom), two are
  fixtures where the delay IS the subject, and one asserts that something does NOT happen, which has
  no condition to poll for. Internal to the test suite; no published behaviour changed.
  (b033-wait-for-condition-2026-08-18)

- **Two test-suite defects that were being treated as one (B-020).** `npm test` at default workers
  failed for reasons unrelated to the code under test, and the failures had two different causes.
  **A budget nobody set:** `vitest.config.ts` declared no `testTimeout`, so tests ran against
  vitest's 5000 ms default while `package-contract.test.ts` takes 3004 ms on an idle machine — 60%
  of the budget before any contention. Now 15000 ms, with the measurement recorded beside it; a
  raised timeout cannot mask a race, because a race reports a wrong value rather than a timeout.
  **An assertion that read a clock:** `same_status_rerender_does_not_reset_spinner` asserted the
  spinner cell had not CHANGED across a rerender, which conflates "the interval was not reset" — the
  behaviour under test — with "no time passed", which is not ours to guarantee. It now asserts the
  invariant it always meant: the cell is a valid `dots` frame and is not frame[0]. Internal to the
  test suite; no published behaviour changed. The remaining load-sensitivity is a third class,
  filed and planned as B-033. (b020-deterministic-frames-2026-08-18)

## [0.60.1] - 2026-08-18

### Fixed

- **`WindowedList` drew NOTHING when `selected` was `NaN` (B-026).** `windowFor` clamps with
  `Math.min(Math.max(selected, 0), count - 1)`, and every comparison against `NaN` is false — so
  `clampedIndex` and `windowStart` both became `NaN`, `rows.slice(NaN, NaN)` returned `[]`, and the
  list rendered empty: no error, no log, nothing on screen. The `window` prop had a guard and
  `selected` did not. A non-integer `selected` is now refused with a typed error naming the
  component; in-range integers are still clamped, and `-1` remains the "no selection" sentinel.
  (b026-windowedlist-nan-2026-08-18)

## [0.60.0] - 2026-08-18

### Added

- **`CLEAR_SCREEN_AND_SCROLLBACK` em `@theokit/tui/terminal` (B-013).** O item foi registrado
  **esperando ser morto** — uma linha de ANSI e exatamente onde o degrau 5 da parcimonia morde — e
  sobreviveu pela clausula escrita antes de medir. `\\x1b[2J\\x1b[H`, a variante sem apagar o
  scrollback, deixa a tela em branco e o cursor no topo: e exatamente o que um reset correto
  aparenta. A diferenca so aparece quando alguem rola para cima e encontra a conversa que lhe
  disseram estar apagada — e o atraso e ilimitado. Nenhum teste deste pacote enxerga isso: todas as
  assercoes sao sobre o frame renderizado, e scrollback e o que o terminal guarda fora dele. Entao
  o que e publicado e o NOME, nao os bytes: o pacote ja tinha a sequencia oposta, privada no output
  engine, correta la porque um redraw completo e dono da tela e nao pode destruir saida que nao
  escreveu. As duas diferem por tres caracteres e significam coisas opostas. (b013-clear-screen-2026-08-18)

## [0.59.0] - 2026-08-18

### Added

- **`useRisingEdge` — dizer quando piora, e so entao (B-011).** O pacote ja publicava os CANAIS
  para avisar o usuario — `Toast`, `Notice`, `notify` — e nenhum deles impunha QUANDO: `notify`
  escreve um bell a cada chamada, e o `Toast` disciplina a dispensa, nao o disparo. Entao a regra
  era reescrita a mao em cada consumidor, e a medicao mostrou que duas das oito linhas falham em
  SILENCIO: ler o nivel anterior depois de sobrescreve-lo faz os dois serem sempre iguais e o aviso
  nunca dispara; e o booleano de escalada precisa de uma clausula por par ascendente — esquecer uma
  faz o aviso URGENTE nunca chegar enquanto o primeiro ainda chega, ou seja, o usuario foi avisado
  uma vez e acredita que esta sendo avisado. Ambas produzem "o aviso nao aparece", que e invisivel
  porque ausencia de aviso parece ausencia de problema. O hook nao carrega limiar, classificador
  nem texto: decidir em QUE nivel voce esta e politica de quem chama. Nivel fora da ordem lanca
  erro tipado, validado no corpo do render — porque um throw dentro de efeito o React nao entrega
  como rejeicao, e o teste passaria vazio. (b011-rising-edge-2026-08-18)

## [0.58.0] - 2026-08-18

### Added

- **`useCoalesced` e o `createFrameBudget` que ninguem alcancava (B-009).** A premissa do item
  estava errada, e a verdade e um achado melhor: o orcamento de frame nao faltava.
  `src/renderer/frame-budget.ts` estava completo, coberto por nove testes, e tratava um salto de
  relogio para tras **melhor** que a copia do consumidor — considera a ancora obsoleta em vez de
  clampar, porque clampar perpetua o congelamento pelo tamanho do salto em vez de limita-lo a um
  frame. Ele so era **inalcancavel**: fora de todo barrel, importado por nada alem do proprio
  teste. E `npx knip` sem config — como o `/code-quality` o roda — dizia que a arvore estava limpa,
  porque um import de teste parece uso. O codigo morto nao passou por desatencao: o gate foi
  perguntado e respondeu que estava tudo bem. Agora ele e exportado, e o hook novo e construido
  **sobre** ele. O update final e obrigatorio, nao otimizacao: sem ele a ultima mudanca da janela
  nunca renderiza — o token final de um stream — e tudo parece certo ate o stream parar. Modo
  leitor de tela zera a janela: coalescer descarta estados intermediarios, que e exatamente o que
  um leitor de tela precisa anunciar. (b009-frame-budget-hook-2026-08-18)

## [0.57.0] - 2026-08-18

### Added

- **`selectSurface` — decidir qual superficie e dona da regiao sem desenhar nada (B-007).** Todo
  agente de terminal tem gate de confirmacao, login, pergunta e composer disputando uma linha, e a
  resposta e sempre um ternario aninhado dentro do JSX. A ordem E o contrato ali, e nao fica
  registrada em lugar nenhum: no consumidor medido ela atravessa **sete superficies em dois
  arquivos**. A justificativa nao e legibilidade — e o que da para testar. No mesmo repo, a
  precedencia de TECLAS e testada (o pacote ja publicou `routeThroughLayers`) e a de RENDER nao,
  porque observar quem vence exige MONTAR, e montar arrasta `@theocode/agent/config`, `/ask`,
  `/auth` e `node:os`. Aqui a selecao e pura: `selected.layer` e uma string que um teste afirma sem
  montar nada, e `render` e um thunk para que a superficie vencedora so seja construida quando
  alguem de fato for desenha-la. Nao mora em `@theokit/tui/keys` de proposito — aquele subpath
  promete ser livre de React. (b007-surface-layers-2026-08-18)

## [0.56.0] - 2026-08-18

### Added

- **`composerShortcutsFor` e `footerHintFor` — anunciar so o que o app realmente ligou (B-005).**
  Medido: cinco das quinze entradas de `DEFAULT_COMPOSER_SHORTCUTS` descrevem um recurso que o
  `ChatComposer` condiciona a um prop opcional, e uma delas — `Ctrl+C` — nao tem handler nenhum no
  composer. O rodape era pior do que o item dizia: o prop `hint` so e consultado na linha desenhada
  quando NAO ha modo ativo; a linha de modo acrescentava `· ← for agents` sem consultar prop algum,
  entao um app com modo de permissao e sem painel de agentes anunciava um e nao tinha como calar.
  Um prop que funciona em um ramo de dois e pior que prop nenhum, porque quem chama acredita ter
  desligado. Os defaults atuais ficam **intactos** — mudar default e a mudanca silenciosa, que e
  exatamente o defeito deste item. `Ctrl+C` mantem a linha e perde a atribuicao falsa: o defeito
  era de quem e o atalho, nao se ele existe. (b005-capability-affordances-2026-08-18)

## [0.55.0] - 2026-08-18

### Added

- **`WindowedList` — mostrar onde voce esta numa lista sem tomar o teclado (B-003).** A ancora
  centrada e as contagens `hiddenBefore`/`hiddenAfter` foram acrescentadas ao `windowFor` para um
  scrubber de historico, e a view que as justificou nunca foi entregue — entao o consumidor medido
  reconstruiu o clamp a mao, em 91 linhas cujo proprio docstring nomeia essas duas lacunas como
  motivo. `SelectList` nao servia, e nao pelo motivo esperado: o input dele **e** condicionado ao
  foco. O que o desqualifica e ser um MENU — chrome `filter:` obrigatorio, `onSubmit` requerido, e
  um `▲` pelado que descarta a contagem que ele mesmo calculou. O novo componente e presentacional
  (provado estruturalmente, nao prometido em docstring), o cabecalho e um SLOT porque e ali que um
  produto nomeia o proprio gesto, e as linhas ocultas aparecem como numero com glifo de direcao —
  sem palavra alguma para traduzir. Recusa `window` nao-positivo com erro tipado: medido, `window`
  igual a 0 devolve um `windowStart` DEPOIS da selecao, e -1 devolve contagens que somam mais que a
  lista inteira. (b003-history-overlay-2026-08-18)

## [0.54.0] - 2026-08-18

### Added

- **`UsagePanel` — os tres medidores de uso em um bloco (B-001).** `ContextWindowBar`,
  `TokenUsageChart` e `CostMeter` ja existiam separados e nada os compunha, entao todo consumidor de
  `readTurnUsage` escrevia a mesma projecao de `TurnUsage` para `TokenCategory` na mao — 13 linhas
  medidas em um consumidor real. As duas pontas dessa projecao sao deste pacote, entao uma mudanca
  em qualquer uma quebrava cada copia em silencio. A ordem vertical e um prop com default, nao um
  layout fixo: a medicao apontou a ordenacao como a UNICA parte da composicao que e decisao de
  produto. `contextWindow` e opcional porque `TurnUsage` nao carrega o tamanho da janela — sem ele a
  barra mostra a contagem absoluta em vez de inventar uma porcentagem; um numero nao-positivo
  explicito continua sendo erro de programacao e falha alto, nomeando o proprio componente.
  (b001-usage-panel-2026-08-18)

- **Varredura de review sobre o TheoCode — 3 achados registrados (B-015..B-017).** Primeira medicao
  sob o dominio `theocode-app` alargado. Os quatro gates do repo passam a mao em HEAD (typecheck,
  534 testes, knip, depcruise) e o achado esta no que ninguem roda: **`.github` nao existe e nunca
  existiu em 383 commits**, entao todo gate depende de alguem lembrar. Isso e o mecanismo por tras
  dos outros dois — `crossval` reporta 31 de 114 itens fechados sem `fixed_in` (contiguos B-096 a
  B-127, disciplina abandonada em data conhecida) e nenhum pipeline o invoca; e 15 arquivos alterados
  desde 2026-08-09 nao tem teste algum que os importe, incluindo uma recusa de delecao e um veto de
  seguranca. Um candidato foi rastreado ate o consumidor e **recusado** — `all-sessions.ts:132`
  parece engolir erro no caminho do GC e o chamador e fail-closed. Registrar o que foi checado e
  limpo e o que distingue uma varredura de uma que parou de olhar. (theocode-review-sweep-2026-08-18)

- **14 itens de backlog registrados — sete pares extracao/adocao.** Cada par e um componente: a
  extracao em `tui-library` e a adocao em `theocode-app` que a prova. A metade de adocao esta
  bloqueada na extracao e diz isso — e o que impede uma extracao de ser dada como pronta enquanto a
  duplicata que a justificou continua em disco. As extracoes entram `triaged` com ponteiro verificado
  (a medicao ja aconteceu); as adocoes entram `raw` com `evidence: none-yet`, porque o export que
  elas adotariam ainda nao existe e apontar para o arquivo a deletar nao e evidencia de defeito.
  - **theokit-tui:** backlog B-001 — `UsagePanel` — the three usage meters have no composed form, so every consumer assembles them (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-002 — Delete the local usage panel once the library ships one (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-003 — No overlay for walking backwards through history, though both halves it needs already shipped (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-004 — Retire the local backtrack overlay in favour of the library one (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-005 — Two channels advertise affordances the app never wired, and the default parameter is the cause (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-006 — Drop the local shortcut and footer-hint filters once the library gates them (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-007 — Nothing expresses which surface OWNS the input row, so consumers write a nested ternary chain (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-008 — Rewrite the input slot as declared layers (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-009 — No frame budget for derived timeline state, so a streaming turn re-derives on every token (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-010 — Consume the library's frame budget instead of the local one (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-011 — Warning on a threshold crossing has no primitive, so a per-turn warning is the easy default (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-012 — Keep the copy, drop the edge detector (backlog-init-2026-08-18)
  - **theokit-tui:** backlog B-013 — The clear-screen sequence is not published, and the half people omit is the scrollback (backlog-init-2026-08-18)
  - **TheoCode:** backlog B-014 — Delete the local ANSI constant, or kill this item with its pair (backlog-init-2026-08-18)

- **`BACKLOG.md` — o registro de manutencao que faltava, e a tabela de roteamento corrigida.** O
  install trazia `rules/cycle-backlog.md` nomeando o ecossistema `theo-platform` (`theo`,
  `theo-cloud`, `theo-lens`, …), nenhum deles com checkout nesta arvore. Como `scripts/route_domain.py`
  parseia justamente essa tabela, todo repo daqui roteava para lugar nenhum e o gate G1 recusava
  qualquer item — uma tabela herdada que descrevia outro workspace nao e um default, e um defeito
  silencioso. Passa a declarar os dois dominios que existem em disco: `tui-library` (`theokit-tui`) e
  `theocode-app` (`TheoCode`, em `modelo/TheoCode/`), cada um com o especialista escrito
  (`.claude/agents/`), porque `route_domain.py` sai com codigo 3 quando a tabela nomeia um dono que
  nao esta no disco. O par e o ponto: a biblioteca publica as primitivas, o app e obrigado a escrever
  a mao o que ela nao entregou — e isso e a medicao. O gate 0.2 do `/backlog-init` (raiz
  guarda-chuva) foi dispensado deliberadamente e o motivo esta escrito no proprio arquivo, com o
  custo nomeado. Registro nasce vazio: item sem `why_now`, sem DoD e sem dono e herdado como se fosse
  decisao. (backlog-init-2026-08-18)

- **Gate de estrutura em CI — ADR 0003.** `tests/lint/structure.test.ts` reprova o PR que devolve um
  arquivo solto para a raiz de `src/`, cria pasta sem barrel, passa de 25 arquivos por pasta, exporta
  dois componentes do mesmo modulo, deixa componente inline com mais de 40 linhas, usa qualificador
  de teste fora do registro (`integration`, `e2e`), prefixa arquivo com id de milestone ou usa
  `-model` sem view ao lado. Segue o precedente de `tests/lint/no-ptbr.test.ts` — politica como
  teste, sem ferramenta nova — e roda dentro de `pnpm gates`. A deriva que motivou tudo isso passou
  por code review por 147 arquivos sem ser barrada: regra que so vive na cabeca do revisor erode.
  (architecture-review-2026-08)

- Secret scanning em duas camadas: um hook `pre-commit` que varre com o TruffleHog o conteúdo que
  está staged e recusa o commit, e `.github/workflows/secret-scan.yml`, que revarre no CI o intervalo
  empurrado. O hook é o que impede a credencial de entrar no histórico; o workflow é o que
  `git commit --no-verify` não consegue pular. Falsos positivos confirmados são silenciados linha a
  linha com um comentário `trufflehog:ignore`, nunca excluindo o caminho — excluir o caminho
  esconderia também um segredo real acrescentado depois àquele mesmo fixture. (secret-scanning-2026-08)

- **`windowFor` ganha ancora centrada, e a ajuda de teclado passa a derivar das capacidades — T3.4.**
  Duas metades que sobraram no consumidor. A janela ja reportava `hiddenBefore`/`hiddenAfter` como
  contagem desde a 0.53.0 (U-10); o que faltava era a **ancora** — a janela trailing prende a selecao
  na ultima linha, e um overlay que anda para tras no historico precisa dela no meio, com as linhas
  dos dois lados visiveis. Entrou como **opcao** com o comportamento atual no default: qualquer outra
  coisa re-ancora silenciosamente toda lista de todo consumidor no upgrade. Desvio deliberado do
  pseudo-codigo do plano, que propunha um `windowAround` novo: ja existia exatamente uma
  implementacao desse clamp, exportada e consumida, e uma irma ao lado seriam duas implementacoes de
  uma regra so, discordando na primeira vez que alguem tocar em qualquer uma (G12).

  `keyboardHelpFor` deriva o rodape de atalhos das mesmas capacidades que a superficie liga. O
  literal escrito a mao mora ao lado do handler que ele descreve sem nada segurando os dois juntos, e
  a falha e silenciosa e de mao unica: reamarra-se uma tecla e a ajuda continua anunciando a antiga,
  o usuario aperta e nada acontece, e nenhum teste quebra porque a string continua sendo a string.
  Capacidade sem tecla, com tecla em branco, ou desabilitada nao entra — anunciar um atalho que nao
  responde e pior do que nao mencionar.

- **Os mapas de apresentacao de tool chegam ao pacote — T3.1.** `ToolCallCard`, `ToolResult`,
  `ShellEnvelope` e os medidores ja vinham daqui; o que faltava era a metade que diz **qual nome le
  como**. Sem ela, todo produto escreve a sua: o consumidor medido carrega 292 linhas de
  `HEADERS_BY_TOOL` / `BODY_BY_TOOL` / `APPROVAL_LABELS`, mais um `tool_name_mismatch` escrito a mao
  no registry para segurar o contrato de chaves por disciplina. As duas metades sao nossas — as
  factories donas dos nomes, este pacote dono do render — entao este e o unico lugar onde elas podem
  ficar juntas. `DEFAULT_TOOL_PRESENTATION` traz 20 nomes medidos das factories; `toolPresentation()`
  aceita override parcial (trocar um header nao obriga a repetir os outros dezenove) e responde por
  qualquer nome, inclusive um que o produto inventou. Todo leitor trata a entrada como hostil: input e
  output de tool vem de um modelo e de subprocessos, e um render que estoura derruba a sessao por uma
  string que o modelo errou.

  Nota de acoplamento, registrada e nao resolvida: a lista de nomes e conhecimento duplicado. Este
  pacote **nao** importa `@theokit/agents` e nao deve — a dependencia corre no sentido contrario —
  entao `KNOWN_TOOL_NAMES` e literal e pode divergir. O custo da divergencia e um header generico em
  uma tool; o custo da alternativa e uma aresta de dependencia invertida para sempre.

### Changed

- **`src/` passa a ser organizado por dominio de produto, e nenhum componente exportado divide
  arquivo com outro — ADRs 0001/0002.** A superficie publica do pacote nao muda: os quatro subpaths
  (`.`, `./renderer`, `./terminal`, `./keys`) exportam exatamente os mesmos simbolos de antes, o que
  `tests/contract/export-surface.test.ts` e `tests/contract/public-api.integration.test.tsx`
  verificam a cada commit. O que muda e o caminho de arquivo de cada modulo dentro do pacote — quem
  fazia deep import (`@theokit/tui/dist/chat-composer.js`, nunca suportado) precisa passar pelo
  barrel. `src/` tinha 147 arquivos em um unico diretorio: 71 modulos, 61 testes co-locados e 15
  snapshots. Agora sao 14 pastas de dominio (`agent/`, `chat/`, `tools/`, `diff/`, `markdown/`,
  `prompts/`, `metrics/`, `branding/`, `layout/`, `status/`, `theme/`, `shortcuts/`, `search/`,
  `format/`), cada uma com barrel proprio, e `src/index.ts` caiu de 288 para 27 linhas — deixou de
  ser lista escrita a mao e ponto garantido de conflito de merge. `chat-composer.tsx` caiu de 806
  para 575 linhas: os sete componentes que dividiam o arquivo viraram modulos em `chat/composer/`.
  (architecture-review-2026-08)

- **A politica de export que vivia em comentario agora tem lugar proprio: `docs/adr/`.** O codigo
  citava ADRs por id (`D7`, `EC-10`, `arch-5`) que nao existiam como arquivo — 47 ids distintos em
  248 citacoes. `docs/adr/README.md` indexa cada um com todas as linhas que dependem dele, gerado
  por `docs/adr/build-legacy-index.py`. O indice torna os ids localizaveis; ele nao inventa a
  justificativa que nunca foi escrita. (architecture-review-2026-08)

- **`tests/` e `examples/` passam a ser divididos por proposito.** `tests/` ganhou
  `contract/`, `examples/`, `benchmarks/` e `fixtures/` ao lado do `renderer/` que ja existia;
  `examples/` ganhou `components/`, `scenes/` e `renderer/`. Os scripts `example:*` continuam
  valendo, apontando para os novos caminhos. (architecture-review-2026-08)

- **22 arquivos deixam de comecar por id de milestone.** `m17-skeleton-parity.md` ordenava por
  cronologia do projeto e nao dizia nada a quem le; o milestone agora fica dentro do arquivo.
  Vale para `benchmarks/baselines/*`, `tests/*` e `wiki/*`. (architecture-review-2026-08)

- **O sufixo `-model` passa a significar algo — ADR 0004.** Ele marcava a metade headless de um
  componente, mas acertava 3 vezes em 8, e outros 23 modulos headless nao o usavam. Agora so e
  valido quando existe a view de mesmo nome ao lado; os cinco que nao tinham par perderam o sufixo
  (`diff-model.ts` -> `diff.ts`, `markdown-model.ts` -> `markdown.ts`, e assim por diante).
  (architecture-review-2026-08)

- **O repositório passou para a organização oficial `usetheokit`.** Clones existentes continuam
  funcionando: o GitHub redireciona permanentemente o remote antigo `usetheodev/theokit-tui`. Os
  campos `repository`, `bugs` e `homepage`, o README, os exemplos que imprimem o link de documentação
  no terminal e o `NOTICE` agora apontam para `usetheokit`. (usetheokit/theokit#316)

- **O texto da licença Apache-2.0 foi completado com o apêndice de copyright.** O LICENSE trazia o
  corpo oficial, mas com o apêndice ainda no formato de instrução (`Copyright [yyyy] [name of
copyright owner]`), sem titular declarado. O `NOTICE`, por sua vez, atribuía a "Theo ecosystem
  contributors (usetheodev)" — divergente do titular usado em todos os outros repositórios. Os dois
  agora declaram `Copyright 2026 usetheo.dev`. (usetheokit/theokit#316)

- `sonar-project.properties` passa a declarar `sonar.organization=usetheokit` e
  `sonar.projectKey=usetheokit_theokit-tui`, acompanhando a mudança de organização. A organização e o
  projeto correspondentes precisam existir no SonarCloud — do contrário o step de análise falha.
  (usetheokit/theokit#316)

### Fixed

- **O gate `no-ptbr` parava de varrer na borda de outro repositorio.** `SCAN_ROOTS = ["."]` varre a
  arvore inteira — de proposito, porque uma lista mantida a mao apodrece assim que alguem adiciona um
  pacote. So que a arvore passou a conter `modelo/TheoCode`, um checkout proprio (383 commits) de um
  produto irmao nosso, com politica de idioma propria: 5 ofensas em `BACKLOG.md` e
  `tools/check-english-only.mjs` que este repositorio nao pode corrigir e nao deve reescrever —
  editar o historico de outro repo para satisfazer o nosso linter. O corte e estrutural, nao um nome
  em `SKIP_DIRS`: diretorio que carrega `.git` E outro repositorio, e "contem .git" nao envelhece,
  enquanto uma lista de exclusao envelhece no dia do segundo checkout. Custo zero de I/O — o
  `Dirent[]` ja estava em maos. Coberto por teste com poder de deteccao verificado por mutacao:
  desarmar o guard deixa o teste vermelho. (backlog-init-2026-08-18)

- **O guard `it_count_never_decreases` nao enxergava renames e morria com ENOENT.** Ele comparava o
  caminho do commit base com o disco; qualquer arquivo de teste movido o derrubava antes de contar.
  Agora indexa os testes atuais por basename (com unicidade verificada, para a premissa falhar alto
  se deixar de valer), carrega uma tabela explicita de renames deliberados e trata arquivo de teste
  realmente apagado como contagem zero — um enfraquecimento que a assercao **diz**, em vez de um
  crash. A deteccao de rename do proprio git foi testada antes e descartada com evidencia: contra um
  base distante, 120 de 161 movimentacoes puras ainda eram lidas como delete+add.
  (architecture-review-2026-08)

## [0.53.0] - 2026-08-14

### Added

- **`FreeTextInput` ganha um modo mascarado (`mask`) — U-9.** Um app de terminal que le uma API key
  tinha de reconstruir o componente inteiro para nao ecoar o que o usuario digita; o consumidor
  medido carrega 63 linhas de `SecretInput` proprio por causa disso, e copias reconstruidas sao
  justamente onde o texto puro vaza. `mask: true` usa `•`; uma string contribui seu primeiro
  grafema, para que um valor de varios caracteres nao infle o comprimento renderizado — vazar um
  comprimento errado ainda e vazar um comprimento.

  A mascara e uma questao de RENDERIZACAO: `onSubmit` continua recebendo o texto real. Um
  componente que mascarasse tambem o valor submetido seria silenciosamente inutil, e so no ponto em
  que a credencial falha — remotamente, depois, com uma mensagem de provider que nao diz nada sobre
  isso.

  E a colagem foi tratada porque um campo mascarado e onde se COLA: um valor vindo de gerenciador de
  senha chega como um pedaco unico que pode carregar quebra de linha. Inseri-la crua poe uma quebra
  dentro do segredo; deixa-la passar como Enter submete um segredo truncado. Nenhuma das duas falhas
  aparece ali — as duas surgem depois, como erro opaco de autenticacao.

  **O que este modo NAO promete:** manter o segredo fora da memoria. Ele vive no buffer como
  qualquer outro texto. Uma versao que o movesse para um `ref` seria o mesmo heap com uma historia
  mais forte — e a nota original que motivou este item afirmava que o consumidor mantinha o segredo
  fora do state do React, o que foi verificado e **e falso** (ele usa `useState`). A propriedade que
  este modo de fato entrega e a que importa num terminal: o texto puro nunca chega a tela, onde
  cairia no scrollback, num compartilhamento de tela ou numa sessao gravada.

- **`StatusFooter` passa a encaminhar `modeLabel` para a linha de modo — U-8.** O `ModeIndicator` ja
  aceitava `label` exatamente para um produto cujo vocabulario de permissao nao e este (um agente
  estilo Codex usa `suggest | auto-edit | full-auto`). O que faltava e que o rodape composto nunca
  encaminhava: a saida de emergencia ficava um nivel abaixo e fora de alcance, entao quem usava
  `StatusFooter` empilhava o modo no `left` e perdia a linha — que e o que o consumidor medido faz.

  **Encaminhar, nao alargar.** Alargar a uniao de `mode` deixaria `plna` renderizar como um modo;
  exigir que quem chama DIGA que esta fora do vocabulario mantem o typo sendo um erro e torna a
  saida explicita. `mode` segue encaminhado mesmo junto de `modeLabel`, para que a checagem de
  uniao fechada continue rodando — um chamador que passe um label e um modo com typo ouve sobre o
  typo.

## [0.52.1] - 2026-08-12

### Fixed

- **The suite no longer fails about one full run in twenty (B-125).** Two timing assumptions, both
  measured over twenty consecutive runs rather than reasoned about. `chat-composer` slept a fixed
  50ms after each simulated keystroke — its own comment already said a fixed sleep is flaky under
  load and that polling was the answer — and now waits for two identical consecutive frames.
  `chat-composer.onchange` assumed two ticks were enough for `useInput` to subscribe before writing;
  under load the keystroke was dropped and the failure surfaced two seconds later in a `waitFor`,
  far from the cause. It now writes until the key lands, which resends a lost event rather than
  retrying a failed assertion.

## [0.52.0] - 2026-08-11

### Added

- **`@theokit/tui/keys` — modal keypress routing (B-104 slice 2).** Layers are tried in declared
  order, the first whose `when` holds claims the key exclusively, and the result names WHICH layer
  claimed it. That last part is why it is worth extracting: precedence that cannot be observed cannot
  be tested. `./terminal` deferred this with a real objection — an interface shaped by one product's
  key states would give the second consumer something to route around — and the objection is answered
  rather than waived: what ships is the ordering rule, with states, keys and actions as type
  parameters. Nothing in the module names an overlay, a mode or a keystroke.

## [0.51.0] - 2026-08-11

### Added

- **`@theokit/tui/terminal` — the loop the components run inside (#B-104).** This package shipped ~60 widgets and none of what a terminal agent must build before a widget can be drawn safely. `installStderrGuard(logPath, { label })` redirects `process.stderr.write` for the session so a stray warning cannot corrupt the frame, and COUNTS what it could not write, reporting the loss once at teardown — falling back to the real stream would corrupt the frame, which is the thing being prevented, and staying silent produces a session where every diagnostic is dead and nothing says so. `createWriteQueue()` serialises writes per key, as a factory rather than module state so two consumers in one process do not serialise against each other, and a rejected operation rejects its own caller without poisoning the key. `rotateLog(path, { capBytes, keep })` caps a log by size, throwing on a nonsense argument and staying quiet on a full disk. A separate subpath because these reach `node:fs` and `process` while the root entry is React components. The keypress router is deliberately NOT included: its mechanism generalises, its contract is the consumer's vocabulary, and a public API shaped by one application gives the second consumer something to route around

## [0.50.4] - 2026-08-10

### Fixed

- The command menu closes once you start typing an argument. It matched on the first token after the slash, so `/sandbox read-only` still matched the command `sandbox` and the menu stayed open — Enter then completed the selection, replaced the line with the bare command and DISCARDED the argument. Measured in a consumer across three commands; one of them changed a security setting and failed silently, accepting the command and leaving the setting alone. Typing a space after the name is the user leaving selection and starting to write, so there is nothing left to choose (#B-089)

## [0.50.3] - 2026-08-10

### Fixed

- `Home` and `End` move the cursor in the composer. Every terminal form of both keys was already parsed and then thrown away: the names landed in `nonAlphanumericKeys` so the printable input was blanked, and `Key` carried no field to replace it, so the composer received no event at all. The motions they drive (`move-line-start` / `move-line-end`) already existed and were already bound to ctrl+a/ctrl+e, so this connects a built capability rather than adding one — and it goes through `defaultKeymap`, so both keys stay remappable. Measured in a consumer by A/B against another terminal agent over the same tmux channel, which ruled out terminal encoding (#B-068)

### Added

- `ModeIndicator` accepts `label`, so a product whose permission vocabulary is not this one can still use the row. `PermissionMode` is the Claude Code idiom (`default | auto-accept | plan`); a Codex-style agent has a different one, and the boundary check refused it — right for a typo, wrong for a different vocabulary, with no way to tell them apart. The union stays closed for `mode`, so a typo is still caught: a caller has to SAY it is outside the vocabulary rather than slip out of it (#U-8)
- `WindowView` reports `hiddenBefore` and `hiddenAfter`. `windowFor` already computed both — `windowStart` IS the count above — and reduced them to booleans, so a consumer rendering "N more above" had to recompute the same window arithmetic it had just asked for. The booleans remain, now derived from the counts (#U-10)

## [0.50.2] - 2026-08-08

### Fixed

- `WelcomeBanner` no longer lets a two-column layout overflow its own border. The box capped itself at `MAX_WIDTH` (60 cells), a limit sized for the single-column banner; with an `aside` the content is art + gutter + aside, which routinely exceeds it — and capping the frame did not shrink the content, it just let it run past the right border. The cap now applies to the one-column layout only, where it protects line length; the two-column layout uses the terminal width it was given (#U-7c)

## [0.50.1] - 2026-08-08

### Fixed

- `WelcomeBanner` no longer compresses `art` when an `aside` is present. The two-column branch grew the main column with `flexGrow` alone, so once art + gutter + aside exceeded the terminal Ink broke every art row across lines and pushed the tagline and hints out of the frame — making the `art` prop shipped in 0.50.0 usable only in the single-column layout that already worked. The column is now sized with `bannerArtWidth` and does not shrink; without `art` the previous behaviour is unchanged (#U-7b)

## [0.50.0] - 2026-08-08

### Added

- `WelcomeBanner` accepts `art`: a multi-line ASCII-art string rendered in place of the bold `name`, so art and the right-hand `aside` compose in one component. `Banner` had `art` and no `aside`; this had `aside` and no `art`, so the layout a coding agent actually ships — art on the left, a hints panel on the right — was reachable from neither, and a consumer rebuilt the whole box by hand to get both. It degrades to the bold `name` exactly as `Banner` does, and both now draw through the same `ArtBlock` (#U-7)

### Changed

- A documentação do repositório passou a viver em `wiki/`, uma base de conhecimento no formato Open Knowledge Format v0.2 (legível por agentes, com procedência e links entre conceitos); a pasta `docs/` foi removida e seus nove relatórios viraram doze conceitos — o registro de TTFATT agora é `wiki/benchmarks/ttfatt.md`
- Os baselines de benchmark saíram de `docs/benchmarks/` para `benchmarks/baselines/`, ao lado dos benches que os geram; quem regenera um baseline não precisa mais escrever fora da pasta de benchmarks

### Fixed

- `ChatComposer` não chama mais `onChange` com o texto inalterado quando o host re-renderiza passando uma arrow function nova — o callback é lido por ref, então não é preciso `useCallback` no consumidor (#59)
- As linhas do bloco `Explored` mantêm a indentação sob o galho `└` quando o alvo é longo demais para a largura do terminal, em vez de continuarem na coluna 0 (#59)
- O bloco `explored` da projeção de mensagens voltou a ter identidade estável entre renders quando seu conteúdo não muda — sem isso, a validação incremental da timeline reprocessava o histórico inteiro a cada token em qualquer sessão com um agrupamento de leituras (#66)
- `ChatMessage` com `markdown` e margem horizontal não estoura mais o terminal por uma célula — a coluna do conteúdo passou a repartir só o espaço que sobra do glifo, em vez de ser dimensionada pelo parágrafo inteiro sem quebra (#64)
- `AgentTimeline` passou a validar também os eventos `explored` na fronteira: ids duplicados entre as ferramentas agrupadas (e contra os ids de topo), bloco sem nenhuma ferramenta e status/exclusividade/`maxLines` inválidos agora falham com erro tipado, em vez de virarem aviso de `key` duplicada do React ou um cabeçalho "Explored (0)" vazio (#58)
- `AgentTimeline` passou a limitar o diff inline em 20 linhas por padrão — um resultado grande de `apply_patch` não inunda mais o transcript, e o teto explícito por evento (`maxLines`) continua valendo (#57)
- `ChatMessage` com margem horizontal (`marginLeft`/`marginRight`/`marginX`/`margin`) não estoura mais a largura do terminal — a margem passou a ser descontada da largura fixada, eliminando a quebra no meio da palavra que voltava a acontecer nessas mensagens (#56)
