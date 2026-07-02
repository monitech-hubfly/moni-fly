/** Remove tags HTML para parse de @menções no texto plano. */
export function htmlComentarioParaTextoPlano(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

export type PerfilMencao = { id: string; nome: string };

// Limita a 4 palavras — evita que o regex greedy consuma frases inteiras após o @Nome
const MENCAO_REGEX = /@(\p{L}+(?:\s+\p{L}+){0,3})/gu;

/**
 * Extrai IDs de usuários mencionados com @Nome no texto.
 * Usa match por prefixo para suportar casos onde o regex captura palavras extras
 * (ex: "@Elisabete Nucci verificar" ainda encontra "Elisabete Nucci").
 */
export function extrairIdsMencoes(textoPlano: string, perfis: PerfilMencao[]): string[] {
  const ids: string[] = [];
  const texto = textoPlano.trim();
  if (!texto || perfis.length === 0) return ids;

  // Ordena por nome mais longo primeiro — garante match mais específico em caso de ambiguidade
  const sorted = [...perfis].sort((a, b) => b.nome.length - a.nome.length);

  let match: RegExpExecArray | null;
  MENCAO_REGEX.lastIndex = 0;
  while ((match = MENCAO_REGEX.exec(texto)) !== null) {
    const nomeBusca = match[1].trim().toLowerCase();
    if (!nomeBusca) continue;

    // 1. Match exato
    const exato = sorted.find((p) => p.nome.trim().toLowerCase() === nomeBusca);
    if (exato && !ids.includes(exato.id)) { ids.push(exato.id); continue; }

    // 2. Prefixo: o texto capturado começa com o nome do perfil (ex: "elisabete nucci verificar" → "elisabete nucci")
    const porPrefixo = sorted.find((p) => {
      const pn = p.nome.trim().toLowerCase();
      return nomeBusca.startsWith(pn) || pn.startsWith(nomeBusca);
    });
    if (porPrefixo && !ids.includes(porPrefixo.id)) ids.push(porPrefixo.id);
  }

  return ids;
}

/** Nomes únicos mencionados no texto (para buscar perfis no servidor). */
export function extrairNomesMencionados(textoPlano: string): string[] {
  const nomes = new Set<string>();
  let match: RegExpExecArray | null;
  MENCAO_REGEX.lastIndex = 0;
  while ((match = MENCAO_REGEX.exec(textoPlano)) !== null) {
    const n = match[1].trim();
    if (n.length >= 1) nomes.add(n);
  }
  return [...nomes];
}

/** Prefer HTML do editor; senão texto plano. */
export function conteudoPersistivelComentario(conteudo: string, plain: string): string {
  const raw = String(conteudo ?? '').trim();
  if (raw.includes('<')) return raw;
  return plain;
}
