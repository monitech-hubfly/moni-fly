/**
 * Regras consolidadas da Batalha de Casas (documento Cursor).
 * Ordem de desempate: Atributos do Lote > Preço > Produto.
 * Nota final = Atributos do Lote + Preço + Produto (soma; cada critério -3 a +2).
 */

export const ATRIBUTOS_LOTE = [
  { id: 'vista', label: 'Vista privilegiada', nota: 2 },
  { id: 'area_verde', label: 'Perto de área verde', nota: 2 },
  { id: 'muro', label: 'Muro', nota: 0 },
  { id: 'area_convivencia', label: 'Perto de área de convivência', nota: -2 },
  { id: 'lixeira', label: 'Perto de lixeira', nota: -1 },
] as const;

export type AtributosLoteIds = (typeof ATRIBUTOS_LOTE)[number]['id'];

export type AtributosLoteRespostas = Partial<Record<AtributosLoteIds, boolean>>;

export function notaAtributosLote(respostas: AtributosLoteRespostas): number {
  let sum = 0;
  for (const a of ATRIBUTOS_LOTE) {
    if (respostas[a.id]) sum += a.nota;
  }
  return clampNota(sum);
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

/** Produto: tamanho m² — diferença % anúncio vs nossa casa. Nossa maior = positivo. */
export function notaTamanhoM2(areaAnuncio: number | null, areaNossa: number | null): number {
  if (areaAnuncio == null || areaNossa == null || areaNossa === 0) return 0;
  const diffPerc = (areaAnuncio - areaNossa) / areaNossa;
  if (diffPerc >= 0.5) return -3;
  if (diffPerc >= 0.2) return -2;
  if (diffPerc >= 0.01) return -1;
  if (diffPerc > -0.01) return 0;
  if (diffPerc > -0.2) return 1;
  return 2;
}

/** Quartos: nossa casa 4 por padrão. Anúncio com menos = positivo. */
export const QUARTOS_PADRAO_NOSSA = 4;

export function notaQuartos(quartosAnuncio: number | null): number {
  if (quartosAnuncio == null) return 0;
  const diff = QUARTOS_PADRAO_NOSSA - quartosAnuncio;
  if (diff <= -4) return -3;
  if (diff === -2) return -2;
  if (diff === -1) return -1;
  if (diff === 0) return 0;
  if (diff === 1) return 1;
  return 2; // 2 ou mais quartos a menos
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

/** Nota final Produto = média simples dos 5 sub-itens */
export function notaProdutoMedia(
  tamanho: number,
  amenidades: number,
  quartos: number,
  design: number,
  idade: number,
): number {
  const v = (tamanho + amenidades + quartos + design + idade) / 5;
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

function clampNota(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= -3) return -3;
  if (n >= 2) return 2;
  return Math.round(n * 10) / 10;
}
