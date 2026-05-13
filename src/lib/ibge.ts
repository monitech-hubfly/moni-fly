/**
 * Dados do município retornados pela API de Localidades do IBGE.
 * https://servicodados.ibge.gov.br/api/docs/localidades
 */
export type MunicipioIbge = {
  id: number;
  nome: string;
  microrregiao: { id: number; nome: string };
  mesorregiao: { id: number; nome: string };
  'regiao-imediata': { id: number; nome: string };
  'regiao-intermediaria': { id: number; nome: string };
  regiao: { id: number; nome: string; sigla: string };
  uf: { id: number; nome: string; sigla: string };
};

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Resolve UF a partir do estado (sigla ou nome).
 */
function toUF(estado: string | null | undefined): string | null {
  if (!estado || typeof estado !== 'string') return null;
  const s = estado.trim().toUpperCase();
  if (s.length === 2) return s;
  const mapa: Record<string, string> = {
    ACRE: 'AC',
    ALAGOAS: 'AL',
    AMAPA: 'AP',
    AMAZONAS: 'AM',
    BAHIA: 'BA',
    CEARA: 'CE',
    'DISTRITO FEDERAL': 'DF',
    'ESPIRITO SANTO': 'ES',
    GOIAS: 'GO',
    MARANHAO: 'MA',
    'MATO GROSSO': 'MT',
    'MATO GROSSO DO SUL': 'MS',
    'MINAS GERAIS': 'MG',
    PARA: 'PA',
    PARAIBA: 'PB',
    PARANA: 'PR',
    PERNAMBUCO: 'PE',
    PIAUI: 'PI',
    'RIO DE JANEIRO': 'RJ',
    'RIO GRANDE DO NORTE': 'RN',
    'RIO GRANDE DO SUL': 'RS',
    RONDONIA: 'RO',
    RORAMA: 'RR',
    'SANTA CATARINA': 'SC',
    'SAO PAULO': 'SP',
    SERGIPE: 'SE',
    TOCANTINS: 'TO',
  };
  return mapa[normalizar(estado)] ?? null;
}

/**
 * Busca dados do município no IBGE por nome da cidade e estado (UF).
 * Retorna o primeiro município cujo nome coincide (normalizado).
 */
export async function buscarMunicipioIbge(
  cidade: string,
  estado: string | null | undefined,
): Promise<{ ok: true; data: MunicipioIbge } | { ok: false; error: string }> {
  const uf = toUF(estado);
  if (!uf) {
    return { ok: false, error: 'Informe o estado (UF) para buscar dados do IBGE.' };
  }
  const cidadeNorm = normalizar(cidade);
  if (!cidadeNorm) {
    return { ok: false, error: 'Informe a cidade para buscar dados do IBGE.' };
  }

  try {
    const res = await fetch(`${IBGE_BASE}/estados/${uf}/municipios`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return { ok: false, error: `IBGE retornou ${res.status}. Tente novamente.` };
    }
    const lista = (await res.json()) as MunicipioIbge[];
    const municipio = lista.find((m) => normalizar(m.nome) === cidadeNorm);
    if (!municipio) {
      return {
        ok: false,
        error: `Município "${cidade}" não encontrado na UF ${uf}. Verifique o nome ou a UF.`,
      };
    }
    return { ok: true, data: municipio };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar IBGE.';
    return { ok: false, error: msg };
  }
}
