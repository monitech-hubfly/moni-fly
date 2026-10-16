import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { tipoKanbanHistoricoFromAcao } from '@/lib/kanban/kanban-historico-tipo';
import { setKanbanHistoricoActor } from '@/lib/kanban/kanban-historico-actor';
import {
  decidirBastaoJuridicoLoteadores,
  decidirBastaoJuridicoPortfolio,
  faseDestinoBastaoLoteadores,
  faseDestinoBastaoPortfolio,
  isTipoBastaoJuridicoLoteadores,
  isTipoBastaoJuridicoPortfolio,
  mensagemNotificacaoDocumentoAssinado,
  mensagemNotificacaoDocumentoAssinadoLoteadores,
  momentoBastaoPorFaseJuridico,
  rotuloDocumentoAssinado,
  rotuloDocumentoAssinadoLoteadores,
  type MomentoBastaoJuridicoPortfolio,
  type TipoBastaoJuridicoLoteadores,
  type TipoBastaoJuridicoPortfolio,
} from '@/lib/kanban/juridico-portfolio-bastao';
import { solicitacaoComercialEvitaBastaoDeOrigem } from '@/lib/kanban/juridico-solicitacao-comercial';
import { createAdminClient } from '@/lib/supabase/admin';

const TIPO_NOTIFICACAO = 'bastao_juridico_portfolio';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Db = ReturnType<typeof createAdminClient>;

export type ResultadoBastaoJuridicoPortfolio =
  | {
      ok: true;
      aplicavel: boolean;
      moveu: boolean;
      /** Já registrou o histórico do bastão, ou o flag já estava marcado. */
      pularHistoricoFlag: boolean;
    }
  | { ok: false; error: string };

function uuidOuNull(valor: string | null | undefined): string | null {
  const v = String(valor ?? '').trim();
  return UUID_RE.test(v) ? v : null;
}

async function reverterFaseFilho(
  db: Db,
  cardFilhoId: string,
  faseAnteriorId: string | null | undefined,
): Promise<string | null> {
  const faseId = String(faseAnteriorId ?? '').trim();
  if (!faseId) return null;
  const { error } = await db.from('kanban_cards').update({ fase_id: faseId }).eq('id', cardFilhoId);
  if (error) return error.message;
  return null;
}

async function responsavelDoCard(
  db: Db,
  cardId: string,
  faseId: string,
  responsavelId: string | null,
): Promise<string | null> {
  const direto = uuidOuNull(responsavelId);
  if (direto) return direto;

  const { data: item } = await db
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', faseId)
    .eq('campo_slug', 'responsavel_fase')
    .maybeSingle();
  const itemId = String((item as { id?: string } | null)?.id ?? '').trim();
  if (!itemId) return null;

  const { data: resposta } = await db
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('item_id', itemId)
    .eq('card_id', cardId)
    .maybeSingle();
  return uuidOuNull((resposta as { valor?: string | null } | null)?.valor);
}

type ConfigBastaoOrigem = {
  kanbanId: string;
  funil: 'Portfólio' | 'Loteadores';
  kanbanNomeHref: string;
  tiposLabel: string;
  isTipo: (valor: string | null | undefined) => boolean;
  destinoSlug: (tipo: string, momento: MomentoBastaoJuridicoPortfolio) => string;
  decidir: (input: {
    tipo: string;
    momento: MomentoBastaoJuridicoPortfolio;
    fasePaiSlug: string;
    fasePaiNome: string;
    ordemPai: number | null;
    ordemDestino: number | null;
    faseDestinoNome: string;
  }) => ReturnType<typeof decidirBastaoJuridicoPortfolio>;
  mensagem: (tipo: string) => string;
  rotulo: (tipo: string) => string;
};

const CONFIG_PORTFOLIO: ConfigBastaoOrigem = {
  kanbanId: KANBAN_IDS.PORTFOLIO,
  funil: 'Portfólio',
  kanbanNomeHref: 'Funil Portfólio',
  tiposLabel: 'Opção, Cto c/ Precedentes nem Cto s/ Precedentes',
  isTipo: isTipoBastaoJuridicoPortfolio,
  destinoSlug: (tipo, momento) => faseDestinoBastaoPortfolio(tipo as TipoBastaoJuridicoPortfolio, momento),
  decidir: (input) =>
    decidirBastaoJuridicoPortfolio({
      ...input,
      tipo: input.tipo as TipoBastaoJuridicoPortfolio,
    }),
  mensagem: (tipo) => mensagemNotificacaoDocumentoAssinado(tipo as TipoBastaoJuridicoPortfolio),
  rotulo: (tipo) => rotuloDocumentoAssinado(tipo as TipoBastaoJuridicoPortfolio),
};

const CONFIG_LOTEADORES: ConfigBastaoOrigem = {
  kanbanId: KANBAN_IDS.LOTEADORES,
  funil: 'Loteadores',
  kanbanNomeHref: 'Funil Loteadores',
  tiposLabel: 'NDA nem Cto de Parceria',
  isTipo: isTipoBastaoJuridicoLoteadores,
  destinoSlug: (tipo, momento) => faseDestinoBastaoLoteadores(tipo as TipoBastaoJuridicoLoteadores, momento),
  decidir: (input) =>
    decidirBastaoJuridicoLoteadores({
      ...input,
      tipo: input.tipo as TipoBastaoJuridicoLoteadores,
    }),
  mensagem: (tipo) => mensagemNotificacaoDocumentoAssinadoLoteadores(tipo as TipoBastaoJuridicoLoteadores),
  rotulo: (tipo) => rotuloDocumentoAssinadoLoteadores(tipo as TipoBastaoJuridicoLoteadores),
};

function configDaOrigem(kanbanId: string | null | undefined): ConfigBastaoOrigem | null {
  const id = String(kanbanId ?? '').trim();
  if (id === KANBAN_IDS.PORTFOLIO) return CONFIG_PORTFOLIO;
  if (id === KANBAN_IDS.LOTEADORES) return CONFIG_LOTEADORES;
  return null;
}

async function notificarResponsavel(input: {
  db: Db;
  userId: string;
  cardPaiId: string;
  tituloPai: string;
  config: ConfigBastaoOrigem;
  tipo: string;
  inserir?: (row: Record<string, unknown>) => Promise<string | null>;
}): Promise<string | null> {
  const mensagem = input.config.mensagem(input.tipo);
  const href = hrefAbrirCardKanban(input.config.kanbanNomeHref, input.cardPaiId);
  const tituloCard = String(input.tituloPai ?? '').trim() || `Card do ${input.config.funil}`;
  const texto = `${mensagem} Card: ${tituloCard}. Tipo: ${input.config.rotulo(input.tipo)}. Abrir: ${href}`;
  const row = {
    user_id: input.userId,
    chamado_id: null,
    tipo: TIPO_NOTIFICACAO,
    titulo: 'Jurídico concluído',
    mensagem,
    texto,
    referencia_card_id: input.cardPaiId,
  };
  if (input.inserir) return input.inserir(row);
  const { error } = await input.db.from('sirene_notificacoes').insert(row as never);
  return error?.message ?? null;
}

/**
 * Na entrada da fase 5 ou 7 do Funil Jurídico, avança o card de origem.
 * Portfólio e Loteadores usam a mesma decisão, o mesmo histórico e a mesma notificação.
 * Não cria atendimento. Não regride. Não move fase incompatível.
 * Se falhar e `faseAnteriorFilhoId` vier preenchido, devolve o card jurídico à fase anterior.
 */
export async function executarBastaoJuridicoParaPortfolio(input: {
  cardFilhoId: string;
  novaFaseSlug: string;
  userId?: string | null;
  faseAnteriorFilhoId?: string | null;
  /**
   * O service role do DEV não tem GRANT em kanban_historico.
   * O caller autenticado grava o bastão. Sem callback, tenta o admin.
   */
  inserirHistorico?: (row: Record<string, unknown>) => Promise<string | null>;
  /** Mesma razão do histórico: grava com o usuário autenticado, não com o service role. */
  inserirNotificacao?: (row: Record<string, unknown>) => Promise<string | null>;
}): Promise<ResultadoBastaoJuridicoPortfolio> {
  const cardFilhoId = String(input.cardFilhoId ?? '').trim();
  const slug = String(input.novaFaseSlug ?? '').trim();
  const momento = momentoBastaoPorFaseJuridico(slug);
  if (!cardFilhoId || !momento) {
    return { ok: true, aplicavel: false, moveu: false, pularHistoricoFlag: false };
  }

  let db: Db;
  try {
    db = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Serviço indisponível para o bastão Jurídico.',
    };
  }

  const falha = async (error: string): Promise<ResultadoBastaoJuridicoPortfolio> => {
    const revertErr = await reverterFaseFilho(db, cardFilhoId, input.faseAnteriorFilhoId);
    if (revertErr) {
      return {
        ok: false,
        error: `${error} Além disso, não foi possível devolver o card jurídico à fase anterior: ${revertErr}`,
      };
    }
    return { ok: false, error };
  };

  const { data: filho, error: errFilho } = await db
    .from('kanban_cards')
    .select(
      'id, kanban_id, fase_id, origem_card_id, juridico_origem, juridico_tipo_contrato, titulo, arquivado',
    )
    .eq('id', cardFilhoId)
    .maybeSingle();
  if (errFilho) return falha(errFilho.message);
  if (!filho) return falha('Bastão Jurídico não executado: card jurídico não encontrado.');

  const filhoRow = filho as {
    kanban_id?: string | null;
    fase_id?: string | null;
    origem_card_id?: string | null;
    juridico_origem?: string | null;
    juridico_tipo_contrato?: string | null;
    titulo?: string | null;
    arquivado?: boolean | null;
  };

  if (String(filhoRow.kanban_id ?? '') !== KANBAN_IDS.JURIDICO) {
    return { ok: true, aplicavel: false, moveu: false, pularHistoricoFlag: false };
  }

  if (solicitacaoComercialEvitaBastaoDeOrigem(filhoRow.juridico_origem)) {
    return { ok: true, aplicavel: false, moveu: false, pularHistoricoFlag: false };
  }

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
    return falha(
      'Bastão Jurídico não executado: a fase atual do card jurídico não confere com a fase informada.',
    );
  }

  const origemCardId = String(filhoRow.origem_card_id ?? '').trim();
  if (!origemCardId) {
    return { ok: true, aplicavel: false, moveu: false, pularHistoricoFlag: false };
  }

  const { data: pai, error: errPai } = await db
    .from('kanban_cards')
    .select('id, kanban_id, fase_id, titulo, responsavel_id, juridico_ok, arquivado')
    .eq('id', origemCardId)
    .maybeSingle();
  if (errPai) return falha(errPai.message);
  if (!pai) {
    return falha('Bastão Jurídico não executado: o card de origem não foi encontrado.');
  }

  const paiRow = pai as {
    id: string;
    kanban_id?: string | null;
    fase_id?: string | null;
    titulo?: string | null;
    responsavel_id?: string | null;
    juridico_ok?: boolean | null;
    arquivado?: boolean | null;
  };

  const config = configDaOrigem(paiRow.kanban_id);
  if (!config) {
    return { ok: true, aplicavel: false, moveu: false, pularHistoricoFlag: false };
  }

  const tipoInformado = String(filhoRow.juridico_tipo_contrato ?? '').trim();
  if (!config.isTipo(filhoRow.juridico_tipo_contrato)) {
    return falha(
      `Bastão Jurídico → ${config.funil} não executado: tipo documental «${tipoInformado || 'vazio'}» não é ${config.tiposLabel}.`,
    );
  }
  const tipo = tipoInformado;

  if (paiRow.arquivado) {
    return falha(
      `Bastão Jurídico → ${config.funil} não executado: o card de origem está arquivado. Ele não foi movido.`,
    );
  }

  const destinoSlug = config.destinoSlug(tipo, momento);
  const [{ data: fasePai }, { data: faseDestino }] = await Promise.all([
    db
      .from('kanban_fases')
      .select('id, slug, nome, ordem, kanban_id')
      .eq('id', String(paiRow.fase_id ?? ''))
      .maybeSingle(),
    db
      .from('kanban_fases')
      .select('id, slug, nome, ordem, kanban_id')
      .eq('kanban_id', config.kanbanId)
      .eq('slug', destinoSlug)
      .maybeSingle(),
  ]);

  const fasePaiRow = fasePai as {
    slug?: string | null;
    nome?: string | null;
    ordem?: number | null;
    kanban_id?: string | null;
  } | null;
  const faseDestinoRow = faseDestino as {
    id?: string;
    slug?: string | null;
    nome?: string | null;
    ordem?: number | null;
    kanban_id?: string | null;
  } | null;

  if (String(fasePaiRow?.kanban_id ?? '') !== config.kanbanId) {
    return falha(
      `Bastão Jurídico → ${config.funil} não executado: a fase atual do card de origem não pertence ao Funil ${config.funil}.`,
    );
  }
  if (!faseDestinoRow?.id || String(faseDestinoRow.kanban_id ?? '') !== config.kanbanId) {
    return falha(
      `Bastão Jurídico → ${config.funil} não executado: a fase «${destinoSlug}» não existe no Funil ${config.funil}.`,
    );
  }

  const decisao = config.decidir({
    tipo,
    momento,
    fasePaiSlug: String(fasePaiRow?.slug ?? ''),
    fasePaiNome: String(fasePaiRow?.nome ?? fasePaiRow?.slug ?? ''),
    ordemPai: fasePaiRow?.ordem ?? null,
    ordemDestino: faseDestinoRow.ordem ?? null,
    faseDestinoNome: String(faseDestinoRow.nome ?? destinoSlug),
  });

  if (decisao.acao === 'incompativel') return falha(decisao.erro);
  if (decisao.acao !== 'mover') {
    if (momento === 'assinado' && paiRow.juridico_ok !== true) {
      const { error: errFlag } = await db
        .from('kanban_cards')
        .update({ juridico_ok: true })
        .eq('id', paiRow.id);
      if (errFlag) return falha(errFlag.message);
    }
    const flagJaMarcada = momento === 'assinado' && paiRow.juridico_ok === true;
    return { ok: true, aplicavel: true, moveu: false, pularHistoricoFlag: flagJaMarcada };
  }

  const responsavelId = await responsavelDoCard(
    db,
    paiRow.id,
    String(paiRow.fase_id ?? ''),
    paiRow.responsavel_id ?? null,
  );

  try {
    await setKanbanHistoricoActor(db, input.userId ?? null);
  } catch (e) {
    console.error('[bastao-juridico-portfolio] actor:', e);
  }

  const { error: errMove } = await db
    .from('kanban_cards')
    .update({ fase_id: faseDestinoRow.id })
    .eq('id', paiRow.id);
  if (errMove) {
    try {
      await setKanbanHistoricoActor(db, null);
    } catch {
      /* actor é auxiliar */
    }
    return falha(errMove.message);
  }

  const descricao =
    momento === 'assinado'
      ? config.mensagem(tipo)
      : `Jurídico encaminhou para assinatura: ${config.rotulo(tipo).replace(' assinada', '').replace(' assinado', '')}.`;

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
  const errHist = errHistMsg ? { message: errHistMsg } : null;

  try {
    await setKanbanHistoricoActor(db, null);
  } catch {
    /* actor é auxiliar */
  }

  if (errHist) {
    console.error('[bastao-juridico-portfolio] historico:', errHist.message);
  }

  try {
    const { propagarResponsavelFaseAoEntrarFase, propagarResponsavelDaFaseAoEntrarFase } =
      await import('@/lib/kanban/responsavel-fase-checklist');
    await propagarResponsavelFaseAoEntrarFase(db, paiRow.id, faseDestinoRow.id, input.userId ?? null);
    await propagarResponsavelDaFaseAoEntrarFase(db, paiRow.id, faseDestinoRow.id, input.userId ?? null);
  } catch (e) {
    console.error('[bastao-juridico-portfolio] responsável:', e);
  }

  if (momento === 'assinado') {
    const devolverPai = async (): Promise<string | null> => {
      const { error } = await db
        .from('kanban_cards')
        .update({ fase_id: paiRow.fase_id })
        .eq('id', paiRow.id);
      return error?.message ?? null;
    };

    if (!responsavelId) {
      const undo = await devolverPai();
      return falha(
        undo
          ? `Bastão Jurídico → ${config.funil} não executado: o card de origem não tem responsável e a fase assinada não pôde ser desfeita (${undo}).`
          : `Bastão Jurídico → ${config.funil} não executado: o card de origem não tem responsável para notificar. A fase do ${config.funil} foi devolvida.`,
      );
    }

    const notifErr = await notificarResponsavel({
      db,
      userId: responsavelId,
      cardPaiId: paiRow.id,
      tituloPai: String(paiRow.titulo ?? ''),
      config,
      tipo,
      inserir: input.inserirNotificacao,
    });
    if (notifErr) {
      const undo = await devolverPai();
      return falha(
        undo
          ? `Bastão Jurídico → ${config.funil} não executado: a notificação falhou (${notifErr}) e a fase assinada não pôde ser desfeita (${undo}).`
          : `Bastão Jurídico → ${config.funil} não executado: a notificação ao responsável falhou (${notifErr}). A fase do ${config.funil} foi devolvida.`,
      );
    }
  }

  if (momento === 'assinado') {
    const { error: errFlag } = await db.from('kanban_cards').update({ juridico_ok: true }).eq('id', paiRow.id);
    if (errFlag) return falha(errFlag.message);
  }

  return { ok: true, aplicavel: true, moveu: true, pularHistoricoFlag: momento === 'assinado' };
}
