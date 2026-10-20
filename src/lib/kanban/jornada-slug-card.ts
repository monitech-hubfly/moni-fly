import type { SupabaseClient } from '@supabase/supabase-js';
import { gerarSlugCard } from '@/lib/utils/slug';

type ModeloRow = {
  page_slug?: string | null;
  planilha_lotes_path?: string | null;
  page_ativa?: boolean | null;
};

/**
 * Garante o slug da jornada deste card do Funil Loteadores.
 * O slug nasce do nome do condomínio e do id. page_ativa só fica true com slug e planilha.
 */
export async function garantirSlugJornadaDoCard(
  supabase: SupabaseClient,
  input: { cardId: string; nomeCondominio?: string | null; titulo?: string | null },
): Promise<{ ok: true; slug: string; pageAtiva: boolean } | { ok: false; error: string }> {
  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const { data, error } = await supabase
    .from('imob_card_modelo')
    .select('page_slug, planilha_lotes_path, page_ativa')
    .eq('card_id', cardId)
    .maybeSingle();
  if (error && !/schema cache|does not exist|could not find/i.test(error.message)) {
    return { ok: false, error: error.message };
  }

  const row = (data as ModeloRow | null) ?? null;
  const atual = String(row?.page_slug ?? '').trim();
  const slug = gerarSlugCard(input.nomeCondominio, cardId);
  const planilha = String(row?.planilha_lotes_path ?? '').trim();
  const pageAtiva = Boolean(slug && planilha);

  if (row && atual.toLowerCase() === slug && row.page_ativa === pageAtiva) {
    return { ok: true, slug, pageAtiva };
  }

  const { data: other, error: errOther } = await supabase
    .from('imob_card_modelo')
    .select('card_id')
    .eq('page_slug', slug)
    .neq('card_id', cardId)
    .maybeSingle();
  if (errOther && !/schema cache|does not exist|could not find/i.test(errOther.message)) {
    return { ok: false, error: errOther.message };
  }
  if (other) {
    return {
      ok: false,
      error: 'Este slug já está em uso por outro empreendimento. Escolha um slug diferente.',
    };
  }

  const patch = {
    page_slug: slug,
    page_ativa: pageAtiva,
    updated_at: new Date().toISOString(),
  };
  const write = row
    ? await supabase.from('imob_card_modelo').update(patch).eq('card_id', cardId)
    : await supabase.from('imob_card_modelo').insert({ card_id: cardId, ...patch });
  if (write.error) return { ok: false, error: write.error.message };
  return { ok: true, slug, pageAtiva };
}
