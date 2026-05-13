/**
 * Supabase Edge Function: proxy para a glue-api do ZAP.
 * POST body: { cidade: string, estado: string, condominio?: string, from: number }
 * Monta a URL da glue-api, faz GET com headers de browser e retorna o JSON da glue-api.
 */

const UF_TO_STATE: Record<string, string> = {
  sp: 'São Paulo',
  rj: 'Rio de Janeiro',
  mg: 'Minas Gerais',
  pr: 'Paraná',
  rs: 'Rio Grande do Sul',
  sc: 'Santa Catarina',
  ba: 'Bahia',
  go: 'Goiás',
  pe: 'Pernambuco',
  df: 'Distrito Federal',
};

function noAccent(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

const CITY_POINTS: Record<string, { lat: number; lon: number }> = {
  campinas: { lat: -22.863555, lon: -47.014484 },
};

function buildGlueApiUrl(
  cidade: string,
  estado: string,
  condominio: string | undefined,
  from: number,
  size: number,
  opts: { listingType: string; unitTypesV3: string },
): string {
  const uf = estado.replace(/\s/g, '').slice(0, 2).toLowerCase();
  const stateName = UF_TO_STATE[uf] ?? estado.trim();
  const city = cidade.trim();
  const neighborhood = (condominio ?? '').trim();

  const stateNoAccent = noAccent(stateName);
  const cityNoAccent = noAccent(city);
  const neighborhoodNoAccent = noAccent(neighborhood);

  const addressLocationId = neighborhood
    ? `BR>${stateNoAccent}>NULL>${cityNoAccent}>Barrios>${neighborhoodNoAccent}`
    : `BR>${stateNoAccent}>NULL>${cityNoAccent}`;

  const cityKey = city
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  const point = CITY_POINTS[cityKey] ?? { lat: -22.863555, lon: -47.014484 };

  return `https://glue-api.zapimoveis.com.br/v2/listings?business=SALE&parentId=null&listingType=${opts.listingType}&__zt=mtc%3Adeduplication2023&priceMin=4000000&addressCity=${encodeURIComponent(city || stateName)}&addressZone=&addressStreet=&addressLocationId=${encodeURIComponent(addressLocationId)}&addressState=${encodeURIComponent(stateName)}&addressNeighborhood=${encodeURIComponent(neighborhood)}&addressPointLat=${point.lat}&addressPointLon=${point.lon}&addressType=neighborhood&unitTypes=HOME%2CHOME%2CHOME&unitTypesV3=${opts.unitTypesV3}&unitSubTypes=TWO_STORY_HOUSE%7CCONDOMINIUM%7CUnitSubType_NONE%2CTWO_STORY_HOUSE%2CSINGLE_STOREY_HOUSE%2CKITNET&usageTypes=RESIDENTIAL%2CRESIDENTIAL%2CRESIDENTIAL&page=1&size=${size}&from=${from}&images=webp&categoryPage=RESULT&includeFields=search%2Cpage%2Clistings`;
}

const GLUE_HEADERS: Record<string, string> = {
  accept: '*/*',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  origin: 'https://www.zapimoveis.com.br',
  referer: 'https://www.zapimoveis.com.br/',
  'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'x-domain': '.zapimoveis.com.br',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as {
      cidade?: string;
      estado?: string;
      condominio?: string;
      from?: number;
      cookie?: string;
    };
    const cidade = typeof body?.cidade === 'string' ? body.cidade.trim() : '';
    const estado = typeof body?.estado === 'string' ? body.estado.trim() : '';
    const condominio =
      typeof body?.condominio === 'string' ? body.condominio.trim() || undefined : undefined;
    const from = typeof body?.from === 'number' && body.from >= 0 ? body.from : 0;
    const cookie = typeof body?.cookie === 'string' ? body.cookie : undefined;

    if (!cidade || !estado) {
      return new Response(JSON.stringify({ error: 'cidade e estado são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const size = 24;
    const headers = { ...GLUE_HEADERS };
    if (cookie) {
      headers['cookie'] = cookie;
    }

    const urlUsed = buildGlueApiUrl(cidade, estado, condominio, from, size, {
      listingType: 'USED',
      unitTypesV3: 'TWO_STORY_HOUSE%2CCONDOMINIUM%2CHOME',
    });
    const urlDevelopment = buildGlueApiUrl(cidade, estado, condominio, from, size, {
      listingType: 'DEVELOPMENT',
      unitTypesV3: 'RESIDENTIAL',
    });

    const [resUsed, resDev] = await Promise.all([
      fetch(urlUsed, { method: 'GET', headers }),
      fetch(urlDevelopment, { method: 'GET', headers }),
    ]);

    if (!resUsed.ok) {
      const text = await resUsed.text();
      return new Response(
        JSON.stringify({ error: `Glue-API USED ${resUsed.status}`, detail: text.slice(0, 300) }),
        { status: resUsed.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!resDev.ok) {
      const text = await resDev.text();
      return new Response(
        JSON.stringify({
          error: `Glue-API DEVELOPMENT ${resDev.status}`,
          detail: text.slice(0, 300),
        }),
        { status: resDev.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const dataUsed = (await resUsed.json()) as {
      search?: { totalCount?: number; result?: { listings?: unknown[] } };
      page?: unknown;
    };
    const dataDev = (await resDev.json()) as {
      search?: { totalCount?: number; result?: { listings?: unknown[] } };
      page?: unknown;
    };

    const usedListings = dataUsed.search?.result?.listings ?? [];
    const devListings = dataDev.search?.result?.listings ?? [];
    const combinedListings = [
      ...(Array.isArray(usedListings) ? usedListings : []),
      ...(Array.isArray(devListings) ? devListings : []),
    ];
    const totalCountUsed = dataUsed.search?.totalCount ?? 0;
    const totalCountDev = dataDev.search?.totalCount ?? 0;
    const totalCount = totalCountUsed + totalCountDev;

    const combined = {
      ...dataUsed,
      search: {
        ...dataUsed.search,
        totalCount,
        result: { listings: combinedListings },
      },
    };

    return new Response(JSON.stringify(combined), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
