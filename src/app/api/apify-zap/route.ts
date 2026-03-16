import { NextResponse } from 'next/server';
import { mapGlueApiListingsToItems, type ZapListingItem } from '@/lib/zap-glue-api';

const PAGE_SIZE = 24;
const MAX_FROM = 500;

/**
 * POST /api/apify-zap
 * Body: { cidade: string, estado: string, condominio?: string }
 * Chama a Edge Function zap-search (proxy para a glue-api), pagina e retorna o array de listings.
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
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Configuração Supabase ausente (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
        },
        { status: 500 },
      );
    }

    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const edgeUrl = `https://${projectRef}.supabase.co/functions/v1/zap-search`;
    const cookieHeader = request.headers.get('cookie') ?? undefined;

    const allItems: ZapListingItem[] = [];
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
        console.log('[ZAP-ROUTE] Edge Function error response:', {
          status: res.status,
          body: errBody,
        });
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
      console.log('[ZAP-ROUTE] Edge Function response:', { status: res.status, body: data });
      const result = (data.search as Record<string, unknown> | undefined)?.result as
        | Record<string, unknown>
        | undefined;
      const rawListings = result?.listings;
      const listingsArray = Array.isArray(rawListings)
        ? (rawListings as Array<{ listing?: Record<string, unknown> }>)
            .map((item) => item.listing)
            .filter((l): l is Record<string, unknown> => l != null)
        : [];
      console.log('[ZAP-ROUTE] listings this page:', listingsArray.length);

      if (!Array.isArray(rawListings)) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Resposta da glue-api sem array de listings (search.result.listings).',
          },
          { status: 200 },
        );
      }

      allItems.push(...mapGlueApiListingsToItems(listingsArray));

      if (listingsArray.length < PAGE_SIZE || from + PAGE_SIZE >= MAX_FROM) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }

    console.log('[ZAP-ROUTE] total items returned:', allItems.length);

    return NextResponse.json({
      ok: true,
      items: allItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
