# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added

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
