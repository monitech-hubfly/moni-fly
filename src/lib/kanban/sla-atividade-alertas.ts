import { rotuloSlaAtividadeDiasUteis } from '@/lib/dias-uteis';
import { prazoIsoEfetivoSla } from '@/lib/kanban/prazo-negociacao';
import { montarPathAlertaAtividade } from '@/lib/kanban/alerta-atividade-path';
import {
  buscarMetaNotificacaoChamado,
  type AlertaKanbanAtividadeTipo,
} from '@/lib/kanban/chamados-notificacoes';
import { createAdminClient } from '@/lib/supabase/admin';

const JANELA_DEDUPE_HORAS = 24;

type TopicoSlaRow = {
  id: number;
  interacao_id: string;
  chamado_id: number | null;
  nome: string | null;
  descricao: string | null;
  data_fim: string | null;
  prazo_proposto: string | null;
  prazo_status: string | null;
  status: string | null;
  responsavel_id: string | null;
  responsaveis_ids: string[] | null;
};

type InteracaoSlaRow = {
  id: string;
  titulo: string | null;
  data_vencimento: string | null;
  status: string | null;
  responsavel_id: string | null;
  responsaveis_ids: string[] | null;
};

function responsaveisDeRow(row: {
  responsavel_id: string | null;
  responsaveis_ids: string[] | null;
}): string[] {
  const ids = new Set<string>();
  const principal = String(row.responsavel_id ?? '').trim();
  if (principal) ids.add(principal);
  for (const id of row.responsaveis_ids ?? []) {
    const s = String(id ?? '').trim();
    if (s) ids.add(s);
  }
  return [...ids];
}

async function jaNotificadoNasUltimas24h(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  tipo: AlertaKanbanAtividadeTipo,
  referenciaPath: string,
): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_DEDUPE_HORAS * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('alertas')
    .select('id')
    .eq('user_id', userId)
    .eq('tipo', tipo)
    .eq('referencia_path', referenciaPath)
    .gte('created_at', desde)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

async function inserirAlertaSla(
  db: ReturnType<typeof createAdminClient>,
  params: {
    userId: string;
    tipo: AlertaKanbanAtividadeTipo;
    mensagem: string;
    cardId: string | null;
    referenciaPath: string;
  },
): Promise<void> {
  const duplicada = await jaNotificadoNasUltimas24h(db, params.userId, params.tipo, params.referenciaPath);
  if (duplicada) return;

  const { error } = await db.from('alertas').insert({
    user_id: params.userId,
    tipo: params.tipo,
    mensagem: params.mensagem,
    referencia_card_id: params.cardId,
    referencia_path: params.referenciaPath,
    lido: false,
  } as never);

  if (error) {
    console.error('[sla-atividade-alertas] insert:', error.message);
  }
}

async function chamadoSireneFechado(
  db: ReturnType<typeof createAdminClient>,
  chamadoId: number,
): Promise<boolean> {
  const { data } = await db
    .from('sirene_chamados')
    .select('status, arquivado')
    .eq('id', chamadoId)
    .maybeSingle();
  if (!data) return false;
  const s = String((data as { status?: string | null }).status ?? '').toLowerCase();
  return (data as { arquivado?: boolean }).arquivado === true || s === 'concluido' || s === 'concluído';
}

/**
 * Notifica responsáveis de sub-interações (sirene_topicos) e chamados abertos
 * quando o SLA em dias úteis está em atenção ou atrasado.
 */
export async function notificarAtividadesComSlaCritico(): Promise<void> {
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[sla-atividade-alertas] admin client:', e);
    return;
  }

  const { data: topicos, error: errTopicos } = await db
    .from('sirene_topicos')
    .select(
      'id, interacao_id, chamado_id, nome, descricao, data_fim, prazo_proposto, prazo_status, status, responsavel_id, responsaveis_ids',
    )
    .in('status', ['nao_iniciado', 'em_andamento'])
    .eq('arquivado', false)
    .not('interacao_id', 'is', null);

  if (errTopicos) {
    console.error('[sla-atividade-alertas] listagem tópicos:', errTopicos.message);
  } else {
    for (const raw of topicos ?? []) {
      const row = raw as TopicoSlaRow;
      const prazo = prazoIsoEfetivoSla(row);
      if (!prazo) continue;

      const sla = rotuloSlaAtividadeDiasUteis(prazo, row.status ?? undefined);
      if (sla.variante !== 'atrasado' && sla.variante !== 'atencao') continue;

      const interacaoId = String(row.interacao_id ?? '').trim();
      if (!interacaoId) continue;

      if (row.chamado_id != null) {
        const fechado = await chamadoSireneFechado(db, row.chamado_id);
        if (fechado) continue;
      }

      const meta = await buscarMetaNotificacaoChamado(db, interacaoId);
      if (!meta) continue;

      // Verificar se a kanban_atividade vinculada está arquivada ou concluída
      const { data: kaCheck } = await db
        .from('kanban_atividades')
        .select('status, arquivado')
        .eq('id', interacaoId)
        .maybeSingle();
      if (kaCheck) {
        const kaStatus = String((kaCheck as { status?: string | null }).status ?? '').toLowerCase();
        const kaArquivado = Boolean((kaCheck as { arquivado?: boolean | null }).arquivado);
        if (kaArquivado || kaStatus === 'concluida' || kaStatus === 'concluído' || kaStatus === 'cancelada') {
          continue;
        }
      }

      const tituloAtiv =
        String(row.nome ?? row.descricao ?? 'Atividade').trim() || 'Atividade';
      const tituloChamado = meta.titulo.trim() || 'Chamado';
      const referenciaPath = montarPathAlertaAtividade({
        cardId: meta.cardId,
        basePath: meta.basePath,
        interacaoId,
        topicoId: row.id,
        origemLegado: meta.origemLegado ?? false,
      });
      const tipo: AlertaKanbanAtividadeTipo =
        sla.variante === 'atrasado' ? 'sla_atividade_atrasado' : 'sla_atividade_atencao';
      const mensagem =
        sla.variante === 'atrasado'
          ? `Atividade "${tituloAtiv}" (${tituloChamado}) — ${sla.texto}`
          : `Atividade "${tituloAtiv}" (${tituloChamado}) — ${sla.texto}`;

      for (const userId of responsaveisDeRow(row)) {
        await inserirAlertaSla(db, {
          userId,
          tipo,
          mensagem,
          cardId: meta.cardId,
          referenciaPath,
        });
      }
    }
  }

  const { data: interacoes, error: errInteracoes } = await db
    .from('kanban_atividades')
    .select('id, titulo, data_vencimento, status, responsavel_id, responsaveis_ids')
    .in('status', ['pendente', 'em_andamento'])
    .eq('arquivado', false)
    .not('data_vencimento', 'is', null);

  if (errInteracoes) {
    console.error('[sla-atividade-alertas] listagem chamados:', errInteracoes.message);
    return;
  }

  for (const raw of interacoes ?? []) {
    const row = raw as InteracaoSlaRow;
    const prazo = String(row.data_vencimento ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) continue;

    const sla = rotuloSlaAtividadeDiasUteis(prazo, row.status ?? undefined);
    if (sla.variante !== 'atrasado' && sla.variante !== 'atencao') continue;

    const interacaoId = String(row.id ?? '').trim();
    if (!interacaoId) continue;

    const meta = await buscarMetaNotificacaoChamado(db, interacaoId);
    // Verificar se atividade pertence a chamado Sirene fechado
    const { data: atv } = await db
      .from('kanban_atividades')
      .select('sirene_chamado_id')
      .eq('id', interacaoId)
      .maybeSingle();
    const scId = (atv as { sirene_chamado_id?: number | null } | null)?.sirene_chamado_id;
    if (scId != null) {
      const fechado = await chamadoSireneFechado(db, scId);
      if (fechado) continue;
    }
    if (!meta) continue;

    const tituloChamado = String(row.titulo ?? meta.titulo ?? 'Chamado').trim() || 'Chamado';
    const referenciaPath = montarPathAlertaAtividade({
      cardId: meta.cardId,
      basePath: meta.basePath,
      interacaoId,
      origemLegado: meta.origemLegado ?? false,
    });
    const tipo: AlertaKanbanAtividadeTipo =
      sla.variante === 'atrasado' ? 'sla_atividade_atrasado' : 'sla_atividade_atencao';
    const mensagem = `Chamado "${tituloChamado}" — ${sla.texto}`;

    for (const userId of responsaveisDeRow(row)) {
      await inserirAlertaSla(db, {
        userId,
        tipo,
        mensagem,
        cardId: meta.cardId,
        referenciaPath,
      });
    }
  }
}
