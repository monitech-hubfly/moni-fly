import {
  formatIsoDateOnlyPtBr,
  formatLocalYmd,
  isDiaUtil,
  normalizarDataIsoYmd,
  parseIsoDateOnlyLocal,
} from '@/lib/dias-uteis';

const DIAS_ANTECEDENCIA_ENVIO_CREDITO_OBRA = 30;

/** Avança para o próximo dia útil (inclusive se a data já for útil). */
export function proximoDiaUtilInclusive(data: Date): Date {
  const cur = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  while (!isDiaUtil(cur)) {
    cur.setDate(cur.getDate() + 1);
  }
  return cur;
}

/** Converte texto de pré-obra (`YYYY-MM-DD` ou `dd/mm/aaaa`) para ISO local. */
export function parsePreObraDataParaIso(input: string | null | undefined): string | null {
  const iso = normalizarDataIsoYmd(input);
  if (iso) return iso;
  const m = String(input ?? '')
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const y = m[3];
  return `${y}-${mo}-${d}`;
}

/**
 * Data de envio para Crédito Obra: previsão de aprovação na prefeitura − 30 dias corridos,
 * ajustada para o próximo dia útil.
 */
export function calcularDataEnvioCreditoObra(
  previsaoAprovacaoPrefeitura: string | null | undefined,
): string | null {
  const iso = parsePreObraDataParaIso(previsaoAprovacaoPrefeitura);
  const base = parseIsoDateOnlyLocal(iso);
  if (!base) return null;

  const alvo = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  alvo.setDate(alvo.getDate() - DIAS_ANTECEDENCIA_ENVIO_CREDITO_OBRA);
  return formatLocalYmd(proximoDiaUtilInclusive(alvo));
}

export function formatDataEnvioCreditoObraExibicao(iso: string | null | undefined): string | null {
  return formatIsoDateOnlyPtBr(parsePreObraDataParaIso(iso) ?? iso);
}

export function hojeIsoLocal(): string {
  return formatLocalYmd(new Date());
}

/** `hoje >= dataEnvio` em comparação de calendário local. */
export function dataEnvioCreditoObraJaChegou(dataEnvioIso: string | null | undefined): boolean {
  const envio = parsePreObraDataParaIso(dataEnvioIso);
  if (!envio) return false;
  return hojeIsoLocal() >= envio;
}

export type PreObraComEnvioCredito = {
  previsao_aprovacao_prefeitura: string;
  previsao_liberacao_credito_obra: string;
};

export function aplicarDataEnvioCreditoObraNoPreObra<T extends PreObraComEnvioCredito>(draft: T): T {
  const calc = calcularDataEnvioCreditoObra(draft.previsao_aprovacao_prefeitura);
  if (!calc) return draft;
  return { ...draft, previsao_liberacao_credito_obra: calc };
}
