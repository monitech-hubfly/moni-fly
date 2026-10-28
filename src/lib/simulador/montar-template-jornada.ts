import type { TemplateConfig } from '@/lib/simulador/calcular-oferta';

/**
 * Fonte de template para o engine: RPC da jornada pública ou row do banco (Helenna).
 * Aceita os dois formatos de nome de campo.
 */
export type TemplateFonteEngine = {
  pct_itbi?: number | null;
  itbi_percentual?: number | null;
  pct_impostos?: number | null;
  pct_taxa_plataforma?: number | null;
  pct_taxa_gestao?: number | null;
  tipo_taxa_gestao?: string | null;
  taxa_gestao_valor?: number | null;
  percentual_plataforma_entrada?: number | null;
  pct_plataforma_entrada?: number | null;
  pct_lucro_loteadora?: number | null;
  pct_lucro_moni?: number | null;
  pct_lucro_franqueado?: number | null;
  pct_comissao_corretor?: number | null;
  prazo_obra_meses?: number | null;
  prazo_desembolso_sugerido?: number | null;
  taxa_juros_credito_ponte?: number | null;
  tipo_juros_cp?: string | null;
  perc_cp?: number | null;
  taxa_juros_parcelado_mes?: number | null;
  taxa_juros_financiamento_anual?: number | null;
  perc_entrada_minima?: number | null;
  perc_entrada_sugerida?: number | null;
  entrada_minima_loteadora?: { tipo?: string | null; valor?: number | null } | null;
  premissa_entrada_lote_nao_pago?: { tipo?: string | null; valor?: number | null } | null;
  premissa_entrada_lote_parcial?: { tipo?: string | null; valor?: number | null } | null;
};

function num(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Fração no banco (0.03). Valores ≥ 1 foram gravados como % (3). Ausente → 0. */
function fracaoOuZero(raw: unknown): number {
  const n = num(raw);
  if (n == null || n < 0) return 0;
  if (n >= 1) return n / 100;
  return n;
}

function tipoTaxaGestao(raw: unknown): 'percentual' | 'fixo' {
  return String(raw ?? '').trim().toLowerCase() === 'fixo' ? 'fixo' : 'percentual';
}

function tipoJurosCp(raw: unknown): 'mes_a_mes' | 'total' {
  return String(raw ?? '').trim().toLowerCase() === 'total' ? 'total' : 'mes_a_mes';
}

function montarEntradaMinima(
  tpl: TemplateFonteEngine,
): TemplateConfig['entrada_minima_loteadora'] {
  const json =
    tpl.entrada_minima_loteadora ??
    tpl.premissa_entrada_lote_nao_pago ??
    tpl.premissa_entrada_lote_parcial;
  if (json && typeof json === 'object') {
    const tipoRaw = String(json.tipo ?? '').trim().toLowerCase();
    if (tipoRaw === 'percentual' || tipoRaw === 'valor_fixo' || tipoRaw === 'fixo') {
      const tipo = tipoRaw === 'percentual' ? 'percentual' : 'fixo';
      return {
        tipo,
        valor: tipo === 'fixo' ? (num(json.valor) ?? 0) : fracaoOuZero(json.valor),
      };
    }
  }
  const perc = tpl.perc_entrada_minima ?? tpl.perc_entrada_sugerida;
  if (perc == null) return null;
  return { tipo: 'percentual', valor: fracaoOuZero(perc) };
}

/**
 * Única fonte de verdade: template (RPC ou banco) → objeto do `calcularOferta`.
 * Campo ausente/null/undefined → 0. Zero é valor válido (`??`, nunca `||`).
 */
export function montarTemplateParaEngine(
  tpl: TemplateFonteEngine | null | undefined,
): TemplateConfig {
  if (tpl == null) {
    return {
      percentual_itbi: 0,
      percentual_impostos: 0,
      percentual_taxa_plataforma: 0,
      percentual_taxa_gestao: 0,
      tipo_taxa_gestao: 'percentual',
      percentual_plataforma_entrada: 0,
      percentual_lucro_loteadora: 0,
      percentual_lucro_moni: 0,
      percentual_lucro_franqueado: 0,
      percentual_comissao_corretor: 0,
      prazo_obra_meses: 0,
      taxa_juros_credito_ponte: 0,
      tipo_juros_cp: 'mes_a_mes',
      taxa_juros_parcelado_mes: 0,
      taxa_juros_financiamento_anual: 0,
      entrada_minima_loteadora: null,
    };
  }

  const tipoGestao = tipoTaxaGestao(tpl.tipo_taxa_gestao);
  return {
    percentual_itbi: fracaoOuZero(tpl.pct_itbi ?? tpl.itbi_percentual),
    percentual_impostos: fracaoOuZero(tpl.pct_impostos),
    percentual_taxa_plataforma: fracaoOuZero(tpl.pct_taxa_plataforma),
    percentual_taxa_gestao:
      tipoGestao === 'fixo'
        ? (num(tpl.taxa_gestao_valor) ?? num(tpl.pct_taxa_gestao) ?? 0)
        : fracaoOuZero(tpl.pct_taxa_gestao),
    tipo_taxa_gestao: tipoGestao,
    percentual_plataforma_entrada: fracaoOuZero(
      tpl.percentual_plataforma_entrada ?? tpl.pct_plataforma_entrada,
    ),
    percentual_lucro_loteadora: fracaoOuZero(tpl.pct_lucro_loteadora),
    percentual_lucro_moni: fracaoOuZero(tpl.pct_lucro_moni),
    percentual_lucro_franqueado: fracaoOuZero(tpl.pct_lucro_franqueado),
    percentual_comissao_corretor: fracaoOuZero(tpl.pct_comissao_corretor),
    prazo_obra_meses: num(tpl.prazo_obra_meses) ?? num(tpl.prazo_desembolso_sugerido) ?? 0,
    taxa_juros_credito_ponte: fracaoOuZero(tpl.taxa_juros_credito_ponte ?? tpl.perc_cp),
    tipo_juros_cp: tipoJurosCp(tpl.tipo_juros_cp ?? 'mes_a_mes'),
    taxa_juros_parcelado_mes: fracaoOuZero(tpl.taxa_juros_parcelado_mes),
    taxa_juros_financiamento_anual: fracaoOuZero(tpl.taxa_juros_financiamento_anual),
    entrada_minima_loteadora: montarEntradaMinima(tpl),
  };
}
