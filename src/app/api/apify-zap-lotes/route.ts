import { NextResponse } from 'next/server';
import { resolveSupabaseServiceRoleKey } from '@/lib/supabase/admin';

const PAGE_SIZE = 24;
const MAX_FROM = 500;

export type ZapLoteItem = {
  condominio?: string;
  area_lote_m2?: number;
  preco?: number;
  preco_m2?: number;
  link?: string;
  valor_condominio?: number;
  iptu?: number;
  caracteristicas_condominio?: string;
  /** Características do condomínio a partir de listing.amenities (glue-api) */
  caracteristicas?: string | null;
};

function parseMoney(value: string | number | undefined): number | undefined {
  if (value == null) return undefined;
  const s = String(value).replace(/\D/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function mapGlueListingToLoteItem(raw: Record<string, unknown>): ZapLoteItem {
  const address = raw.address as Record<string, unknown> | undefined;
  const condominio = address?.neighborhood != null ? String(address.neighborhood) : undefined;
  const usableAreas = raw.usableAreas as string[] | number[] | undefined;
  const area = usableAreas?.[0] != null ? parseFloat(String(usableAreas[0])) : undefined;
  const pricingInfos = raw.pricingInfos as Array<Record<string, unknown>> | undefined;
  const pi = Array.isArray(pricingInfos) ? pricingInfos[0] : undefined;
  const priceStr = pi?.price != null ? String(pi.price) : undefined;
  const preco = priceStr != null ? parseMoney(priceStr) : undefined;
  const preco_m2 = preco != null && area != null && area > 0 ? preco / area : undefined;
  const link = raw.id != null ? `https://www.zapimoveis.com.br/imovel/${raw.id}` : undefined;
  const valor_condominio = parseMoney(pi?.monthlyCondoFee as string | number | undefined);
  const iptu = parseMoney(pi?.yearlyIptu as string | number | undefined);
  const amenities = raw.amenities as string[] | undefined;
  const caracteristicas = amenities?.filter(Boolean).join(', ') ?? null;
  return {
    condominio,
    area_lote_m2: area,
    preco: Number.isFinite(preco) ? preco : undefined,
    preco_m2: Number.isFinite(preco_m2) ? preco_m2 : undefined,
    link,
    valor_condominio: Number.isFinite(valor_condominio) ? valor_condominio : undefined,
    iptu: Number.isFinite(iptu) ? iptu : undefined,
    caracteristicas_condominio: undefined,
    caracteristicas,
  };
}

/**
 * POST /api/apify-zap-lotes
 * Body: { cidade: string, estado: string, condominio?: string }
 * Chama a Edge Function zap-search-lotes (terrenos/lotes), pagina e retorna o array de itens.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cidade = typeof body?.cidade === 'string' ? body.cidade.trim() : '';
    const estado = typeof body?.estado === 'string' ? body.estado.trim() : '';
    const condominio =
      typeof body?.condominio === 'string' ? body.condominio.trim() || undefined : undefined;

    if (!cidade || !estado) {
      return NextResponse.json(
        { ok: false, error: 'Corpo da requisição deve conter cidade e estado.' },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let serviceRoleKey: string;
    try {
      serviceRoleKey = resolveSupabaseServiceRoleKey();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Configuração Supabase ausente (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_DEV_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY válida).',
        },
        { status: 500 },
      );
    }
    if (!supabaseUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Configuração Supabase ausente (NEXT_PUBLIC_SUPABASE_URL).',
        },
        { status: 500 },
      );
    }

    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const edgeUrl = `https://${projectRef}.supabase.co/functions/v1/zap-search-lotes`;
    const cookieHeader = request.headers.get('cookie') ?? undefined;

    const allItems: ZapLoteItem[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          cidade,
          estado,
          condominio,
          from,
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        let errMsg: string;
        try {
          const j = JSON.parse(errBody);
          errMsg = j.error ?? j.detail ?? errBody.slice(0, 300);
        } catch {
          errMsg = errBody.slice(0, 300) || `Edge Function ${res.status}`;
        }
        return NextResponse.json({ ok: false, error: errMsg }, { status: 200 });
      }

      const data = (await res.json()) as Record<string, unknown>;
      const result = (data.search as Record<string, unknown> | undefined)?.result as
        | Record<string, unknown>
        | undefined;
      const rawListings = result?.listings;
      const listingsArray = Array.isArray(rawListings)
        ? (rawListings as Array<{ listing?: Record<string, unknown> }>)
            .map((item) => item.listing)
            .filter((l): l is Record<string, unknown> => l != null)
        : [];

      if (!Array.isArray(rawListings)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Resposta da glue-api sem array de listings (search.result.listings).',
          },
          { status: 200 },
        );
      }

      allItems.push(...listingsArray.map((listing) => mapGlueListingToLoteItem(listing)));

      if (listingsArray.length < PAGE_SIZE || from + PAGE_SIZE >= MAX_FROM) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    return NextResponse.json({
      ok: true,
      items: allItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
