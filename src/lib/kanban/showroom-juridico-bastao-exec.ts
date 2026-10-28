import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { tipoKanbanHistoricoFromAcao } from '@/lib/kanban/kanban-historico-tipo';
import { setKanbanHistoricoActor } from '@/lib/kanban/kanban-historico-actor';
import {
  decidirBastaoJuridicoShowroom,
  faseDestinoBastaoShowroom,
  isTipoBastaoJuridicoShowroom,
  mensagemNotificacaoDocumentoAssinadoShowroom,
  momentoBastaoPorFaseJuridicoShowroom,
  rotuloDocumentoAssinadoShowroom,
  type TipoBastaoJuridicoShowroom,
} from '@/lib/kanban/juridico-portfolio-bastao';
import { solicitacaoComercialEvitaBastaoDeOrigem } from '@/lib/kanban/juridico-solicitacao-comercial';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Db = ReturnType<typeof createAdminClient>;

export type ResultadoBastaoJuridicoShowroom =
  | { ok: true; aplicavel: boolean; moveu: boolean; pularHistoricoFlag: boolean }
  | { ok: false; error: string };

function uuidOuNull(valor: string | null | undefined): string | null {
  const v = String(valor ?? '').trim();
  return UUID_RE.test(v) ? v : null;
}

const NAO: ResultadoBastaoJuridicoShowroom = {
  ok: true,
  aplicavel: false,
  moveu: false,
  pularHistoricoFlag: false,
};

/**
 * Aguardando Assinaturas leva o Showroom para Assinaturas.
 * Pós-Assinatura / Retroalimentação leva para Assinado e marca juridico_ok.
 * Não mexe no Portfólio. Fase incompatível devolve o card jurídico.
 */
export async function executarBastaoJuridicoParaShowroom(input: {
  cardFilhoId: string;
  novaFaseSlug: string;
  userId?: string | null;
  faseAnteriorFilhoId?: string | null;
  inserirHistorico?: (row: Record<string, unknown>) => Promise<string | null>;
  inserirNotificacao?: (row: Record<string, unknown>) => Promise<string | null>;
}): Promise<ResultadoBastaoJuridicoShowroom> {
  const cardFilhoId = String(input.cardFilhoId ?? '').trim();
  const slug = String(input.novaFaseSlug ?? '').trim();
  const momento = momentoBastaoPorFaseJuridicoShowroom(slug);
  if (!cardFilhoId || !momento) return NAO;

  let db: Db;
  try {
    db = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível para o bastão do Showroom.' };
  }

  const falha = async (error: string): Promise<ResultadoBastaoJuridicoShowroom> => {
    const faseId = String(input.faseAnteriorFilhoId ?? '').trim();
    if (faseId) {
      const { error: revertErr } = await db.from('kanban_cards').update({ fase_id: faseId }).eq('id', cardFilhoId);
      if (revertErr) {
        return {
          ok: false,
          error: `${error} Além disso, não foi possível devolver o card jurídico à fase anterior: ${revertErr.message}`,
        };
      }
    }
    return { ok: false, error };
  };

  const { data: filho, error: errFilho } = await db
    .from('kanban_cards')
    .select('id, kanban_id, fase_id, origem_card_id, juridico_origem, juridico_tipo_contrato, arquivado')
    .eq('id', cardFilhoId)
    .maybeSingle();
  if (errFilho) return falha(errFilho.message);
  if (!filho) return falha('Bastão Jurídico → Showroom não executado: card jurídico não encontrado.');

  const filhoRow = filho as {
    kanban_id?: string | null;
    fase_id?: string | null;
    origem_card_id?: string | null;
    juridico_origem?: string | null;
    juridico_tipo_contrato?: string | null;
  };

  if (String(filhoRow.kanban_id ?? '') !== KANBAN_IDS.JURIDICO) return NAO;
  if (solicitacaoComercialEvitaBastaoDeOrigem(filhoRow.juridico_origem)) return NAO;

  const { data: faseFilho } = await db
    .from('kanban_fases')
    .select('slug, kanban_id')
    .eq('id', String(filhoRow.fase_id ?? ''))
    .maybeSingle();
  const faseFilhoRow = faseFilho as { slug?: string | null; kanban_id?: string | null } | null;
  if (
    String(faseFilhoRow?.kanban_id ?? '') !== KANBAN_IDS.JURIDICO ||
    String(faseFilhoRow?.slug ?? '').trim() !== slug
  ) {
    return falha('Bastão Jurídico → Showroom não executado: a fase atual do card jurídico não confere.');
  }

  const origemCardId = String(filhoRow.origem_card_id ?? '').trim();
  if (!origemCardId) return NAO;

  const { data: pai, error: errPai } = await db
    .from('kanban_cards')
    .select('id, kanban_id, fase_id, titulo, responsavel_id, juridico_ok, arquivado')
    .eq('id', origemCardId)
    .maybeSingle();
  if (errPai) return falha(errPai.message);
  if (!pai) return falha('Bastão Jurídico → Showroom não executado: o card de origem não foi encontrado.');

  const paiRow = pai as {
    id: string;
    kanban_id?: string | null;
    fase_id?: string | null;
    titulo?: string | null;
    responsavel_id?: string | null;
    juridico_ok?: boolean | null;
    arquivado?: boolean | null;
  };

  if (String(paiRow.kanban_id ?? '') !== KANBAN_IDS.SHOWROOM) return NAO;
  if (!isTipoBastaoJuridicoShowroom(filhoRow.juridico_tipo_contrato)) return NAO;
  const tipo = filhoRow.juridico_tipo_contrato;

  if (paiRow.arquivado) {
    return falha('Bastão Jurídico → Showroom não executado: o card de origem está arquivado. Ele não foi movido.');
  }

  const destinoSlug = faseDestinoBastaoShowroom(tipo, momento);
  const [{ data: fasePai }, { data: faseDestino }] = await Promise.all([
    db.from('kanban_fases').select('id, slug, nome, ordem, kanban_id').eq('id', String(paiRow.fase_id ?? '')).maybeSingle(),
    db
      .from('kanban_fases')
      .select('id, slug, nome, ordem, kanban_id')
      .eq('kanban_id', KANBAN_IDS.SHOWROOM)
      .eq('slug', destinoSlug)
      .maybeSingle(),
  ]);

  const fasePaiRow = fasePai as { slug?: string | null; nome?: string | null; ordem?: number | null; kanban_id?: string | null } | null;
  const faseDestinoRow = faseDestino as {
    id?: string;
    slug?: string | null;
    nome?: string | null;
    ordem?: number | null;
    kanban_id?: string | null;
  } | null;

  if (String(fasePaiRow?.kanban_id ?? '') !== KANBAN_IDS.SHOWROOM) {
    return falha('Bastão Jurídico → Showroom não executado: a fase atual do card de origem não pertence ao Funil Showroom.');
  }
  if (!faseDestinoRow?.id) {
    return falha(`Bastão Jurídico → Showroom não executado: a fase «${destinoSlug}» não existe no Funil Showroom.`);
  }

  const decisao = decidirBastaoJuridicoShowroom({
    tipo,
    momento,
    fasePaiSlug: String(fasePaiRow?.slug ?? ''),
    fasePaiNome: String(fasePaiRow?.nome ?? ''),
    ordemPai: fasePaiRow?.ordem ?? null,
    ordemDestino: faseDestinoRow.ordem ?? null,
    faseDestinoNome: String(faseDestinoRow.nome ?? destinoSlug),
  });

  if (decisao.acao === 'incompativel') return falha(decisao.erro);

  if (decisao.acao !== 'mover') {
    if (momento === 'assinado' && paiRow.juridico_ok !== true) {
      const { error: errFlag } = await db.from('kanban_cards').update({ juridico_ok: true }).eq('id', paiRow.id);
      if (errFlag) return falha(errFlag.message);
    }
    return {
      ok: true,
      aplicavel: true,
      moveu: false,
      pularHistoricoFlag: momento === 'assinado' && paiRow.juridico_ok === true,
    };
  }

  try {
    await setKanbanHistoricoActor(db, input.userId ?? null);
  } catch (e) {
    console.error('[bastao-juridico-showroom] actor:', e);
  }

  const { error: errMove } = await db.from('kanban_cards').update({ fase_id: faseDestinoRow.id }).eq('id', paiRow.id);
  if (errMove) {
    try {
      await setKanbanHistoricoActor(db, null);
    } catch {
      /* auxiliar */
    }
    return falha(errMove.message);
  }

  const rotulo = rotuloDocumentoAssinadoShowroom(tipo as TipoBastaoJuridicoShowroom);
  const descricao =
    momento === 'assinado'
      ? mensagemNotificacaoDocumentoAssinadoShowroom(tipo)
      : `Jurídico encaminhou para assinatura: ${rotulo.replace(' assinado', '')}.`;

  const historicoRow = {
    card_id: paiRow.id,
    usuario_id: uuidOuNull(input.userId) ?? null,
    usuario_nome: null,
    acao: 'bastao_retorno',
    tipo: tipoKanbanHistoricoFromAcao('bastao_retorno'),
    detalhe: {
      tipo: 'bastao_retorno',
      descricao,
      fase_slug: slug,
      fase_destino_slug: destinoSlug,
      fase_destino_id: faseDestinoRow.id,
      card_filho_id: cardFilhoId,
      tipo_documento: tipo,
      momento,
    },
  };
  const errHistMsg = input.inserirHistorico
    ? await input.inserirHistorico(historicoRow)
    : (await db.from('kanban_historico').insert(historicoRow as never)).error?.message ?? null;
  if (errHistMsg) console.error('[bastao-juridico-showroom] historico:', errHistMsg);

  try {
    await setKanbanHistoricoActor(db, null);
  } catch {
    /* auxiliar */
  }

  try {
    const { propagarResponsavelFaseAoEntrarFase, propagarResponsavelDaFaseAoEntrarFase } =
      await import('@/lib/kanban/responsavel-fase-checklist');
    await propagarResponsavelFaseAoEntrarFase(db, paiRow.id, faseDestinoRow.id, input.userId ?? null);
    await propagarResponsavelDaFaseAoEntrarFase(db, paiRow.id, faseDestinoRow.id, input.userId ?? null);
  } catch (e) {
    console.error('[bastao-juridico-showroom] responsável:', e);
  }

  if (momento === 'assinado') {
    const { error: errFlag } = await db.from('kanban_cards').update({ juridico_ok: true }).eq('id', paiRow.id);
    if (errFlag) return falha(errFlag.message);

    const responsavelId = uuidOuNull(paiRow.responsavel_id);
    if (responsavelId) {
      const mensagem = mensagemNotificacaoDocumentoAssinadoShowroom(tipo);
      const href = hrefAbrirCardKanban('Funil Showroom', paiRow.id);
      const row = {
        user_id: responsavelId,
        chamado_id: null,
        tipo: 'bastao_juridico_portfolio',
        titulo: 'Jurídico concluído',
        mensagem,
        texto: `${mensagem} Card: ${String(paiRow.titulo ?? '').trim() || 'Card do Showroom'}. Abrir: ${href}`,
        referencia_card_id: paiRow.id,
      };
      const notifErr = input.inserirNotificacao
        ? await input.inserirNotificacao(row)
        : (await db.from('sirene_notificacoes').insert(row as never)).error?.message ?? null;
      if (notifErr) console.error('[bastao-juridico-showroom] notificacao:', notifErr);
    }
  }

  revalidatePath('/funil-showroom');
  revalidatePath('/funil-juridico');
  return { ok: true, aplicavel: true, moveu: true, pularHistoricoFlag: momento === 'assinado' };
}
