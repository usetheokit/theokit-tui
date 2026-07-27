import { beforeEach, describe, expect, it } from 'vitest'

import { assertValidEvents, reiniciarValidacaoIncremental } from '../src/agent-timeline.js'

const ev = (id: string, text: string) => ({ id, kind: 'message', role: 'assistant', text }) as never
const ruim = (id: string) => ({ id, kind: 'nao-existe', role: 'assistant', text: 'x' }) as never

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
describe('M92 — assertValidEvents nos dois caminhos', () => {
  beforeEach(() => {
    reiniciarValidacaoIncremental()
  })

  it('EXTENSAO — id duplicado na cauda continua sendo pego', () => {
    assertValidEvents([ev('a', 'um')])
    expect(() => assertValidEvents([ev('a', 'um'), ev('a', 'dois')])).toThrow(/duplicate event id/)
  })

  it('EXTENSAO — kind desconhecido na cauda continua sendo pego', () => {
    assertValidEvents([ev('b1', 'um')])
    expect(() => assertValidEvents([ev('b1', 'um'), ruim('b2')])).toThrow(/unknown event kind/)
  })

  it('NAO-EXTENSAO — invalido no MEIO cai no fallback e continua sendo pego', () => {
    assertValidEvents([ev('c1', 'um'), ev('c2', 'dois')])
    // Array totalmente diferente: não é extensão, logo a varredura completa tem de rodar.
    expect(() => assertValidEvents([ruim('d1'), ev('d2', 'tres')])).toThrow(/unknown event kind/)
  })

  it('NAO-EXTENSAO — duplicado no meio de um array novo continua sendo pego', () => {
    assertValidEvents([ev('e1', 'um')])
    expect(() => assertValidEvents([ev('x', 'a'), ev('x', 'b')])).toThrow(/duplicate event id/)
  })

  it('EXTENSAO valida NAO e rejeitada — a otimizacao nao quebra o legitimo', () => {
    assertValidEvents([ev('f1', 'um')])
    expect(() => assertValidEvents([ev('f1', 'um'), ev('f2', 'dois')])).not.toThrow()
  })

  it('depois de uma REJEICAO, o array invalido NAO vira prefixo confiavel', () => {
    // A MESMA referência de array nas duas chamadas — é o que o React faz num re-render sem mudança.
    //
    // A primeira versão deste teste criava dois literais distintos, e por isso NÃO conseguia falhar:
    // identidades diferentes nunca são extensão de prefixo, então o fallback rodava e o inválido era
    // pego pelo caminho errado. O mutante "grava o prefixo antes de validar" sobreviveu, e só a
    // mutação mostrou.
    const bom = ev('g1', 'um')
    const arrayInvalido = [bom, ruim('g2')]
    assertValidEvents([bom])
    expect(() => assertValidEvents(arrayInvalido)).toThrow()
    // Se o array que lançou tivesse virado prefixo, esta chamada pularia a checagem que acabou de
    // falhar — a cauda seria vazia e nada seria validado.
    expect(() => assertValidEvents(arrayInvalido)).toThrow(/unknown event kind/)
  })

  it('ENCOLHER o array nao e extensao — cai no fallback', () => {
    assertValidEvents([ev('h1', 'um'), ev('h2', 'dois')])
    expect(() => assertValidEvents([ruim('h1')])).toThrow(/unknown event kind/)
  })
})
