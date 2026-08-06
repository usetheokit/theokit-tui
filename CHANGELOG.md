# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Fixed

- As linhas do bloco `Explored` mantêm a indentação sob o galho `└` quando o alvo é longo demais para a largura do terminal, em vez de continuarem na coluna 0 (#59)
- O bloco `explored` da projeção de mensagens voltou a ter identidade estável entre renders quando seu conteúdo não muda — sem isso, a validação incremental da timeline reprocessava o histórico inteiro a cada token em qualquer sessão com um agrupamento de leituras (#66)
- `ChatMessage` com `markdown` e margem horizontal não estoura mais o terminal por uma célula — a coluna do conteúdo passou a repartir só o espaço que sobra do glifo, em vez de ser dimensionada pelo parágrafo inteiro sem quebra (#64)
- `AgentTimeline` passou a validar também os eventos `explored` na fronteira: ids duplicados entre as ferramentas agrupadas (e contra os ids de topo), bloco sem nenhuma ferramenta e status/exclusividade/`maxLines` inválidos agora falham com erro tipado, em vez de virarem aviso de `key` duplicada do React ou um cabeçalho "Explored (0)" vazio (#58)
- `AgentTimeline` passou a limitar o diff inline em 20 linhas por padrão — um resultado grande de `apply_patch` não inunda mais o transcript, e o teto explícito por evento (`maxLines`) continua valendo (#57)
- `ChatMessage` com margem horizontal (`marginLeft`/`marginRight`/`marginX`/`margin`) não estoura mais a largura do terminal — a margem passou a ser descontada da largura fixada, eliminando a quebra no meio da palavra que voltava a acontecer nessas mensagens (#56)
