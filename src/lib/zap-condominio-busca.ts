/**
 * Resolve nomes de condomínio da pesquisa interna para o termo que a ZAP reconhece,
 * e compara nomes diferentes que se referem ao mesmo empreendimento/bairro.
 */

const ZAP_BUSCA_ALIASES: Record<string, string> = {
  'artesano galleria': 'Loteamento Artesano',
  'artesano galeria': 'Loteamento Artesano',
};

function chaveNome(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

const TOKENS_IGNORADOS = new Set([
  'loteamento',
  'condominio',
  'cond',
  'residencial',
  'res',
  'clube',
  'parque',
  'village',
  'galleria',
  'galeria',
  'park',
]);

function tokensSignificativos(nome: string): string[] {
  return chaveNome(nome)
    .split(/[\s,/+-]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter((t) => t.length >= 4 && !TOKENS_IGNORADOS.has(t));
}

/**
 * @deprecated Não use para sobrescrever o campo Condomínio na UI — o termo digitado vai verbatim ao Apify.
 * Mantido só para aliases explícitos em fluxos legados (ex.: Artesano Galleria).
 */
export function resolverTermoBuscaZap(nomeProspect: string): string {
  const bruto = nomeProspect.trim();
  if (!bruto) return '';

  const alias = ZAP_BUSCA_ALIASES[chaveNome(bruto)];
  if (alias) return alias;

  return bruto;
}

/** Mesmo empreendimento/bairro com nomes diferentes (prospect vs ZAP). */
export function condominiosMapaCompativeis(nomeA: string, nomeB: string): boolean {
  const a = chaveNome(nomeA);
  const b = chaveNome(nomeB);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const ta = new Set(tokensSignificativos(nomeA));
  const tb = new Set(tokensSignificativos(nomeB));
  for (const t of ta) {
    if (tb.has(t)) return true;
  }
  return false;
}
