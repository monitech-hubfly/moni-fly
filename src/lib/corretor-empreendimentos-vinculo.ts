import type { createClient } from '@/lib/supabase/server'

export type EmpreendimentoVinculoOpcao = {
  id: string
  nome: string
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Db = { from: (table: string) => any }

export function idsEmpreendimentoInformados(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const unicos = new Set<string>()
  for (const item of raw) {
    const id = String(item ?? '').trim()
    if (UUID.test(id)) unicos.add(id)
  }
  return [...unicos].slice(0, 100)
}

/** Empreendimentos ativos: são os que o corretor pode vincular no cadastro. */
export async function listarEmpreendimentosParaVinculoCorretor(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<EmpreendimentoVinculoOpcao[]> {
  const { data, error } = await supabase
    .from('imob_empreendimentos')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) {
    console.error('[corretor-empreendimentos] lista:', error.message)
    return []
  }

  return (data ?? [])
    .map((row) => {
      const r = row as { id?: string; nome?: string | null }
      return { id: String(r.id ?? ''), nome: String(r.nome ?? '').trim() }
    })
    .filter((row) => row.id && row.nome)
}

/** Grava só ids de empreendimentos ativos. Ids desconhecidos são ignorados. */
export async function vincularCorretorAosEmpreendimentosAtivos(
  supabase: Db,
  corretorId: string,
  empreendimentoIds: string[],
): Promise<{ ok: true; vinculados: number } | { ok: false; error: string }> {
  const cid = String(corretorId ?? '').trim()
  const ids = idsEmpreendimentoInformados(empreendimentoIds)
  if (!cid) return { ok: false, error: 'Corretor inválido.' }
  if (ids.length === 0) return { ok: true, vinculados: 0 }

  const { data, error } = await supabase
    .from('imob_empreendimentos')
    .select('id')
    .eq('ativo', true)
    .in('id', ids)

  if (error) return { ok: false, error: error.message }

  const ativos = (data ?? [])
    .map((row: { id?: string }) => String(row.id ?? ''))
    .filter(Boolean)
  if (ativos.length === 0) return { ok: true, vinculados: 0 }

  const { error: linkErr } = await supabase.from('imob_corretor_empreendimentos').upsert(
    ativos.map((empreendimento_id: string) => ({ corretor_id: cid, empreendimento_id })),
    { onConflict: 'corretor_id,empreendimento_id' },
  )
  if (linkErr) return { ok: false, error: linkErr.message }
  return { ok: true, vinculados: ativos.length }
}

/** Deixa o corretor ligado só aos empreendimentos ativos marcados. */
export async function substituirVinculosCorretorEmpreendimentos(
  supabase: Db,
  corretorId: string,
  empreendimentoIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = String(corretorId ?? '').trim()
  const ids = idsEmpreendimentoInformados(empreendimentoIds)
  if (!cid) return { ok: false, error: 'Corretor inválido.' }

  const gravado = await vincularCorretorAosEmpreendimentosAtivos(supabase, cid, ids)
  if (!gravado.ok) return gravado

  let remover = supabase.from('imob_corretor_empreendimentos').delete().eq('corretor_id', cid)
  if (ids.length > 0) {
    const lista = `(${ids.map((id) => `"${id}"`).join(',')})`
    remover = remover.not('empreendimento_id', 'in', lista)
  }
  const { error } = await remover
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
