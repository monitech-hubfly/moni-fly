'use server';

import { revalidatePath } from 'next/cache';
import { parseCondominioChecklistSnapshot } from '@/lib/condominios-checklist';
import type { CondominioLotePatch } from '@/lib/condominios-lotes';
import { parseDecimalInput } from '@/lib/condominios';
import { KANBAN_IDS, FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { CHAVE_LOTE_PARA_COLUNA_DB, LOTES_DISPONIVEIS_CHECKBOXES } from '@/lib/kanban/lotes-disponiveis-condominio';
import { createClient } from '@/lib/supabase/server';

export type LotesCondominioActionResult = { ok: true } | { ok: false; error: string };

function parseNumeroChecklist(valor: string | null | undefined): number | null {
  const t = String(valor ?? '').trim();
  if (!t) return null;
  return parseDecimalInput(t) ?? (Number.isFinite(Number(t)) ? Number(t) : null);
}

function valorPorLabel(
  itens: { id: string; label: string }[],
  respostas: Map<string, { valor: string; arquivo_path: string | null }>,
): Map<string, { valor: string; arquivo_path: string | null }> {
  const porLabel = new Map<string, { valor: string; arquivo_path: string | null }>();
  for (const it of itens) {
    const resp = respostas.get(it.id);
    if (resp) porLabel.set(it.label.trim(), resp);
  }
  return porLabel;
}

/** Sincroniza respostas do checklist Lotes disponíveis → `condominios_lotes` + card. */
export async function sincronizarLoteChecklistComCadastro(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  basePath?: string;
}): Promise<LotesCondominioActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const { data: fase } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.STEP_ONE)
    .eq('slug', FASE_SLUGS.LOTES_DISPONIVEIS)
    .maybeSingle();

  const faseId = (fase as { id?: string } | null)?.id;
  if (!faseId) return { ok: false, error: 'Fase Lotes disponíveis não encontrada.' };

  const { data: itensData, error: errItens } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, label, tipo')
    .eq('fase_id', faseId);

  if (errItens) return { ok: false, error: errItens.message };

  const itens = (itensData ?? []) as { id: string; label: string; tipo: string }[];
  const itemIds = itens.map((i) => i.id);

  const { data: respostasData, error: errResp } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor, arquivo_path')
    .eq('card_id', cardId)
    .in('item_id', itemIds);

  if (errResp) return { ok: false, error: errResp.message };

  const respMap = new Map<string, { valor: string; arquivo_path: string | null }>();
  for (const r of (respostasData ?? []) as {
    item_id: string;
    valor: string | null;
    arquivo_path: string | null;
  }[]) {
    respMap.set(r.item_id, { valor: r.valor ?? '', arquivo_path: r.arquivo_path });
  }

  const porLabel = valorPorLabel(itens, respMap);

  const itemCondominio = itens.find((i) => i.tipo === 'condominio' || i.label === 'Condomínio vinculado');
  const snap = parseCondominioChecklistSnapshot(
    itemCondominio ? respMap.get(itemCondominio.id)?.valor : null,
  );

  let condominioId = snap?.condominio_id ?? null;

  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('condominio_id, quadra, lote')
    .eq('id', cardId)
    .maybeSingle();

  if (!condominioId && cardRow) {
    condominioId = String((cardRow as { condominio_id?: string | null }).condominio_id ?? '').trim() || null;
  }

  if (!condominioId) {
    return { ok: false, error: 'Selecione um condomínio do cadastro antes de salvar o lote.' };
  }

  const quadra =
    porLabel.get('Quadra')?.valor?.trim() ||
    snap?.quadra?.trim() ||
    (cardRow as { quadra?: string | null })?.quadra?.trim() ||
    null;
  const lote =
    porLabel.get('Lote')?.valor?.trim() ||
    snap?.lote?.trim() ||
    (cardRow as { lote?: string | null })?.lote?.trim() ||
    null;

  const patch: CondominioLotePatch = {
    condominio_id: condominioId,
    quadra,
    lote,
    area_m2: parseNumeroChecklist(porLabel.get('Área m²')?.valor),
    valor: parseNumeroChecklist(porLabel.get('Valor do lote (R$)')?.valor ?? porLabel.get('Valor estimado')?.valor),
    situacao_documental: porLabel.get('Situação documental')?.valor?.trim() || null,
    fotos_path: porLabel.get('Fotos do lote')?.arquivo_path ?? null,
    observacoes: porLabel.get('Observações adicionais sobre o lote')?.valor?.trim() || null,
    kanban_card_id: cardId,
  };

  for (const { chave, label } of LOTES_DISPONIVEIS_CHECKBOXES) {
    patch[CHAVE_LOTE_PARA_COLUNA_DB[chave]] = porLabel.get(label)?.valor === 'true';
  }

  const { data: existente } = await supabase
    .from('condominios_lotes')
    .select('id')
    .eq('kanban_card_id', cardId)
    .maybeSingle();

  const row = {
    ...patch,
    updated_at: new Date().toISOString(),
    criado_por: user.id,
  };

  if (existente?.id) {
    const { error } = await supabase.from('condominios_lotes').update(row as never).eq('id', existente.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('condominios_lotes').insert(row as never);
    if (error) return { ok: false, error: error.message };
  }

  if (input.origem === 'nativo') {
    const { data: cond } = await supabase.from('condominios').select('nome').eq('id', condominioId).maybeSingle();
    const nome = String((cond as { nome?: string } | null)?.nome ?? '').trim() || null;
    await supabase
      .from('kanban_cards')
      .update({
        condominio_id: condominioId,
        nome_condominio: nome,
        quadra,
        lote,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', cardId);
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/rede-franqueados');
  return { ok: true };
}

export async function listarLotesDoCondominio(condominioId: string) {
  const supabase = await createClient();
  const id = String(condominioId ?? '').trim();
  if (!id) return [];

  const { data, error } = await supabase
    .from('condominios_lotes')
    .select('*')
    .eq('condominio_id', id)
    .order('updated_at', { ascending: false });

  if (error) return [];
  return data ?? [];
}
