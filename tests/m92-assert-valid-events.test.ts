import { beforeEach, describe, expect, it } from "vitest";

import {
  assertValidEvents,
  reiniciarValidacaoIncremental,
} from "../src/agent-timeline.js";

const ev = (id: string, text: string) =>
  ({ id, kind: "message", role: "assistant", text }) as never;
const ruim = (id: string) =>
  ({ id, kind: "nao-existe", role: "assistant", text: "x" }) as never;

/**
 * M92 T5.1 — a validação incremental **não pode** deixar de pegar entrada inválida.
 *
 * `assertValidEvents` passou a validar só a cauda quando o array novo é extensão de prefixo do
 * anterior — o histórico congelado em `<Static>` não muda, e revarrê-lo por render é O(N) por token
 * sobre dado que a estrutura garante imutável.
 *
 * O risco da otimização é este arquivo: uma validação que ficou rápida **deixando de validar** é pior
 * que a lentidão. Por isso o fallback (array que não é extensão → varredura completa), e por isso cada
 * caminho é exercitado com entrada inválida.
 *
 * Testar por render não funciona, e isso foi medido: o throw acontece dentro do render e o ink não o
 * propaga — `renderFrame` de um evento inválido **resolve**. A função é exportada para que a prova
 * exista.
 */
describe("M92 — assertValidEvents nos dois caminhos", () => {
  beforeEach(() => {
    reiniciarValidacaoIncremental();
  });

  it("EXTENSAO — id duplicado na cauda continua sendo pego", () => {
    assertValidEvents([ev("a", "um")]);
    expect(() => assertValidEvents([ev("a", "um"), ev("a", "dois")])).toThrow(
      /duplicate event id/,
    );
  });

  it("EXTENSAO — kind desconhecido na cauda continua sendo pego", () => {
    assertValidEvents([ev("b1", "um")]);
    expect(() => assertValidEvents([ev("b1", "um"), ruim("b2")])).toThrow(
      /unknown event kind/,
    );
  });

  it("NAO-EXTENSAO — invalido no MEIO cai no fallback e continua sendo pego", () => {
    assertValidEvents([ev("c1", "um"), ev("c2", "dois")]);
    // Array totalmente diferente: não é extensão, logo a varredura completa tem de rodar.
    expect(() => assertValidEvents([ruim("d1"), ev("d2", "tres")])).toThrow(
      /unknown event kind/,
    );
  });

  it("NAO-EXTENSAO — duplicado no meio de um array novo continua sendo pego", () => {
    assertValidEvents([ev("e1", "um")]);
    expect(() => assertValidEvents([ev("x", "a"), ev("x", "b")])).toThrow(
      /duplicate event id/,
    );
  });

  it("EXTENSAO valida NAO e rejeitada — a otimizacao nao quebra o legitimo", () => {
    assertValidEvents([ev("f1", "um")]);
    expect(() =>
      assertValidEvents([ev("f1", "um"), ev("f2", "dois")]),
    ).not.toThrow();
  });

  it("depois de uma REJEICAO, o array invalido NAO vira prefixo confiavel", () => {
    // A MESMA referência de array nas duas chamadas — é o que o React faz num re-render sem mudança.
    //
    // A primeira versão deste teste criava dois literais distintos, e por isso NÃO conseguia falhar:
    // identidades diferentes nunca são extensão de prefixo, então o fallback rodava e o inválido era
    // pego pelo caminho errado. O mutante "grava o prefixo antes de validar" sobreviveu, e só a
    // mutação mostrou.
    const bom = ev("g1", "um");
    const arrayInvalido = [bom, ruim("g2")];
    assertValidEvents([bom]);
    expect(() => assertValidEvents(arrayInvalido)).toThrow();
    // Se o array que lançou tivesse virado prefixo, esta chamada pularia a checagem que acabou de
    // falhar — a cauda seria vazia e nada seria validado.
    expect(() => assertValidEvents(arrayInvalido)).toThrow(
      /unknown event kind/,
    );
  });

  it("ENCOLHER o array nao e extensao — cai no fallback", () => {
    assertValidEvents([ev("h1", "um"), ev("h2", "dois")]);
    expect(() => assertValidEvents([ruim("h1")])).toThrow(/unknown event kind/);
  });
});

/**
 * Issue #58 — `explored` é membro PÚBLICO da união (e exportado), então um consumidor direto de
 * `AgentTimeline` (sem passar por `messagesToAgentEvents`) alcança este caminho. Antes, o evento caía
 * fora de toda checagem: ids aninhados não entravam no conjunto de duplicados (React reclamava de
 * `key` duplicada em pleno render, onde o error boundary do ink engole o throw), `tools: []`
 * renderizava um cabeçalho "Explored (0)" pelado, e status/exclusividade/maxLines dos aninhados
 * passavam livres — contrariando o contrato documentado nas props ("unique ids (duplicates throw)").
 */
const ferramenta = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    kind: "tool",
    name: "read_file",
    status: "success",
    ...extra,
  }) as never;
const explorado = (id: string, tools: unknown[]) =>
  ({ id, kind: "explored", tools }) as never;

describe("issue #58 — assertValidEvents desce nos eventos 'explored'", () => {
  beforeEach(() => {
    reiniciarValidacaoIncremental();
  });

  it("id aninhado duplicado dentro do MESMO bloco lanca", () => {
    expect(() =>
      assertValidEvents([
        explorado("e1", [ferramenta("t1"), ferramenta("t1")]),
      ]),
    ).toThrow(/duplicate event id "t1"/);
  });

  it("id aninhado que colide com um id de TOPO lanca", () => {
    // O conjunto de ids e compartilhado: aninhado e topo vivem no mesmo espaco de nomes.
    expect(() =>
      assertValidEvents([ev("t1", "um"), explorado("e1", [ferramenta("t1")])]),
    ).toThrow(/duplicate event id "t1"/);
  });

  it("bloco 'explored' vazio lanca em vez de renderizar 'Explored (0)'", () => {
    expect(() => assertValidEvents([explorado("e1", [])])).toThrow(
      /at least one/,
    );
  });

  it("status invalido num aninhado lanca", () => {
    expect(() =>
      assertValidEvents([
        explorado("e1", [ferramenta("t1", { status: "pendente" })]),
      ]),
    ).toThrow(/invalid status/);
  });

  it("exclusividade output/shell/diff vale para os aninhados", () => {
    expect(() =>
      assertValidEvents([
        explorado("e1", [ferramenta("t1", { output: "x", diff: "y" })]),
      ]),
    ).toThrow(/only one of/);
  });

  it("maxLines invalido num aninhado lanca", () => {
    expect(() =>
      assertValidEvents([explorado("e1", [ferramenta("t1", { maxLines: 0 })])]),
    ).toThrow(/maxLines must be an integer/);
  });

  it("bloco 'explored' valido NAO e rejeitado", () => {
    expect(() =>
      assertValidEvents([
        explorado("e1", [ferramenta("t1"), ferramenta("t2")]),
      ]),
    ).not.toThrow();
  });

  it("EXTENSAO — os ids aninhados do prefixo continuam reservados na cauda", () => {
    // A otimizacao do M92 reaproveita o conjunto de ids do render anterior. Se os aninhados nao
    // entrassem nele, um id ja usado dentro de um bloco congelado voltaria a ser aceito no topo.
    const bloco = explorado("e1", [ferramenta("t1")]);
    assertValidEvents([bloco]);
    expect(() => assertValidEvents([bloco, ev("t1", "colide")])).toThrow(
      /duplicate event id "t1"/,
    );
  });
});
