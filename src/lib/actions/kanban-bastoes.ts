'use server';

import { revalidatePath } from 'next/cache';
import { KANBANS_COM_CHAMADO_JURIDICO, FASE_IDS, FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isFrankOrFranqueadoRole } from '@/lib/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const MSG_CHAMADO_JURIDICO_JA_EXISTE =
  'Já existe um chamado jurídico aberto para este card';

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
  [KANBAN_IDS.CREDITO]: 'credito',
  [KANBAN_IDS.LOTEADORES]: 'loteadores',
  [KANBAN_IDS.OPERACOES]: 'operacoes',
  [KANBAN_IDS.JURIDICO]: 'juridico',
  [KANBAN_IDS.MONI_CAPITAL]: 'moni-capital',
  [KANBAN_IDS.CONTRATACOES]: 'contratacoes',
};

type BastaoDestino = {
  kanbanDestinoId: string;
  faseDestinoSlug: string;
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

async function dispararBastao(
  pai: CardPaiBastao,
  faseOrigemSlug: string,
  destino: BastaoDestino,
): Promise<void> {
  try {
    await criarCardFilho({
      cardPaiId: pai.id,
      kanbanDestinoId: destino.kanbanDestinoId,
      faseDestinoSlug: destino.faseDestinoSlug,
      titulo: pai.titulo,
      projetoId: pai.projeto_id,
      redeFranqueadoId: pai.rede_franqueado_id,
      kanbanOrigemSlug: kanbanOrigemSlugPorId(pai.kanban_id),
      faseOrigemSlug,
    });
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

  const bastoesPorSlug: Partial<Record<string, BastaoDestino[]>> = {
    [FASE_SLUGS.STEP_4]: [
      { kanbanDestinoId: KANBAN_IDS.ACOPLAMENTO, faseDestinoSlug: 'modelagem_terreno' },
      { kanbanDestinoId: KANBAN_IDS.CREDITO, faseDestinoSlug: 'credito_terreno' },
      { kanbanDestinoId: KANBAN_IDS.CONTABILIDADE, faseDestinoSlug: 'contabilidade_incorporadora' },
    ],
    [FASE_SLUGS.CAPTACAO_CAPITAL]: [
      { kanbanDestinoId: KANBAN_IDS.MONI_CAPITAL, faseDestinoSlug: 'capital_recebimento' },
    ],
    [FASE_SLUGS.PASSAGEM_WAYSER]: [
      { kanbanDestinoId: KANBAN_IDS.OPERACOES, faseDestinoSlug: 'planialtimetrico' },
    ],
    [FASE_SLUGS.AGUARDANDO_CREDITO]: [
      { kanbanDestinoId: KANBAN_IDS.CREDITO, faseDestinoSlug: 'credito_obra' },
    ],
    [FASE_SLUGS.LOTEADOR_JURIDICO]: [
      { kanbanDestinoId: KANBAN_IDS.JURIDICO, faseDestinoSlug: 'juridico_recebimento' },
    ],
  };

  const destinos = bastoesPorSlug[slug];
  if (!destinos?.length) return;

  if (slug === FASE_SLUGS.PASSAGEM_WAYSER) {
    const completo = await checklistFaseObrigatoriaCompleto(cardPaiId, FASE_IDS.PORTFOLIO_PASSAGEM_WAYSER);
    if (!completo) return;
  }

  const paiComTitulo: CardPaiBastao = { ...pai, titulo };

  for (const destino of destinos) {
    await dispararBastao(paiComTitulo, slug, destino);
  }
}

type BastaoRetornoFlagCol =
  | 'acoplamento_concluido'
  | 'credito_terreno_ok'
  | 'credito_obra_ok'
  | 'contabilidade_ok'
  | 'juridico_ok'
  | 'capital_ok';

const DESFECHO_FLAG_POR_FASE: Partial<Record<string, BastaoRetornoFlagCol>> = {
  [FASE_SLUGS.ACOPLAMENTO_APROVADO]: 'acoplamento_concluido',
  [FASE_SLUGS.ACOPLAMENTO_REPROVADO]: 'acoplamento_concluido',
  [FASE_SLUGS.CREDITO_TERRENO_APROVADO]: 'credito_terreno_ok',
  [FASE_SLUGS.CREDITO_TERRENO_REPROVADO]: 'credito_terreno_ok',
  [FASE_SLUGS.CREDITO_OBRA_APROVADO]: 'credito_obra_ok',
  [FASE_SLUGS.CREDITO_OBRA_REPROVADO]: 'credito_obra_ok',
  [FASE_SLUGS.CONTABILIDADE_CONCLUIDO]: 'contabilidade_ok',
  [FASE_SLUGS.JURIDICO_CONCLUIDO]: 'juridico_ok',
  [FASE_SLUGS.CAPITAL_CONCLUIDO]: 'capital_ok',
  [FASE_SLUGS.CAPITAL_NAO_ELEGIVEL]: 'capital_ok',
};

const DESFECHO_ESTEIRA_LABEL: Record<string, string> = {
  [FASE_SLUGS.ACOPLAMENTO_APROVADO]: 'Acoplamento (aprovado)',
  [FASE_SLUGS.ACOPLAMENTO_REPROVADO]: 'Acoplamento (reprovado)',
  [FASE_SLUGS.CREDITO_TERRENO_APROVADO]: 'Crédito Terreno (aprovado)',
  [FASE_SLUGS.CREDITO_TERRENO_REPROVADO]: 'Crédito Terreno (reprovado)',
  [FASE_SLUGS.CREDITO_OBRA_APROVADO]: 'Crédito Obra (aprovado)',
  [FASE_SLUGS.CREDITO_OBRA_REPROVADO]: 'Crédito Obra (reprovado)',
  [FASE_SLUGS.CONTABILIDADE_CONCLUIDO]: 'Contabilidade',
  [FASE_SLUGS.JURIDICO_CONCLUIDO]: 'Jurídico',
  [FASE_SLUGS.CAPITAL_CONCLUIDO]: 'Moní Capital (concluído)',
  [FASE_SLUGS.CAPITAL_NAO_ELEGIVEL]: 'Moní Capital (não elegível)',
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
