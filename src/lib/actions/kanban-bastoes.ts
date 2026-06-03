'use server';

import { revalidatePath } from 'next/cache';
import { KANBANS_COM_CHAMADO_JURIDICO, FASE_IDS, FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isFrankOrFranqueadoRole } from '@/lib/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { MSG_CHAMADO_JURIDICO_JA_EXISTE } from '@/lib/constants/kanban-ids';
import {
  DESTINOS_ESTEIRA_MANUAL,
  destinosEsteiraManualParaKanban,
  type DestinoEsteiraManualKey,
} from '@/lib/kanban/esteira-manual-destinos';
import { sincronizarTagAcoplamentoPaiDoFilho } from '@/lib/kanban/acoplamento-tag-pai';
import {
  deveDispararBastaoAcoplamentoAutomatico,
  resolverCardPaiPortfolioParaAcoplamento,
} from '@/lib/kanban/portfolio-paralelas';

/** Verifica se já existe card filho no Funil Jurídico para o card pai. */
export async function existeChamadoJuridicoParaCard(cardPaiId: string): Promise<boolean> {
  const paiId = String(cardPaiId ?? '').trim();
  if (!paiId) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    return false;
  }

  const { data: existente } = await db
    .from('kanban_cards')
    .select('id')
    .eq('origem_card_id', paiId)
    .eq('kanban_id', KANBAN_IDS.JURIDICO)
    .limit(1)
    .maybeSingle();

  return Boolean(existente?.id);
}

export type AbrirChamadoJuridicoResult =
  | { ok: true; cardFilhoId: string }
  | { ok: false; error: string; jaExiste?: boolean };

export interface CriarCardFilhoParams {
  cardPaiId: string;
  kanbanDestinoId: string;
  faseDestinoSlug: string;
  titulo: string;
  projetoId: string | null;
  redeFranqueadoId: string | null;
  kanbanOrigemSlug: string;
  faseOrigemSlug: string;
}

export interface KanbanCardFilhoCriado {
  id: string;
  kanban_id: string;
  fase_id: string;
  titulo: string;
  origem_card_id: string | null;
  projeto_id: string | null;
  rede_franqueado_id: string | null;
  status: string;
  franqueado_id: string;
}

const CARD_FILHO_SELECT =
  'id, kanban_id, fase_id, titulo, origem_card_id, projeto_id, rede_franqueado_id, status, franqueado_id';

/**
 * Cria card filho no kanban de destino (bastão) com vínculo e atividade de auditoria.
 * Idempotente: se já existir filho com `origem_card_id` = pai no mesmo kanban, retorna null.
 */
export async function criarCardFilho(
  params: CriarCardFilhoParams,
): Promise<KanbanCardFilhoCriado | null> {
  const cardPaiId = String(params.cardPaiId ?? '').trim();
  const kanbanDestinoId = String(params.kanbanDestinoId ?? '').trim();
  const faseDestinoSlug = String(params.faseDestinoSlug ?? '').trim();
  const titulo = String(params.titulo ?? '').trim();

  if (!cardPaiId || !kanbanDestinoId || !faseDestinoSlug || !titulo) {
    throw new Error('Parâmetros inválidos para criar card filho.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Serviço indisponível: ${msg}`);
  }

  const { data: existente, error: errExiste } = await db
    .from('kanban_cards')
    .select(CARD_FILHO_SELECT)
    .eq('origem_card_id', cardPaiId)
    .eq('kanban_id', kanbanDestinoId)
    .limit(1)
    .maybeSingle();

  if (errExiste) throw new Error(errExiste.message);
  if (existente?.id) return null;

  const { data: fase, error: errFase } = await db
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', kanbanDestinoId)
    .eq('slug', faseDestinoSlug)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errFase) throw new Error(errFase.message);
  if (!fase?.id) {
    throw new Error(
      `Fase "${faseDestinoSlug}" não encontrada no kanban de destino (${kanbanDestinoId}).`,
    );
  }

  const { data: cardPai, error: errPai } = await db
    .from('kanban_cards')
    .select('id, franqueado_id')
    .eq('id', cardPaiId)
    .maybeSingle();

  if (errPai) throw new Error(errPai.message);
  if (!cardPai?.id) throw new Error('Card pai não encontrado.');

  const franqueadoId = String((cardPai as { franqueado_id?: string }).franqueado_id ?? '').trim();
  if (!franqueadoId) throw new Error('Card pai sem franqueado_id.');

  const faseId = String(fase.id);

  const { data: filho, error: errInsert } = await db
    .from('kanban_cards')
    .insert({
      kanban_id: kanbanDestinoId,
      fase_id: faseId,
      titulo,
      origem_card_id: cardPaiId,
      projeto_id: params.projetoId ?? null,
      rede_franqueado_id: params.redeFranqueadoId ?? null,
      franqueado_id: franqueadoId,
      status: 'ativo',
    })
    .select(CARD_FILHO_SELECT)
    .single();

  if (errInsert) throw new Error(errInsert.message);
  if (!filho?.id) throw new Error('Não foi possível criar o card filho.');

  const cardFilhoId = String(filho.id);
  const criadoPor = user?.id ?? null;

  const inserirVinculo = async (tipo: 'originou' | 'relacionado') => {
    return db.from('kanban_card_vinculos').insert({
      card_origem_id: cardPaiId,
      card_destino_id: cardFilhoId,
      tipo_vinculo: tipo,
      criado_por: criadoPor,
    });
  };

  let { error: errVinc } = await inserirVinculo('originou');
  if (errVinc?.code === '23514') {
    ({ error: errVinc } = await inserirVinculo('relacionado'));
  }
  if (errVinc && errVinc.code !== '23505') {
    throw new Error(errVinc.message);
  }

  const origemLabel = `${params.kanbanOrigemSlug} / ${params.faseOrigemSlug}`;
  const destinoLabel = faseDestinoSlug;
  const tituloAtividade = `Card criado por bastão automático (${origemLabel} → ${destinoLabel})`;

  const { error: errAtiv } = await db.from('kanban_atividades').insert({
    card_id: cardFilhoId,
    titulo: tituloAtividade,
    descricao: `Origem: card ${cardPaiId}. Destino: kanban ${kanbanDestinoId}, fase ${faseDestinoSlug}.`,
    tipo: 'atividade',
    status: 'concluida',
    prioridade: 'normal',
    ordem: 0,
    criado_por: criadoPor,
    origem: 'nativo',
    tema: 'bastao',
    times_ids: [],
  } as never);

  if (errAtiv) throw new Error(errAtiv.message);

  return filho as KanbanCardFilhoCriado;
}

/**
 * Cria card no Funil Jurídico a partir de Portfolio / Loteadores / Operações (ação manual).
 */
export async function abrirChamadoJuridicoDoCard(
  cardPaiId: string,
  basePath?: string,
): Promise<AbrirChamadoJuridicoResult> {
  const paiId = String(cardPaiId ?? '').trim();
  if (!paiId) return { ok: false, error: 'Card inválido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para continuar.' };

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (isFrankOrFranqueadoRole((prof as { role?: string | null } | null)?.role)) {
    return { ok: false, error: 'Sem permissão para abrir chamado jurídico.' };
  }

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Serviço indisponível: ${msg}` };
  }

  const { data: paiRow, error: errPai } = await db
    .from('kanban_cards')
    .select('id, titulo, kanban_id, projeto_id, rede_franqueado_id, fase_id')
    .eq('id', paiId)
    .maybeSingle();

  if (errPai) return { ok: false, error: errPai.message };
  if (!paiRow?.id) return { ok: false, error: 'Card não encontrado.' };

  const pai = paiRow as {
    id: string;
    titulo?: string | null;
    kanban_id?: string | null;
    projeto_id?: string | null;
    rede_franqueado_id?: string | null;
    fase_id?: string | null;
  };

  const kanbanId = String(pai.kanban_id ?? '').trim();
  if (!(KANBANS_COM_CHAMADO_JURIDICO as readonly string[]).includes(kanbanId)) {
    return { ok: false, error: 'Este funil não permite abrir chamado jurídico manualmente.' };
  }

  const { data: existente } = await db
    .from('kanban_cards')
    .select('id')
    .eq('origem_card_id', paiId)
    .eq('kanban_id', KANBAN_IDS.JURIDICO)
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    return { ok: false, error: MSG_CHAMADO_JURIDICO_JA_EXISTE, jaExiste: true };
  }

  const faseId = String(pai.fase_id ?? '').trim();
  let faseOrigemSlug = 'desconhecida';
  if (faseId) {
    const { data: faseRow } = await db.from('kanban_fases').select('slug').eq('id', faseId).maybeSingle();
    faseOrigemSlug = String((faseRow as { slug?: string | null } | null)?.slug ?? '').trim() || faseOrigemSlug;
  }

  try {
    const filho = await criarCardFilho({
      cardPaiId: paiId,
      kanbanDestinoId: KANBAN_IDS.JURIDICO,
      faseDestinoSlug: 'juridico_recebimento',
      titulo: String(pai.titulo ?? '').trim() || 'Chamado jurídico',
      projetoId: pai.projeto_id ?? null,
      redeFranqueadoId: pai.rede_franqueado_id ?? null,
      kanbanOrigemSlug: kanbanOrigemSlugPorId(kanbanId),
      faseOrigemSlug,
    });

    if (!filho?.id) {
      return { ok: false, error: MSG_CHAMADO_JURIDICO_JA_EXISTE, jaExiste: true };
    }

    revalidatePath(basePath?.trim() || '/');
    revalidatePath('/funil-juridico');
    return { ok: true, cardFilhoId: String(filho.id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

const KANBAN_ID_TO_ORIGEM_SLUG: Record<string, string> = {
  [KANBAN_IDS.STEP_ONE]: 'step-one',
  [KANBAN_IDS.PORTFOLIO]: 'portfolio',
  [KANBAN_IDS.ACOPLAMENTO]: 'acoplamento',
  [KANBAN_IDS.CONTABILIDADE]: 'contabilidade',
  [KANBAN_IDS.CREDITO_OBRA]: 'credito',
  [KANBAN_IDS.LOTEADORES]: 'loteadores',
  [KANBAN_IDS.OPERACOES]: 'operacoes',
  [KANBAN_IDS.JURIDICO]: 'juridico',
  [KANBAN_IDS.MONI_CAPITAL]: 'moni-capital',
  [KANBAN_IDS.CONTRATACOES]: 'contratacoes',
  [KANBAN_IDS.HDM_PRODUTO]: 'hdm-produto',
  [KANBAN_IDS.HDM_MODELO_VIRTUAL]: 'hdm-modelo-virtual',
  [KANBAN_IDS.HDM_HOMOLOGACOES]: 'hdm-homologacoes',
  [KANBAN_IDS.PROJETO_LEGAL]: 'projeto-legal',
  [KANBAN_IDS.PROJETOS_LOCAIS]: 'projetos-locais',
  [KANBAN_IDS.PROJETOS_LEGAIS]: 'projetos-legais',
};

type BastaoDestino = {
  kanbanDestinoId: string;
  faseDestinoSlug: string;
  flag?: null;
};

type CardPaiBastao = {
  id: string;
  titulo: string;
  projeto_id: string | null;
  rede_franqueado_id: string | null;
  kanban_id: string;
};

function kanbanOrigemSlugPorId(kanbanId: string): string {
  return KANBAN_ID_TO_ORIGEM_SLUG[kanbanId] ?? kanbanId;
}

async function checklistFaseObrigatoriaCompleto(cardId: string, faseId: string): Promise<boolean> {
  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch {
    return false;
  }

  const { data: itens, error: errItens } = await db
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', faseId)
    .eq('obrigatorio', true);

  if (errItens) return false;
  const obrigatorios = (itens ?? []) as { id: string }[];
  if (obrigatorios.length === 0) return true;

  const itemIds = obrigatorios.map((i) => i.id);
  const { data: respostas, error: errResp } = await db
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor')
    .eq('card_id', cardId)
    .in('item_id', itemIds);

  if (errResp) return false;

  const comValor = new Set<string>();
  for (const r of (respostas ?? []) as { item_id: string; valor: string | null }[]) {
    if (String(r.valor ?? '').trim()) comValor.add(r.item_id);
  }
  return itemIds.every((id) => comValor.has(id));
}

/** Ritual de encerramento: card Portfolio pai concluído após Operações entregue + checklist 100%. */
async function finalizarCardPortfolioRitualEncerramento(cardPaiId: string): Promise<void> {
  const paiId = String(cardPaiId ?? '').trim();
  if (!paiId) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[ritualEncerramento] admin client:', e);
    return;
  }

  const { data: paiRow, error: errPai } = await db
    .from('kanban_cards')
    .select('id, kanban_id, concluido, arquivado, titulo')
    .eq('id', paiId)
    .maybeSingle();

  if (errPai || !paiRow?.id) {
    if (errPai) console.error('[ritualEncerramento] card pai:', errPai.message);
    return;
  }

  const row = paiRow as {
    id: string;
    kanban_id?: string;
    concluido?: boolean | null;
    arquivado?: boolean | null;
    titulo?: string | null;
  };

  if (String(row.kanban_id ?? '') !== KANBAN_IDS.PORTFOLIO) return;
  if (Boolean(row.concluido) || Boolean(row.arquivado)) return;

  const now = new Date().toISOString();
  const { error: errUpd } = await db
    .from('kanban_cards')
    .update({
      concluido: true,
      concluido_em: now,
      concluido_por: null,
    } as never)
    .eq('id', paiId);

  if (errUpd) {
    console.error('[ritualEncerramento] update pai:', errUpd.message);
    return;
  }

  const titulo = String(row.titulo ?? '').trim() || 'Card';
  const { error: errHist } = await db.from('kanban_historico').insert({
    card_id: paiId,
    usuario_id: null,
    usuario_nome: 'Sistema',
    acao: 'card_finalizado',
    detalhe: {
      tipo: 'ritual_encerramento_operacoes',
      descricao: `Ritual de encerramento: Operações entregue com checklist completo — Portfolio "${titulo}" finalizado.`,
    },
  } as never);

  if (errHist) {
    console.error('[ritualEncerramento] historico:', errHist.message);
  }

  revalidatePath('/portfolio');
  revalidatePath('/operacoes');
  revalidatePath('/');
}

async function executarRitualEncerramentoOperacoes(cardOperacoesId: string): Promise<void> {
  const cid = String(cardOperacoesId ?? '').trim();
  if (!cid) return;

  const completo = await checklistFaseObrigatoriaCompleto(cid, FASE_IDS.OPERACOES_ENTREGUE);
  if (!completo) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[ritualEncerramento] admin client:', e);
    return;
  }

  const { data: filhoRow, error: errFilho } = await db
    .from('kanban_cards')
    .select('origem_card_id, kanban_id')
    .eq('id', cid)
    .maybeSingle();

  if (errFilho) {
    console.error('[ritualEncerramento] card operações:', errFilho.message);
    return;
  }

  const filho = filhoRow as { origem_card_id?: string | null; kanban_id?: string } | null;
  if (String(filho?.kanban_id ?? '') !== KANBAN_IDS.OPERACOES) return;

  const origemCardId = String(filho?.origem_card_id ?? '').trim();
  if (!origemCardId) return;

  await finalizarCardPortfolioRitualEncerramento(origemCardId);
}

async function dispararBastao(
  pai: CardPaiBastao,
  faseOrigemSlug: string,
  destino: BastaoDestino,
): Promise<void> {
  if (
    destino.kanbanDestinoId === KANBAN_IDS.ACOPLAMENTO &&
    !deveDispararBastaoAcoplamentoAutomatico(faseOrigemSlug, pai.kanban_id)
  ) {
    return;
  }

  try {
    const filho = await criarCardFilho({
      cardPaiId: pai.id,
      kanbanDestinoId: destino.kanbanDestinoId,
      faseDestinoSlug: destino.faseDestinoSlug,
      titulo: pai.titulo,
      projetoId: pai.projeto_id,
      redeFranqueadoId: pai.rede_franqueado_id,
      kanbanOrigemSlug: kanbanOrigemSlugPorId(pai.kanban_id),
      faseOrigemSlug,
    });
    if (
      filho?.id &&
      destino.kanbanDestinoId === KANBAN_IDS.ACOPLAMENTO &&
      destino.faseDestinoSlug
    ) {
      await sincronizarTagAcoplamentoPaiDoFilho(String(filho.id), destino.faseDestinoSlug);
    }
  } catch (e) {
    console.error('[executarBastoes] falha ao criar filho:', destino, e);
  }
}

/**
 * Após mover card para `novaFaseSlug`, cria cards filhos nas esteiras de destino (idempotente).
 */
export async function executarBastoes(cardId: string, novaFaseSlug: string): Promise<void> {
  const slug = String(novaFaseSlug ?? '').trim();
  if (!slug) return;

  const cardPaiId = String(cardId ?? '').trim();
  if (!cardPaiId) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[executarBastoes] admin client:', e);
    return;
  }

  const { data: paiRow, error: errPai } = await db
    .from('kanban_cards')
    .select('id, titulo, projeto_id, rede_franqueado_id, kanban_id')
    .eq('id', cardPaiId)
    .maybeSingle();

  if (errPai) {
    console.error('[executarBastoes] card pai:', errPai.message);
    return;
  }
  if (!paiRow?.id) {
    console.error('[executarBastoes] card pai não encontrado:', cardPaiId);
    return;
  }

  const pai = paiRow as CardPaiBastao;
  const titulo = String(pai.titulo ?? '').trim() || 'Card';

  const BASTOES_DE_IDA: Partial<Record<string, BastaoDestino[]>> = {
    [FASE_SLUGS.STEP_3]: [
      { kanbanDestinoId: KANBAN_IDS.JURIDICO, faseDestinoSlug: 'juridico_recebimento' },
    ],
    [FASE_SLUGS.ACOPLAMENTO]: [
      { kanbanDestinoId: KANBAN_IDS.ACOPLAMENTO, faseDestinoSlug: 'modelagem_terreno' },
    ],
    [FASE_SLUGS.STEP_7]: [
      { kanbanDestinoId: KANBAN_IDS.CONTABILIDADE, faseDestinoSlug: 'contabilidade_spe' },
    ],
    [FASE_SLUGS.CAPTACAO_CAPITAL]: [
      { kanbanDestinoId: KANBAN_IDS.MONI_CAPITAL, faseDestinoSlug: 'capital_recebimento' },
    ],
    [FASE_SLUGS.PASSAGEM_WAYSER]: [
      { kanbanDestinoId: KANBAN_IDS.OPERACOES, faseDestinoSlug: 'planialtimetrico' },
    ],
    [FASE_SLUGS.AGUARDANDO_CREDITO]: [
      { kanbanDestinoId: KANBAN_IDS.CREDITO_OBRA, faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO },
    ],
    [FASE_SLUGS.PROD_PUBLICADO]: [
      { kanbanDestinoId: KANBAN_IDS.HDM_MODELO_VIRTUAL, faseDestinoSlug: 'mv_recebimento' },
    ],
    [FASE_SLUGS.APROVACAO_CONDOMINIO]: [
      {
        kanbanDestinoId: KANBAN_IDS.PROJETOS_LOCAIS,
        faseDestinoSlug: 'projetos_locais_briefing',
        flag: null,
      },
    ],
    [FASE_SLUGS.PROJETO_LEGAL]: [
      {
        kanbanDestinoId: KANBAN_IDS.PROJETO_LEGAL,
        faseDestinoSlug: 'projleg_levantamento',
        flag: null,
      },
    ],
    [FASE_SLUGS.LOTEADOR_JURIDICO]: [
      { kanbanDestinoId: KANBAN_IDS.JURIDICO, faseDestinoSlug: 'juridico_recebimento' },
    ],
  };

  if (slug === FASE_SLUGS.OPERACOES_ENTREGUE) {
    await executarRitualEncerramentoOperacoes(cardPaiId);
    return;
  }

  const destinos = BASTOES_DE_IDA[slug];
  if (!destinos?.length) return;

  if (slug === FASE_SLUGS.PASSAGEM_WAYSER) {
    const completo = await checklistFaseObrigatoriaCompleto(cardPaiId, FASE_IDS.PORTFOLIO_PASSAGEM_WAYSER);
    if (!completo) return;
  }

  const paiComTitulo: CardPaiBastao = { ...pai, titulo };

  for (const destino of destinos) {
    if (
      destino.kanbanDestinoId === KANBAN_IDS.ACOPLAMENTO &&
      !deveDispararBastaoAcoplamentoAutomatico(slug, pai.kanban_id)
    ) {
      continue;
    }
    await dispararBastao(paiComTitulo, slug, destino);
  }
}

type BastaoRetornoFlagCol =
  | 'acoplamento_concluido'
  | 'credito_terreno_ok'
  | 'credito_obra_ok'
  | 'contabilidade_ok'
  | 'juridico_ok'
  | 'capital_ok'
  | 'projetos_locais_ok'
  | 'projetos_legais_ok';

const DESFECHO_FLAG_POR_FASE: Partial<Record<string, BastaoRetornoFlagCol>> = {
  [FASE_SLUGS.ACOPLAMENTO_APROVADO]: 'acoplamento_concluido',
  [FASE_SLUGS.ACOPLAMENTO_REPROVADO]: 'acoplamento_concluido',
  [FASE_SLUGS.CO_OUTRO_PARCEIRO]: 'credito_obra_ok',
  [FASE_SLUGS.CREDITO_OBRA_APROVADO]: 'credito_obra_ok',
  [FASE_SLUGS.CREDITO_OBRA_REPROVADO]: 'credito_obra_ok',
  [FASE_SLUGS.CONTABILIDADE_CONCLUIDO]: 'contabilidade_ok',
  [FASE_SLUGS.JURIDICO_CONCLUIDO]: 'juridico_ok',
  [FASE_SLUGS.CAPITAL_CONCLUIDO]: 'capital_ok',
  [FASE_SLUGS.CAPITAL_NAO_ELEGIVEL]: 'capital_ok',
  [FASE_SLUGS.PROJETOS_LOCAIS_CONCLUIDO]: 'projetos_locais_ok',
  [FASE_SLUGS.PROJETOS_LEGAIS_CONCLUIDO]: 'projetos_legais_ok',
};

const DESFECHO_ESTEIRA_LABEL: Record<string, string> = {
  [FASE_SLUGS.ACOPLAMENTO_APROVADO]: 'Acoplamento (aprovado)',
  [FASE_SLUGS.ACOPLAMENTO_REPROVADO]: 'Acoplamento (reprovado)',
  [FASE_SLUGS.CO_OUTRO_PARCEIRO]: 'Crédito Obra (outro parceiro)',
  [FASE_SLUGS.CREDITO_OBRA_APROVADO]: 'Crédito Obra (aprovado)',
  [FASE_SLUGS.CREDITO_OBRA_REPROVADO]: 'Crédito Obra (reprovado)',
  [FASE_SLUGS.CONTABILIDADE_CONCLUIDO]: 'Contabilidade',
  [FASE_SLUGS.JURIDICO_CONCLUIDO]: 'Jurídico',
  [FASE_SLUGS.CAPITAL_CONCLUIDO]: 'Moní Capital (concluído)',
  [FASE_SLUGS.CAPITAL_NAO_ELEGIVEL]: 'Moní Capital (não elegível)',
  [FASE_SLUGS.PROJETOS_LOCAIS_CONCLUIDO]: 'Projetos Locais',
  [FASE_SLUGS.PROJETOS_LEGAIS_CONCLUIDO]: 'Projetos Legais',
};

/**
 * Quando card filho entra em fase de desfecho, marca flag no card pai (`origem_card_id`).
 */
export async function executarBastaoDeVolta(cardId: string, novaFaseSlug: string): Promise<void> {
  const slug = String(novaFaseSlug ?? '').trim();
  const flagCol = DESFECHO_FLAG_POR_FASE[slug];
  if (!flagCol) return;

  const cardFilhoId = String(cardId ?? '').trim();
  if (!cardFilhoId) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[executarBastaoDeVolta] admin client:', e);
    return;
  }

  const { data: filhoRow, error: errFilho } = await db
    .from('kanban_cards')
    .select('id, origem_card_id')
    .eq('id', cardFilhoId)
    .maybeSingle();

  if (errFilho) {
    console.error('[executarBastaoDeVolta] card filho:', errFilho.message);
    return;
  }

  const origemCardId = String((filhoRow as { origem_card_id?: string | null } | null)?.origem_card_id ?? '').trim();
  if (!origemCardId) return;

  const patch = { [flagCol]: true } as Partial<Record<BastaoRetornoFlagCol, boolean>>;

  const { error: errUpd } = await db.from('kanban_cards').update(patch).eq('id', origemCardId);
  if (errUpd) {
    console.error('[executarBastaoDeVolta] update pai:', errUpd.message);
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let usuarioNome: string | null = null;
  if (user?.id) {
    const { data: prof } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    usuarioNome = String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim() || null;
  }

  const esteiraLabel = DESFECHO_ESTEIRA_LABEL[slug] ?? slug;
  const descricao = `Bastão de retorno: esteira ${esteiraLabel} concluída (fase ${slug}).`;

  const { error: errHist } = await db.from('kanban_historico').insert({
    card_id: origemCardId,
    usuario_id: user?.id ?? null,
    usuario_nome: usuarioNome,
    acao: 'bastao_retorno',
    detalhe: {
      tipo: 'bastao_retorno',
      descricao,
      fase_slug: slug,
      flag: flagCol,
      card_filho_id: cardFilhoId,
      esteira: esteiraLabel,
    },
  } as never);

  if (errHist) {
    console.error('[executarBastaoDeVolta] historico:', errHist.message);
  }
}

export type DispararEsteiraManualResult =
  | { ok: true; cardFilhoId: string; kanbanNome: string; jaExistia: boolean }
  | { ok: false; error: string };

/** Dispara card filho manualmente (mesma lógica do bastão automático). */
export async function dispararEsteiraManualDoCard(
  cardPaiId: string,
  destinoKey: string,
  basePath?: string,
): Promise<DispararEsteiraManualResult> {
  const paiId = String(cardPaiId ?? '').trim();
  const key = String(destinoKey ?? '').trim() as DestinoEsteiraManualKey;

  const destino = DESTINOS_ESTEIRA_MANUAL[key];
  if (!destino) return { ok: false, error: 'Destino inválido.' };

  if (key === 'acoplamento') {
    return {
      ok: false,
      error:
        'Use o botão «Abrir Funil Acoplamento» no painel de vínculos (lado esquerdo do card).',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = String((prof as { role?: string | null } | null)?.role ?? '').toLowerCase();
  if (role !== 'admin' && role !== 'team') {
    return { ok: false, error: 'Sem permissão para disparar esteira.' };
  }

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Serviço indisponível: ${msg}` };
  }

  let { data: paiRow, error: errPai } = await db
    .from('kanban_cards')
    .select('id, titulo, kanban_id, projeto_id, rede_franqueado_id, fase_id')
    .eq('id', paiId)
    .maybeSingle();

  if (errPai) return { ok: false, error: errPai.message };

  if (!paiRow?.id) {
    const { data: vLeg, error: vErr } = await db
      .from('v_processo_como_kanban_cards')
      .select('id, kanban_id, fase_id, titulo, responsavel_id')
      .eq('id', paiId)
      .maybeSingle();

    if (vErr) return { ok: false, error: vErr.message };
    if (!vLeg?.id) return { ok: false, error: 'Card não encontrado.' };

    const kid = String((vLeg as { kanban_id?: string | null }).kanban_id ?? '').trim();
    const fid = String((vLeg as { fase_id?: string | null }).fase_id ?? '').trim();
    const franq = String((vLeg as { responsavel_id?: string | null }).responsavel_id ?? '').trim();
    if (!kid || !fid || !franq) {
      return { ok: false, error: 'Dados incompletos do processo (kanban/fase/franqueado).' };
    }

    const { data: shadowExists } = await db.from('kanban_cards').select('id').eq('id', paiId).maybeSingle();
    if (!shadowExists?.id) {
      const { error: insErr } = await db.from('kanban_cards').insert({
        id: paiId,
        kanban_id: kid,
        fase_id: fid,
        franqueado_id: franq,
        titulo: String((vLeg as { titulo?: string | null }).titulo ?? '').trim() || 'Sem título',
        status: 'ativo',
        concluido: false,
      } as never);
      if (insErr) return { ok: false, error: insErr.message };
    }

    const refetch = await db
      .from('kanban_cards')
      .select('id, titulo, kanban_id, projeto_id, rede_franqueado_id, fase_id')
      .eq('id', paiId)
      .maybeSingle();
    if (refetch.error) return { ok: false, error: refetch.error.message };
    paiRow = refetch.data;
    if (!paiRow?.id) return { ok: false, error: 'Card não encontrado.' };
  }

  const pai = paiRow as {
    id: string;
    titulo?: string | null;
    kanban_id?: string | null;
    projeto_id?: string | null;
    rede_franqueado_id?: string | null;
    fase_id?: string | null;
  };

  const kanbanId = String(pai.kanban_id ?? '').trim();
  const permitidos = destinosEsteiraManualParaKanban(kanbanId);
  if (!permitidos.includes(key)) {
    return { ok: false, error: 'Este funil não permite disparar este destino.' };
  }

  let faseOrigemSlug = 'desconhecida';
  const faseId = String(pai.fase_id ?? '').trim();
  if (faseId) {
    const { data: faseRow } = await db.from('kanban_fases').select('slug').eq('id', faseId).maybeSingle();
    faseOrigemSlug = String((faseRow as { slug?: string | null } | null)?.slug ?? '').trim() || faseOrigemSlug;
  }

  const { data: existente } = await db
    .from('kanban_cards')
    .select('id')
    .eq('origem_card_id', paiId)
    .eq('kanban_id', destino.kanbanDestinoId)
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    const { data: kb } = await db.from('kanbans').select('nome').eq('id', destino.kanbanDestinoId).maybeSingle();
    return {
      ok: true,
      cardFilhoId: String(existente.id),
      kanbanNome: String((kb as { nome?: string | null } | null)?.nome ?? destino.label),
      jaExistia: true,
    };
  }

  try {
    const filho = await criarCardFilho({
      cardPaiId: paiId,
      kanbanDestinoId: destino.kanbanDestinoId,
      faseDestinoSlug: destino.faseDestinoSlug,
      titulo: String(pai.titulo ?? '').trim() || 'Card',
      projetoId: pai.projeto_id ?? null,
      redeFranqueadoId: pai.rede_franqueado_id ?? null,
      kanbanOrigemSlug: kanbanOrigemSlugPorId(kanbanId),
      faseOrigemSlug,
    });

    if (!filho?.id) {
      return { ok: false, error: 'Não foi possível criar o card filho (pode já existir).' };
    }

    if (destino.kanbanDestinoId === KANBAN_IDS.ACOPLAMENTO) {
      await sincronizarTagAcoplamentoPaiDoFilho(String(filho.id), destino.faseDestinoSlug);
    }

    const { data: kb } = await db.from('kanbans').select('nome').eq('id', destino.kanbanDestinoId).maybeSingle();
    revalidatePath(basePath?.trim() || '/');
    revalidatePath('/');

    return {
      ok: true,
      cardFilhoId: String(filho.id),
      kanbanNome: String((kb as { nome?: string | null } | null)?.nome ?? destino.label),
      jaExistia: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/** Abre ou cria o card filho no Funil Acoplamento (único caminho manual além da fase Portfólio Acoplamento). */
export async function abrirFunilAcoplamentoManualDoCard(
  cardId: string,
  basePath?: string,
): Promise<DispararEsteiraManualResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = String((prof as { role?: string | null } | null)?.role ?? '').toLowerCase();
  if (role !== 'admin' && role !== 'team') {
    return { ok: false, error: 'Sem permissão para abrir o Funil Acoplamento.' };
  }

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Serviço indisponível: ${msg}` };
  }

  const paiPortfolioId = await resolverCardPaiPortfolioParaAcoplamento(db, cardId);
  if (!paiPortfolioId) {
    return { ok: false, error: 'Card não pertence ao Funil Portfólio (nem é filho com origem no Portfólio).' };
  }

  const destino = DESTINOS_ESTEIRA_MANUAL.acoplamento;

  const { data: paiRow, error: errPai } = await db
    .from('kanban_cards')
    .select('id, titulo, kanban_id, projeto_id, rede_franqueado_id, fase_id')
    .eq('id', paiPortfolioId)
    .maybeSingle();

  if (errPai) return { ok: false, error: errPai.message };
  if (!paiRow?.id) return { ok: false, error: 'Card do Portfólio não encontrado.' };

  const pai = paiRow as {
    id: string;
    titulo?: string | null;
    kanban_id?: string | null;
    projeto_id?: string | null;
    rede_franqueado_id?: string | null;
    fase_id?: string | null;
  };

  let faseOrigemSlug = 'desconhecida';
  const faseId = String(pai.fase_id ?? '').trim();
  if (faseId) {
    const { data: faseRow } = await db.from('kanban_fases').select('slug').eq('id', faseId).maybeSingle();
    faseOrigemSlug = String((faseRow as { slug?: string | null } | null)?.slug ?? '').trim() || faseOrigemSlug;
  }

  const { data: existente } = await db
    .from('kanban_cards')
    .select('id')
    .eq('origem_card_id', paiPortfolioId)
    .eq('kanban_id', destino.kanbanDestinoId)
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    const { data: kb } = await db.from('kanbans').select('nome').eq('id', destino.kanbanDestinoId).maybeSingle();
    return {
      ok: true,
      cardFilhoId: String(existente.id),
      kanbanNome: String((kb as { nome?: string | null } | null)?.nome ?? destino.label),
      jaExistia: true,
    };
  }

  try {
    const filho = await criarCardFilho({
      cardPaiId: paiPortfolioId,
      kanbanDestinoId: destino.kanbanDestinoId,
      faseDestinoSlug: destino.faseDestinoSlug,
      titulo: String(pai.titulo ?? '').trim() || 'Card',
      projetoId: pai.projeto_id ?? null,
      redeFranqueadoId: pai.rede_franqueado_id ?? null,
      kanbanOrigemSlug: kanbanOrigemSlugPorId(KANBAN_IDS.PORTFOLIO),
      faseOrigemSlug,
    });

    if (!filho?.id) {
      return { ok: false, error: 'Não foi possível criar o card filho (pode já existir).' };
    }

    await sincronizarTagAcoplamentoPaiDoFilho(String(filho.id), destino.faseDestinoSlug);

    const { data: kb } = await db.from('kanbans').select('nome').eq('id', destino.kanbanDestinoId).maybeSingle();
    revalidatePath(basePath?.trim() || '/');
    revalidatePath('/');

    return {
      ok: true,
      cardFilhoId: String(filho.id),
      kanbanNome: String((kb as { nome?: string | null } | null)?.nome ?? destino.label),
      jaExistia: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
