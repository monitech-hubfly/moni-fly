import { NextResponse } from 'next/server';

const UF_TO_CODIGO: Record<string, number> = {
  AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52,
  MA: 21, MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41, PE: 26, PI: 22,
  RJ: 33, RN: 24, RS: 43, RO: 11, RR: 14, SC: 42, SP: 35, SE: 28, TO: 17,
};

function normalizeNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .toLowerCase()
    .trim();
}

type Municipio = { nome: string; latitude: number; longitude: number; codigo_uf: number };

let municipiosCache: Municipio[] | null = null;

async function getMunicipios(): Promise<Municipio[]> {
  if (municipiosCache) return municipiosCache;
  const res = await fetch(
    'https://raw.githubusercontent.com/kelvins/Municipios-Brasileiros/main/json/municipios.json',
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) throw new Error('Falha ao carregar municípios');
  const data = (await res.json()) as { nome: string; latitude: number; longitude: number; codigo_uf: number }[];
  municipiosCache = data;
  return data;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { cidades?: string[] };
    const cidades = Array.isArray(body.cidades) ? body.cidades : [];
    const unicos = Array.from(
      new Set(cidades.map((c) => (c ?? '').toString().trim()).filter(Boolean)),
    );
    if (unicos.length === 0) {
      return NextResponse.json({});
    }
    const municipios = await getMunicipios();
    const result: Record<string, { lat: number; lng: number }> = {};
    for (const key of unicos) {
      const i = key.indexOf(' - ');
      if (i < 0) continue;
      const uf = key.slice(0, i).trim().toUpperCase();
      const cidade = key.slice(i + 3).trim();
      const codigoUf = UF_TO_CODIGO[uf];
      if (codigoUf == null) continue;
      const nomeNorm = normalizeNome(cidade);
      const mun = municipios.find(
        (m) => m.codigo_uf === codigoUf && normalizeNome(m.nome) === nomeNorm,
      );
      if (!mun) {
        const partial = municipios.find(
          (m) => m.codigo_uf === codigoUf && normalizeNome(m.nome).includes(nomeNorm),
        );
        if (partial) {
          result[key] = { lat: partial.latitude, lng: partial.longitude };
        }
        continue;
      }
      result[key] = { lat: mun.latitude, lng: mun.longitude };
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error('cidades-coordenadas', e);
    return NextResponse.json(
      { error: 'Erro ao obter coordenadas.' },
      { status: 500 },
    );
  }
}
