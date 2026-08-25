import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { aplicarTagTrancheCreditoObra, type CreditoObraTrancheNumero } from '@/lib/kanban/credito-obra-tag-tranche';
import { inserirKanbanCardVinculo } from '@/lib/kanban/kanban-card-vinculos';
import { resolverTituloCardKanban } from '@/lib/kanban/card-sync-group';
import { createAdminClient } from '@/lib/supabase/admin';

export type CriarCardCreditoObraTrancheInput = {
  operacoesCardId: string;
  faseDestinoSlug: string;
  tituloFallback: string;
  projetoId: string | null;
  redeFranqueadoId: string | null;
  tranche: CreditoObraTrancheNumero;
  criadoPor: string | null;
};

/**
 * Cria card filho no Funil Crédito Obra para tranche 2ª–6ª.
 * Módulo sem `'use server'` para preservar mensagens de erro reais
 * (server actions aninhadas em produção viram digest opaco).
 */
export async function criarCardCreditoObraTranche(
  input: CriarCardCreditoObraTrancheInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const paiId = String(input.operacoesCardId ?? '').trim();
  const faseSlug = String(input.faseDestinoSlug ?? '').trim();
  if (!paiId || !faseSlug) {
    return { ok: false, error: 'Parâmetros inválidos para criar card da tranche.' };
  }

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Serviço indisponível: ${msg}` };
  }

  const { data: fase, error: errFase } = await db
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.CREDITO_OBRA)
    .eq('slug', faseSlug)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errFase) return { ok: false, error: `Fase destino: ${errFase.message}` };
  if (!fase?.id) {
    return {
      ok: false,
      error: `Fase "${faseSlug}" não encontrada no Funil Crédito Obra.`,
    };
  }

  const { data: pai, error: errPai } = await db
    .from('kanban_cards')
    .select(
      'id, franqueado_id, titulo, nome_condominio, quadra, lote, condominio_id, rede_franqueado_id, rede_loteador_id',
    )
    .eq('id', paiId)
    .maybeSingle();

  if (errPai) return { ok: false, error: `Card Operações: ${errPai.message}` };
  if (!pai?.id) return { ok: false, error: 'Card de Operações não encontrado.' };

  const paiRow = pai as {
    franqueado_id?: string | null;
    titulo?: string | null;
    nome_condominio?: string | null;
    quadra?: string | null;
    lote?: string | null;
    condominio_id?: string | null;
    rede_franqueado_id?: string | null;
    rede_loteador_id?: string | null;
  };

  const franqueadoId = String(paiRow.franqueado_id ?? '').trim();
  if (!franqueadoId) {
    return { ok: false, error: 'Card de Operações sem franqueado_id — não é possível criar a tranche.' };
  }

  const redeFranqueadoId =
    String(input.redeFranqueadoId ?? '').trim() ||
    String(paiRow.rede_franqueado_id ?? '').trim() ||
    null;

  let titulo =
    String(input.tituloFallback ?? '').trim() ||
    String(paiRow.titulo ?? '').trim() ||
    'Card';

  try {
    const tituloCalc = await resolverTituloCardKanban(db, {
      rede_franqueado_id: redeFranqueadoId,
      nome_condominio: paiRow.nome_condominio ?? null,
      quadra: paiRow.quadra ?? null,
      lote: paiRow.lote ?? null,
      titulo,
    });
    if (tituloCalc) titulo = tituloCalc;
  } catch (e) {
    console.error('[criarCardCreditoObraTranche] titulo:', e);
  }

  const insertPayload = {
    kanban_id: KANBAN_IDS.CREDITO_OBRA,
    fase_id: String(fase.id),
    titulo,
    origem_card_id: paiId,
    projeto_id: input.projetoId,
    rede_franqueado_id: redeFranqueadoId,
    nome_condominio: paiRow.nome_condominio ?? null,
    quadra: paiRow.quadra ?? null,
    lote: paiRow.lote ?? null,
    condominio_id: paiRow.condominio_id ?? null,
    franqueado_id: franqueadoId,
    rede_loteador_id: String(paiRow.rede_loteador_id ?? '').trim() || null,
    status: 'ativo',
  };

  const { data: filho, error: errInsert } = await db
    .from('kanban_cards')
    .insert(insertPayload as never)
    .select('id')
    .single();

  if (errInsert) return { ok: false, error: `Insert Crédito Obra: ${errInsert.message}` };
  const filhoId = String((filho as { id?: string } | null)?.id ?? '').trim();
  if (!filhoId) return { ok: false, error: 'Insert Crédito Obra não retornou id.' };

  try {
    let { error: errVinc } = await inserirKanbanCardVinculo(db, {
      cardOrigemId: paiId,
      cardDestinoId: filhoId,
      tipoVinculo: 'originou',
      criadoPor: input.criadoPor,
    });
    if (errVinc?.code === '23514') {
      ({ error: errVinc } = await inserirKanbanCardVinculo(db, {
        cardOrigemId: paiId,
        cardDestinoId: filhoId,
        tipoVinculo: 'relacionado',
        criadoPor: input.criadoPor,
      }));
    }
    if (errVinc && errVinc.code !== '23505') {
      console.error('[criarCardCreditoObraTranche] vinculo:', errVinc.message);
    }
  } catch (e) {
    console.error('[criarCardCreditoObraTranche] vinculo throw:', e);
  }

  try {
    await db.from('kanban_atividades').insert({
      card_id: filhoId,
      titulo: `Card criado por vínculo de tranche (${input.tranche}ª)`,
      descricao: `Origem: Operações ${paiId}. Tag: ${input.tranche}ª tranche.`,
      tipo: 'atividade',
      status: 'concluida',
      prioridade: 'normal',
      ordem: 0,
      criado_por: input.criadoPor,
      origem: 'nativo',
      tema: 'bastao',
      times_ids: [],
    } as never);
  } catch (e) {
    console.error('[criarCardCreditoObraTranche] atividade:', e);
  }

  try {
    await aplicarTagTrancheCreditoObra(db, filhoId, input.tranche, KANBAN_IDS.CREDITO_OBRA);
  } catch (e) {
    console.error('[criarCardCreditoObraTranche] tag:', e);
  }

  try {
    const { aplicarResponsavelFasePadraoAoCard, aplicarResponsavelDaFasePadraoSeVazio } =
      await import('@/lib/kanban/responsavel-fase-checklist');
    await aplicarResponsavelFasePadraoAoCard(
      db,
      filhoId,
      String(fase.id),
      KANBAN_IDS.CREDITO_OBRA,
      input.criadoPor,
    );
    await aplicarResponsavelDaFasePadraoSeVazio(db, filhoId, String(fase.id), input.criadoPor);
  } catch (e) {
    console.error('[criarCardCreditoObraTranche] responsavel:', e);
  }

  return { ok: true, id: filhoId };
}
