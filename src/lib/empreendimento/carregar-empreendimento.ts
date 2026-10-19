// src/lib/empreendimento/carregar-empreendimento.ts
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
import { parsePlanilhaLotesBuffer } from '@/lib/simulador/parse-planilha-lotes';
import type {
  EmpreendimentoPublico,
  LotePublicoEmp,
  ItemCustomizacao,
  OfertaEmpreendimento,
  TemplateConfigPublico,
} from '@/app/empreendimento/[slug]/types';

const BUCKET = 'processo-docs';

type ClientLike = NonNullable<ReturnType<typeof tryCreateAdminClient>>;

function numOrNull(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseItem(raw: unknown): ItemCustomizacao | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  const nome = String(r.nome ?? '').trim();
  const categoria = String(r.categoria ?? '');
  if (!id || !nome) return null;
  if (categoria !== 'kit_moni' && categoria !== 'gadget') return null;
  return {
    id,
    categoria: categoria as 'kit_moni' | 'gadget',
    nome,
    descricao: r.descricao != null ? String(r.descricao) : null,
    valor: Number(r.valor ?? 0),
    ordem: Number(r.ordem ?? 0),
  };
}

function parseOferta(raw: unknown): OfertaEmpreendimento | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    nome: r.nome != null ? String(r.nome) : null,
    ordem: Number(r.ordem ?? 0),
    valor_avista: r.valor_avista != null ? Number(r.valor_avista) : null,
    valor_base_casa: r.valor_base_casa != null ? Number(r.valor_base_casa) : null,
    valor_acoplamento: r.valor_acoplamento != null ? Number(r.valor_acoplamento) : null,
    valor_lote_oferta: r.valor_lote_oferta != null ? Number(r.valor_lote_oferta) : null,
    valor_customizacao_oferta:
      r.valor_customizacao_oferta != null ? Number(r.valor_customizacao_oferta) : null,
    titulo_oferta: r.titulo_oferta != null ? String(r.titulo_oferta) : null,
    produto_modelo: r.produto_modelo != null ? String(r.produto_modelo) : null,
    descricao: r.descricao != null ? String(r.descricao) : null,
  };
}

function parseTemplate(raw: unknown): TemplateConfigPublico | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    link_token: String(r.link_token ?? ''),
    prazo_obra_meses: Number(r.prazo_obra_meses ?? 0),
    valor_lote_padrao: r.valor_lote_padrao != null ? Number(r.valor_lote_padrao) : null,
    taxa_juros_financiamento_anual:
      r.taxa_juros_financiamento_anual != null ? Number(r.taxa_juros_financiamento_anual) : null,
    taxa_juros_parcelado_mes:
      r.taxa_juros_parcelado_mes != null ? Number(r.taxa_juros_parcelado_mes) : null,
    perc_entrada_minima: r.perc_entrada_minima != null ? Number(r.perc_entrada_minima) : null,
    perc_entrada_sugerida: r.perc_entrada_sugerida != null ? Number(r.perc_entrada_sugerida) : null,
    perc_parcela_mensal: r.perc_parcela_mensal != null ? Number(r.perc_parcela_mensal) : null,
    perc_cp: r.perc_cp != null ? Number(r.perc_cp) : null,
    num_meses_cp: r.num_meses_cp != null ? Number(r.num_meses_cp) : null,
    itbi_percentual: r.itbi_percentual != null ? Number(r.itbi_percentual) : null,
    pct_taxa_plataforma: r.pct_taxa_plataforma != null ? Number(r.pct_taxa_plataforma) : null,
    pct_taxa_gestao: r.pct_taxa_gestao != null ? Number(r.pct_taxa_gestao) : null,
    tipo_taxa_gestao: r.tipo_taxa_gestao != null ? String(r.tipo_taxa_gestao) : null,
    taxa_gestao_valor: r.taxa_gestao_valor != null ? Number(r.taxa_gestao_valor) : null,
    tipo_juros_cp:
      r.tipo_juros_cp == null
        ? undefined
        : String(r.tipo_juros_cp).trim().toLowerCase() === 'total'
          ? 'total'
          : 'mes_a_mes',
    percentual_plataforma_entrada:
      r.percentual_plataforma_entrada != null
        ? Number(r.percentual_plataforma_entrada)
        : r.pct_plataforma_entrada != null
          ? Number(r.pct_plataforma_entrada)
          : null,
    pct_plataforma_entrada:
      r.pct_plataforma_entrada != null ? Number(r.pct_plataforma_entrada) : null,
    pct_impostos: r.pct_impostos != null ? Number(r.pct_impostos) : null,
    pct_comissao_corretor: r.pct_comissao_corretor != null ? Number(r.pct_comissao_corretor) : null,
    pct_lucro_loteadora: r.pct_lucro_loteadora != null ? Number(r.pct_lucro_loteadora) : null,
    pct_lucro_moni: r.pct_lucro_moni != null ? Number(r.pct_lucro_moni) : null,
    pct_lucro_franqueado: r.pct_lucro_franqueado != null ? Number(r.pct_lucro_franqueado) : null,
  };
}

function loteDimensoesVazias(): Pick<
  LotePublicoEmp,
  'frente_m' | 'fundo_m' | 'lateral1_m' | 'lateral2_m' | 'area_m2' | 'topografia'
> {
  return {
    frente_m: null,
    fundo_m: null,
    lateral1_m: null,
    lateral2_m: null,
    area_m2: null,
    topografia: null,
  };
}

async function carregarLotesDaPlanilha(
  planilhaPath: string,
  planilhaNome: string,
): Promise<LotePublicoEmp[]> {
  const supabase = await createClient();
  const admin = tryCreateAdminClient();

  const clients = [admin, supabase as unknown as typeof admin].filter(Boolean);

  for (const client of clients) {
    if (!client) continue;
    const { data, error } = await client.storage.from(BUCKET).download(planilhaPath);
    if (error || !data) continue;
    try {
      let buf: ArrayBuffer;
      if (data instanceof ArrayBuffer) {
        buf = data;
      } else if (typeof (data as Blob).arrayBuffer === 'function') {
        buf = await (data as Blob).arrayBuffer();
      } else {
        const view = new Uint8Array(await (data as Blob).arrayBuffer());
        buf = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
      }
      return parsePlanilhaLotesBuffer(buf, planilhaNome).map((l, i) => ({
        id: `planilha:${i}:${l.codigo}`,
        codigo: l.codigo,
        valor: l.valor,
        acoplamento: l.valorAcoplamento,
        ...loteDimensoesVazias(),
      }));
    } catch {
      // tenta o próximo client
    }
  }
  return [];
}

function jsonValorNumerico(raw: unknown): number | null {
  if (raw == null || typeof raw !== 'object') return null;
  return numOrNull((raw as { valor?: unknown }).valor);
}

/**
 * Completa o que a RPC pode omitir (migration 635) e o lote/customização da
 * oferta da Helenna, necessários para o preview ao vivo do step 2.
 */
async function enriquecerOfertasETemplate(
  cardId: string,
  ofertas: OfertaEmpreendimento[],
  template: TemplateConfigPublico | null,
): Promise<{ ofertas: OfertaEmpreendimento[]; template: TemplateConfigPublico | null }> {
  const admin = tryCreateAdminClient();
  const supabase = (await createClient()) as unknown as ClientLike;
  const client: ClientLike = admin ?? supabase;

  if (!admin) {
    console.error(
      '[empreendimento] service role indisponível — preview da oferta pode ficar sem lote da Helenna',
    );
  }

  const { data: imobRows, error: imobErr } = await client
    .from('imob_card_empreendimentos')
    .select('id, valor_base_casa, valor_acoplamento, simulacao_pagamento_id')
    .eq('card_id', cardId);

  if (imobErr) {
    console.error('[empreendimento] enriquecer ofertas IMOB:', imobErr.message);
  }

  const imobById = new Map<
    string,
    {
      valor_base_casa: number | null;
      valor_acoplamento: number | null;
      simulacao_pagamento_id: string | null;
    }
  >();
  const simIds: string[] = [];
  for (const row of (imobRows ?? []) as Record<string, unknown>[]) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    const simId =
      row.simulacao_pagamento_id != null ? String(row.simulacao_pagamento_id).trim() : '';
    imobById.set(id, {
      valor_base_casa: numOrNull(row.valor_base_casa),
      valor_acoplamento: numOrNull(row.valor_acoplamento),
      simulacao_pagamento_id: simId || null,
    });
    if (simId) simIds.push(simId);
  }

  const simById = new Map<
    string,
    { valor_lote: number | null; valor_customizacao: number | null; valor_acoplamento: number | null }
  >();
  if (simIds.length > 0) {
    const { data: simRows, error: simErr } = await client
      .from('simulacoes_pagamento')
      .select('id, valor_lote, valor_customizacao, valor_acoplamento')
      .in('id', simIds);
    if (simErr) {
      console.error('[empreendimento] enriquecer ofertas simulação:', simErr.message);
    } else {
      for (const row of (simRows ?? []) as Record<string, unknown>[]) {
        const id = String(row.id ?? '').trim();
        if (!id) continue;
        simById.set(id, {
          valor_lote: numOrNull(row.valor_lote),
          valor_customizacao: numOrNull(row.valor_customizacao),
          valor_acoplamento: numOrNull(row.valor_acoplamento),
        });
      }
    }
  }

  const ofertasEnriquecidas = ofertas.map((o) => {
    const imob = imobById.get(o.id);
    const sim = imob?.simulacao_pagamento_id
      ? simById.get(imob.simulacao_pagamento_id)
      : undefined;
    const baseRpc = o.valor_base_casa;
    const baseImob = imob?.valor_base_casa ?? null;
    const valor_base_casa =
      baseRpc != null && Number.isFinite(baseRpc) && baseRpc > 0
        ? baseRpc
        : baseImob != null && Number.isFinite(baseImob)
          ? baseImob
          : baseRpc;
    return {
      ...o,
      valor_base_casa,
      valor_acoplamento:
        o.valor_acoplamento ?? imob?.valor_acoplamento ?? sim?.valor_acoplamento ?? null,
      valor_lote_oferta: sim?.valor_lote ?? o.valor_lote_oferta,
      valor_customizacao_oferta: sim?.valor_customizacao ?? o.valor_customizacao_oferta,
    };
  });

  let templateEnriquecido = template;
  const templateIncompleto = template == null || template.pct_impostos == null;
  if (templateIncompleto) {
    const { data: tplRow, error: tplErr } = await client
      .from('loteamento_simulador_templates')
      .select('*')
      .eq('kanban_card_id', cardId)
      .maybeSingle();
    if (tplErr) {
      console.error('[empreendimento] enriquecer template:', tplErr.message);
    } else if (tplRow) {
      const r = tplRow as Record<string, unknown>;
      const parsed = parseTemplate({
        ...r,
        perc_entrada_minima: jsonValorNumerico(r.entrada_minima_loteadora),
        perc_entrada_sugerida: jsonValorNumerico(r.premissa_entrada_lote_parcial),
        perc_parcela_mensal: jsonValorNumerico(r.premissa_entrada_lote_nao_pago),
        perc_cp: r.taxa_juros_credito_ponte,
        num_meses_cp: r.prazo_desembolso_sugerido,
        itbi_percentual: r.pct_itbi ?? r.itbi_percentual,
      });
      if (parsed) {
        if (!template) {
          templateEnriquecido = parsed;
        } else {
          const rpcPreenchido = Object.fromEntries(
            Object.entries(template).filter(([, v]) => v != null && v !== ''),
          ) as Partial<TemplateConfigPublico>;
          templateEnriquecido = {
            ...parsed,
            ...rpcPreenchido,
            pct_impostos: template.pct_impostos ?? parsed.pct_impostos,
            pct_comissao_corretor: template.pct_comissao_corretor ?? parsed.pct_comissao_corretor,
            pct_lucro_loteadora: template.pct_lucro_loteadora ?? parsed.pct_lucro_loteadora,
            pct_lucro_moni: template.pct_lucro_moni ?? parsed.pct_lucro_moni,
            pct_lucro_franqueado: template.pct_lucro_franqueado ?? parsed.pct_lucro_franqueado,
            pct_taxa_plataforma: template.pct_taxa_plataforma ?? parsed.pct_taxa_plataforma,
            pct_taxa_gestao: template.pct_taxa_gestao ?? parsed.pct_taxa_gestao,
            tipo_taxa_gestao: template.tipo_taxa_gestao ?? parsed.tipo_taxa_gestao,
            taxa_gestao_valor: template.taxa_gestao_valor ?? parsed.taxa_gestao_valor,
            percentual_plataforma_entrada:
              template.percentual_plataforma_entrada ?? parsed.percentual_plataforma_entrada,
            pct_plataforma_entrada:
              template.pct_plataforma_entrada ?? parsed.pct_plataforma_entrada,
            tipo_juros_cp: template.tipo_juros_cp ?? parsed.tipo_juros_cp,
          };
        }
      }
    }
  }

  return { ofertas: ofertasEnriquecidas, template: templateEnriquecido };
}

export async function carregarEmpreendimento(
  slug: string,
): Promise<EmpreendimentoPublico | null> {
  const s = String(slug ?? '').trim();
  if (!s) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('empreendimento_publico_carregar', { p_slug: s });

  if (error) {
    console.error('[empreendimento] empreendimento_publico_carregar:', error.message);
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;
  const card_id = String(raw.card_id ?? '').trim();
  if (!card_id) return null;

  const itens_customizacao = Array.isArray(raw.itens_customizacao)
    ? raw.itens_customizacao.map(parseItem).filter((i): i is ItemCustomizacao => i != null)
    : [];
  const ofertasRpc = Array.isArray(raw.ofertas)
    ? raw.ofertas.map(parseOferta).filter((o): o is OfertaEmpreendimento => o != null)
    : [];

  const planilhaPath = raw.planilha_lotes_path != null ? String(raw.planilha_lotes_path) : null;
  const planilhaNome = raw.planilha_lotes_nome != null ? String(raw.planilha_lotes_nome) : 'planilha.xlsx';
  const [lotes, enriquecido] = await Promise.all([
    planilhaPath ? carregarLotesDaPlanilha(planilhaPath, planilhaNome) : Promise.resolve([]),
    enriquecerOfertasETemplate(card_id, ofertasRpc, parseTemplate(raw.template)),
  ]);

  return {
    card_id,
    slug: String(raw.slug ?? s),
    titulo: String(raw.titulo ?? ''),
    descricao: raw.descricao != null ? String(raw.descricao) : null,
    status_imovel: raw.status_imovel != null ? String(raw.status_imovel) : null,
    imagem_principal_path:
      raw.imagem_principal_path != null ? String(raw.imagem_principal_path) : null,
    planilha_lotes_path: planilhaPath,
    planilha_lotes_nome: planilhaNome,
    template: enriquecido.template,
    itens_customizacao,
    ofertas: enriquecido.ofertas,
    lotes,
  };
}
