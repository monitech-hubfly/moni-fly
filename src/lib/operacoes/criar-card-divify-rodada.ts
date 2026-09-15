import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { aplicarTagRodadaDivify, type DivifyRodadaNumero } from '@/lib/kanban/divify-tag-rodada';
import { inserirKanbanCardVinculo } from '@/lib/kanban/kanban-card-vinculos';
import { resolverTituloCardKanban } from '@/lib/kanban/card-sync-group';
import {
  configRodadaVinculo,
  DIVIFY_KANBAN_ID,
  indiceRodadaValido,
  type RodadaVinculoIndex,
} from '@/lib/operacoes/rodada-vinculos-config';
import { createAdminClient } from '@/lib/supabase/admin';

export type CriarCardDivifyRodadaResult =
  | { ok: true; cardId: string; error?: undefined }
  | { ok: false; error: string; cardId?: undefined };

/**
 * Cria card filho no Funil Divify para rodada 1ª–6ª.
 * Módulo sem `'use server'` para preservar mensagens de erro reais
 * (server actions aninhadas em produção viram digest opaco).
 * Chamado via API route / service layer.
 */
export async function criarCardDivifyRodada(
  paiCardId: string,
  rodadaIndex: RodadaVinculoIndex | DivifyRodadaNumero,
  userId: string,
): Promise<CriarCardDivifyRodadaResult> {
  try {
    const paiId = String(paiCardId ?? '').trim();
    const criadoPor = String(userId ?? '').trim() || null;
    const idx = Number(rodadaIndex);

    if (!paiId || !indiceRodadaValido(idx)) {
      return { ok: false, error: 'Parâmetros inválidos para criar card da rodada.' };
    }

    const cfg = configRodadaVinculo(idx);
    if (!cfg) {
      return { ok: false, error: `Configuração da ${idx}ª rodada não encontrada.` };
    }
    const faseSlug = String(cfg.faseDestinoSlug ?? '').trim();
    if (!faseSlug) {
      return { ok: false, error: 'faseDestinoSlug ausente na configuração da rodada.' };
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
      .eq('kanban_id', DIVIFY_KANBAN_ID)
      .eq('slug', faseSlug)
      .eq('ativo', true)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (errFase) return { ok: false, error: `Fase destino: ${errFase.message}` };
    if (!fase?.id) {
      return {
        ok: false,
        error: `Fase "${faseSlug}" não encontrada no Funil Divify.`,
      };
    }

    const { data: pai, error: errPai } = await db
      .from('kanban_cards')
      .select(
        'id, franqueado_id, titulo, nome_condominio, quadra, lote, condominio_id, rede_franqueado_id, rede_loteador_id, projeto_id',
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
      projeto_id?: string | null;
    };

    const franqueadoId = String(paiRow.franqueado_id ?? '').trim();
    if (!franqueadoId) {
      return { ok: false, error: 'Card de Operações sem franqueado_id — não é possível criar a rodada.' };
    }

    const redeFranqueadoId = String(paiRow.rede_franqueado_id ?? '').trim() || null;
    const projetoId = String(paiRow.projeto_id ?? '').trim() || null;

    let titulo = String(paiRow.titulo ?? '').trim() || 'Card';

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
      console.error('[criarCardDivifyRodada] titulo:', e);
    }

    const insertPayload = {
      kanban_id: DIVIFY_KANBAN_ID,
      fase_id: String(fase.id),
      titulo,
      origem_card_id: paiId,
      projeto_id: projetoId,
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

    if (errInsert) return { ok: false, error: `Insert Divify: ${errInsert.message}` };
    const filhoId = String((filho as { id?: string } | null)?.id ?? '').trim();
    if (!filhoId) return { ok: false, error: 'Insert Divify não retornou id.' };

    const now = new Date().toISOString();
    try {
      const { data: vinculoExistente } = await db
        .from('kanban_operacoes_rodada_vinculos')
        .select('id')
        .eq('operacoes_card_id', paiId)
        .eq('rodada_index', idx)
        .maybeSingle();

      const patchVinculo = {
        operacoes_card_id: paiId,
        rodada_index: idx,
        divify_card_id: filhoId,
        concluido_em: now,
        concluido_por: criadoPor,
        updated_at: now,
      };

      if (vinculoExistente?.id) {
        const { error: errUpd } = await db
          .from('kanban_operacoes_rodada_vinculos')
          .update(patchVinculo as never)
          .eq('id', String(vinculoExistente.id));
        if (errUpd) {
          return {
            ok: false,
            error: `Card Divify criado (${filhoId}), mas o vínculo não foi atualizado: ${errUpd.message}`,
          };
        }
      } else {
        const { error: errIns } = await db
          .from('kanban_operacoes_rodada_vinculos')
          .insert({ ...patchVinculo, created_at: now } as never);
        if (errIns) {
          return {
            ok: false,
            error: `Card Divify criado (${filhoId}), mas o vínculo não foi salvo: ${errIns.message}`,
          };
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[criarCardDivifyRodada] rodada_vinculos:', msg);
      return {
        ok: false,
        error: `Card Divify criado (${filhoId}), mas o vínculo falhou: ${msg}`,
      };
    }

    try {
      let { error: errVinc } = await inserirKanbanCardVinculo(db, {
        cardOrigemId: paiId,
        cardDestinoId: filhoId,
        tipoVinculo: 'originou',
        criadoPor,
      });
      if (errVinc?.code === '23514') {
        ({ error: errVinc } = await inserirKanbanCardVinculo(db, {
          cardOrigemId: paiId,
          cardDestinoId: filhoId,
          tipoVinculo: 'relacionado',
          criadoPor,
        }));
      }
      if (errVinc && errVinc.code !== '23505') {
        console.error('[criarCardDivifyRodada] vinculo:', errVinc.message);
      }
    } catch (e) {
      console.error('[criarCardDivifyRodada] vinculo throw:', e);
    }

    try {
      const { error: errAtiv } = await db.from('kanban_atividades').insert({
        card_id: filhoId,
        titulo: `Rodada ${idx}ª aberta`,
        descricao: `Origem: Operações ${paiId}. Tag: ${cfg.tagLabel}.`,
        tipo: 'atividade',
        status: 'concluida',
        prioridade: 'normal',
        ordem: 0,
        criado_por: criadoPor,
        origem: 'nativo',
        tema: 'bastao',
        times_ids: [],
      } as never);
      if (errAtiv) {
        console.error('[criarCardDivifyRodada] atividade:', errAtiv.message);
      }
    } catch (e) {
      console.error('[criarCardDivifyRodada] atividade throw:', e);
    }

    try {
      await aplicarTagRodadaDivify(db, filhoId, cfg.tagRodada, KANBAN_IDS.MONI_CAPITAL);
    } catch (e) {
      console.error('[criarCardDivifyRodada] tag:', e);
    }

    try {
      const { aplicarResponsavelFasePadraoAoCard, aplicarResponsavelDaFasePadraoSeVazio } =
        await import('@/lib/kanban/responsavel-fase-checklist');
      await aplicarResponsavelFasePadraoAoCard(
        db,
        filhoId,
        String(fase.id),
        DIVIFY_KANBAN_ID,
        criadoPor,
      );
      await aplicarResponsavelDaFasePadraoSeVazio(db, filhoId, String(fase.id), criadoPor);
    } catch (e) {
      console.error('[criarCardDivifyRodada] responsavel:', e);
    }

    return { ok: true, cardId: filhoId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[criarCardDivifyRodada] unexpected:', msg);
    return { ok: false, error: msg || 'Erro inesperado ao criar card Divify.' };
  }
}
