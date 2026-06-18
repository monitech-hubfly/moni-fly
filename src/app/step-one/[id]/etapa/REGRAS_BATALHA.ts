/**
 * Regras consolidadas da Batalha de Casas (documento Cursor).
 * Ordem de desempate: Atributos do Lote > Preço > Produto.
 * Nota final = Atributos do Lote + Preço + Produto (soma; cada critério -3 a +2).
 */

import {
  LOTES_DISPONIVEIS_CHECKBOXES,
  type LinhaLoteDisponivel,
} from '@/lib/kanban/lotes-disponiveis-condominio';
import type { FaixaMercado } from '@/lib/kanban/mapa-competidores-condominio';

export const ATRIBUTOS_LOTE = [
  { id: 'vista', label: 'Vista privilegiada', nota: 2 },
  { id: 'plano', label: 'Terreno plano', nota: 0 },
  { id: 'aclive', label: 'Terreno aclive', nota: 0 },
  { id: 'declive', label: 'Terreno declive', nota: 0 },
  { id: 'fundo_mata', label: 'Fundo de mata', nota: 2 },
  { id: 'frente_mata', label: 'Frente de mata', nota: 2 },
  { id: 'area_verde', label: 'Perto de área verde', nota: 1 },
  { id: 'perto_lago', label: 'Perto do lago', nota: 1 },
  { id: 'fundo_lago', label: 'Fundo de lago', nota: 2 },
  { id: 'frente_lago', label: 'Frente de lago', nota: 2 },
  { id: 'area_convivencia', label: 'Perto de área de convivência', nota: 1 },
  { id: 'lixeira', label: 'Perto de lixeira', nota: -2 },
  { id: 'portaria', label: 'Perto de portaria', nota: 0 },
  { id: 'muro_rodovia', label: 'Muro com rodovia', nota: -2 },
  { id: 'muro_comunidade', label: 'Muro com comunidade', nota: -2 },
  { id: 'muro_vegetacao', label: 'Muro com vegetação', nota: -1 },
] as const;

export type AtributosLoteIds = (typeof ATRIBUTOS_LOTE)[number]['id'];

export type AtributosLoteRespostas = {
  [K in (typeof ATRIBUTOS_LOTE)[number]['id']]?: boolean;
};

/** Converte lote da fase Lotes Disponíveis → respostas para `notaAtributosLote()` (ids = ATRIBUTOS_LOTE). */
export function atributosRespostasFromLoteDisponivel(lote: LinhaLoteDisponivel): AtributosLoteRespostas {
  const out: AtributosLoteRespostas = {};
  for (const { chave } of LOTES_DISPONIVEIS_CHECKBOXES) {
    if (lote[chave] === 'true') out[chave] = true;
  }
  return out;
}

const ATRIBUTOS_LOTE_IDS = new Set<string>(ATRIBUTOS_LOTE.map((a) => a.id));

/** Lê `atributos_lote_json` persistido; descarta chaves desconhecidas e legado `muro`. */
export function parseAtributosLoteRespostas(raw: unknown): AtributosLoteRespostas {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: AtributosLoteRespostas = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key === 'muro') {
      // TODO: migrar respostas legadas de muro
      continue;
    }
    if (!ATRIBUTOS_LOTE_IDS.has(key) || val !== true) continue;
    out[key as AtributosLoteIds] = true;
  }
  return out;
}

export function notaAtributosLote(respostas: AtributosLoteRespostas): number {
  let sum = 0;
  for (const a of ATRIBUTOS_LOTE) {
    if (respostas[a.id]) sum += a.nota;
  }
  return clampNota(sum);
}

/** Campo booleano em `catalogo_casas` correspondente a cada id de ATRIBUTOS_LOTE. */
export const MAP_ATRIBUTO_LOTE_CATALOGO = {
  vista: 'attr_vista_privilegiada',
  plano: 'attr_terreno_plano',
  aclive: 'attr_terreno_aclive',
  declive: 'attr_terreno_declive',
  fundo_mata: 'attr_fundo_mata',
  frente_mata: 'attr_frente_mata',
  area_verde: 'attr_area_verde',
  perto_lago: 'attr_perto_lago',
  fundo_lago: 'attr_fundo_lago',
  frente_lago: 'attr_frente_lago',
  area_convivencia: 'attr_area_convivencia',
  lixeira: 'attr_perto_lixeira',
  portaria: 'attr_perto_portaria',
  muro_rodovia: 'attr_muro_rodovia',
  muro_comunidade: 'attr_muro_comunidade',
  muro_vegetacao: 'attr_muro_vegetacao',
} as const satisfies Record<AtributosLoteIds, string>;

export type CatalogoAttrCampo = (typeof MAP_ATRIBUTO_LOTE_CATALOGO)[AtributosLoteIds];

export type CatalogoComAtributosLote = Partial<Record<CatalogoAttrCampo, boolean | null>>;

/** Colunas attr_* para SELECT em `catalogo_casas`. */
export const CATALOGO_CASAS_SELECT_ATTRS = Object.values(MAP_ATRIBUTO_LOTE_CATALOGO).join(', ');

/** SELECT completo do catálogo para ranking Pré Batalha (inclui attr_* + flexível). */
export const CATALOGO_CASAS_SELECT_PRE_BATALHA =
  'id, nome, quartos, suites, banheiros, vagas, andares, rooftop, quartos_flexivel, suites_flexivel, banheiros_flexivel, assinatura, preco_custo, preco_custo_m2, preco_venda_m2, area_m2, preco_venda, topografia, dimensao_x_m, dimensao_y_m, area_perimetro_m2, ' +
  CATALOGO_CASAS_SELECT_ATTRS;

export const OBS_FLEXIVEL_QUARTOS = '1 quarto adicional necessário para competir';
export const OBS_FLEXIVEL_SUITES = '1 suíte adicional necessária para competir';
export const OBS_FLEXIVEL_BANHEIROS = '1 banheiro adicional necessário para competir';

export function contarAtributosLoteMarcados(atributosLote: AtributosLoteRespostas): number {
  return ATRIBUTOS_LOTE.reduce((n, a) => n + (atributosLote[a.id] === true ? 1 : 0), 0);
}

/** Quantidade de atributos do lote (true) que a casa também possui no catálogo. */
export function calcularMatchScoreAtributosLote(
  atributosLote: AtributosLoteRespostas,
  catalogo: CatalogoComAtributosLote,
): number {
  let score = 0;
  for (const a of ATRIBUTOS_LOTE) {
    if (atributosLote[a.id] !== true) continue;
    const campo = MAP_ATRIBUTO_LOTE_CATALOGO[a.id];
    if (catalogo[campo] === true) score += 1;
  }
  return score;
}

/** Faixas percentuais para critério Preço (Distância Nominal e Preço Nominal): -3 a +2 */
export function notaPrecoPorPercentual(diffPerc: number): number {
  if (diffPerc <= -0.5) return -3;
  if (diffPerc <= -0.2) return -2;
  if (diffPerc <= -0.01) return -1;
  if (diffPerc < 0.01) return 0;
  if (diffPerc < 0.2) return 1;
  return 2;
}

/** Checklist de reforma: 8 categorias (valor em R$, dificuldade, incerteza) */
export const CATEGORIAS_REFORMA = [
  {
    id: 'A',
    nome: 'Estrutura e Fundação',
    valor: 65000,
    dificuldade: 'dificil' as const,
    incerteza: 'alta' as const,
  },
  {
    id: 'B',
    nome: 'Impermeabilização e Infiltração',
    valor: 18000,
    dificuldade: 'dificil',
    incerteza: 'alta',
  },
  { id: 'C', nome: 'Instalações', valor: 28000, dificuldade: 'dificil', incerteza: 'alta' },
  { id: 'D', nome: 'Cobertura', valor: 14000, dificuldade: 'intermediario', incerteza: 'alta' },
  {
    id: 'E',
    nome: 'Revestimentos e Esquadrias',
    valor: 22000,
    dificuldade: 'intermediario',
    incerteza: 'normal',
  },
  {
    id: 'F',
    nome: 'Cozinha e Banheiros',
    valor: 15000,
    dificuldade: 'intermediario',
    incerteza: 'normal',
  },
  {
    id: 'G',
    nome: 'Fachada e Áreas Externas',
    valor: 25000,
    dificuldade: 'intermediario',
    incerteza: 'alta',
  },
  { id: 'H', nome: 'Acabamentos Leves', valor: 6000, dificuldade: 'facil', incerteza: 'normal' },
] as const;

export type Dificuldade = 'facil' | 'intermediario' | 'dificil';
export type Incerteza = 'normal' | 'alta';

export type CategoriaReformaMarcada = { marked: boolean; valor?: number };
export type ChecklistReforma = Partial<Record<string, CategoriaReformaMarcada>>;

/** Esforço (0 a +2) conforme combinação de dificuldades marcadas */
export function notaEsforco(checklist: ChecklistReforma): number {
  const marcadas = CATEGORIAS_REFORMA.filter((c) => checklist[c.id]?.marked);
  if (marcadas.length === 0) return 2;
  if (marcadas.length === CATEGORIAS_REFORMA.length) return 2;
  const temFacil = marcadas.some((c) => c.dificuldade === 'facil');
  const temIntermediario = marcadas.some((c) => c.dificuldade === 'intermediario');
  const temDificil = marcadas.some((c) => c.dificuldade === 'dificil');
  if (temFacil && !temIntermediario && !temDificil) return 1;
  if (temDificil && temIntermediario && !temFacil) return 1;
  if (temIntermediario && temFacil) return 0;
  return 0;
}

/** Incerteza do Preço (-3 a +2) conforme categorias marcadas (alta vs normal) */
export function notaIncertezaPreco(checklist: ChecklistReforma): number {
  const marcadas = CATEGORIAS_REFORMA.filter((c) => checklist[c.id]?.marked);
  if (marcadas.length === 0) return -3;
  const comAlta = marcadas.filter((c) => c.incerteza === 'alta').length;
  const comNormal = marcadas.filter((c) => c.incerteza === 'normal').length;
  if (comNormal > 0 && comAlta === 0) return -2;
  if (comAlta > 0 && comNormal === 0) return 1;
  if (marcadas.length === CATEGORIAS_REFORMA.length) return 2;
  if (comNormal > comAlta) return -1;
  return 0; // mix maioria alta
}

export function valorInvestimento(checklist: ChecklistReforma): number {
  let sum = 0;
  for (const c of CATEGORIAS_REFORMA) {
    const m = checklist[c.id];
    if (m?.marked) sum += m?.valor ?? c.valor;
  }
  return sum;
}

export type CatalogoPrecoRef = {
  preco_custo?: number | null;
  preco_custo_m2?: number | null;
  preco_venda?: number | null;
  preco_venda_m2?: number | null;
  area_m2?: number | null;
};

/** Preço de incorporação (preco_custo ou preco_custo_m2 × área). */
export function getValorPrecoCusto(cat: CatalogoPrecoRef): number | null {
  if (cat.preco_custo != null && Number.isFinite(cat.preco_custo)) return cat.preco_custo;
  if (cat.preco_custo_m2 != null && cat.area_m2 != null && cat.area_m2 > 0)
    return cat.preco_custo_m2 * cat.area_m2;
  return null;
}

/** Valor de venda do catálogo (preco_venda ou preco_venda_m2 × área). */
export function getValorNossaCatalogo(cat: CatalogoPrecoRef): number | null {
  if (cat.preco_venda != null && Number.isFinite(cat.preco_venda)) return cat.preco_venda;
  if (cat.preco_venda_m2 != null && cat.area_m2 != null && cat.area_m2 > 0)
    return cat.preco_venda_m2 * cat.area_m2;
  return null;
}

/**
 * Preço Moní Pré Batalha: incorporação (preco_custo) + kit Moní (preco_venda − preco_custo).
 * Se só houver preco_venda, usa o VGV do catálogo.
 */
export function getPrecoIncMaisKitMoni(cat: CatalogoPrecoRef): number | null {
  const inc = getValorPrecoCusto(cat);
  const venda = getValorNossaCatalogo(cat);
  if (inc != null && inc > 0 && venda != null && venda > 0) {
    return inc + Math.max(0, venda - inc);
  }
  if (venda != null && venda > 0) return venda;
  if (inc != null && inc > 0) return inc;
  return null;
}

/** Nota Preço Pré Batalha: compara VGV Moní (INC + Kit) vs. preço do anúncio ZAP. */
export function notaPrecoPreBatalhaContraAnuncio(
  valorMoniIncKit: number | null,
  valorListing: number | null,
): number {
  if (valorMoniIncKit == null || valorMoniIncKit <= 0 || valorListing == null || valorListing <= 0) {
    return 0;
  }
  const diffPerc = (valorListing - valorMoniIncKit) / valorMoniIncKit;
  return notaPrecoPorPercentual(diffPerc);
}

/** Valor de referência para D (distância): custo de construção se preenchido, senão catálogo. */
export function getValorNossaDistancia(
  cat: CatalogoPrecoRef,
  custoConstrucao?: number | null,
): number | null {
  if (custoConstrucao != null && Number.isFinite(custoConstrucao) && custoConstrucao > 0)
    return custoConstrucao;
  return getValorNossaCatalogo(cat);
}

export type PrecoSubNotasCalc = {
  D: number;
  E: number;
  I: number;
  P: number;
  nota: number;
};

/** Nota Preço com checklist; P usa preço de venda do catálogo, D usa custo ou catálogo. */
export function calcularNotaPrecoComChecklist(
  cat: CatalogoPrecoRef,
  checklist: ChecklistReforma,
  valorListing: number,
  custoConstrucao?: number | null,
): PrecoSubNotasCalc | null {
  const valorDist = getValorNossaDistancia(cat, custoConstrucao);
  const valorNom = getValorNossaCatalogo(cat);
  if (valorDist == null || valorDist <= 0 || valorNom == null || valorNom <= 0) return null;
  const inv = valorInvestimento(checklist);
  const totalComparativo = valorListing + inv;
  const diffPercDist = (totalComparativo - valorDist) / valorDist;
  const diffPercNominal = (valorListing - valorNom) / valorNom;
  const D = notaPrecoPorPercentual(diffPercDist);
  const P = notaPrecoPorPercentual(diffPercNominal);
  const E = notaEsforco(checklist);
  const I = notaIncertezaPreco(checklist);
  return { D, E, I, P, nota: notaPrecoPonderada(D, E, I, P) };
}

export const CHECKLIST_LABEL_CUSTO_CONSTRUCAO_PREFIX = 'Custo de construção — Casa ';

export function labelCustoConstrucaoEscolha(ordem: number): string {
  return `${CHECKLIST_LABEL_CUSTO_CONSTRUCAO_PREFIX}${ordem}`;
}

export function parseOrdemCustoConstrucaoEscolha(label: string): number | null {
  const m = label.match(/^Custo de construção — Casa (\d)$/);
  return m ? Number(m[1]) : null;
}

/** Pesos dos 4 sub-itens de Preço: D=4, E=3, I=2, P=1. Nota = (D*4+E*3+I*2+P*1)/10 */
export const PESOS_PRECO = { distancia: 4, esforco: 3, incerteza: 2, preco_nominal: 1 } as const;
const TOTAL_PESO_PRECO =
  PESOS_PRECO.distancia + PESOS_PRECO.esforco + PESOS_PRECO.incerteza + PESOS_PRECO.preco_nominal;

export function notaPrecoPonderada(
  distancia: number,
  esforco: number,
  incerteza: number,
  precoNominal: number,
): number {
  const v =
    (distancia * PESOS_PRECO.distancia +
      esforco * PESOS_PRECO.esforco +
      incerteza * PESOS_PRECO.incerteza +
      precoNominal * PESOS_PRECO.preco_nominal) /
    TOTAL_PESO_PRECO;
  return clampNota(Math.round(v * 10) / 10);
}

/** Módulo opcional de anexo (m²) — sugerido quando anúncio é maior que o modelo Moní. */
export const M2_POR_MODULO_ANEXO = 20;

export interface NotaTamanhoResult {
  nota: number;
  sugestaoAnexo?: {
    anexosNecessarios: number;
    m2Anexo: number;
    areaMoniComAnexo: number;
    penalizacaoEliminada: boolean;
  };
}

export function calcularNotaTamanho(areaAnuncio: number, areaMoni: number): NotaTamanhoResult {
  const diffPct = (areaAnuncio - areaMoni) / areaMoni;

  let nota: number;
  if (diffPct >= 0.5) nota = -3;
  else if (diffPct >= 0.2) nota = -2;
  else if (diffPct >= 0.01) nota = -1;
  else if (diffPct >= -0.2) nota = 0;
  else if (diffPct >= -0.5) nota = 1;
  else nota = 2;

  let sugestaoAnexo: NotaTamanhoResult['sugestaoAnexo'];
  if (nota < 0) {
    const areaAlvo = areaAnuncio / 1.01;
    const diffM2 = Math.max(0, areaAlvo - areaMoni);
    const anexosNecessarios = Math.ceil(diffM2 / M2_POR_MODULO_ANEXO);
    const m2Anexo = anexosNecessarios * M2_POR_MODULO_ANEXO;
    const areaMoniComAnexo = areaMoni + m2Anexo;
    const novaDiffPct = (areaAnuncio - areaMoniComAnexo) / areaMoniComAnexo;
    sugestaoAnexo = {
      anexosNecessarios,
      m2Anexo,
      areaMoniComAnexo,
      penalizacaoEliminada: novaDiffPct < 0.01,
    };
  }

  return { nota, sugestaoAnexo };
}

/** diff_pct anúncio vs Moní+anexo abaixo de 1% → sem penalização de tamanho. */
export function penalizacaoTamanhoEliminada(
  areaAnuncio: number,
  areaMoni: number,
  m2Anexo: number,
): boolean {
  const areaMoniComAnexo = areaMoni + m2Anexo;
  if (areaMoniComAnexo <= 0) return false;
  return (areaAnuncio - areaMoniComAnexo) / areaMoniComAnexo < 0.01;
}

/** Produto: tamanho m² — diferença % anúncio vs nossa casa. Nossa maior = positivo. */
export function notaTamanhoM2(areaAnuncio: number | null, areaNossa: number | null): number {
  if (areaAnuncio == null || areaNossa == null || areaNossa === 0) return 0;
  return calcularNotaTamanho(areaAnuncio, areaNossa).nota;
}

/** Quartos: fallback 4 se modelo sem valor. Anúncio com menos = positivo. */
export const QUARTOS_PADRAO_NOSSA = 4;

/** Modelos Moní elegíveis por faixa do mapa de competidores (Pré Batalha). */
export const MODELOS_POR_FAIXA: Record<FaixaMercado, string[]> = {
  entrada: ['Lu', 'Isa', 'Val', 'Liz', 'Ivy', 'Mia', 'Cissa', 'Sol'],
  intermediaria: ['Liz', 'Ivy', 'Mia', 'Cissa', 'Sol'],
  premium: ['Eva', 'Gal'],
  premium_plus: ['Eva', 'Gal', 'Lena'],
  premium_plus2: ['Lena'],
  premium_plus3: ['Lena'],
};

export function modeloPermitidoNaFaixa(nomeModelo: string, faixa: FaixaMercado): boolean {
  const permitidos = MODELOS_POR_FAIXA[faixa] ?? [];
  const norm = nomeModelo.trim().toLowerCase();
  const token = norm.split(/[\s/._-]+/).find(Boolean) ?? norm;
  return permitidos.some((m) => {
    const ml = m.toLowerCase();
    return ml === norm || ml === token;
  });
}

/** Escala comum para banheiros e vagas: diff = nosso − anúncio. */
export function notaDiffContagem(nosso: number | null, anuncio: number | null): number {
  if (anuncio == null || nosso == null) return 0;
  const diff = nosso - anuncio;
  if (diff <= -3) return -3;
  if (diff === -2) return -2;
  if (diff === -1) return -1;
  if (diff === 0) return 0;
  if (diff === 1) return 1;
  return 2;
}

export function notaQuartos(
  quartosNosso: number | null,
  quartosAnuncio: number | null,
): number {
  if (quartosAnuncio == null) return 0;
  const nosso = quartosNosso ?? QUARTOS_PADRAO_NOSSA;
  const diff = nosso - quartosAnuncio;
  if (diff <= -4) return -3;
  if (diff === -3) return -3;
  if (diff === -2) return -2;
  if (diff === -1) return -1;
  if (diff === 0) return 0;
  if (diff === 1) return 1;
  return 2;
}

export function notaBanheiros(
  banheirosNosso: number | null,
  banheirosAnuncio: number | null,
): number {
  return notaDiffContagem(banheirosNosso, banheirosAnuncio);
}

export function notaSuites(suitesNosso: number | null, suitesAnuncio: number | null): number {
  return notaDiffContagem(suitesNosso, suitesAnuncio);
}

export type NotaCampoFlexResult = { nota: number; obs?: string };

/** diff = moni − anúncio; se diff < 0 e flexível, recalcula com moni + 1 e registra obs. */
function notaCampoComFlexivel(
  nosso: number | null,
  anuncio: number | null,
  flexivel: boolean | null | undefined,
  calcNota: (n: number | null, a: number | null) => number,
  resolverNosso: (n: number | null) => number,
  obsMsg: string,
): NotaCampoFlexResult {
  if (anuncio == null) return { nota: calcNota(nosso, anuncio) };
  const nossoEf = resolverNosso(nosso);
  const diff = nossoEf - anuncio;
  const notaBase = calcNota(nosso, anuncio);
  if (diff >= 0 || !flexivel) return { nota: notaBase };
  return { nota: calcNota(nossoEf + 1, anuncio), obs: obsMsg };
}

export function notaQuartosComFlexivel(
  quartosNosso: number | null,
  quartosAnuncio: number | null,
  flexivel?: boolean | null,
): NotaCampoFlexResult {
  return notaCampoComFlexivel(
    quartosNosso,
    quartosAnuncio,
    flexivel,
    notaQuartos,
    (n) => n ?? QUARTOS_PADRAO_NOSSA,
    OBS_FLEXIVEL_QUARTOS,
  );
}

export function notaBanheirosComFlexivel(
  banheirosNosso: number | null,
  banheirosAnuncio: number | null,
  flexivel?: boolean | null,
): NotaCampoFlexResult {
  if (banheirosNosso == null) {
    return { nota: notaBanheiros(banheirosNosso, banheirosAnuncio) };
  }
  return notaCampoComFlexivel(
    banheirosNosso,
    banheirosAnuncio,
    flexivel,
    notaBanheiros,
    (n) => n ?? 0,
    OBS_FLEXIVEL_BANHEIROS,
  );
}

export function notaSuitesComFlexivel(
  suitesNosso: number | null,
  suitesAnuncio: number | null,
  flexivel?: boolean | null,
): NotaCampoFlexResult {
  if (suitesNosso == null) {
    return { nota: notaSuites(suitesNosso, suitesAnuncio) };
  }
  return notaCampoComFlexivel(
    suitesNosso,
    suitesAnuncio,
    flexivel,
    notaSuites,
    (n) => n ?? 0,
    OBS_FLEXIVEL_SUITES,
  );
}

export function notaVagas(vagasNosso: number | null, vagasAnuncio: number | null): number {
  return notaDiffContagem(vagasNosso, vagasAnuncio);
}

/** Design: opções e notas (franqueado seleciona) */
export const DESIGN_OPCOES = [
  { id: 'arquiteto', label: 'Casa assinada por arquiteto renomado', nota: -2 },
  { id: 'contemporaneo_alto', label: 'Design contemporâneo de alto padrão', nota: -1 },
  { id: 'moderno', label: 'Design padrão moderno', nota: 0 },
  { id: 'desatualizado', label: 'Design desatualizado / sem projeto', nota: 1 },
  { id: 'degradado', label: 'Design comprometido / fachada degradada', nota: 2 },
] as const;

/** Idade: até 1 ano 0, 1–19 anos +2, 20+ +1 */
export function notaIdade(idadeAnos: number | null): number {
  if (idadeAnos == null) return 0;
  if (idadeAnos <= 1) return 0;
  if (idadeAnos <= 19) return 2;
  return 1;
}

/** Amenidades: anúncio tem / nós não = negativo; nós temos / anúncio não = positivo */
export const AMENIDADES_ITENS = [
  { id: 'piscina', label: 'Piscina', notaAdTemNosNao: -2, notaNosTemosAdNao: 2 },
  { id: 'rooftop', label: 'Rooftop', notaAdTemNosNao: -2, notaNosTemosAdNao: 2 },
  { id: 'ofuro', label: 'Ofuro', notaAdTemNosNao: -1, notaNosTemosAdNao: 1 },
  { id: 'hidromassagem', label: 'Hidromassagem', notaAdTemNosNao: -1, notaNosTemosAdNao: 1 },
] as const;

/** Nota amenidades: compara listing (piscina, marcenaria hoje) com "nossa casa" (por enquanto false em todos). */
export function notaAmenidades(listing: {
  piscina?: boolean | null;
  marcenaria?: boolean | null;
}): number {
  let sum = 0;
  const adTem = (id: string) => {
    if (id === 'piscina') return !!listing.piscina;
    return false;
  };
  const nosTemos = (_id: string) => false; // TODO: vir do catálogo
  for (const a of AMENIDADES_ITENS) {
    const ad = adTem(a.id);
    const nos = nosTemos(a.id);
    if (ad && !nos) sum += a.notaAdTemNosNao;
    else if (!ad && nos) sum += a.notaNosTemosAdNao;
  }
  return clampNota(sum);
}

export type TipoCasaPredominanteFaixa = 'Sobrado' | 'Térrea';

export type RooftopCatalogo = boolean | string | null;

export type CatalogoProdutoRef = {
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  suites?: number | null;
  area_m2?: number | null;
  andares?: number | null;
  rooftop?: RooftopCatalogo;
  quartos_flexivel?: boolean | null;
  suites_flexivel?: boolean | null;
  banheiros_flexivel?: boolean | null;
  assinatura?: boolean | null;
};

export type AnuncioProdutoRef = {
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  suites?: number | null;
  area_casa_m2: number | null;
  piscina?: boolean | null;
  marcenaria?: boolean | null;
};

export type ProdutoDadosPar = {
  designId?: string;
  idade?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  /** Tipo predominante da faixa (Dados dos Condomínios) — critério Andares (An). */
  tipoPredominante?: TipoCasaPredominanteFaixa | null;
};

export type NotaProdutoCompletaResult = {
  nota: number;
  obsFlexivel: string[];
  sugestaoAnexo?: NotaTamanhoResult['sugestaoAnexo'];
  subnotas?: {
    tamanho: number;
    amenidades: number;
    quartos: number;
    suites?: number;
    banheiros: number;
    vagas: number;
    design: number;
    idade: number;
    andares: number;
  };
};

export function normalizarRooftopCatalogo(raw: RooftopCatalogo): 'S' | 'N' | 'Integrado' | null {
  if (raw === true || raw === 'S' || raw === 's' || raw === 'true') return 'S';
  if (raw === false || raw === 'N' || raw === 'n' || raw === 'false') return 'N';
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'integrado') return 'Integrado';
  return null;
}

export type NotaAndaresResult = { nota: number; bloqueado: boolean };

/** Nota Andares (An): depende do tipo predominante da faixa e de andares/rooftop do modelo Moní. */
export function notaAndares(
  tipoPredominante: string | null | undefined,
  andaresMoni: number | null | undefined,
  rooftop: RooftopCatalogo,
): NotaAndaresResult {
  const tipo = String(tipoPredominante ?? '').trim();
  if (tipo !== 'Sobrado' && tipo !== 'Térrea') {
    return { nota: 0, bloqueado: true };
  }

  const andares =
    andaresMoni != null && Number.isFinite(Number(andaresMoni)) ? Number(andaresMoni) : null;
  if (andares == null) return { nota: 0, bloqueado: false };

  if (tipo === 'Sobrado') {
    if (andares > 1) return { nota: 2, bloqueado: false };
    if (andares === 1) {
      const rt = normalizarRooftopCatalogo(rooftop);
      if (rt === 'S') return { nota: -2, bloqueado: false };
      if (rt === 'N') return { nota: -3, bloqueado: false };
      if (rt === 'Integrado') return { nota: -1, bloqueado: false };
      return { nota: 0, bloqueado: false };
    }
    return { nota: 0, bloqueado: false };
  }

  if (andares > 1) return { nota: -3, bloqueado: false };
  if (andares === 1) return { nota: 2, bloqueado: false };
  return { nota: 0, bloqueado: false };
}

export function formatNotaAn(n: number): string {
  if (n > 0) return `An: +${n}`;
  return `An: ${n}`;
}

/**
 * Modelo incompatível com o tipo predominante da faixa (andares vs térrea/sobrado).
 * Usado para reordenação prioritária no ranking Pré Batalha.
 */
export function modeloTipoAndarIncompativel(
  tipoPredominante: string | null | undefined,
  andaresMoni: number | null | undefined,
): boolean {
  const tipo = String(tipoPredominante ?? '').trim();
  if (tipo !== 'Sobrado' && tipo !== 'Térrea') return false;

  const andares =
    andaresMoni != null && Number.isFinite(Number(andaresMoni)) ? Number(andaresMoni) : null;
  if (andares == null) return false;

  if (tipo === 'Térrea') return andares > 1;
  return andares === 1;
}

/** Texto do badge vermelho quando o modelo é rebaixado por incompatibilidade de andares. */
export function labelBadgeTipoAndarIncompativel(
  tipoPredominante: string | null | undefined,
): string | null {
  const tipo = String(tipoPredominante ?? '').trim();
  if (tipo === 'Térrea') return 'Não compatível — sobrado';
  if (tipo === 'Sobrado') return 'Não compatível — térrea';
  return null;
}

function notaTamanhoFromAreas(
  areaAnuncio: number | null,
  areaMoni: number | null,
): NotaTamanhoResult {
  if (areaAnuncio == null || areaMoni == null || areaMoni === 0) return { nota: 0 };
  return calcularNotaTamanho(areaAnuncio, areaMoni);
}

function coletarObsFlexivel(...results: NotaCampoFlexResult[]): string[] {
  return results.map((r) => r.obs).filter((o): o is string => Boolean(o));
}

/** Nota Produto modelo × anúncio com sub-notas e sugestão de anexo (quando T < 0). */
export function calcularNotaProdutoCompleta(
  catalogo: CatalogoProdutoRef,
  anuncio: AnuncioProdutoRef,
  dados?: ProdutoDadosPar | null,
): NotaProdutoCompletaResult {
  const banheirosAnuncio = dados?.banheiros ?? anuncio.banheiros;
  const vagasAnuncio = dados?.vagas ?? anuncio.vagas;
  const tResult = notaTamanhoFromAreas(anuncio.area_casa_m2, catalogo.area_m2 ?? null);
  const T = tResult.nota;
  const qFlex = notaQuartosComFlexivel(
    catalogo.quartos,
    anuncio.quartos,
    catalogo.quartos_flexivel,
  );
  const bFlex = notaBanheirosComFlexivel(
    catalogo.banheiros,
    banheirosAnuncio,
    catalogo.banheiros_flexivel,
  );
  const Q = qFlex.nota;
  const B = bFlex.nota;
  const V = notaVagas(catalogo.vagas, vagasAnuncio);

  const suitesAnuncio = anuncio.suites;
  const suitesFlex =
    catalogo.suites != null && suitesAnuncio != null
      ? notaSuitesComFlexivel(catalogo.suites, suitesAnuncio, catalogo.suites_flexivel)
      : null;
  const obsFlexivel = coletarObsFlexivel(
    qFlex,
    bFlex,
    ...(suitesFlex ? [suitesFlex] : []),
  );
  const An = notaAndares(
    dados?.tipoPredominante,
    catalogo.andares ?? null,
    catalogo.rooftop ?? null,
  ).nota;

  if (dados?.designId != null || dados?.idade != null) {
    const A = notaAmenidades(anuncio);
    const designOpt = DESIGN_OPCOES.find((o) => o.id === dados?.designId);
    const D = designOpt?.nota ?? 0;
    const I = notaIdade(dados?.idade ?? null);
    return {
      nota: notaProdutoMedia(T, A, Q, B, V, D, I, An),
      obsFlexivel,
      sugestaoAnexo: tResult.sugestaoAnexo,
      subnotas: {
        tamanho: T,
        amenidades: A,
        quartos: Q,
        ...(suitesFlex != null ? { suites: suitesFlex.nota } : {}),
        banheiros: B,
        vagas: V,
        design: D,
        idade: I,
        andares: An,
      },
    };
  }

  return {
    nota: notaProdutoSimplificada(T, Q, B, V, An),
    obsFlexivel,
    sugestaoAnexo: tResult.sugestaoAnexo,
    subnotas: {
      tamanho: T,
      amenidades: 0,
      quartos: Q,
      ...(suitesFlex != null ? { suites: suitesFlex.nota } : {}),
      banheiros: B,
      vagas: V,
      design: 0,
      idade: 0,
      andares: An,
    },
  };
}

/**
 * Nota Produto modelo × anúncio.
 * Com design ou idade: 8 sub-itens via `notaProdutoMedia`.
 * Caso contrário: média (T + Q + B + V + An) / 5.
 */
export function notaProdutoContraAnuncio(
  catalogo: CatalogoProdutoRef,
  anuncio: AnuncioProdutoRef,
  dados?: ProdutoDadosPar | null,
): number {
  return calcularNotaProdutoCompleta(catalogo, anuncio, dados).nota;
}

/** Modo simplificado: (T + Q + B + V + An) / 5 */
export function notaProdutoSimplificada(
  tamanho: number,
  quartos: number,
  banheiros: number,
  vagas: number,
  andares: number,
): number {
  const v = (tamanho + quartos + banheiros + vagas + andares) / 5;
  return clampNota(Math.round(v * 10) / 10);
}

/** Nota final Produto = média simples dos 8 sub-itens (T, A, Q, B, V, D, I, An) */
export function notaProdutoMedia(
  tamanho: number,
  amenidades: number,
  quartos: number,
  banheiros: number,
  vagas: number,
  design: number,
  idade: number,
  andares: number,
): number {
  const v =
    (tamanho + amenidades + quartos + banheiros + vagas + design + idade + andares) / 8;
  return clampNota(Math.round(v * 10) / 10);
}

/** Nota final da batalha = Atributos do Lote + Preço + Produto (soma). Desempate: Lote > Preço > Produto. */
export function notaFinalBatalha(
  notaAtributos: number,
  notaPreco: number,
  notaProduto: number,
): number {
  return clampNota(notaAtributos + notaPreco + notaProduto);
}

/** @deprecated Pré-batalha usa as mesmas regras da batalha completa — preferir `notaFinalBatalha`. */
export function notaFinalPreBatalha(notaAtributos: number, notaProduto: number): number {
  return notaFinalBatalha(notaAtributos, 0, notaProduto);
}

function clampNota(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= -3) return -3;
  if (n >= 2) return 2;
  return Math.round(n * 10) / 10;
}
