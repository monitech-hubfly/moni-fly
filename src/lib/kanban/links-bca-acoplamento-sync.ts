import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { resolverProcessoIdExplicitoDoCard } from '@/lib/kanban/card-sync-group';
import { tipoKanbanHistoricoFromAcao } from '@/lib/kanban/kanban-historico-tipo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const CHECKLIST_LABEL_GBOX = 'Gbox';
export const CHECKLIST_LABEL_ACOPLAMENTO = 'Acoplamento';

export type OrigemSyncLinkGboxAcoplamento = 'checklist' | 'painel_negocio';

function normLabel(label: string | null | undefined): string {
  return String(label ?? '')
    .trim()
    .toLowerCase();
}

function normLink(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim();
  return s.length > 0 ? s : null;
}

export function linkGboxAcoplamentoPreenchidos(
  linkGbox: string | null | undefined,
  linkAcoplamento: string | null | undefined,
): boolean {
  return Boolean(normLink(linkGbox)) && Boolean(normLink(linkAcoplamento));
}

/** @deprecated Use linkGboxAcoplamentoPreenchidos */
export function linkBcaAcoplamentoPreenchidos(
  linkGbox: string | null | undefined,
  linkAcoplamento: string | null | undefined,
): boolean {
  return linkGboxAcoplamentoPreenchidos(linkGbox, linkAcoplamento);
}

/** Resolve `processo_step_one.id` a partir do card kanban. */
export async function resolverProcessoIdDoCard(
  db: ReturnType<typeof createAdminClient>,
  cardId: string,
): Promise<string | null> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return null;

  return resolverProcessoIdExplicitoDoCard(db, cid);
}

/** Cards do mesmo processo + componente conexo em `kanban_card_vinculos`. */
export async function listarCardIdsVinculadosAoProcesso(
  db: ReturnType<typeof createAdminClient>,
  processoId: string,
): Promise<string[]> {
  const pid = String(processoId ?? '').trim();
  if (!pid) return [];

  const ids = new Set<string>([pid]);

  const { data: porProjeto } = await db
    .from('kanban_cards')
    .select('id')
    .eq('projeto_id', pid);

  for (const row of porProjeto ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim();
    if (id) ids.add(id);
  }

  let frontier = [...ids];
  const seenEdges = new Set<string>();

  while (frontier.length > 0) {
    const batch = frontier;
    frontier = [];

    for (const cid of batch) {
      const { data: vinculos } = await db
        .from('kanban_card_vinculos')
        .select('card_origem_id, card_destino_id')
        .or(`card_origem_id.eq.${cid},card_destino_id.eq.${cid}`);

      for (const v of vinculos ?? []) {
        const a = String((v as { card_origem_id?: string }).card_origem_id ?? '').trim();
        const b = String((v as { card_destino_id?: string }).card_destino_id ?? '').trim();
        const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (seenEdges.has(edgeKey)) continue;
        seenEdges.add(edgeKey);

        for (const nid of [a, b]) {
          if (!nid || ids.has(nid)) continue;
          ids.add(nid);
          frontier.push(nid);
        }
      }
    }
  }

  return [...ids];
}

type ItensChecklistModelagem = {
  faseId: string;
  gboxItemId: string | null;
  acoplamentoItemId: string | null;
};

async function obterItensChecklistModelagemCasa(
  db: ReturnType<typeof createAdminClient>,
): Promise<ItensChecklistModelagem | null> {
  const { data: fases } = await db
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
    .in('slug', [FASE_SLUGS.MODELAGEM_CASA_GBOX, FASE_SLUGS.GBOX_ACOPLAMENTO])
    .eq('ativo', true);

  const faseIds = (fases ?? [])
    .map((fase) => String((fase as { id?: string }).id ?? '').trim())
    .filter(Boolean);
  if (faseIds.length === 0) return null;
  const faseId = faseIds[0]!;

  const { data: itens } = await db
    .from('kanban_fase_checklist_itens')
    .select('id, label')
    .in('fase_id', faseIds);

  let gboxItemId: string | null = null;
  let acoplamentoItemId: string | null = null;
  for (const it of itens ?? []) {
    const id = String((it as { id?: string }).id ?? '').trim();
    const lab = normLabel((it as { label?: string }).label);
    if (lab === normLabel(CHECKLIST_LABEL_GBOX) || lab === 'bca') gboxItemId = id;
    if (lab === normLabel(CHECKLIST_LABEL_ACOPLAMENTO)) acoplamentoItemId = id;
  }

  return { faseId, gboxItemId, acoplamentoItemId };
}

async function registrarHistoricoLinks(
  db: ReturnType<typeof createAdminClient>,
  cardIds: string[],
  params: {
    usuarioId: string | null;
    usuarioNome: string | null;
    origem: OrigemSyncLinkGboxAcoplamento;
    cardOrigemId: string;
    linkGbox: string | null;
    linkAcoplamento: string | null;
  },
): Promise<void> {
  const descricao =
    params.origem === 'checklist'
      ? 'Links Gbox e Acoplamento atualizados (checklist da fase).'
      : 'Links Gbox e Acoplamento atualizados (dados do negócio).';

  const rows = cardIds.map((card_id) => ({
    card_id,
    usuario_id: params.usuarioId,
    usuario_nome: params.usuarioNome,
    acao: 'links_gbox_acoplamento',
    tipo: tipoKanbanHistoricoFromAcao('links_gbox_acoplamento'),
    detalhe: {
      tipo: 'links_gbox_acoplamento',
      descricao,
      origem: params.origem,
      card_origem_id: params.cardOrigemId,
      link_gbox: params.linkGbox,
      link_acoplamento: params.linkAcoplamento,
    },
  }));

  if (rows.length === 0) return;
  const { error } = await db.from('kanban_historico').insert(rows as never);
  if (error) console.error('[links-gbox-acoplamento] historico:', error.message);
}

/** Lê Gbox e Acoplamento salvos no checklist das fases Modelagem da Casa e Gbox. */
export async function lerLinksGboxAcoplamentoChecklistCard(
  db: ReturnType<typeof createAdminClient>,
  cardId: string,
): Promise<{ linkGbox: string | null; linkAcoplamento: string | null }> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return { linkGbox: null, linkAcoplamento: null };

  const itens = await obterItensChecklistModelagemCasa(db);
  if (!itens) return { linkGbox: null, linkAcoplamento: null };

  const itemIds = [itens.gboxItemId, itens.acoplamentoItemId].filter(Boolean) as string[];
  if (itemIds.length === 0) return { linkGbox: null, linkAcoplamento: null };

  const { data: resps } = await db
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor')
    .eq('card_id', cid)
    .in('item_id', itemIds);

  let linkGbox: string | null = null;
  let linkAcoplamento: string | null = null;
  for (const r of resps ?? []) {
    const itemId = String((r as { item_id?: string }).item_id ?? '').trim();
    const v = normLink((r as { valor?: string | null }).valor);
    if (itens.gboxItemId && itemId === itens.gboxItemId) linkGbox = v;
    if (itens.acoplamentoItemId && itemId === itens.acoplamentoItemId) linkAcoplamento = v;
  }

  return { linkGbox, linkAcoplamento };
}

/**
 * Grava `link_gbox` / `link_acoplamento` no processo (somente entrada manual no painel Dados do Negócio).
 * Não propaga para checklist nem outros cards.
 */
export async function sincronizarLinksGboxAcoplamento(params: {
  cardOrigemId: string;
  linkGbox?: string | null;
  linkAcoplamento?: string | null;
  origem: OrigemSyncLinkGboxAcoplamento;
  usuarioId: string;
  usuarioNome?: string | null;
}): Promise<{ ok: true; linkGbox: string | null; linkAcoplamento: string | null } | { ok: false; error: string }> {
  const cardOrigemId = String(params.cardOrigemId ?? '').trim();
  if (!cardOrigemId) return { ok: false, error: 'Card inválido.' };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const processoId = await resolverProcessoIdDoCard(db, cardOrigemId);
  if (!processoId) {
    return { ok: false, error: 'Sem processo vinculado para sincronizar Gbox/Acoplamento.' };
  }

  const { data: procAtual, error: errProc } = await db
    .from('processo_step_one')
    .select('link_gbox, link_acoplamento')
    .eq('id', processoId)
    .maybeSingle();

  if (errProc) return { ok: false, error: errProc.message };

  const linkGbox =
    params.linkGbox !== undefined
      ? normLink(params.linkGbox)
      : normLink((procAtual as { link_gbox?: string | null } | null)?.link_gbox);
  const linkAcoplamento =
    params.linkAcoplamento !== undefined
      ? normLink(params.linkAcoplamento)
      : normLink((procAtual as { link_acoplamento?: string | null } | null)?.link_acoplamento);

  const { error: errUpd } = await db
    .from('processo_step_one')
    .update({
      link_gbox: linkGbox,
      link_acoplamento: linkAcoplamento,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', processoId);

  if (errUpd) return { ok: false, error: errUpd.message };

  if (params.origem === 'painel_negocio') {
    const cardIdsHistorico = await listarCardIdsVinculadosAoProcesso(db, processoId);
    await registrarHistoricoLinks(db, cardIdsHistorico, {
      usuarioId: params.usuarioId,
      usuarioNome: params.usuarioNome ?? null,
      origem: params.origem,
      cardOrigemId,
      linkGbox,
      linkAcoplamento,
    });
  }

  return { ok: true, linkGbox, linkAcoplamento };
}

/** @deprecated Use sincronizarLinksGboxAcoplamento */
export const sincronizarLinksBcaAcoplamento = sincronizarLinksGboxAcoplamento;

export function isChecklistItemSyncGboxAcoplamento(label: string | null | undefined): 'gbox' | 'acoplamento' | null {
  const n = normLabel(label);
  if (n === normLabel(CHECKLIST_LABEL_GBOX)) return 'gbox';
  if (n === normLabel(CHECKLIST_LABEL_ACOPLAMENTO)) return 'acoplamento';
  return null;
}

/** @deprecated Use isChecklistItemSyncGboxAcoplamento */
export function isChecklistItemSyncBcaAcoplamento(label: string | null | undefined): 'gbox' | 'acoplamento' | null {
  return isChecklistItemSyncGboxAcoplamento(label);
}

type CampoObrigatorioAcoplamento = {
  chave: string;
  label: string;
  coluna?: 'link_acoplamento' | 'link_gbox' | 'link_gbox_ozempic';
};

const CAMPOS_OBRIGATORIOS_CASA: CampoObrigatorioAcoplamento[] = [
  { chave: 'negocio:link_acoplamento', label: 'Acoplamento', coluna: 'link_acoplamento' },
  { chave: 'acoplamento:acoplamento_pontos_sondagem', label: 'Acoplamento com os pontos de sondagem' },
  { chave: 'acoplamento:pranchas_pdf', label: 'Pranchas em PDF (plantas e cortes)' },
  { chave: 'acoplamento:imagens_3d', label: 'Imagens 3D' },
  { chave: 'acoplamento:video_360_acoplamento', label: 'Vídeo 360 do acoplamento' },
  { chave: 'acoplamento:tabela_metragens', label: 'Tabela de metragens (área útil e total de venda)' },
];

const CAMPOS_OBRIGATORIOS_GBOX: CampoObrigatorioAcoplamento[] = [
  ...CAMPOS_OBRIGATORIOS_CASA,
  { chave: 'negocio:link_gbox', label: 'Gbox', coluna: 'link_gbox' },
];

function textoChecklist(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s || null;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    const s = String(raw).trim();
    return s || null;
  }
  return null;
}

/** Copia Acoplamento, Gbox e GBOX Ozempic para os cards vinculados. */
export async function propagarLinksAcoplamentoVinculados(params: {
  cardId: string;
  usuarioId: string;
  linkGbox?: string | null;
  linkAcoplamento?: string | null;
  linkGboxOzempic?: string | null;
  bookEmpreendimento?: string | null;
  checkAnaliseCredito?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cardId = String(params.cardId ?? '').trim();
  if (!cardId) return { ok: true };

  const patch: Record<string, string | null> = {};
  if (params.linkGbox !== undefined) patch.link_gbox = params.linkGbox;
  if (params.linkAcoplamento !== undefined) patch.link_acoplamento = params.linkAcoplamento;
  if (params.linkGboxOzempic !== undefined) patch.link_gbox_ozempic = params.linkGboxOzempic;
  if (params.bookEmpreendimento !== undefined) patch.book_empreendimento = params.bookEmpreendimento;
  if (params.checkAnaliseCredito !== undefined) patch.check_analise_credito = params.checkAnaliseCredito;
  if (Object.keys(patch).length === 0) return { ok: true };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const { propagarCamposProcesso, listarKanbanCardIdsSyncGroup } = await import(
    '@/lib/kanban/card-sync-group'
  );
  const { data: card } = await db
    .from('kanban_cards')
    .select('processo_step_one_id')
    .eq('id', cardId)
    .maybeSingle();
  const processoId = String(
    (card as { processo_step_one_id?: string | null } | null)?.processo_step_one_id ?? '',
  ).trim();
  if (!processoId) return { ok: true };

  let sync = await propagarCamposProcesso(
    db,
    cardId,
    processoId,
    patch as Parameters<typeof propagarCamposProcesso>[3],
  );
  if (!sync.ok && params.linkGboxOzempic !== undefined && /column|does not exist|schema cache/i.test(sync.error)) {
    const semOzempic = { ...patch };
    delete semOzempic.link_gbox_ozempic;
    if (Object.keys(semOzempic).length > 0) {
      sync = await propagarCamposProcesso(
        db,
        cardId,
        processoId,
        semOzempic as Parameters<typeof propagarCamposProcesso>[3],
      );
    } else {
      sync = { ok: true };
    }
  }
  if (!sync.ok) return sync;

  const chaves: { chave: string; valor: string | null }[] = [];
  if (params.linkAcoplamento !== undefined) {
    chaves.push({ chave: 'negocio:link_acoplamento', valor: params.linkAcoplamento });
  }
  if (params.linkGbox !== undefined) chaves.push({ chave: 'negocio:link_gbox', valor: params.linkGbox });
  if (params.linkGboxOzempic !== undefined) {
    chaves.push({ chave: 'negocio:link_gbox_ozempic', valor: params.linkGboxOzempic });
  }
  if (params.bookEmpreendimento !== undefined) {
    chaves.push({ chave: 'negocio:book_empreendimento', valor: params.bookEmpreendimento });
  }
  if (params.checkAnaliseCredito !== undefined) {
    chaves.push({ chave: 'negocio:check_analise_credito', valor: params.checkAnaliseCredito });
  }
  const cardIds = await listarKanbanCardIdsSyncGroup(db, cardId);
  if (cardIds.length === 0 || chaves.length === 0) return { ok: true };

  const agora = new Date().toISOString();
  const rows = cardIds.flatMap((id) =>
    chaves.map((linha) => ({
      card_id: id,
      chave: linha.chave,
      valor: linha.valor,
      atualizado_por: params.usuarioId,
      atualizado_em: agora,
    })),
  );
  const { error } = await db.from('kanban_card_checklist_compartilhado').upsert(rows as never, {
    onConflict: 'card_id,chave',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Gate: sair da fase exige os campos obrigatórios daquela fase. */
export async function verificarGateAcoplamentoModelagemCasa(
  cardId: string,
  novaFaseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = String(cardId ?? '').trim();
  const fid = String(novaFaseId ?? '').trim();
  if (!cid || !fid) return { ok: true };

  const supabase = await createClient();

  const { data: card } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, fase_id, projeto_id')
    .eq('id', cid)
    .maybeSingle();

  if (!card || String((card as { id?: string }).id ?? '') !== cid) return { ok: true };
  if (String((card as { kanban_id?: string }).kanban_id ?? '') !== KANBAN_IDS.ACOPLAMENTO) return { ok: true };

  const [{ data: faseAtual }, { data: faseDest }] = await Promise.all([
    supabase.from('kanban_fases').select('slug, ordem').eq('id', String(card.fase_id ?? '')).maybeSingle(),
    supabase.from('kanban_fases').select('slug, ordem').eq('id', fid).maybeSingle(),
  ]);

  const slugAtual = String((faseAtual as { slug?: string } | null)?.slug ?? '').trim();
  const slugDest = String((faseDest as { slug?: string } | null)?.slug ?? '').trim();
  const ordemAtual = Number((faseAtual as { ordem?: number } | null)?.ordem ?? 0);
  const ordemDest = Number((faseDest as { ordem?: number } | null)?.ordem ?? 0);

  const saindoDaCasa = slugAtual === FASE_SLUGS.MODELAGEM_CASA_GBOX;
  const saindoDoGbox = slugAtual === FASE_SLUGS.GBOX_ACOPLAMENTO;
  const saindoDasAlteracoes = slugAtual === FASE_SLUGS.ACOPLAMENTO_ALTERACOES;
  if (!saindoDaCasa && !saindoDoGbox && !saindoDasAlteracoes) return { ok: true };
  if (ordemDest <= ordemAtual) return { ok: true };
  if (slugDest === FASE_SLUGS.ACOPLAMENTO_REPROVADO) return { ok: true };

  const pulouGbox = saindoDaCasa && slugDest !== FASE_SLUGS.GBOX_ACOPLAMENTO;
  const exigidos =
    saindoDoGbox || saindoDasAlteracoes || pulouGbox ? CAMPOS_OBRIGATORIOS_GBOX : CAMPOS_OBRIGATORIOS_CASA;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const chaves = exigidos.map((campo) => campo.chave);
  const [{ data: compartilhados }, { data: respostas }, processoId] = await Promise.all([
    db.from('kanban_card_checklist_compartilhado').select('chave, valor').eq('card_id', cid).in('chave', chaves),
    db
      .from('kanban_fase_checklist_respostas')
      .select('valor, item:kanban_fase_checklist_itens!inner(chave_compartilhada)')
      .eq('card_id', cid),
    resolverProcessoIdDoCard(db, cid),
  ]);

  const porChave = new Map<string, string>();
  for (const row of respostas ?? []) {
    const item = (row as { item?: { chave_compartilhada?: string | null } | { chave_compartilhada?: string | null }[] })
      .item;
    const chave = String(
      (Array.isArray(item) ? item[0]?.chave_compartilhada : item?.chave_compartilhada) ?? '',
    ).trim();
    const valor = textoChecklist((row as { valor?: unknown }).valor);
    if (chave && valor && !porChave.has(chave)) porChave.set(chave, valor);
  }
  for (const row of compartilhados ?? []) {
    const chave = String((row as { chave?: string }).chave ?? '').trim();
    const valor = textoChecklist((row as { valor?: unknown }).valor);
    if (chave && valor) porChave.set(chave, valor);
  }

  if (processoId) {
    const { data: proc, error: procErr } = await db
      .from('processo_step_one')
      .select('link_gbox, link_acoplamento, link_gbox_ozempic')
      .eq('id', processoId)
      .maybeSingle();
    const procRow = (!procErr && proc ? proc : null) as Record<string, unknown> | null;
    const procFallback =
      procErr && processoId
        ? (
            await db
              .from('processo_step_one')
              .select('link_gbox, link_acoplamento')
              .eq('id', processoId)
              .maybeSingle()
          ).data
        : procRow;
    const fonte = (procFallback ?? {}) as Record<string, unknown>;
    for (const campo of exigidos) {
      if (!campo.coluna || porChave.get(campo.chave)) continue;
      const valor = textoChecklist(fonte[campo.coluna]);
      if (valor) porChave.set(campo.chave, valor);
    }
  }

  const faltando = exigidos.filter((campo) => !porChave.get(campo.chave)).map((campo) => campo.label);
  if (faltando.length > 0) {
    return {
      ok: false,
      error: `Preencha antes de avançar: ${faltando.join(', ')}.`,
    };
  }

  return { ok: true };
}
