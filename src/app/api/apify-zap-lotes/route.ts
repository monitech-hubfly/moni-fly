import { NextResponse } from 'next/server';
import { fetchZapLotesGluePage } from '@/lib/zap-glue-server-fetch';
import {
  applyZapLotesSave,
  verifyProcessoLotesAccess,
  type ZapLoteItem,
} from '@/lib/zap-save-lotes';

const PAGE_SIZE = 24;
const MAX_FROM = 500;

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
 * Body: { cidade, estado, condominio?, processoId? }
 * Com processoId: busca + grava e devolve só inserted.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cidade = typeof body?.cidade === 'string' ? body.cidade.trim() : '';
    const estado = typeof body?.estado === 'string' ? body.estado.trim() : '';
    const condominio =
      typeof body?.condominio === 'string' ? body.condominio.trim() || undefined : undefined;
    const processoId =
      typeof body?.processoId === 'string' ? body.processoId.trim() || undefined : undefined;

    if (!cidade || !estado) {
      return NextResponse.json(
        { ok: false, error: 'Corpo da requisição deve conter cidade e estado.' },
        { status: 400 },
      );
    }

    const cookieHeader = request.headers.get('cookie') ?? undefined;
    const allItems: ZapLoteItem[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let listingsArray: Record<string, unknown>[];
      try {
        listingsArray = await fetchZapLotesGluePage(
          cidade,
          estado,
          condominio,
          from,
          PAGE_SIZE,
          cookieHeader,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ ok: false, error: message }, { status: 200 });
      }

      allItems.push(...listingsArray.map((listing) => mapGlueListingToLoteItem(listing)));

      if (listingsArray.length < PAGE_SIZE || from + PAGE_SIZE >= MAX_FROM) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    if (processoId) {
      const access = await verifyProcessoLotesAccess(processoId);
      if (!access.ok) {
        return NextResponse.json({ ok: false, error: access.error }, { status: 200 });
      }

      try {
        const { inserted } = await applyZapLotesSave(access.supabase, processoId, allItems);
        return NextResponse.json({ ok: true, saved: true, inserted });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ ok: false, error: message }, { status: 200 });
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
