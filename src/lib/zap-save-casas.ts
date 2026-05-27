import { mapZapItemToCasa, type ZapListingItem } from '@/lib/apify-zap';
import { createClient } from '@/lib/supabase/server';

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export async function verifyProcessoCasasAccess(
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

/**
 * Aplica atualização ZAP na listagem de casas (upsert por link + despublicar ausentes).
 * Não altera registros manuais.
 */
export async function applyZapCasasUpdate(
  supabase: SupabaseServer,
  processoId: string,
  items: ZapListingItem[],
  cidade: string,
  estado: string,
): Promise<{ inserted: number; updated: number; despublicados: number }> {
  const cidadeNorm = cidade.trim();
  const estadoNorm = estado.trim().slice(0, 2).toUpperCase();
  const rows = (items ?? [])
    .filter((i) => i?.url)
    .map((i) => mapZapItemToCasa(i as ZapListingItem, cidadeNorm, estadoNorm))
    .filter((r) => r.link);

  const linksFromZap = new Set(rows.map((r) => r.link as string));

  const { data: existing } = await supabase
    .from('listings_casas')
    .select('id, link, manual')
    .eq('processo_id', processoId);

  let despublicados = 0;
  const now = new Date().toISOString().slice(0, 10);
  for (const row of existing ?? []) {
    if (row.manual) continue;
    const link = row.link as string | null;
    if (!link || linksFromZap.has(link)) continue;
    const { error: upErr } = await supabase
      .from('listings_casas')
      .update({ status: 'despublicado', data_despublicado: now })
      .eq('id', row.id);
    if (!upErr) despublicados++;
  }

  const existingByLink = new Map<string | null, { id: string }>();
  for (const row of existing ?? []) {
    if (row.manual) continue;
    if (row.link) existingByLink.set(row.link, { id: row.id });
  }

  let inserted = 0;
  let updated = 0;
  for (const r of rows) {
    const payload = {
      processo_id: processoId,
      manual: false,
      cidade: r.cidade,
      estado: r.estado,
      status: 'a_venda' as const,
      condominio: r.condominio,
      localizacao_condominio: r.localizacao_condominio,
      quartos: r.quartos,
      banheiros: r.banheiros,
      vagas: r.vagas,
      piscina: r.piscina,
      marcenaria: r.marcenaria,
      preco: r.preco,
      area_casa_m2: r.area_casa_m2,
      preco_m2: r.preco_m2,
      link: r.link,
      foto_url: r.foto_url,
      data_publicacao: r.data_publicacao,
    };
    const existingRow = r.link ? existingByLink.get(r.link) : null;
    if (existingRow) {
      const { error: upErr } = await supabase
        .from('listings_casas')
        .update({ ...payload, data_despublicado: null })
        .eq('id', existingRow.id);
      if (!upErr) updated++;
    } else {
      const { error: insErr } = await supabase.from('listings_casas').insert(payload);
      if (!insErr) inserted++;
    }
  }

  return { inserted, updated, despublicados };
}
