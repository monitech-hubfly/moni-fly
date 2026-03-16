'use server';

import { createClient } from '@/lib/supabase/server';

/** Resumo no formato da Etapa 11 para exibir na apresentação do Comitê */
export type ResumoComite = {
  cidade: string;
  estado: string | null;
  narrativa: string;
  lote: {
    condominio: string | null;
    area_lote_m2: number | null;
    preco: number | null;
    preco_m2: number | null;
  } | null;
  ranking: { posicao: number; nome: string; media: number; justificativa?: string }[];
  bcaOpcoes: { titulo: string; descricao?: string }[];
};

export type ComiteData = {
  processoId: string;
  processoCidade: string | null;
  processoEstado: string | null;
  /** Ordem pré-cetada: 1 Prospecção Cidade, 2 Score Batalha, 3 Resumo Hipóteses */
  pdfUrlProspeccao: string | null;
  pdfUrlScoreBatalha: string | null;
  resumo: ResumoComite | null;
};

/**
 * Busca todos os dados para a apresentação do Comitê, na ordem pré-definida.
 * @param ownerUserId - quando a página é vista por Moní, passar processo.user_id para carregar os PDFs do franqueado
 */
export async function getComiteData(
  processoId: string,
  ownerUserId?: string,
): Promise<ComiteData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: processo } = await supabase
    .from('processo_step_one')
    .select('id, cidade, estado, pdf_url_etapa1, user_id')
    .eq('id', processoId)
    .single();

  if (!processo) return null;

  const userIdForEtapas = ownerUserId ?? user.id;

  const pdfUrlProspeccao = processo.pdf_url_etapa1 ?? null;

  const { data: ep6 } = await supabase
    .from('etapa_progresso')
    .select('dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 6)
    .eq('user_id', userIdForEtapas)
    .maybeSingle();

  const pdfUrlScoreBatalha = (ep6?.dados_json as { pdf_url?: string } | null)?.pdf_url ?? null;

  const { data: ep1 } = await supabase
    .from('etapa_progresso')
    .select('dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 1)
    .eq('user_id', userIdForEtapas)
    .single();

  const { data: le } = await supabase
    .from('lote_escolhido')
    .select('condominio, area_lote_m2, preco, preco_m2')
    .eq('processo_id', processoId)
    .maybeSingle();

  const { data: batList } = await supabase
    .from('batalhas')
    .select('listing_casa_id, catalogo_casa_id, nota_preco, nota_produto, nota_localizacao')
    .eq('processo_id', processoId);

  const { data: ceList } = await supabase
    .from('catalogo_escolhidos')
    .select('catalogo_casa_id, ordem')
    .eq('processo_id', processoId)
    .order('ordem', { ascending: true });

  const { data: catList } = await supabase
    .from('catalogo_casas')
    .select('id, nome')
    .eq('ativo', true);

  const { data: ep9 } = await supabase
    .from('etapa_progresso')
    .select('dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 9)
    .eq('user_id', userIdForEtapas)
    .single();

  const { data: ep10 } = await supabase
    .from('etapa_progresso')
    .select('dados_json')
    .eq('processo_id', processoId)
    .eq('etapa_id', 10)
    .eq('user_id', userIdForEtapas)
    .single();

  const narrativa = (ep1?.dados_json as { narrativa?: string } | null)?.narrativa ?? '';
  const justificativas11 =
    (ep9?.dados_json as { justificativas?: Record<string, string> } | null)?.justificativas ?? {};
  const opcoes10 =
    (ep10?.dados_json as { opcoes?: { titulo: string; descricao?: string }[] } | null)?.opcoes ??
    [];
  const batalhas11 = batList ?? [];
  const ce11 = ceList ?? [];
  const cat11 = catList ?? [];

  const ids = [...ce11]
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((ce) => ce.catalogo_casa_id);
  const rankingRows = ids.map((catalogoId) => {
    const rows = batalhas11.filter((b) => b.catalogo_casa_id === catalogoId);
    let sum = 0;
    for (const r of rows) {
      sum += (r.nota_preco ?? 0) + (r.nota_produto ?? 0) + (r.nota_localizacao ?? 0);
    }
    const media = rows.length > 0 ? sum / rows.length : 0;
    const casa = cat11.find((c) => c.id === catalogoId);
    return { catalogo_casa_id: catalogoId, nome: casa?.nome ?? '—', media };
  });
  rankingRows.sort((a, b) => b.media - a.media);
  const ranking = rankingRows.map((r, i) => ({
    posicao: i + 1,
    nome: r.nome,
    media: r.media,
    justificativa: justificativas11[r.catalogo_casa_id],
  }));

  const resumo: ResumoComite = {
    cidade: processo.cidade ?? '',
    estado: processo.estado ?? null,
    narrativa,
    lote: le
      ? {
          condominio: le.condominio,
          area_lote_m2: le.area_lote_m2,
          preco: le.preco,
          preco_m2: le.preco_m2,
        }
      : null,
    ranking,
    bcaOpcoes: opcoes10.map((o) => ({ titulo: o.titulo, descricao: o.descricao })),
  };

  return {
    processoId: processo.id,
    processoCidade: processo.cidade ?? null,
    processoEstado: processo.estado ?? null,
    pdfUrlProspeccao,
    pdfUrlScoreBatalha,
    resumo,
  };
}
