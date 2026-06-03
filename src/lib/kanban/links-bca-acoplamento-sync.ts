import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
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

  const { data: card } = await db
    .from('kanban_cards')
    .select('projeto_id')
    .eq('id', cid)
    .maybeSingle();

  const projetoId = String((card as { projeto_id?: string | null } | null)?.projeto_id ?? '').trim();
  if (projetoId) return projetoId;

  const { data: proc } = await db.from('processo_step_one').select('id').eq('id', cid).maybeSingle();
  return proc?.id ? String(proc.id) : null;
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
  const { data: fase } = await db
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
    .eq('slug', FASE_SLUGS.MODELAGEM_CASA_GBOX)
    .eq('ativo', true)
    .maybeSingle();

  if (!fase?.id) return null;
  const faseId = String(fase.id);

  const { data: itens } = await db
    .from('kanban_fase_checklist_itens')
    .select('id, label')
    .eq('fase_id', faseId);

  let gboxItemId: string | null = null;
  let acoplamentoItemId: string | null = null;
  for (const it of itens ?? []) {
    const id = String((it as { id?: string }).id ?? '').trim();
    const lab = normLabel((it as { label?: string }).label);
    if (lab === normLabel(CHECKLIST_LABEL_GBOX)) gboxItemId = id;
    if (lab === normLabel(CHECKLIST_LABEL_ACOPLAMENTO)) acoplamentoItemId = id;
  }

  return { faseId, gboxItemId, acoplamentoItemId };
}

async function listarCardsAcoplamentoDoProcesso(
  db: ReturnType<typeof createAdminClient>,
  processoId: string,
): Promise<string[]> {
  const { data } = await db
    .from('kanban_cards')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.ACOPLAMENTO)
    .eq('projeto_id', processoId);

  return (data ?? []).map((r) => String((r as { id?: string }).id ?? '').trim()).filter(Boolean);
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

/**
 * Sincroniza `link_gbox` / `link_acoplamento` no processo, checklist Modelagem Casa+GBox
 * e histórico em todos os cards vinculados.
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

  const itens = await obterItensChecklistModelagemCasa(db);
  const cardsAcoplamento = await listarCardsAcoplamentoDoProcesso(db, processoId);
  const now = new Date().toISOString();

  if (itens) {
    for (const acopCardId of cardsAcoplamento) {
      if (itens.gboxItemId) {
        await db.from('kanban_fase_checklist_respostas').upsert(
          {
            item_id: itens.gboxItemId,
            card_id: acopCardId,
            valor: linkGbox,
            preenchido_por: params.usuarioId,
            preenchido_em: now,
          } as never,
          { onConflict: 'item_id,card_id' },
        );
      }
      if (itens.acoplamentoItemId) {
        await db.from('kanban_fase_checklist_respostas').upsert(
          {
            item_id: itens.acoplamentoItemId,
            card_id: acopCardId,
            valor: linkAcoplamento,
            preenchido_por: params.usuarioId,
            preenchido_em: now,
          } as never,
          { onConflict: 'item_id,card_id' },
        );
      }
    }
  }

  const cardIdsHistorico = await listarCardIdsVinculadosAoProcesso(db, processoId);
  await registrarHistoricoLinks(db, cardIdsHistorico, {
    usuarioId: params.usuarioId,
    usuarioNome: params.usuarioNome ?? null,
    origem: params.origem,
    cardOrigemId,
    linkGbox,
    linkAcoplamento,
  });

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

/** Gate: saída da fase Modelagem Casa+GBox exige links (exceto para Reprovado/Paralisados). */
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

  if (slugAtual !== FASE_SLUGS.MODELAGEM_CASA_GBOX) return { ok: true };
  if (ordemDest <= ordemAtual) return { ok: true };
  if (slugDest === FASE_SLUGS.ACOPLAMENTO_REPROVADO) return { ok: true };

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const processoId = await resolverProcessoIdDoCard(db, cid);
  if (!processoId) {
    return {
      ok: false,
      error: 'Preencha os links de Gbox e Acoplamento no checklist da fase ou em Dados do Negócio antes de avançar.',
    };
  }

  const { data: proc } = await db
    .from('processo_step_one')
    .select('link_gbox, link_acoplamento')
    .eq('id', processoId)
    .maybeSingle();

  if (!linkGboxAcoplamentoPreenchidos(proc?.link_gbox, proc?.link_acoplamento)) {
    return {
      ok: false,
      error:
        'Preencha os links de Gbox e Acoplamento (checklist da fase ou painel esquerdo) antes de avançar para a próxima fase.',
    };
  }

  return { ok: true };
}
