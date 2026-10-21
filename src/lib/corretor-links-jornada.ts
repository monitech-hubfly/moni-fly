import { getPublicAppUrl } from '@/lib/app-url'

export type LinkJornadaCorretor = {
  empreendimentoId: string
  nome: string
  url: string | null
}

type Db = { from: (table: string) => any }

type EmpRow = {
  id?: string
  nome?: string | null
  slug?: string | null
  ativo?: boolean | null
  card_id?: string | null
}

type VinculoRow = {
  corretor_id?: string
  empreendimento_id?: string
  imob_empreendimentos?: EmpRow | EmpRow[] | null
}

type ModeloRow = {
  card_id?: string | null
  page_slug?: string | null
  page_ativa?: boolean | null
  planilha_lotes_path?: string | null
}

function um<T>(raw: T | T[] | null | undefined): T | null {
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw ?? null
}

function slugAberto(modelo: ModeloRow | undefined): string | null {
  if (!modelo) return null
  const slug = String(modelo.page_slug ?? '').trim()
  if (!slug) return null
  const planilha = String(modelo.planilha_lotes_path ?? '').trim()
  if (modelo.page_ativa === true || planilha) return slug
  return null
}

/** Mesmo endereço do botão Acessar Jornada, com o corretor na query. */
export function urlJornadaDoCorretor(baseUrl: string, slug: string, corretorId: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const params = new URLSearchParams({ corretor_id: corretorId })
  return `${base}/empreendimento/${encodeURIComponent(slug)}?${params.toString()}`
}

/**
 * Um link por empreendimento ativo vinculado.
 * O slug é o da jornada do card (page_slug), não o formulário genérico do simulador.
 */
export async function listarLinksJornadaPorCorretores(
  supabase: Db,
  corretorIds: string[],
  baseUrl: string,
): Promise<Map<string, LinkJornadaCorretor[]>> {
  const ids = [...new Set(corretorIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  const mapa = new Map<string, LinkJornadaCorretor[]>()
  if (ids.length === 0) return mapa

  const { data, error } = await supabase
    .from('imob_corretor_empreendimentos')
    .select('corretor_id, empreendimento_id, imob_empreendimentos(id, nome, slug, ativo, card_id)')
    .in('corretor_id', ids)

  if (error) {
    console.error('[corretor-links-jornada] vínculos:', error.message)
    return mapa
  }

  const vinculos = (data ?? []) as VinculoRow[]
  const cardIds = new Set<string>()
  const slugsCatalogo = new Set<string>()
  for (const row of vinculos) {
    const emp = um(row.imob_empreendimentos)
    if (!emp || emp.ativo === false) continue
    const cardId = String(emp.card_id ?? '').trim()
    const slug = String(emp.slug ?? '').trim()
    if (cardId) cardIds.add(cardId)
    if (slug) slugsCatalogo.add(slug)
  }

  const porCard = new Map<string, ModeloRow>()
  const porSlug = new Map<string, ModeloRow>()

  if (cardIds.size > 0) {
    const { data: modelos, error: modeloErr } = await supabase
      .from('imob_card_modelo')
      .select('card_id, page_slug, page_ativa, planilha_lotes_path')
      .in('card_id', [...cardIds])
    if (modeloErr) console.error('[corretor-links-jornada] modelo por card:', modeloErr.message)
    for (const modelo of (modelos ?? []) as ModeloRow[]) {
      const cardId = String(modelo.card_id ?? '').trim()
      if (cardId) porCard.set(cardId, modelo)
    }
  }

  if (slugsCatalogo.size > 0) {
    const { data: modelos, error: modeloErr } = await supabase
      .from('imob_card_modelo')
      .select('card_id, page_slug, page_ativa, planilha_lotes_path')
      .in('page_slug', [...slugsCatalogo])
    if (modeloErr) console.error('[corretor-links-jornada] modelo por slug:', modeloErr.message)
    for (const modelo of (modelos ?? []) as ModeloRow[]) {
      const slug = String(modelo.page_slug ?? '').trim().toLowerCase()
      if (slug) porSlug.set(slug, modelo)
    }
  }

  for (const row of vinculos) {
    const corretorId = String(row.corretor_id ?? '').trim()
    const emp = um(row.imob_empreendimentos)
    if (!corretorId || !emp || emp.ativo === false) continue
    const empreendimentoId = String(emp.id ?? row.empreendimento_id ?? '').trim()
    const nome = String(emp.nome ?? '').trim() || 'Empreendimento'
    const cardId = String(emp.card_id ?? '').trim()
    const slugCatalogo = String(emp.slug ?? '').trim().toLowerCase()
    const modelo = (cardId ? porCard.get(cardId) : undefined) ?? (slugCatalogo ? porSlug.get(slugCatalogo) : undefined)
    const slug = slugAberto(modelo)
    const item: LinkJornadaCorretor = {
      empreendimentoId,
      nome,
      url: slug ? urlJornadaDoCorretor(baseUrl, slug, corretorId) : null,
    }
    const lista = mapa.get(corretorId) ?? []
    lista.push(item)
    mapa.set(corretorId, lista)
  }

  for (const [id, lista] of mapa) {
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    mapa.set(id, lista)
  }

  return mapa
}

export async function anexarLinksJornada<T extends { id: string }>(
  supabase: Db,
  rows: T[],
): Promise<(T & { links_jornada: LinkJornadaCorretor[] })[]> {
  try {
    const mapa = await listarLinksJornadaPorCorretores(
      supabase,
      rows.map((row) => row.id),
      getPublicAppUrl(),
    )
    return rows.map((row) => ({ ...row, links_jornada: mapa.get(row.id) ?? [] }))
  } catch (err) {
    console.error('[corretor-links-jornada] anexar:', err)
    return rows.map((row) => ({ ...row, links_jornada: [] }))
  }
}
