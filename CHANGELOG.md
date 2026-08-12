# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/).

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

## [Unreleased]

### Added

- **`@theokit/tui/keys` — modal keypress routing (B-104 slice 2).** Layers are tried in declared
  order, the first whose `when` holds claims the key exclusively, and the result names WHICH layer
  claimed it. That last part is why it is worth extracting: precedence that cannot be observed cannot
  be tested. `./terminal` deferred this with a real objection — an interface shaped by one product's
  key states would give the second consumer something to route around — and the objection is answered
  rather than waived: what ships is the ordering rule, with states, keys and actions as type
  parameters. Nothing here names an overlay, a mode or a keystroke.

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
