import { formatLocalYmd, parseIsoDateOnlyLocal } from '@/lib/dias-uteis';
import {
  addBusinessDays,
  DIAS_ALVARA_APOS_PREFEITURA,
} from '@/lib/kanban/previsibilidade-operacoes';
import { parsePreObraDataParaIso } from '@/lib/pre-obra/credito-obra-envio-data';

/** Emissão do alvará = aprovação na prefeitura + 3 dias úteis (seg–sex, sem feriados). */
export function calcularDataEmissaoAlvara(
  dataAprovacaoPrefeitura: string | null | undefined,
): string | null {
  const iso = parsePreObraDataParaIso(dataAprovacaoPrefeitura);
  const base = parseIsoDateOnlyLocal(iso);
  if (!base) return null;
  return formatLocalYmd(addBusinessDays(base, DIAS_ALVARA_APOS_PREFEITURA));
}

export type PreObraComEmissaoAlvara = {
  previsao_aprovacao_prefeitura: string;
  previsao_emissao_alvara: string;
  data_aprovacao_prefeitura: string;
  data_emissao_alvara: string;
};

export function aplicarPrevisaoEmissaoAlvaraNoPreObra<T extends Pick<PreObraComEmissaoAlvara, 'previsao_aprovacao_prefeitura' | 'previsao_emissao_alvara'>>(
  draft: T,
): T {
  const calc = calcularDataEmissaoAlvara(draft.previsao_aprovacao_prefeitura);
  if (!calc) return draft;
  return { ...draft, previsao_emissao_alvara: calc };
}

export function aplicarDataEmissaoAlvaraNoPreObra<
  T extends Pick<PreObraComEmissaoAlvara, 'data_aprovacao_prefeitura' | 'data_emissao_alvara'>,
>(draft: T): T {
  const calc = calcularDataEmissaoAlvara(draft.data_aprovacao_prefeitura);
  if (!calc) return draft;
  return { ...draft, data_emissao_alvara: calc };
}
