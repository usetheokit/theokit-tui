# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

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
