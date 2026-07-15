'use server'

import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type PericiaStatus =
  | 'rascunho'
  | 'aberta'
  | 'investigando'
  | 'plano_acao'
  | 'concluida'
  | 'cancelada'

export type PericiaTipo = 'investigacao' | 'projeto' | 'auditoria'

export type PericiaDominio =
  | 'GBox'
  | 'Crédito e financeiro'
  | 'Inadimplência e atrasos'
  | 'Taxa de franquia'
  | 'Homologações e fornecedores'
  | 'Produtos e catálogo'
  | 'Contratos e jurídico'
  | 'SPE e estruturas jurídicas'
  | 'Acoplamento'
  | 'Viabilidade e comitê'
  | 'Terrenistas e permuta'
  | 'Obra e cronograma'
  | 'Divulgação e IMOB'
  | 'Moní Care'
  | 'Ciclo do Frank'
  | 'Ferramentas e IA'
  | 'Outros'

export const PERICIAS_DOMINIOS: PericiaDominio[] = [
  'GBox',
  'Crédito e financeiro',
  'Inadimplência e atrasos',
  'Taxa de franquia',
  'Homologações e fornecedores',
  'Produtos e catálogo',
  'Contratos e jurídico',
  'SPE e estruturas jurídicas',
  'Acoplamento',
  'Viabilidade e comitê',
  'Terrenistas e permuta',
  'Obra e cronograma',
  'Divulgação e IMOB',
  'Moní Care',
  'Ciclo do Frank',
  'Ferramentas e IA',
  'Outros',
]

export interface Pericia {
  id: number
  numero: string
  titulo: string
  dominio: PericiaDominio
  tipo: PericiaTipo | null
  status: PericiaStatus
  prioridade: string | null
  time_responsavel: string | null
  responsavel_id: string | null
  data_inicio: string | null
  data_previsao_conclusao: string | null
  data_conclusao_real: string | null
  causa_raiz: string | null
  parecer_final: string | null
  recidivas_count: number
  chamados_count: number
  carometro_count: number
  created_by: string | null
  created_at: string
}

export interface PericiaParaSelect {
  id: number
  numero: string
  titulo: string
  status: PericiaStatus
  dominio: PericiaDominio
}

export interface CriarPericiaPayload {
  titulo: string
  dominio: PericiaDominio
  tipo?: PericiaTipo
  prioridade?: string
  time_responsavel?: string
  responsavel_id?: string
  data_previsao_conclusao?: string
  observacoes?: string
}

// Tipo de retorno uniforme para as actions
type ActionResult<T> = { data: T } | { error: string }

// ---------------------------------------------------------------------------
// Helper: cria cliente Supabase para Server Actions
// ---------------------------------------------------------------------------
async function createClient() {
  return createSupabaseServerClient()
}

// ---------------------------------------------------------------------------
// Helper interno: busca usuário autenticado
// ---------------------------------------------------------------------------
async function getAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Usuário não autenticado')
  return user
}

// ---------------------------------------------------------------------------
// 1. criarPericia
// ---------------------------------------------------------------------------
/**
 * Cria uma nova perícia com status inicial 'rascunho' e registra o histórico.
 */
export async function criarPericia(
  payload: CriarPericiaPayload
): Promise<ActionResult<Pericia>> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()

    // Insere a perícia
    const { data: pericia, error: insertError } = await supabase
      .from('sirene_pericias')
      .insert({
        nome_pericia: payload.titulo,
        dominio: payload.dominio,
        tipo: payload.tipo ?? null,
        prioridade: payload.prioridade ?? null,
        time_responsavel: payload.time_responsavel ?? null,
        responsavel_id: payload.responsavel_id ?? null,
        data_previsao_conclusao: payload.data_previsao_conclusao ?? null,
        status: 'aberta' as PericiaStatus,
        created_by: user.id,
        recidivas_count: 0,
        chamados_count: 0,
        carometro_count: 0,
      })
      .select()
      .single()

    if (insertError || !pericia) {
      return { error: insertError?.message ?? 'Erro ao criar perícia' }
    }

    // Registra o histórico de criação
    const { error: histError } = await supabase
      .from('sirene_pericia_historico')
      .insert({
        pericia_id: pericia.id,
        fase_nova: 'rascunho',
        observacao: payload.observacoes
          ? `Pericia criada. ${payload.observacoes}`
          : 'Pericia criada',
        user_id: user.id,
      })

    if (histError) {
      // Não bloqueia o fluxo principal, mas loga o erro
      console.error('[criarPericia] Erro ao inserir histórico:', histError.message)
    }

    revalidatePath('/sirene/pericias')
    return { data: pericia as Pericia }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao criar perícia'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 2. editarPericia
// ---------------------------------------------------------------------------
/**
 * Atualiza campos da perícia. Aceita qualquer subconjunto de CriarPericiaPayload
 * mais campos adicionais como causa_raiz, parecer_final e motivo_cancelamento.
 */
export async function editarPericia(
  id: number,
  payload: Partial<
    CriarPericiaPayload & {
      titulo: string
      causa_raiz: string
      parecer_final: string
      motivo_cancelamento: string
    }
  >
): Promise<ActionResult<Pericia>> {
  try {
    const supabase = await createClient()
    await getAuthUser()

    // Remove campos undefined para não sobrescrever valores com null indesejado
    const camposParaAtualizar = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    )

    if (Object.keys(camposParaAtualizar).length === 0) {
      return { error: 'Nenhum campo fornecido para atualização' }
    }

    const { data: pericia, error } = await supabase
      .from('sirene_pericias')
      .update(camposParaAtualizar)
      .eq('id', id)
      .select()
      .single()

    if (error || !pericia) {
      return { error: error?.message ?? 'Erro ao atualizar perícia' }
    }

    revalidatePath('/sirene/pericias')
    return { data: pericia as Pericia }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado ao editar perícia'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 3. avancarFasePericia
// ---------------------------------------------------------------------------
/**
 * Avança a perícia para uma nova fase, aplicando gates de validação.
 *
 * Gates:
 * - investigando → plano_acao : exige causa_raiz preenchida
 * - plano_acao   → concluida  : exige parecer_final preenchido
 * - qualquer     → cancelada  : exige motivo_cancelamento preenchido
 */
export async function avancarFasePericia(
  id: number,
  novaFase: PericiaStatus,
  observacao?: string
): Promise<ActionResult<Pericia>> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()

    // Busca a perícia atual para validações
    const { data: periciaAtual, error: fetchError } = await supabase
      .from('sirene_pericias')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !periciaAtual) {
      return { error: fetchError?.message ?? 'Perícia não encontrada' }
    }

    const faseAtual: PericiaStatus = periciaAtual.status

    // ---- Gates de validação ------------------------------------------------

    if (novaFase === 'plano_acao' && faseAtual === 'investigando') {
      if (!periciaAtual.causa_raiz || periciaAtual.causa_raiz.trim() === '') {
        return {
          error:
            'Para avançar para Plano de Ação é necessário preencher a causa raiz.',
        }
      }
    }

    if (novaFase === 'concluida' && faseAtual === 'plano_acao') {
      if (!periciaAtual.parecer_final || periciaAtual.parecer_final.trim() === '') {
        return {
          error:
            'Para concluir a perícia é necessário preencher o parecer final.',
        }
      }
    }

    if (novaFase === 'cancelada') {
      if (!periciaAtual.motivo_cancelamento || periciaAtual.motivo_cancelamento.trim() === '') {
        return {
          error:
            'Para cancelar a perícia é necessário preencher o motivo do cancelamento.',
        }
      }
    }

    // ---- Monta update ------------------------------------------------------
    const updatePayload: Record<string, unknown> = { status: novaFase }

    if (novaFase === 'concluida') {
      updatePayload.data_conclusao_real = new Date().toISOString()
    }

    if (novaFase === 'aberta' && !periciaAtual.data_inicio) {
      updatePayload.data_inicio = new Date().toISOString()
    }

    const { data: pericia, error: updateError } = await supabase
      .from('sirene_pericias')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError || !pericia) {
      return { error: updateError?.message ?? 'Erro ao avançar fase da perícia' }
    }

    // ---- Histórico ---------------------------------------------------------
    const { error: histError } = await supabase
      .from('sirene_pericia_historico')
      .insert({
        pericia_id: id,
        fase_anterior: faseAtual,
        fase_nova: novaFase,
        observacao: observacao ?? null,
        user_id: user.id,
      })

    if (histError) {
      console.error('[avancarFasePericia] Erro ao inserir histórico:', histError.message)
    }

    // ---- Notificação se concluída -----------------------------------------
    if (novaFase === 'concluida') {
      // Notifica todos os usuários com papel caneta_verde
      await notificarCanetaVerde(supabase, {
        tipo: 'pericia_concluida',
        titulo: `Perícia concluída: ${periciaAtual.numero}`,
        mensagem: `A perícia "${periciaAtual.titulo}" foi concluída.`,
        referencia_tipo: 'pericia',
        referencia_id: String(id),
      })
    }

    revalidatePath('/sirene/pericias')
    return { data: pericia as Pericia }
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Erro inesperado ao avançar fase da perícia'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 4. vincularChamadoPericia
// ---------------------------------------------------------------------------
/**
 * Vincula um chamado a uma perícia, incrementa o contador e detecta recidiva
 * caso a perícia já esteja concluída.
 */
export async function vincularChamadoPericia(
  chamadoId: number,
  periciaId: number,
  motivo: string
): Promise<ActionResult<{ periciaId: number; chamadoId: number }>> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()

    // Busca perícia para verificar o status e checar recidiva
    const { data: pericia, error: fetchError } = await supabase
      .from('sirene_pericias')
      .select('id, status, chamados_count')
      .eq('id', periciaId)
      .single()

    if (fetchError || !pericia) {
      return { error: fetchError?.message ?? 'Perícia não encontrada' }
    }

    // Upsert na tabela de vínculo (evita duplicatas)
    const { error: vinculoError } = await supabase
      .from('sirene_pericia_chamados')
      .upsert(
        {
          pericia_id: periciaId,
          chamado_id: chamadoId,
          motivo,
          vinculado_por: user.id,
        },
        { onConflict: 'chamado_id,pericia_id' }
      )

    if (vinculoError) {
      return { error: vinculoError.message }
    }

    // Atualiza pericia_id no chamado
    const { error: chamadoError } = await supabase
      .from('sirene_chamados')
      .update({ pericia_id: periciaId })
      .eq('id', chamadoId)

    if (chamadoError) {
      console.error('[vincularChamadoPericia] Erro ao atualizar chamado:', chamadoError.message)
    }

    // Incrementa chamados_count
    const { error: countError } = await supabase
      .from('sirene_pericias')
      .update({ chamados_count: (pericia.chamados_count ?? 0) + 1 })
      .eq('id', periciaId)

    if (countError) {
      console.error('[vincularChamadoPericia] Erro ao incrementar chamados_count:', countError.message)
    }

    // Detecta recidiva se perícia já concluída
    if (pericia.status === 'concluida') {
      await detectarRecidiva(periciaId)
    }

    revalidatePath('/sirene/pericias')
    return { data: { periciaId, chamadoId } }
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Erro inesperado ao vincular chamado à perícia'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 5. vincularCarometroPericia
// ---------------------------------------------------------------------------
/**
 * Vincula um item do carômetro (ação ou tarefa) a uma perícia.
 * `itemId` = UUID de `acoes.id` ou `tarefas.id`.
 */
export async function vincularCarometroPericia(
  periciaId: number,
  itemTipo: 'acao' | 'tarefa',
  itemId: string,
  itemDescricao: string,
  franqueadoId?: string | null,
): Promise<ActionResult<{ periciaId: number; itemId: string }>> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()

    const itemUuid = String(itemId ?? '').trim()
    if (!itemUuid) {
      return { error: 'ID do item do carômetro inválido.' }
    }

    // Busca perícia
    const { data: pericia, error: fetchError } = await supabase
      .from('sirene_pericias')
      .select('id, status, carometro_count')
      .eq('id', periciaId)
      .single()

    if (fetchError || !pericia) {
      return { error: fetchError?.message ?? 'Perícia não encontrada' }
    }

    // Insere vínculo no carômetro
    const { error: vinculoError } = await supabase
      .from('sirene_pericia_carometro_vinculos')
      .insert({
        pericia_id: periciaId,
        item_tipo: itemTipo,
        item_id: itemUuid,
        item_descricao: itemDescricao,
        franqueado_id: franqueadoId?.trim() || null,
        vinculado_por: user.id,
      })

    if (vinculoError) {
      return { error: vinculoError.message }
    }

    // Incrementa carometro_count
    const { error: countError } = await supabase
      .from('sirene_pericias')
      .update({ carometro_count: (pericia.carometro_count ?? 0) + 1 })
      .eq('id', periciaId)

    if (countError) {
      console.error(
        '[vincularCarometroPericia] Erro ao incrementar carometro_count:',
        countError.message
      )
    }

    // Detecta recidiva se perícia já concluída
    if (pericia.status === 'concluida') {
      await detectarRecidiva(periciaId)
    }

    revalidatePath('/sirene/pericias')
    revalidatePath('/carometro')
    return { data: { periciaId, itemId: itemUuid } }
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Erro inesperado ao vincular carômetro à perícia'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 6. listPericiasParaSelect
// ---------------------------------------------------------------------------
/**
 * Lista perícias abertas de um domínio para uso em selects/dropdowns.
 * Não pagina — retorna todos os resultados.
 */
export async function listPericiasParaSelect(
  dominio: string
): Promise<PericiaParaSelect[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sirene_pericias')
      .select('id, numero, titulo, status, dominio')
      .eq('dominio', dominio)
      .in('status', ['rascunho', 'aberta', 'investigando', 'plano_acao'])
      .order('titulo', { ascending: true })

    if (error) {
      console.error('[listPericiasParaSelect] Erro:', error.message)
      return []
    }

    return (data ?? []) as PericiaParaSelect[]
  } catch (err: unknown) {
    console.error('[listPericiasParaSelect] Erro inesperado:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// 7. listPericias
// ---------------------------------------------------------------------------
/**
 * Lista perícias com suporte a filtros opcionais por domínio, status e busca
 * por texto no título. Ordena por relevância (chamados + carômetro) e data.
 */
export async function listPericias(filtros?: {
  dominio?: PericiaDominio
  status?: PericiaStatus
  busca?: string
}): Promise<ActionResult<Pericia[]>> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('sirene_pericias')
      .select('*')
      .order('chamados_count', { ascending: false })
      .order('created_at', { ascending: false })

    if (filtros?.dominio) {
      query = query.eq('dominio', filtros.dominio)
    }

    if (filtros?.status) {
      query = query.eq('status', filtros.status)
    }

    if (filtros?.busca && filtros.busca.trim() !== '') {
      query = query.ilike('titulo', `%${filtros.busca.trim()}%`)
    }

    const { data, error } = await query

    if (error) {
      return { error: error.message }
    }

    // Ordena no cliente por chamados_count + carometro_count DESC como critério composto
    const sorted = (data ?? []).sort((a, b) => {
      const scoreB = (b.chamados_count ?? 0) + (b.carometro_count ?? 0)
      const scoreA = (a.chamados_count ?? 0) + (a.carometro_count ?? 0)
      if (scoreB !== scoreA) return scoreB - scoreA
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return { data: sorted as Pericia[] }
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Erro inesperado ao listar perícias'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 8. getPericia
// ---------------------------------------------------------------------------
/**
 * Busca uma perícia pelo ID, incluindo suas ações e vínculos de chamados.
 */
export async function getPericia(id: number): Promise<
  ActionResult<
    Pericia & {
      acoes: PericiaAcao[]
      chamados_vinculados: PericiaChamadoVinculo[]
      historico: PericiaHistoricoItem[]
    }
  >
> {
  try {
    const supabase = await createClient()

    // Busca a perícia principal
    const { data: pericia, error: periciaError } = await supabase
      .from('sirene_pericias')
      .select('*')
      .eq('id', id)
      .single()

    if (periciaError || !pericia) {
      return { error: periciaError?.message ?? 'Perícia não encontrada' }
    }

    // Busca ações vinculadas
    const { data: acoes, error: acoesError } = await supabase
      .from('sirene_pericia_acoes')
      .select('*')
      .eq('pericia_id', id)
      .order('created_at', { ascending: true })

    if (acoesError) {
      console.error('[getPericia] Erro ao buscar ações:', acoesError.message)
    }

    // Busca chamados vinculados
    const { data: chamados, error: chamadosError } = await supabase
      .from('sirene_pericia_chamados')
      .select('*, sirene_chamados(id, numero, titulo, status)')
      .eq('pericia_id', id)
      .order('created_at', { ascending: false })

    if (chamadosError) {
      console.error('[getPericia] Erro ao buscar chamados:', chamadosError.message)
    }

    // Busca histórico de fases
    const { data: historico, error: historicoError } = await supabase
      .from('sirene_pericia_historico')
      .select('*')
      .eq('pericia_id', id)
      .order('created_at', { ascending: true })

    if (historicoError) {
      console.error('[getPericia] Erro ao buscar histórico:', historicoError.message)
    }

    return {
      data: {
        ...(pericia as Pericia),
        acoes: (acoes ?? []) as PericiaAcao[],
        chamados_vinculados: (chamados ?? []) as PericiaChamadoVinculo[],
        historico: (historico ?? []) as PericiaHistoricoItem[],
      },
    }
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Erro inesperado ao buscar perícia'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 9. criarAcaoPericia
// ---------------------------------------------------------------------------
/**
 * Cria uma ação dentro de uma perícia.
 */
export async function criarAcaoPericia(
  periciaId: number,
  payload: {
    descricao: string
    time_responsavel?: string
    responsavel_id?: string
    responsavel_nome?: string
    prazo?: string
  }
): Promise<ActionResult<PericiaAcao>> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()

    const { data, error } = await supabase
      .from('sirene_pericia_acoes')
      .insert({
        pericia_id: periciaId,
        descricao: payload.descricao,
        time_responsavel: payload.time_responsavel ?? null,
        responsavel_id: payload.responsavel_id ?? null,
        responsavel_nome: payload.responsavel_nome ?? null,
        prazo: payload.prazo ?? null,
        status: 'pendente',
      })
      .select()
      .single()

    if (error || !data) {
      return { error: error?.message ?? 'Erro ao criar ação' }
    }

    revalidatePath('/sirene/pericias')
    return { data: data as PericiaAcao }
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Erro inesperado ao criar ação da perícia'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 10. atualizarAcaoPericia
// ---------------------------------------------------------------------------
/**
 * Atualiza campos de uma ação da perícia.
 */
export async function atualizarAcaoPericia(
  id: number,
  payload: {
    status?: string
    conclusao?: string
    descricao?: string
    prazo?: string
  }
): Promise<ActionResult<PericiaAcao>> {
  try {
    const supabase = await createClient()
    await getAuthUser()

    const camposParaAtualizar = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    )

    if (Object.keys(camposParaAtualizar).length === 0) {
      return { error: 'Nenhum campo fornecido para atualização' }
    }

    // Se estiver sendo concluída, registra a data de conclusão
    if (payload.status === 'concluida' && !camposParaAtualizar.data_conclusao) {
      camposParaAtualizar.data_conclusao = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('sirene_pericia_acoes')
      .update(camposParaAtualizar)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      return { error: error?.message ?? 'Erro ao atualizar ação' }
    }

    revalidatePath('/sirene/pericias')
    return { data: data as PericiaAcao }
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Erro inesperado ao atualizar ação da perícia'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// 11. detectarRecidiva (interno — não exportado)
// ---------------------------------------------------------------------------
/**
 * Detecta recidiva em uma perícia concluída que recebeu novo chamado ou
 * vínculo de carômetro. Incrementa o contador e notifica usuários caneta_verde.
 */
async function detectarRecidiva(periciaId: number): Promise<void> {
  try {
    const supabase = await createClient()

    // Busca recidivas_count atual
    const { data: pericia, error: fetchError } = await supabase
      .from('sirene_pericias')
      .select('id, recidivas_count, numero, titulo')
      .eq('id', periciaId)
      .single()

    if (fetchError || !pericia) {
      console.error('[detectarRecidiva] Perícia não encontrada:', fetchError?.message)
      return
    }

    // Incrementa recidivas_count
    const novoCount = (pericia.recidivas_count ?? 0) + 1
    const { error: updateError } = await supabase
      .from('sirene_pericias')
      .update({ recidivas_count: novoCount })
      .eq('id', periciaId)

    if (updateError) {
      console.error('[detectarRecidiva] Erro ao incrementar recidivas_count:', updateError.message)
    }

    // Notifica todos com papel caneta_verde
    await notificarCanetaVerde(supabase, {
      tipo: 'pericia_recidiva',
      titulo: `Recidiva detectada: ${pericia.numero}`,
      mensagem: `A perícia "${pericia.titulo}" (já concluída) recebeu novo vínculo — recidiva #${novoCount}.`,
      referencia_tipo: 'pericia',
      referencia_id: String(periciaId),
    })
  } catch (err: unknown) {
    console.error('[detectarRecidiva] Erro inesperado:', err)
  }
}

// ---------------------------------------------------------------------------
// 12. buscarPericiaSugestoes
// ---------------------------------------------------------------------------
/**
 * Busca perícias abertas por texto livre (ILIKE) para sugestão em autocomplete.
 * Filtra por domínio se fornecido. Limita a 5 resultados.
 *
 * Nota: a busca por similarity (pg_trgm) é feita via ILIKE para compatibilidade
 * sem necessidade de RPC. Se pg_trgm estiver habilitado no projeto, substituir
 * pela chamada a uma função RPC para melhor relevância.
 */
export async function buscarPericiaSugestoes(
  texto: string,
  dominio?: PericiaDominio
): Promise<ActionResult<PericiaParaSelect[]>> {
  try {
    const supabase = await createClient()

    if (!texto || texto.trim().length < 2) {
      return { data: [] }
    }

    const termoBusca = texto.trim()

    let query = supabase
      .from('sirene_pericias')
      .select('id, numero, titulo, status, dominio')
      .ilike('titulo', `%${termoBusca}%`)
      .in('status', ['rascunho', 'aberta', 'investigando'])
      .limit(5)

    if (dominio) {
      query = query.eq('dominio', dominio)
    }

    const { data, error } = await query.order('titulo', { ascending: true })

    if (error) {
      return { error: error.message }
    }

    return { data: (data ?? []) as PericiaParaSelect[] }
  } catch (err: unknown) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Erro inesperado ao buscar sugestões de perícias'
    return { error: msg }
  }
}

// ---------------------------------------------------------------------------
// Tipos auxiliares (usados nas queries relacionadas de getPericia)
// ---------------------------------------------------------------------------

export interface PericiaAcao {
  id: number
  pericia_id: number
  descricao: string
  status: string
  time_responsavel: string | null
  responsavel_id: string | null
  responsavel_nome: string | null
  prazo: string | null
  conclusao: string | null
  data_conclusao: string | null
  criado_por: string | null
  created_at: string
}

export interface PericiaChamadoVinculo {
  id: number
  pericia_id: number
  chamado_id: number
  motivo: string | null
  vinculado_por: string | null
  created_at: string
}

export interface PericiaHistoricoItem {
  id: number
  pericia_id: number
  fase_anterior: PericiaStatus | null
  fase_nova: PericiaStatus
  observacao: string | null
  criado_por: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Helper interno: notifica todos os usuários com papel caneta_verde
// ---------------------------------------------------------------------------

interface NotificacaoPayload {
  tipo: string
  titulo: string
  mensagem: string
  referencia_tipo: string
  referencia_id: string
}

async function notificarCanetaVerde(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: NotificacaoPayload
): Promise<void> {
  try {
    // Busca usuários com papel caneta_verde
    const { data: papeis, error: papeisError } = await supabase
      .from('sirene_papeis')
      .select('user_id')
      .eq('papel', 'caneta_verde')

    if (papeisError || !papeis || papeis.length === 0) {
      if (papeisError) {
        console.error('[notificarCanetaVerde] Erro ao buscar papéis:', papeisError.message)
      }
      return
    }

    // Monta notificações para cada usuário caneta_verde
    const notificacoes = papeis.map((p: { user_id: string }) => ({
      user_id: p.user_id,
      tipo: payload.tipo,
      titulo: payload.titulo,
      mensagem: payload.mensagem,
      referencia_tipo: payload.referencia_tipo,
      referencia_id: payload.referencia_id,
      lida: false,
    }))

    const { error: notifError } = await supabase
      .from('sirene_notificacoes')
      .insert(notificacoes)

    if (notifError) {
      console.error('[notificarCanetaVerde] Erro ao inserir notificações:', notifError.message)
    }
  } catch (err: unknown) {
    console.error('[notificarCanetaVerde] Erro inesperado:', err)
  }
}
