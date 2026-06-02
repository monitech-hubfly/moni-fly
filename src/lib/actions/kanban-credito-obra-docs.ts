'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { urlDocumentacaoCreditoObraPreenchida } from '@/lib/kanban/kanban-card-sla';

type ActionResult = { ok: true } | { ok: false; error: string };

function normalizarUrl(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  return s || null;
}

export async function salvarCreditoObraDocumentacao(input: {
  cardId: string;
  alvara_url: string | null;
  docs_terreno_url: string | null;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const alvara = normalizarUrl(input.alvara_url);
  const docsTerreno = normalizarUrl(input.docs_terreno_url);
  const ambosPreenchidos =
    urlDocumentacaoCreditoObraPreenchida(alvara) && urlDocumentacaoCreditoObraPreenchida(docsTerreno);

  const { data: cardRow, error: cardErr } = await supabase
    .from('kanban_cards')
    .select('id, fase_id, sla_iniciado_em, kanban_fases ( slug )')
    .eq('id', cardId)
    .maybeSingle();

  if (cardErr) return { ok: false, error: cardErr.message };
  if (!cardRow?.id) return { ok: false, error: 'Card não encontrado.' };

  const faseEmbed = (cardRow as { kanban_fases?: { slug?: string | null } | { slug?: string | null }[] | null })
    .kanban_fases;
  const faseNode = Array.isArray(faseEmbed) ? faseEmbed[0] : faseEmbed;
  const faseSlug = String(faseNode?.slug ?? '').trim();
  if (faseSlug !== FASE_SLUGS.CO_DOCUMENTACAO_ALVARA) {
    return { ok: false, error: 'Documentação só pode ser editada nesta fase do funil.' };
  }

  const patch: Record<string, unknown> = {
    alvara_url: alvara,
    docs_terreno_url: docsTerreno,
  };

  const slaAtual = (cardRow as { sla_iniciado_em?: string | null }).sla_iniciado_em;
  if (ambosPreenchidos && !slaAtual) {
    patch.sla_iniciado_em = new Date().toISOString();
  } else if (!ambosPreenchidos) {
    patch.sla_iniciado_em = null;
  }

  const { error: updErr } = await supabase.from('kanban_cards').update(patch).eq('id', cardId);
  if (updErr) return { ok: false, error: updErr.message };

  const base = input.basePath?.trim() || '/funil-credito-obra';
  revalidatePath(base);
  return { ok: true };
}

/** Ao entrar na fase de documentação, reinicia o relógio de SLA até os dois links. */
export async function aplicarSlaInicioDocumentacaoAoMoverFase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
  novaFaseSlug: string,
): Promise<void> {
  if (novaFaseSlug !== FASE_SLUGS.CO_DOCUMENTACAO_ALVARA) return;

  const { data: row } = await supabase
    .from('kanban_cards')
    .select('alvara_url, docs_terreno_url')
    .eq('id', cardId)
    .maybeSingle();

  const alvara = (row as { alvara_url?: string | null } | null)?.alvara_url;
  const docs = (row as { docs_terreno_url?: string | null } | null)?.docs_terreno_url;
  const ambos =
    urlDocumentacaoCreditoObraPreenchida(alvara) && urlDocumentacaoCreditoObraPreenchida(docs);

  await supabase
    .from('kanban_cards')
    .update({ sla_iniciado_em: ambos ? new Date().toISOString() : null })
    .eq('id', cardId);
}
