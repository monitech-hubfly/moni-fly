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

const MENCAO_REGEX = /@(\p{L}[\p{L}\s]*)/gu;

/**
 * Extrai IDs de usuários mencionados com @Nome no texto.
 * Faz match exato (case-insensitive) contra a lista de perfis informada.
 */
export function extrairIdsMencoes(textoPlano: string, perfis: PerfilMencao[]): string[] {
  const ids: string[] = [];
  const texto = textoPlano.trim();
  if (!texto || perfis.length === 0) return ids;

  let match: RegExpExecArray | null;
  MENCAO_REGEX.lastIndex = 0;
  while ((match = MENCAO_REGEX.exec(texto)) !== null) {
    const nomeBusca = match[1].trim().toLowerCase();
    if (!nomeBusca) continue;

    const exato = perfis.find((p) => p.nome.trim().toLowerCase() === nomeBusca);
    if (exato && !ids.includes(exato.id)) {
      ids.push(exato.id);
      continue;
    }

    const parcial = perfis.find(
      (p) =>
        p.nome.toLowerCase().includes(nomeBusca) || nomeBusca.includes(p.nome.trim().toLowerCase()),
    );
    if (parcial && !ids.includes(parcial.id)) ids.push(parcial.id);
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
