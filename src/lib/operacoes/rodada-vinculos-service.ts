import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { criarCardDivifyRodada } from '@/lib/operacoes/criar-card-divify-rodada';
import {
  configRodadaVinculo,
  indiceRodadaValido,
  OPERACOES_RODADA_VINCULOS,
  rolePodeAbrirRodadaVinculosOperacoes,
  type RodadaVinculoIndex,
} from '@/lib/operacoes/rodada-vinculos-config';
import { createAdminClient, tryCreateAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type RodadaVinculoRow = {
  rodada_index: RodadaVinculoIndex;
  concluido_em: string | null;
  divify_card_id: string | null;
  filho_titulo: string | null;
  filho_arquivado: boolean | null;
  filho_status: string | null;
};

export type RodadaVinculoListItem = {
  index: RodadaVinculoIndex;
  nome: string;
  tagLabel: string;
  status: 'pendente' | 'concluido';
  concluido_em: string | null;
  filhoDivifyId: string | null;
  filhoTitulo: string | null;
  filhoArquivado: boolean;
  filhoStatus: string | null;
};

type RodadaVinculosDbClient =
  | ReturnType<typeof createAdminClient>
  | Awaited<ReturnType<typeof createClient>>;

function mapRow(row: Record<string, unknown>): RodadaVinculoRow {
  const filhoRaw = row.filho ?? row.kanban_cards;
  const filho = Array.isArray(filhoRaw) ? filhoRaw[0] : filhoRaw;
  const filhoObj = (filho && typeof filho === 'object' ? filho : null) as Record<
    string,
    unknown
  > | null;

  return {
    rodada_index: Number(row.rodada_index) as RodadaVinculoIndex,
    concluido_em: row.concluido_em != null ? String(row.concluido_em) : null,
    divify_card_id:
      row.divify_card_id != null ? String(row.divify_card_id).trim() || null : null,
    filho_titulo:
      filhoObj?.titulo != null ? String(filhoObj.titulo).trim() || null : null,
    filho_arquivado:
      filhoObj?.arquivado != null ? Boolean(filhoObj.arquivado) : null,
    filho_status:
      filhoObj?.status != null ? String(filhoObj.status).trim() || null : null,
  };
}

function montarItensRodadaVinculo(porIndex: Map<number, RodadaVinculoRow>): RodadaVinculoListItem[] {
  return OPERACOES_RODADA_VINCULOS.map((cfg) => {
    const saved = porIndex.get(cfg.index);
    const filhoId = saved?.divify_card_id ?? null;
    const concluido = Boolean(saved?.concluido_em || filhoId);
    return {
      index: cfg.index,
      nome: cfg.nome,
      tagLabel: cfg.tagLabel,
      status: concluido ? 'concluido' : 'pendente',
      concluido_em: saved?.concluido_em ?? null,
      filhoDivifyId: filhoId,
      filhoTitulo: saved?.filho_titulo ?? null,
      filhoArquivado: Boolean(saved?.filho_arquivado),
      filhoStatus: saved?.filho_status ?? null,
    };
  });
}

function erroTabelaRodadaVinculosAusente(err: { code?: string; message?: string }): boolean {
  const code = String(err.code ?? '').trim();
  const msg = String(err.message ?? '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('kanban_operacoes_rodada_vinculos') ||
    msg.includes('schema cache')
  );
}

function erroConsultaRodadaVinculosIgnoravel(err: { code?: string; message?: string }): boolean {
  if (erroTabelaRodadaVinculosAusente(err)) return true;
  const code = String(err.code ?? '').trim();
  const msg = String(err.message ?? '').toLowerCase();
  return (
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('violates row-level security policy')
  );
}

function montarDbClientsRodadaVinculos(
  supabase: Awaited<ReturnType<typeof createClient>>,
): RodadaVinculosDbClient[] {
  const dbClients: RodadaVinculosDbClient[] = [];
  const admin = tryCreateAdminClient();
  if (admin) dbClients.push(admin);
  dbClients.push(supabase);
  return dbClients;
}

const SELECT_RODADA_VINCULOS =
  'rodada_index, concluido_em, divify_card_id, filho:kanban_cards!divify_card_id(id, titulo, arquivado, status)';

async function consultarRodadaVinculosSalvos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
  options?: { rodadaIndex?: RodadaVinculoIndex },
): Promise<
  | { ok: true; rows: RodadaVinculoRow[] }
  | { ok: false; error: string; ignoravel: boolean }
> {
  const cid = String(operacoesCardId ?? '').trim();
  let lastErr: { code?: string; message?: string } | null = null;

  for (const db of montarDbClientsRodadaVinculos(supabase)) {
    let query = db
      .from('kanban_operacoes_rodada_vinculos')
      .select(SELECT_RODADA_VINCULOS)
      .eq('operacoes_card_id', cid);

    if (options?.rodadaIndex != null) {
      query = query.eq('rodada_index', options.rodadaIndex);
    }

    const { data: rows, error: rowsErr } = await query;
    if (!rowsErr) {
      const mapped = (rows ?? []).map((r) => mapRow(r as Record<string, unknown>));
      return { ok: true, rows: mapped };
    }

    lastErr = rowsErr;
    if (erroConsultaRodadaVinculosIgnoravel(rowsErr)) continue;
    return { ok: false, error: rowsErr.message, ignoravel: false };
  }

  if (lastErr && erroConsultaRodadaVinculosIgnoravel(lastErr)) {
    return { ok: true, rows: [] };
  }

  return {
    ok: false,
    error: lastErr?.message || 'Não foi possível carregar vínculos de rodada.',
    ignoravel: Boolean(lastErr && erroConsultaRodadaVinculosIgnoravel(lastErr)),
  };
}

async function resolverOperacoesCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operacoesCardId: string,
): Promise<{ ok: true; cardId: string } | { ok: false; error: string }> {
  const cid = String(operacoesCardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: card, error } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id')
    .eq('id', cid)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (card?.id) {
    if (String(card.kanban_id ?? '') !== KANBAN_IDS.OPERACOES) {
      return { ok: false, error: 'Disponível apenas no Funil Pré Obra e Obra.' };
    }
    return { ok: true, cardId: String(card.id) };
  }

  const { data: vLeg, error: vErr } = await supabase
    .from('v_processo_como_kanban_cards')
    .select('id, kanban_id')
    .eq('id', cid)
    .maybeSingle();

  if (vErr) return { ok: false, error: vErr.message };
  if (!vLeg?.id) return { ok: false, error: 'Card não encontrado.' };

  const kid = String((vLeg as { kanban_id?: string | null }).kanban_id ?? '').trim();
  if (kid !== KANBAN_IDS.OPERACOES) {
    return { ok: false, error: 'Disponível apenas no Funil Pré Obra e Obra.' };
  }

  return { ok: true, cardId: cid };
}

function mensagemErroRodadaLegivel(msg: string): string {
  const m = String(msg ?? '').trim();
  if (!m) return '';
  if (/server components render|omitted in production|digest/i.test(m)) {
    return 'Falha ao abrir a rodada (erro interno). Tente novamente; se persistir, avise o time de tecnologia.';
  }
  return m;
}

async function perfilPodeAbrirRodadaOperacoes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  return rolePodeAbrirRodadaVinculosOperacoes(
    (profile as { role?: string } | null)?.role ?? '',
  );
}

/** Lista os vínculos 1ª–6ª rodada com status do card filho Divify (join). */
export async function listarRodadaVinculos(
  operacoesCardId: string,
): Promise<{ ok: true; items: RodadaVinculoListItem[] } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Faça login.' };

    const cid = String(operacoesCardId ?? '').trim();
    if (!cid) return { ok: false, error: 'Card inválido.' };

    const cardOk = await resolverOperacoesCard(supabase, cid);
    if (!cardOk.ok) return cardOk;

    const consulta = await consultarRodadaVinculosSalvos(supabase, cardOk.cardId);
    if (!consulta.ok) {
      if (consulta.ignoravel) {
        return { ok: true, items: montarItensRodadaVinculo(new Map()) };
      }
      return { ok: false, error: consulta.error };
    }

    const porIndex = new Map<number, RodadaVinculoRow>();
    for (const mapped of consulta.rows) {
      porIndex.set(mapped.rodada_index, mapped);
    }

    return { ok: true, items: montarItensRodadaVinculo(porIndex) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || 'Erro ao carregar vínculos de rodada.' };
  }
}

/**
 * Abre vínculo de rodada: valida UNIQUE (já concluído), chama criarCardDivifyRodada.
 * Sem gate de 1ª via bastão — índices 1–6 liberados.
 * Persistência do vínculo fica dentro de criarCardDivifyRodada.
 */
export async function abrirRodadaVinculo(
  operacoesCardId: string,
  rodadaIndex: number,
  userId: string,
): Promise<{ ok: true; cardId: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const uid = String(userId ?? '').trim();
    if (!uid) return { ok: false, error: 'Faça login.' };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== uid) {
      return { ok: false, error: 'Sessão inválida.' };
    }

    const pode = await perfilPodeAbrirRodadaOperacoes(supabase, uid);
    if (!pode) return { ok: false, error: 'Sem permissão para abrir rodadas.' };

    const cid = String(operacoesCardId ?? '').trim();
    const idx = Number(rodadaIndex);
    if (!cid || !indiceRodadaValido(idx)) return { ok: false, error: 'Dados inválidos.' };

    const cfg = configRodadaVinculo(idx);
    if (!cfg) return { ok: false, error: 'Vínculo inválido.' };

    const cardOk = await resolverOperacoesCard(supabase, cid);
    if (!cardOk.ok) return cardOk;

    const operacoesId = cardOk.cardId;

    const consultaExistente = await consultarRodadaVinculosSalvos(supabase, operacoesId, {
      rodadaIndex: idx,
    });
    if (!consultaExistente.ok) {
      return { ok: false, error: consultaExistente.error };
    }

    const row = consultaExistente.rows[0] ?? null;
    if (row?.concluido_em || row?.divify_card_id) {
      return { ok: false, error: 'Este vínculo já foi concluído.' };
    }

    let criado: Awaited<ReturnType<typeof criarCardDivifyRodada>>;
    try {
      criado = await criarCardDivifyRodada(operacoesId, idx, uid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[abrirRodadaVinculo] criarCardDivifyRodada throw:', msg);
      return {
        ok: false,
        error: mensagemErroRodadaLegivel(msg) || 'Erro ao criar card Divify.',
      };
    }

    if (!criado.ok) {
      return { ok: false, error: criado.error };
    }

    return { ok: true, cardId: criado.cardId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[abrirRodadaVinculo]', msg);
    return {
      ok: false,
      error: mensagemErroRodadaLegivel(msg) || 'Erro inesperado ao abrir rodada.',
    };
  }
}
