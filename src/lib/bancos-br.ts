/**
 * Bancos brasileiros (código COMPE / BACEN) para selects de conta.
 * Lista enxuta dos principais; valor do select = código COMPE.
 */
export const BANCOS_BRASIL = [
  { codigo: '001', nome: 'Banco do Brasil' },
  { codigo: '033', nome: 'Santander' },
  { codigo: '104', nome: 'Caixa Econômica Federal' },
  { codigo: '237', nome: 'Bradesco' },
  { codigo: '341', nome: 'Itaú Unibanco' },
  { codigo: '077', nome: 'Banco Inter' },
  { codigo: '260', nome: 'Nubank (Nu Pagamentos)' },
  { codigo: '336', nome: 'C6 Bank' },
  { codigo: '212', nome: 'Banco Original' },
  { codigo: '290', nome: 'PagSeguro' },
  { codigo: '323', nome: 'Mercado Pago' },
  { codigo: '380', nome: 'PicPay' },
  { codigo: '041', nome: 'Banrisul' },
  { codigo: '748', nome: 'Sicredi' },
  { codigo: '756', nome: 'Sicoob' },
  { codigo: '422', nome: 'Safra' },
  { codigo: '070', nome: 'BRB' },
  { codigo: '136', nome: 'Unicred' },
  { codigo: '021', nome: 'Banestes' },
  { codigo: '047', nome: 'Banese' },
  { codigo: '085', nome: 'Ailos (Cooperativa)' },
  { codigo: '197', nome: 'Stone' },
  { codigo: '208', nome: 'BTG Pactual' },
  { codigo: '623', nome: 'Banco Pan' },
  { codigo: '655', nome: 'Neon / Votorantim' },
] as const

export type BancoBrasilCodigo = (typeof BANCOS_BRASIL)[number]['codigo']

export function labelBanco(codigo: string | null | undefined): string {
  const c = String(codigo ?? '').trim()
  const b = BANCOS_BRASIL.find((x) => x.codigo === c)
  return b ? `${b.codigo} — ${b.nome}` : c || '—'
}

export function nomeBancoPorCodigo(codigo: string | null | undefined): string | null {
  const c = String(codigo ?? '').trim()
  return BANCOS_BRASIL.find((x) => x.codigo === c)?.nome ?? null
}
