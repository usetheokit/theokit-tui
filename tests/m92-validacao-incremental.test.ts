import { describe, expect, it } from "vitest";

import { messagesToAgentEvents } from "../src/messages-to-events.js";

const msg = (id: string, texto: string) => ({
  id,
  role: "assistant" as const,
  parts: [{ type: "text" as const, text: texto }],
});

/**
 * M92 T5.1 — `assertValidEvents` para de revarrer o histórico a cada render.
 *
 * A função varria o array inteiro **por render**, incluindo as linhas já congeladas em `<Static>` —
 * que por construção não mudam. Numa sessão longa isso é trabalho O(N) por token sobre dado imutável.
 *
 * A validação é interna ao módulo (não exportada), então o que estes testes exercitam é o
 * comportamento observável: renderizar uma extensão de prefixo continua aceitando o válido e
 * **continua rejeitando o inválido** — que é a metade que o fallback existe para garantir. Uma
 * otimização de validação que deixasse de pegar um caso inválido seria pior que a lentidão.
 */
describe("M92 — a derivação é incremental (item 4 do DoD)", () => {
  /**
   * Comparar `id` NÃO era gate — e a revisão do M92 mediu exatamente isso.
   *
   * A primeira versão destes testes asseria `b[0]!.id === a[0]!.id`. Os ids são derivados de
   * `(message.id, índice da parte)`, então **passam sem cache nenhum**: dois objetos recém-alocados
   * carregam o mesmo id. O item 4 do DoD ficou por implementar e o teste ficou verde do mesmo jeito.
   *
   * O que prova o cache é **identidade referencial** (`toBe`), e é ela que importa: sem objetos
   * estáveis, o `assertValidEvents` do item 5 nunca detecta extensão de prefixo — a revisão mediu o
   * caminho rápido disparando **0 de 5 renders**. Os dois itens são um só mecanismo visto de dois lados.
   */
  it("a MESMA mensagem devolve o MESMO evento por identidade — nao so o mesmo id", () => {
    const m = msg("m1", "ola");
    const a = messagesToAgentEvents([m]);
    const b = messagesToAgentEvents([m]);
    expect(b[0]).toBe(a[0]);
  });

  it("acrescentar mensagem NAO invalida as anteriores — o que torna a extensao detectavel", () => {
    const m1 = msg("m1", "ola");
    const a = messagesToAgentEvents([m1]);
    const b = messagesToAgentEvents([m1, msg("m2", "mundo")]);
    expect(b[0]).toBe(a[0]);
    expect(b).toHaveLength(2);
  });

  it("mensagem NOVA com outro conteudo produz evento novo", () => {
    const m = {
      id: "m1",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "a" }],
    };
    const a = messagesToAgentEvents([m]);
    const outra = { ...m, parts: [{ type: "text" as const, text: "b" }] };
    const b = messagesToAgentEvents([outra]);
    expect(b[0]).not.toBe(a[0]);
  });

  /**
   * O caso que a chave por identidade de PARTES existe para pegar.
   *
   * A versão anterior deste teste criava um objeto novo (`{ ...m, parts }`), então o `WeakMap` errava
   * a chave de qualquer jeito e o mutante "ignora a identidade das partes" **sobrevivia**. O cenário
   * real é outro: a MESMA mensagem por referência com o array de partes trocado — que é o que um
   * store faz ao acumular deltas de token num objeto reaproveitado.
   */
  it("MESMA mensagem por referencia com partes TROCADAS invalida o cache", () => {
    const m: {
      id: string;
      role: "assistant";
      parts: { type: "text"; text: string }[];
    } = {
      id: "m1",
      role: "assistant",
      parts: [{ type: "text", text: "a" }],
    };
    const a = messagesToAgentEvents([m]);
    m.parts = [{ type: "text", text: "ab" }];
    const b = messagesToAgentEvents([m]);
    expect(b[0]).not.toBe(a[0]);
  });

  it("os ids seguem estaveis por (id da mensagem, indice da parte)", () => {
    const eventos = messagesToAgentEvents([msg("m1", "ola")]);
    expect(eventos[0]!.id).toBe("m1::m0");
  });

  it("thread vazio devolve lista vazia — o caso base da extensao", () => {
    expect(messagesToAgentEvents([])).toEqual([]);
  });
});

const leitura = (id: string, path: string) => ({
  type: "tool-read_file" as const,
  toolCallId: id,
  state: "output-available" as const,
  output: "x",
  input: { path },
});

/**
 * Issue #59 item 11 (F-tui-8) — um run de exploração atravessando a fronteira do `<Static>`.
 *
 * O que a graduação exige é que o PREFIXO já congelado não mude: ids e ordem estáveis conforme o
 * turno cresce. Estes testes fixam o que foi MEDIDO, não o que se supõe — e uma das medições virou
 * issue à parte: o objeto `explored` é reconstruído a cada projeção, então ele NÃO participa do
 * caminho rápido do M92 (`events[i] === anterior[i]`). Ver #66.
 */
describe("M92 + explored — estabilidade de prefixo através da graduação", () => {
  it("as ferramentas ANINHADAS sao estaveis por identidade entre projecoes", () => {
    // É o que sustenta a memoização por mensagem: o conteúdo do bloco não é
    // realocado, mesmo que o invólucro seja.
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [leitura("c1", "a.ts"), leitura("c2", "b.ts")],
    };
    const a = messagesToAgentEvents([m1]);
    const b = messagesToAgentEvents([m1]);
    const at = (a[0] as unknown as { tools: unknown[] }).tools;
    const bt = (b[0] as unknown as { tools: unknown[] }).tools;
    expect(bt[0]).toBe(at[0]);
    expect(bt[1]).toBe(at[1]);
  });

  it("o run ABERTO cresce sob o MESMO id — o bloco nao se parte em dois", () => {
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [leitura("c1", "a.ts"), leitura("c2", "b.ts")],
    };
    const m2 = {
      id: "m2",
      role: "assistant" as const,
      parts: [leitura("c3", "c.ts")],
    };
    const p1 = messagesToAgentEvents([m1]);
    const p2 = messagesToAgentEvents([m1, m2]);
    expect(p1.map((e) => e.id)).toEqual(["explored-c1"]);
    expect(p2.map((e) => e.id)).toEqual(["explored-c1"]);
    expect((p2[0] as unknown as { tools: unknown[] }).tools).toHaveLength(3);
  });

  it("o bloco explored e ESTAVEL por identidade quando o conteudo nao mudou", () => {
    // Issue #66: o invólucro era um literal novo a cada projeção, então a
    // checagem de extensão de prefixo do M92 (`events[i] === anterior[i]`)
    // falhava no primeiro `explored` e TODO render caía na varredura completa —
    // o custo que o M92 existe para remover.
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [leitura("c1", "a.ts"), leitura("c2", "b.ts")],
    };
    const a = messagesToAgentEvents([m1]);
    const b = messagesToAgentEvents([m1]);
    expect(a[0]!.kind).toBe("explored");
    expect(b[0]).toBe(a[0]);
    // O array `tools` também: realocá-lo já basta para quebrar quem compara por
    // identidade linha a linha.
    expect((b[0] as unknown as { tools: unknown[] }).tools).toBe(
      (a[0] as unknown as { tools: unknown[] }).tools,
    );
  });

  it("o bloco NAO e reusado quando o run cresce — reuso e por CONTEUDO, nao por id", () => {
    // O run aberto muda de conteúdo de propósito sob o mesmo id. Reusar por id
    // congelaria a leitura nova fora da tela.
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [leitura("c1", "a.ts"), leitura("c2", "b.ts")],
    };
    const m2 = {
      id: "m2",
      role: "assistant" as const,
      parts: [leitura("c3", "c.ts")],
    };
    const antes = messagesToAgentEvents([m1]);
    const depois = messagesToAgentEvents([m1, m2]);
    expect(depois[0]!.id).toBe(antes[0]!.id);
    expect(depois[0]).not.toBe(antes[0]);
    expect((depois[0] as unknown as { tools: unknown[] }).tools).toHaveLength(
      3,
    );
  });

  it("fechado o run, o PREFIXO de ids e ordem nao muda mais", () => {
    const m1 = {
      id: "m1",
      role: "assistant" as const,
      parts: [leitura("c1", "a.ts"), leitura("c2", "b.ts")],
    };
    const m2 = {
      id: "m2",
      role: "assistant" as const,
      parts: [leitura("c3", "c.ts")],
    };
    // MESMA referência nas duas projeções — a memoização por mensagem chaveia em
    // identidade, então dois literais iguais não são o mesmo caso (foi o que a
    // primeira versão deste teste errou, e a falha mostrou).
    const m3 = msg("m3", "pronto");
    const fechado = messagesToAgentEvents([m1, m2, m3]);
    const maisTarde = messagesToAgentEvents([m1, m2, m3, msg("m4", "e mais")]);
    expect(fechado.map((e) => e.id)).toEqual(["explored-c1", "m3::m0"]);
    expect(maisTarde.map((e) => e.id).slice(0, 2)).toEqual([
      "explored-c1",
      "m3::m0",
    ]);
    // O evento NÃO-explored do prefixo é estável por identidade — é o contraste
    // que localiza o gap do #66 no invólucro do bloco, e não na memoização.
    expect(maisTarde[1]).toBe(fechado[1]);
  });
});
