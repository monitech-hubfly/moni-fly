/**
 * Busca casas ZAP no servidor.
 * Com APIFY_API_TOKEN: usa Apify direto, salvo ZAP_TRY_GLUE=true.
 * Sem token: glue via Edge Function Supabase (fallback glue-api direta).
 */

import { runZapScraper } from '@/lib/apify-zap';
import type { FetchZapListingsResult } from '@/lib/zap-glue-api';
import { fetchAllZapCasas } from '@/lib/zap-glue-server-fetch';

/** Polling do run Apify — runs costumam levar 1,5–3 min. */
const APIFY_TIMEOUT_MS = Number(process.env.ZAP_APIFY_TIMEOUT_MS) || 240_000;

function hasApifyToken(): boolean {
  return !!(process.env.APIFY_API_TOKEN || process.env.VITE_APIFY_TOKEN);
}

function isGlueBlocked(error: string): boolean {
  return /\b403\b|forbidden|cloudflare|<!DOCTYPE/i.test(error);
}

function shortenError(error: string, max = 280): string {
  const trimmed = error.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export type FetchZapCasasResult = FetchZapListingsResult & {
  source?: 'glue' | 'apify';
};

async function fetchViaApify(
  cidade: string,
  estado: string,
  condominio?: string,
): Promise<FetchZapCasasResult> {
  const apify = await runZapScraper(cidade, estado, condominio, 300, APIFY_TIMEOUT_MS);
  if (apify.ok) {
    return { ok: true, items: apify.items, source: 'apify' };
  }
  const err = shortenError(apify.error);
  if (/timeout/i.test(err)) {
    return {
      ok: false,
      error:
        'A busca no Apify demorou mais que o esperado. Aguarde e tente de novo (pode levar até 4 minutos).',
    };
  }
  return { ok: false, error: err };
}

/**
 * Busca casas: Apify (se token) ou glue-api + fallback Apify.
 */
export async function fetchZapCasasWithFallback(opts: {
  cidade: string;
  estado: string;
  condominio?: string;
  cookie?: string;
}): Promise<FetchZapCasasResult> {
  const useGlueFirst = !hasApifyToken() || process.env.ZAP_TRY_GLUE === 'true';

  if (hasApifyToken() && !useGlueFirst) {
    return fetchViaApify(opts.cidade, opts.estado, opts.condominio);
  }

  const glue = await fetchAllZapCasas(opts);
  if (glue.ok) {
    return { ...glue, source: 'glue' };
  }

  const glueErr = shortenError(glue.error);

  if (!hasApifyToken()) {
    if (isGlueBlocked(glue.error)) {
      return {
        ok: false,
        error:
          'A ZAP bloqueou a busca direta (403). Configure APIFY_API_TOKEN no servidor para usar o scraper Apify.',
      };
    }
    return { ok: false, error: glueErr };
  }

  const apify = await fetchViaApify(opts.cidade, opts.estado, opts.condominio);
  if (apify.ok) return apify;

  return {
    ok: false,
    error: `Busca direta: ${glueErr}. ${apify.error}`,
  };
}
