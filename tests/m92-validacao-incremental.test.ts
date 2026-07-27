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
