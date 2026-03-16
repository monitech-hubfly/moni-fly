import { NextResponse } from 'next/server';

const UA = 'ViabilidadeApp/1.0 (https://viabilidade.app)';
const IBGE_BASE = 'https://servicodados.ibge.gov.br/api';

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
    .replace(/\p{Diacritic}/gu, '');
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

type MunItem = {
  id: number;
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla: string } } };
  uf?: { sigla: string };
};

/**
 * 1. Buscar código IBGE: GET municipios?nome={cidade}
 * Filtrar por municipio.microrregiao.mesorregiao.UF.sigla === estado
 */
async function buscarCodigoMunicipio(
  cidade: string,
  estado: string | null | undefined,
): Promise<{ ok: true; cod: string } | { ok: false; error: string }> {
  const uf = toUF(estado);
  if (!uf) return { ok: false, error: 'Informe o estado (UF) para buscar dados do IBGE.' };
  const cidadeNorm = normalizar(cidade);
  if (!cidadeNorm) return { ok: false, error: 'Informe a cidade para buscar dados do IBGE.' };

  const url = `${IBGE_BASE}/v1/localidades/municipios?nome=${encodeURIComponent(cidade.trim())}`;
  console.log('[dados-cidade] Fetch código IBGE:', url);
  const res = await fetch(url, { headers: { 'User-Agent': UA }, next: { revalidate: 3600 } });
  console.log('[dados-cidade] Código IBGE status:', res.status);
  if (!res.ok) return { ok: false, error: `IBGE retornou ${res.status}. Tente novamente.` };

  const lista = (await res.json()) as MunItem[];
  const municipio =
    lista.find((m) => {
      const sigla = (m.microrregiao?.mesorregiao?.UF?.sigla ?? m.uf?.sigla)?.toUpperCase();
      return normalizar(m.nome) === cidadeNorm && sigla === uf;
    }) ?? lista.find((m) => normalizar(m.nome) === cidadeNorm);
  if (!municipio) {
    return {
      ok: false,
      error: `Município "${cidade}" não encontrado na UF ${uf}. Verifique o nome ou a UF.`,
    };
  }
  console.log('[dados-cidade] Código encontrado:', municipio.id);
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

/** Extrai valor numérico da resposta da API v3 agregados (resultados[0].series.periodo[0].serie.periodo). */
function extrairValorAgregadoV3(json: unknown, periodo: string = '2021'): number | null {
  try {
    const obj = json as {
      resultados?: Array<{ series?: Record<string, Array<{ serie?: Record<string, unknown> }>> }>;
    };
    const resultados = obj?.resultados;
    if (!Array.isArray(resultados) || resultados.length === 0) return null;
    const series = resultados[0]?.series;
    if (!series || typeof series !== 'object') return null;
    const periodos = series[periodo];
    if (!Array.isArray(periodos) || periodos.length === 0) return null;
    const serie = periodos[0]?.serie;
    if (!serie || typeof serie !== 'object') return null;
    const v = (serie as Record<string, unknown>)[periodo];
    if (v == null) return null;
    const num =
      typeof v === 'number' ? v : parseFloat(String(v).replace(/\D/g, '').replace(',', '.'));
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

/**
 * GET /api/etapa1/dados-cidade?cidade=Campinas&estado=SP
 * 2. População: Censo 2022 - GET v2/censos/2022/municipios/{cod} campo populacao
 * 3. Área: agregado 1301, período 2021, variável 614, localidades N6[cod]
 * 4. PIB per capita: agregado 5938, período 2021, variável 37, localidades N6[cod]
 * 5. Renda: mantida SIDRA 3548/842 (Censo 2010)
 * Densidade: população ÷ área
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
    const headers: HeadersInit = { 'User-Agent': UA };
    const loc = `N6[${cod}]`;

    const out: DadosCidadeResponse = {
      populacao: null,
      pibPerCapita: null,
      rendaMedia: null,
      areaTerritorial: null,
      densidade: null,
    };

    // 2. População — Censo 2022: GET v2/censos/2022/municipios/{cod}, campo populacao; fallback SIDRA 4709
    let popVal: number | null = null;
    const urlPop = `${IBGE_BASE}/v2/censos/2022/municipios/${cod}`;
    console.log('[dados-cidade] Fetch população (Censo 2022):', urlPop);
    try {
      const popRes = await fetch(urlPop, { headers });
      console.log('[dados-cidade] População status:', popRes.status);
      if (popRes.ok) {
        const popJson = (await popRes.json()) as { populacao?: number; [k: string]: unknown };
        if (typeof popJson?.populacao === 'number') popVal = popJson.populacao;
        else if (popJson?.populacao != null) popVal = parseFloat(String(popJson.populacao));
      }
    } catch (e) {
      console.log('[dados-cidade] População fetch/parse error:', e);
    }
    if (popVal == null) {
      const urlSidraPop = `https://apisidra.ibge.gov.br/values/t/4709/n6/${cod}/p/2022/v/93?formato=json`;
      console.log('[dados-cidade] Fallback população (SIDRA 4709):', urlSidraPop);
      try {
        const sidraRes = await fetch(urlSidraPop, { headers });
        console.log('[dados-cidade] SIDRA população status:', sidraRes.status);
        if (sidraRes.ok) {
          const arr = await sidraRes.json();
          if (Array.isArray(arr) && arr.length > 0) {
            const v =
              (arr[0] as Record<string, unknown>).V ?? (arr[0] as Record<string, unknown>).valor;
            if (v != null)
              popVal =
                typeof v === 'number'
                  ? v
                  : parseFloat(String(v).replace(/\D/g, '').replace(',', '.'));
          }
        }
      } catch (e2) {
        console.log('[dados-cidade] SIDRA população error:', e2);
      }
    }
    if (popVal != null) out.populacao = fmtNumero(Math.round(popVal));

    // 3. Área territorial — agregado 1301, período 2021, variável 614
    const urlArea = `${IBGE_BASE}/v3/agregados/1301/periodos/2021/variaveis/614?localidades=${loc}`;
    console.log('[dados-cidade] Fetch área (agregado 1301):', urlArea);
    const areaRes = await fetch(urlArea, { headers });
    console.log('[dados-cidade] Área status:', areaRes.status);
    let areaVal: number | null = null;
    try {
      const areaJson = await areaRes.json();
      areaVal = extrairValorAgregadoV3(areaJson, '2021');
    } catch (e) {
      console.log('[dados-cidade] Área parse error:', e);
    }
    if (areaVal != null) out.areaTerritorial = fmtNumero(areaVal);

    // 4. PIB per capita — agregado 5938, período 2021, variável 37
    const urlPib = `${IBGE_BASE}/v3/agregados/5938/periodos/2021/variaveis/37?localidades=${loc}`;
    console.log('[dados-cidade] Fetch PIB (agregado 5938):', urlPib);
    const pibRes = await fetch(urlPib, { headers });
    console.log('[dados-cidade] PIB status:', pibRes.status);
    let pibVal: number | null = null;
    try {
      const pibJson = await pibRes.json();
      pibVal = extrairValorAgregadoV3(pibJson, '2021');
    } catch (e) {
      console.log('[dados-cidade] PIB parse error:', e);
    }
    if (pibVal != null) out.pibPerCapita = fmtMoeda(pibVal);

    // Renda média domiciliar — SIDRA 3548, 2010, variável 842 (fallback)
    const urlRenda = `https://apisidra.ibge.gov.br/values/t/3548/n6/${cod}/p/2010/v/842?formato=json`;
    console.log('[dados-cidade] Fetch renda (SIDRA 3548):', urlRenda);
    const rendaRes = await fetch(urlRenda, { headers });
    console.log('[dados-cidade] Renda status:', rendaRes.status);
    let rendaVal: number | null = null;
    try {
      const rendaArr = await rendaRes.json();
      if (Array.isArray(rendaArr) && rendaArr.length > 0) {
        const v =
          (rendaArr[0] as Record<string, unknown>).V ??
          (rendaArr[0] as Record<string, unknown>).valor;
        if (v != null)
          rendaVal =
            typeof v === 'number' ? v : parseFloat(String(v).replace(/\D/g, '').replace(',', '.'));
      }
    } catch (e) {
      console.log('[dados-cidade] Renda parse error:', e);
    }
    if (rendaVal != null && Number.isFinite(rendaVal)) out.rendaMedia = fmtMoeda(rendaVal);

    // Densidade — população ÷ área (hab/km²)
    if (popVal != null && areaVal != null && areaVal > 0) {
      const dens = popVal / areaVal;
      out.densidade = `${dens.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} hab/km²`;
    }

    return NextResponse.json(out);
  } catch (err) {
    console.log('[dados-cidade] Erro geral:', err);
    const message = err instanceof Error ? err.message : 'Erro ao carregar dados da cidade.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
