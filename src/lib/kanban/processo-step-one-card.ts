import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extrairNumeroFranquiaDoTitulo,
  parseCamposDoTituloCard,
} from '@/lib/kanban/card-sync-group';

export type DadosProcessoDoTituloCard = {
  numeroFranquia: string | null;
  nomeCondominio: string;
  cidade: string;
  quadra: string | null;
  lote: string | null;
};

/** Extrai FK, condomínio e possível cidade/praça a partir do título do card. */
export function extrairDadosProcessoDoTituloCard(titulo: string): DadosProcessoDoTituloCard {
  const t = titulo.trim();
  const campos = parseCamposDoTituloCard(t);
  const numeroFranquia = extrairNumeroFranquiaDoTitulo(t) || null;
  const parts = t.split(' - ').map((p) => p.trim()).filter(Boolean);

  let cidade = '';
  let nomeCondominio = campos.nomeCondominio?.trim() ?? '';

  // Formato NovoCardForm: "FK0001 - Praça/Cidade" (2 segmentos, sem quadra/lote)
  if (parts.length === 2 && /^FK\d+/i.test(parts[0] ?? '') && !campos.quadra && !campos.lote) {
    cidade = parts[1] ?? '';
    nomeCondominio = '';
  }

  return {
    numeroFranquia,
    nomeCondominio,
    cidade,
    quadra: campos.quadra?.trim() || null,
    lote: campos.lote?.trim() || null,
  };
}

export type CriarProcessoStepOneMinimoInput = {
  userId: string;
  titulo?: string;
  cidade?: string | null;
  estado?: string | null;
  nomeCondominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
  numeroFranquia?: string | null;
  redeFranqueadoId?: string | null;
};

/** Insere registro mínimo em `processo_step_one`. */
export async function criarProcessoStepOneMinimo(
  db: SupabaseClient,
  input: CriarProcessoStepOneMinimoInput,
): Promise<{ ok: true; processoId: string } | { ok: false; error: string }> {
  const fromTitulo = input.titulo?.trim() ? extrairDadosProcessoDoTituloCard(input.titulo) : null;

  const cidade =
    (input.cidade?.trim() || fromTitulo?.cidade?.trim() || '').trim() || 'A definir';
  const estado = input.estado?.trim().toUpperCase().slice(0, 2) || null;
  const nomeCondominio =
    (input.nomeCondominio?.trim() || fromTitulo?.nomeCondominio?.trim() || '') || null;
  const quadra = input.quadra?.trim() || fromTitulo?.quadra || null;
  const lote = input.lote?.trim() || fromTitulo?.lote || null;
  const numeroFranquia =
    input.numeroFranquia?.trim() || fromTitulo?.numeroFranquia || null;
  const redeId = input.redeFranqueadoId?.trim() || null;
  const now = new Date().toISOString();

  const { data: novo, error: errInsert } = await db
    .from('processo_step_one')
    .insert({
      user_id: input.userId,
      cidade,
      estado,
      status: 'em_andamento',
      etapa_atual: 1,
      updated_at: now,
      nome_condominio: nomeCondominio,
      quadra_lote: [quadra, lote].filter(Boolean).join(' / ') || null,
      numero_franquia: numeroFranquia,
      origem_rede_franqueados_id: redeId,
    })
    .select('id')
    .single();

  if (errInsert || !novo?.id) {
    return { ok: false, error: errInsert?.message ?? 'Falha ao criar processo Step One.' };
  }

  return { ok: true, processoId: String((novo as { id: string }).id) };
}

/** Vincula `processo_step_one_id` (e campos espelhados) ao card nativo. */
export async function vincularProcessoStepOneAoCard(
  db: SupabaseClient,
  cardId: string,
  processoId: string,
  extras?: {
    nomeCondominio?: string | null;
    quadra?: string | null;
    lote?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = cardId.trim();
  const pid = processoId.trim();
  if (!cid || !pid) return { ok: false, error: 'Card ou processo inválido.' };

  const patch: Record<string, unknown> = {
    processo_step_one_id: pid,
    updated_at: new Date().toISOString(),
  };
  if (extras?.nomeCondominio?.trim()) patch.nome_condominio = extras.nomeCondominio.trim();
  if (extras?.quadra?.trim()) patch.quadra = extras.quadra.trim();
  if (extras?.lote?.trim()) patch.lote = extras.lote.trim();

  const { error } = await db.from('kanban_cards').update(patch).eq('id', cid);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Cria processo mínimo e vincula ao card (idempotente se já houver `processo_step_one_id`). */
export async function criarEVincularProcessoStepOneAoCard(
  db: SupabaseClient,
  params: CriarProcessoStepOneMinimoInput & {
    cardId: string;
  },
): Promise<{ ok: true; processoId: string; created: boolean } | { ok: false; error: string }> {
  const cid = params.cardId.trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: card } = await db
    .from('kanban_cards')
    .select('processo_step_one_id')
    .eq('id', cid)
    .maybeSingle();

  const existente = String(
    (card as { processo_step_one_id?: string | null } | null)?.processo_step_one_id ?? '',
  ).trim();
  if (existente) {
    return { ok: true, processoId: existente, created: false };
  }

  const criado = await criarProcessoStepOneMinimo(db, params);
  if (!criado.ok) return criado;

  const link = await vincularProcessoStepOneAoCard(db, cid, criado.processoId, {
    nomeCondominio: params.nomeCondominio,
    quadra: params.quadra,
    lote: params.lote,
  });
  if (!link.ok) return link;

  return { ok: true, processoId: criado.processoId, created: true };
}
