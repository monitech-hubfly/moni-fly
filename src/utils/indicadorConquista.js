import { isoWeek, isoWeekYear } from './periodos'
import { parseSemanaMetaTexto, semanaMetaNoPrazo } from './metaCiclo'
import { classificarErroSupabase, mensagemErroIndicadorConquistas } from './supabaseErroPostgres'

/**
 * Último valor de lançamento do indicador (texto), mais recente por `criado_em`.
 */
export async function buscarUltimoValorLancamentoIndicador(supabase, indicadorId) {
  if (!indicadorId) return ''
  const { data, error } = await supabase
    .from('indicador_lancamentos')
    .select('valor, criado_em')
    .eq('indicador_id', indicadorId)
    .order('criado_em', { ascending: false })
    .limit(1)
  if (error || !data?.length) return ''
  const v = data[0]?.valor
  return v == null ? '' : String(v).trim()
}

/**
 * Marca indicador atingível como concluído e grava snapshot em `indicador_conquistas`.
 * @param {{ comentario?: string }} opts
 * @returns {{ ok: true } | { ok: false, message: string, errorKind?: string, raw?: object }}
 */
export async function concluirIndicadorAtingivel(supabase, indicador, areaId, opts = {}) {
  if (!indicador?.id || !areaId) {
    return { ok: false, message: 'Indicador ou área inválidos.', errorKind: 'other' }
  }
  if (String(indicador.meta_ciclo_tipo || '').toLowerCase() !== 'atingivel') {
    return { ok: false, message: 'Apenas indicadores do tipo Atingível podem ser concluídos desta forma.', errorKind: 'other' }
  }
  if (String(indicador.status || '').toLowerCase() === 'concluido') {
    return { ok: false, message: 'Este indicador já está concluído.', errorKind: 'other' }
  }

  const agora = new Date()
  const semanaConclusao = isoWeek(agora)
  const anoIso = isoWeekYear(agora)
  const prazoOriginal = String(indicador.meta_unidade || '').trim() || null
  const noPrazo = semanaMetaNoPrazo(prazoOriginal, `S${semanaConclusao}`) === true

  const ultimoValor = await buscarUltimoValorLancamentoIndicador(supabase, indicador.id)

  const nome = String(indicador.nome || '').trim() || 'Indicador'
  const unidade = indicador.unidade != null ? String(indicador.unidade).trim() : null

  const concluidoEm = agora.toISOString()
  const coment = opts.comentario != null ? String(opts.comentario).trim() : ''

  const updatePayload = {
    status: 'concluido',
    concluido_em: concluidoEm
  }
  if (coment) updatePayload.comentario_conclusao = coment

  const { error: errUp } = await supabase.from('indicadores').update(updatePayload).eq('id', indicador.id)

  if (errUp) {
    const m = String(errUp.message || '')
    if (m.toLowerCase().includes('status') || m.toLowerCase().includes('concluido_em')) {
      return {
        ok: false,
        message:
          'Não foi possível concluir: faltam colunas em indicadores (status, concluido_em). Rode no Supabase o bloco ALTER de indicadores em supabase-objetivos-ciclo-vida-minimo.sql.',
        errorKind: 'schema_mismatch',
        raw: errUp
      }
    }
    return { ok: false, message: m || 'Erro ao atualizar status do indicador.', errorKind: classificarErroSupabase(errUp), raw: errUp }
  }

  const payloadConquista = {
    indicador_id: indicador.id,
    area_id: areaId,
    nome,
    unidade,
    prazo_original: prazoOriginal,
    data_conclusao: agora.toISOString(),
    semana_conclusao: semanaConclusao,
    ano_iso_conclusao: anoIso,
    ultimo_valor: ultimoValor || null,
    no_prazo: noPrazo
  }

  const { error: errIns } = await supabase.from('indicador_conquistas').insert(payloadConquista)
  if (errIns) {
    await supabase.from('indicadores').update({ status: 'ativo', concluido_em: null }).eq('id', indicador.id)
    const errorKind = classificarErroSupabase(errIns)
    return {
      ok: false,
      message: mensagemErroIndicadorConquistas(errIns),
      errorKind,
      raw: errIns
    }
  }

  return { ok: true }
}
