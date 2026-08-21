import { createClient } from '@/lib/supabase/server';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type ZapLoteItem = {
  condominio?: string;
  area_lote_m2?: number;
  preco?: number;
  preco_m2?: number;
  link?: string;
  valor_condominio?: number;
  iptu?: number;
  caracteristicas_condominio?: string;
  caracteristicas?: string | null;
};

export async function verifyProcessoLotesAccess(
  processoId: string,
): Promise<
  | { ok: true; supabase: SupabaseServer }
  | { ok: false; error: string; supabase?: undefined }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: processo } = await supabase
    .from('processo_step_one')
    .select('id')
    .eq('id', processoId)
    .eq('user_id', user.id)
    .single();
  if (!processo) return { ok: false, error: 'Processo não encontrado.' };

  return { ok: true, supabase };
}

/** Substitui lotes ZAP do processo (não remove manuais — lotes são todos reimportados). */
export async function applyZapLotesSave(
  supabase: SupabaseServer,
  processoId: string,
  items: ZapLoteItem[],
): Promise<{ inserted: number }> {
  const { error: deleteError } = await supabase
    .from('listings_lotes')
    .delete()
    .eq('processo_id', processoId);

  if (deleteError) throw new Error(deleteError.message);

  if (items.length === 0) {
    return { inserted: 0 };
  }

  const payloads = items.map((i) => ({
    processo_id: processoId,
    condominio: i.condominio ?? null,
    area_lote_m2: i.area_lote_m2 ?? null,
    preco: i.preco ?? null,
    preco_m2: i.preco_m2 ?? null,
    link: i.link ?? null,
    valor_condominio: i.valor_condominio ?? null,
    iptu: i.iptu ?? null,
    caracteristicas_condominio: i.caracteristicas_condominio ?? null,
    caracteristicas: i.caracteristicas ?? null,
    manual: false,
  }));

  const { error: insertError } = await supabase.from('listings_lotes').insert(payloads);
  if (insertError) throw new Error(insertError.message);

  return { inserted: payloads.length };
}
