/**
 * Utilitário centralizado para classificação de status (Farol) baseada em percentual.
 * Usado de forma consistente em: indicadores semanais, status acumulado e status geral.
 *
 * Regra de classificação (Farol de Status):
 * - Por faixa: verde escuro, verde claro, amarelo — cada um com valor e operador (≥, ≤, =, >, <, ≠).
 * - Primeira faixa que bater (na ordem VE → VC → AM) define o status; se nenhuma, vermelho.
 * - null/undefined: vazio (semana não planejada ou sem dados)
 */

/** @typedef {'verde-escuro'|'verde-claro'|'amarelo'|'vermelho'|'vazio'} StatusFarol */
/** @typedef {'gte'|'lte'|'eq'|'gt'|'lt'|'ne'} RegraOp */

const PADRAO_VERDE_ESCURO = 75
const PADRAO_VERDE_CLARO = 60
const PADRAO_AMARELO = 30
const PADRAO_OP = 'gte'

/**
 * Verifica se o valor atende à condição (op, threshold).
 * @param {number} value - Valor (ex.: percentual)
 * @param {RegraOp|string|undefined} op - gte=≥, lte=≤, eq==, gt=>, lt=<, ne=≠
 * @param {number} threshold - Limiar
 */
export function comparaRegra(value, op, threshold) {
  const o = (op || PADRAO_OP).toLowerCase()
  switch (o) {
    case 'gte': return value >= threshold
    case 'lte': return value <= threshold
    case 'eq': return Math.abs(value - threshold) < 0.01
    case 'gt': return value > threshold
    case 'lt': return value < threshold
    case 'ne': return Math.abs(value - threshold) >= 0.01
    default: return value >= threshold
  }
}

/**
 * Retorna o status do farol baseado no percentual e na regra (valores + operadores por faixa).
 * @param {number|null|undefined} percent - Percentual de execução (0-100 ou null)
 * @param {{ verdeEscuro?: number, verdeClaro?: number, amarelo?: number, verdeEscuroOp?: RegraOp, verdeClaroOp?: RegraOp, amareloOp?: RegraOp }} [regra] - Limiares e ops. Se omitido, usa 75/60/30 com ≥.
 * @returns {{ status: StatusFarol, cssClass: string }}
 */
export function getStatusFromPercent(percent, regra = {}) {
  if (percent == null) {
    return { status: 'vazio', cssClass: 'vazio' }
  }
  const ve = regra.verdeEscuro ?? PADRAO_VERDE_ESCURO
  const vc = regra.verdeClaro ?? PADRAO_VERDE_CLARO
  const am = regra.amarelo ?? PADRAO_AMARELO
  const veOp = regra.verdeEscuroOp ?? PADRAO_OP
  const vcOp = regra.verdeClaroOp ?? PADRAO_OP
  const amOp = regra.amareloOp ?? PADRAO_OP
  if (comparaRegra(percent, veOp, ve)) return { status: 'verde-escuro', cssClass: 'verde-escuro' }
  if (comparaRegra(percent, vcOp, vc)) return { status: 'verde-claro', cssClass: 'verde-claro' }
  if (comparaRegra(percent, amOp, am)) return { status: 'amarelo', cssClass: 'amarelo' }
  return { status: 'vermelho', cssClass: 'vermelho' }
}

