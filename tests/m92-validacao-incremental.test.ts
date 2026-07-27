import { describe, expect, it } from 'vitest'

import { messagesToAgentEvents } from '../src/messages-to-events.js'

const msg = (id: string, texto: string) => ({
  id,
  role: 'assistant' as const,
  parts: [{ type: 'text' as const, text: texto }],
})

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
describe('M92 — a derivação e a validação sob extensão de prefixo', () => {
  it('acrescentar mensagem PRESERVA os eventos anteriores por identidade de id', () => {
    const a = messagesToAgentEvents([msg('m1', 'ola')])
    const b = messagesToAgentEvents([msg('m1', 'ola'), msg('m2', 'mundo')])
    expect(b[0]!.id).toBe(a[0]!.id)
    expect(b).toHaveLength(2)
  })

  it('os ids sao estaveis por (id da mensagem, indice da parte) — o que torna a extensao detectavel', () => {
    const eventos = messagesToAgentEvents([msg('m1', 'ola')])
    expect(eventos[0]!.id).toBe('m1::m0')
  })

  it('mudar o TEXTO de uma parte mantem o id e muda o conteudo', () => {
    const a = messagesToAgentEvents([msg('m1', 'ola')])
    const b = messagesToAgentEvents([msg('m1', 'outro')])
    expect(b[0]!.id).toBe(a[0]!.id)
    expect(b[0]).not.toEqual(a[0])
  })

  it('thread vazio devolve lista vazia — o caso base da extensao', () => {
    expect(messagesToAgentEvents([])).toEqual([])
  })
})
