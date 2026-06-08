import { NextResponse } from 'next/server';

const UA = 'ViabilidadeApp/1.0 (https://viabilidade.app)';
const IBGE_BASE = 'https://servicodados.ibge.gov.br/api';
const SIDRA_BASE = 'https://apisidra.ibge.gov.br/values';

export type DadosCidadeResponse = {
  populacao: string | null;
  pibPerCapita: string | null;
  rendaMedia: string | null;
  areaTerritorial: string | null;
  densidade: string | null;
};

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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

type MunItem = { id: number; nome: string };

/** Busca código IBGE pela lista de municípios da UF (evita ?nome= que retorna MB de dados). */
async function buscarCodigoMunicipio(
  cidade: string,
  estado: string | null | undefined,
): Promise<{ ok: true; cod: string } | { ok: false; error: string }> {
  const uf = toUF(estado);
  if (!uf) return { ok: false, error: 'Informe o estado (UF) para buscar dados do IBGE.' };
  const cidadeNorm = normalizar(cidade);
  if (!cidadeNorm) return { ok: false, error: 'Informe a cidade para buscar dados do IBGE.' };

  const url = `${IBGE_BASE}/v1/localidades/estados/${uf}/municipios`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, next: { revalidate: 86400 } });
  if (!res.ok) return { ok: false, error: `IBGE retornou ${res.status}. Tente novamente.` };

  const lista = (await res.json()) as MunItem[];
  const municipio = lista.find((m) => normalizar(m.nome) === cidadeNorm);
  if (!municipio) {
    return {
      ok: false,
      error: `Município "${cidade}" não encontrado na UF ${uf}. Verifique o nome ou a UF.`,
    };
  }
  return { ok: true, cod: String(municipio.id) };
}

function fmtNumero(val: number | null): string | null {
  if (val == null || !Number.isFinite(val)) return null;
  return val.toLocaleString('pt-BR');
}

function fmtMoeda(val: number | null): string | null {
  if (val == null || !Number.isFinite(val)) return null;
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseSidraNumero(val: unknown): number | null {
  if (val == null || val === '-' || val === '..' || val === 'X') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return parseFloat(s);
  if (s.includes(',')) {
    const num = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(num) ? num : null;
  }
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

function sidraValorPorVariavel(json: unknown, variavel: string): number | null {
  if (!Array.isArray(json) || json.length < 2) return null;
  const row = (json as Record<string, unknown>[]).slice(1).find((r) => String(r.D3C ?? '') === variavel);
  if (!row) return null;
  return parseSidraNumero(row.V ?? row.valor);
}

function sidraPrimeiroValor(json: unknown): number | null {
  if (!Array.isArray(json) || json.length < 2) return null;
  const row = json[1] as Record<string, unknown>;
  return parseSidraNumero(row?.V ?? row?.valor);
}

async function fetchSidra(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${SIDRA_BASE}${path}`, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) {
      const text = await res.text();
      if (text.trim().startsWith('<') || text.includes('Parâmetro')) return null;
      return JSON.parse(text) as unknown;
    }
    return res.json();
  } catch {
    return null;
  }
}

/**
 * GET /api/etapa1/dados-cidade?cidade=Campinas&estado=SP
 * Fontes: SIDRA (4709/4714/5938/3548) + localidades IBGE por UF.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cidade = searchParams.get('cidade')?.trim() ?? '';
    const estado = searchParams.get('estado')?.trim() || null;

    if (!cidade) {
      return NextResponse.json({ error: 'Informe o parâmetro cidade.' }, { status: 400 });
    }

    const codResult = await buscarCodigoMunicipio(cidade, estado);
    if (!codResult.ok) {
      return NextResponse.json({ error: codResult.error }, { status: 404 });
    }
    const cod = codResult.cod;

    const out: DadosCidadeResponse = {
      populacao: null,
      pibPerCapita: null,
      rendaMedia: null,
      areaTerritorial: null,
      densidade: null,
    };

    // População — SIDRA 4709 (Censo 2022); fallback SIDRA 4714 v93
    let popVal: number | null = null;
    const sidraPop = await fetchSidra(`/t/4709/n6/${cod}/p/2022/v/93?formato=json`);
    popVal = sidraPrimeiroValor(sidraPop);
    if (popVal == null) {
      const sidra4714 = await fetchSidra(`/t/4714/n6/${cod}/p/2022/v/all?formato=json`);
      popVal = sidraValorPorVariavel(sidra4714, '93');
    }
    if (popVal != null) out.populacao = fmtNumero(Math.round(popVal));

    // Área e densidade — SIDRA 4714 (Censo 2022)
    let areaVal: number | null = null;
    let densVal: number | null = null;
    const sidra4714 = await fetchSidra(`/t/4714/n6/${cod}/p/2022/v/all?formato=json`);
    areaVal = sidraValorPorVariavel(sidra4714, '6318');
    densVal = sidraValorPorVariavel(sidra4714, '614');
    if (areaVal != null) out.areaTerritorial = fmtNumero(areaVal);
    if (densVal != null) {
      out.densidade = `${densVal.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} hab/km²`;
    } else if (popVal != null && areaVal != null && areaVal > 0) {
      const dens = popVal / areaVal;
      out.densidade = `${dens.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} hab/km²`;
    }

    // PIB per capita — SIDRA 5938 v37 (PIB em mil reais) ÷ população
    const sidraPib = await fetchSidra(`/t/5938/n6/${cod}/p/2021/v/37?formato=json`);
    const pibMilReais = sidraPrimeiroValor(sidraPib);
    if (pibMilReais != null && popVal != null && popVal > 0) {
      const pibPerCapita = (pibMilReais * 1000) / popVal;
      out.pibPerCapita = fmtMoeda(pibPerCapita);
    }

    // Renda média — SIDRA 3548 v58 (rendimento nominal médio mensal, Censo 2010)
    const sidraRenda = await fetchSidra(`/t/3548/n6/${cod}/p/2010/v/58?formato=json`);
    const rendaVal = sidraPrimeiroValor(sidraRenda);
    if (rendaVal != null && rendaVal > 0) {
      out.rendaMedia = fmtMoeda(rendaVal);
    }

    return NextResponse.json(out);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar dados da cidade.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
