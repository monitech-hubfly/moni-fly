import type { FaqArticleView } from './types';

/** Remove acentos, baixa a caixa e colapsa espaços — para busca acento-insensível. */
export function normalizarTexto(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Grupos de equivalência (sinônimos/termos alternativos). Busca por qualquer termo
 * do grupo encontra artigos que usam qualquer outro termo do mesmo grupo.
 * Valores já em forma normalizada (sem acento, minúsculo).
 */
export const GRUPOS_SINONIMOS: string[][] = [
  ['frank', 'franqueado', 'franqueada'],
  ['terrenista', 'proprietario do lote', 'dono do terreno', 'dono do lote'],
  ['lote', 'terreno'],
  ['contrato final', 'contrato definitivo'],
  ['carta fianca', 'instrumento garantidor', 'seguro garantia'],
  ['obra', 'construcao'],
  ['viabilidade', 'bca', 'business case analysis'],
  ['prefeitura', 'aprovacao municipal', 'alvara'],
  ['spe', 'sociedade de proposito especifico'],
  ['itbi', 'imposto de transmissao'],
  ['permuta', 'troca'],
  ['credito', 'financiamento', 'funding'],
];

/** Expande uma lista de tokens com seus sinônimos. */
function expandirComSinonimos(tokens: string[]): string[] {
  const out = new Set(tokens);
  const consulta = tokens.join(' ');
  for (const grupo of GRUPOS_SINONIMOS) {
    const grupoBate = grupo.some((termo) => consulta.includes(termo) || tokens.includes(termo));
    if (grupoBate) {
      for (const termo of grupo) out.add(termo);
    }
  }
  return Array.from(out);
}

function tokenizar(q: string): string[] {
  return normalizarTexto(q)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Texto pesquisável de um artigo (pergunta + resposta + resumo + categoria + keywords + sinônimos). */
function textoArtigo(a: FaqArticleView): string {
  return normalizarTexto(
    [
      a.question,
      a.short_answer ?? '',
      a.answer,
      a.category_name ?? '',
      (a.keywords ?? []).join(' '),
      (a.synonyms ?? []).join(' '),
    ].join(' '),
  );
}

export type FaqBuscaResultado = {
  artigo: FaqArticleView;
  score: number;
};

/**
 * Filtra e ordena por relevância. Busca em pergunta/resposta/resumo/categoria/keywords/sinônimos,
 * ignorando acento e caixa, com expansão por sinônimos.
 */
export function buscarArtigos(artigos: FaqArticleView[], query: string): FaqBuscaResultado[] {
  const termos = expandirComSinonimos(tokenizar(query));
  if (termos.length === 0) return artigos.map((artigo) => ({ artigo, score: 0 }));

  const consultaNorm = normalizarTexto(query);
  const resultados: FaqBuscaResultado[] = [];

  for (const artigo of artigos) {
    const pergunta = normalizarTexto(artigo.question);
    const texto = textoArtigo(artigo);
    let score = 0;

    // Pergunta completa contida no enunciado: peso alto
    if (consultaNorm.length >= 4 && pergunta.includes(consultaNorm)) score += 60;

    for (const termo of termos) {
      if (pergunta.includes(termo)) score += 8;
      else if ((artigo.keywords ?? []).some((k) => normalizarTexto(k).includes(termo))) score += 5;
      else if (texto.includes(termo)) score += 2;
    }

    // exige que ao menos um termo apareça
    if (score > 0) resultados.push({ artigo, score });
  }

  resultados.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.artigo.is_featured !== b.artigo.is_featured) return a.artigo.is_featured ? -1 : 1;
    return a.artigo.display_order - b.artigo.display_order;
  });
  return resultados;
}

/** Divide o texto em segmentos marcando (match=true) os trechos que batem com os termos. */
export function realceSegmentos(texto: string, query: string): { texto: string; match: boolean }[] {
  const termos = tokenizar(query).filter((t) => t.length >= 3);
  if (termos.length === 0) return [{ texto, match: false }];

  // mapeia posições no texto normalizado de volta para o original (comprimentos iguais no NFD sem marks para ASCII;
  // para simplificar e robustez, fazemos realce case/acento-insensível por regex escapada nos termos originais).
  const escapados = termos.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // versão acento-insensível: constrói classe por caractere seria complexo; usamos match direto sobre normalizado.
  const textoNorm = normalizarTexto(texto);
  const regex = new RegExp(`(${escapados.join('|')})`, 'gi');

  const segmentos: { texto: string; match: boolean }[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(textoNorm)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (start > lastIndex) segmentos.push({ texto: texto.slice(lastIndex, start), match: false });
    segmentos.push({ texto: texto.slice(start, end), match: true });
    lastIndex = end;
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }
  if (lastIndex < texto.length) segmentos.push({ texto: texto.slice(lastIndex), match: false });
  return segmentos.length ? segmentos : [{ texto, match: false }];
}
