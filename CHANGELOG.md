# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/);
versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Fixed

- `ChatMessage` com margem horizontal (`marginLeft`/`marginRight`/`marginX`/`margin`) não estoura mais a largura do terminal — a margem passou a ser descontada da largura fixada, eliminando a quebra no meio da palavra que voltava a acontecer nessas mensagens (#56)
