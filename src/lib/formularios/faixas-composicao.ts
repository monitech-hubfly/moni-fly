import type { FormularioCampoGrupoDef } from '@/types/formularios';

function moedaParaNumero(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '');
  if (!digitos) return null;
  return Number(digitos) / 100;
}

/** Um bloco de composição a cada R$ 1 milhão da faixa informada. */
export const PASSO_FAIXA_REAIS = 1_000_000;
export const MINIMO_CONDOMINIOS = 3;
export const MAX_FAIXAS_COMPOSICAO = 30;

export type FaixaMilhao = { de: string; ate: string };

export type StatusFaixaPreco =
  | { tipo: 'incompleta' }
  | { tipo: 'invertida' }
  | { tipo: 'ampla' }
  | { tipo: 'ok'; faixas: FaixaMilhao[] };

export function numeroParaMoeda(reais: number): string {
  return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ehTemaComposicao(def: FormularioCampoGrupoDef): boolean {
  return def.tipo === 'titulo' || def.key === 'composicao_media';
}

export function camposDaComposicao(defs: FormularioCampoGrupoDef[]): FormularioCampoGrupoDef[] {
  const inicio = defs.findIndex(ehTemaComposicao);
  if (inicio < 0) return [];
  return defs.slice(inicio + 1).filter((def) => !ehTemaComposicao(def));
}

export function tituloDaComposicao(defs: FormularioCampoGrupoDef[]): string {
  const tema = defs.find(ehTemaComposicao);
  return tema?.label?.trim() || 'Composição média das casas nessa faixa';
}

export function statusDaFaixaPreco(deTexto: string, ateTexto: string): StatusFaixaPreco {
  const de = moedaParaNumero(deTexto);
  const ate = moedaParaNumero(ateTexto);
  if (de == null || ate == null) return { tipo: 'incompleta' };
  if (ate <= de) return { tipo: 'invertida' };
  const deCentavos = Math.round(de * 100);
  const ateCentavos = Math.round(ate * 100);
  const passo = PASSO_FAIXA_REAIS * 100;
  const quantidade = Math.ceil((ateCentavos - deCentavos) / passo);
  if (quantidade > MAX_FAIXAS_COMPOSICAO) return { tipo: 'ampla' };
  const faixas: FaixaMilhao[] = [];
  let cursor = deCentavos;
  while (cursor < ateCentavos) {
    const proximo = Math.min(cursor + passo, ateCentavos);
    faixas.push({
      de: numeroParaMoeda(cursor / 100),
      ate: numeroParaMoeda(proximo / 100),
    });
    cursor = proximo;
  }
  return { tipo: 'ok', faixas };
}

function ehFaixa(def: FormularioCampoGrupoDef): boolean {
  return def.tipo === 'faixa_moeda' || def.key === 'faixa_preco';
}

export function condominioCompleto(linha: Record<string, unknown>, defs: FormularioCampoGrupoDef[]): boolean {
  const campos = camposDaComposicao(defs);
  if (campos.length === 0) return false;
  if (!String(linha.nome ?? '').trim()) return false;
  const faixa = defs.find(ehFaixa);
  if (!faixa) return false;
  const de = String(linha[`${faixa.key}_de`] ?? linha[faixa.key] ?? '');
  const ate = String(linha[`${faixa.key}_ate`] ?? '');
  const status = statusDaFaixaPreco(de, ate);
  if (status.tipo !== 'ok') return false;
  const comps = Array.isArray(linha.composicoes) ? linha.composicoes : [];
  if (comps.length !== status.faixas.length) return false;
  return status.faixas.every((faixaItem, index) => {
    const comp = comps[index];
    if (!comp || typeof comp !== 'object') return false;
    const registro = comp as Record<string, unknown>;
    if (String(registro.faixa_de ?? '') !== faixaItem.de || String(registro.faixa_ate ?? '') !== faixaItem.ate) return false;
    return campos.every((def) => String(registro[def.key] ?? '').trim());
  });
}

export function pendenciaDoCondominio(linha: Record<string, unknown>, defs: FormularioCampoGrupoDef[]): string | null {
  const nome = defs.find((def) => def.key === 'nome');
  if (!String(linha.nome ?? '').trim()) return `Preencha: ${nome?.label?.trim() || 'Nome do condomínio'}`;
  const faixa = defs.find(ehFaixa);
  if (!faixa) return null;
  const de = String(linha[`${faixa.key}_de`] ?? linha[faixa.key] ?? '');
  const ate = String(linha[`${faixa.key}_ate`] ?? '');
  if (!de.trim() || !ate.trim()) return `Preencha: ${faixa.label}`;
  const status = statusDaFaixaPreco(de, ate);
  if (status.tipo === 'invertida') return 'O valor final da faixa de preço precisa ser maior que o inicial.';
  if (status.tipo === 'ampla') return 'A faixa de preço é ampla demais. Informe um intervalo menor.';
  if (status.tipo !== 'ok') return `Preencha: ${faixa.label}`;
  const comps = Array.isArray(linha.composicoes) ? linha.composicoes : [];
  for (let index = 0; index < status.faixas.length; index += 1) {
    const comp = comps[index];
    const registro = comp && typeof comp === 'object' ? (comp as Record<string, unknown>) : {};
    for (const def of camposDaComposicao(defs)) {
      if (!String(registro[def.key] ?? '').trim()) return `Preencha: ${def.label}`;
    }
  }
  return null;
}

function lembrarComposicoes(
  linha: Record<string, unknown>,
  linhaId: string,
  chaves: string[],
  memoria: Map<string, Record<string, string>>,
) {
  const atuais = Array.isArray(linha.composicoes) ? linha.composicoes : [];
  for (const item of atuais) {
    if (!item || typeof item !== 'object') continue;
    const comp = item as Record<string, unknown>;
    const de = String(comp.faixa_de ?? '');
    const ate = String(comp.faixa_ate ?? '');
    if (!de || !ate) continue;
    const salvo: Record<string, string> = {};
    for (const chave of chaves) salvo[chave] = String(comp[chave] ?? '');
    memoria.set(`${linhaId}|${de}|${ate}`, salvo);
  }
}

export function aplicarFaixaNaLinha(
  linha: Record<string, unknown>,
  key: string,
  de: string,
  ate: string,
  chavesComposicao: string[],
  memoria: Map<string, Record<string, string>>,
): Record<string, unknown> {
  const linhaId = typeof linha.linha_id === 'string' && linha.linha_id ? linha.linha_id : crypto.randomUUID();
  lembrarComposicoes(linha, linhaId, chavesComposicao, memoria);
  const next: Record<string, unknown> = {
    ...linha,
    linha_id: linhaId,
    [`${key}_de`]: de,
    [`${key}_ate`]: ate,
  };
  delete next[key];
  for (const chave of chavesComposicao) delete next[chave];
  const status = statusDaFaixaPreco(de, ate);
  if (status.tipo !== 'ok') {
    delete next.composicoes;
    return next;
  }
  next.composicoes = status.faixas.map((faixa) => {
    const salva = memoria.get(`${linhaId}|${faixa.de}|${faixa.ate}`) ?? {};
    const comp: Record<string, string> = { faixa_de: faixa.de, faixa_ate: faixa.ate };
    for (const chave of chavesComposicao) comp[chave] = salva[chave] ?? '';
    return comp;
  });
  return next;
}

export function aplicarCampoComposicao(
  linha: Record<string, unknown>,
  indexFaixa: number,
  chave: string,
  valorCampo: string,
  memoria: Map<string, Record<string, string>>,
): Record<string, unknown> {
  const comps = Array.isArray(linha.composicoes) ? [...(linha.composicoes as Record<string, string>[])] : [];
  const atual = { ...(comps[indexFaixa] ?? {}) };
  atual[chave] = valorCampo;
  comps[indexFaixa] = atual;
  const linhaId = typeof linha.linha_id === 'string' ? linha.linha_id : '';
  if (linhaId && atual.faixa_de && atual.faixa_ate) {
    const salva = { ...(memoria.get(`${linhaId}|${atual.faixa_de}|${atual.faixa_ate}`) ?? {}) };
    salva[chave] = valorCampo;
    memoria.set(`${linhaId}|${atual.faixa_de}|${atual.faixa_ate}`, salva);
  }
  return { ...linha, composicoes: comps };
}
