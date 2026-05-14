/**
 * Partilhado por scripts que falam com o Supabase (evita duplicar validações).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

/** Carrega `.env.local` para `process.env` (não sobrescreve chaves já definidas). */
export function loadEnvLocal() {
  try {
    const path = resolve(process.cwd(), '.env.local');
    const content = readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (_) {}
  syncViteSupabaseEnvAliases();
}

/** Reutiliza credenciais do Carômetro (Vite) nos scripts / checks que esperam NEXT_PUBLIC_*. */
function syncViteSupabaseEnvAliases() {
  const viteUrl = process.env.VITE_SUPABASE_URL?.trim();
  const viteAnon = process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && viteUrl) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = viteUrl;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() && viteAnon) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = viteAnon;
  }
}

function looksLikePlaceholderUrl(u) {
  const s = String(u ?? '').trim();
  const lower = s.toLowerCase();
  if (s.includes('<') || s.includes('>')) return true;
  if (/ref-prod|seu-projeto|xxx\.supabase/i.test(s)) return true;
  if (lower.includes('seu_ref_real') || lower.includes('your-project')) return true;
  // Hosts usados em exemplos de tutoriais (não existem no DNS)
  if (/abcdefghijklmnop\.supabase\.co/i.test(s)) return true;
  return false;
}

/** Valida URL público do projeto (Next + cliente). */
export function validatePublicSupabaseUrl(urlStr) {
  const u = String(urlStr ?? '').trim();
  if (!u) return { ok: false, message: 'Falta NEXT_PUBLIC_SUPABASE_URL.' };
  if (looksLikePlaceholderUrl(u)) {
    return {
      ok: false,
      message:
        'NEXT_PUBLIC_SUPABASE_URL ainda tem texto de exemplo (ex.: SEU_REF_REAL, seu-projeto). No Supabase: Project Settings → API → copie o "Project URL" inteiro, sem trocar o subdomínio por frases.',
    };
  }
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:') {
      return { ok: false, message: 'NEXT_PUBLIC_SUPABASE_URL deve usar https://.' };
    }
    if (!parsed.hostname.endsWith('.supabase.co')) {
      return {
        ok: false,
        message:
          'NEXT_PUBLIC_SUPABASE_URL: hostname esperado *.supabase.co (copie o Project URL do painel).',
      };
    }
  } catch {
    return { ok: false, message: 'NEXT_PUBLIC_SUPABASE_URL não é um URL válido.' };
  }
  return { ok: true };
}

/** Valida anon key mínima (JWT). */
export function validateAnonKey(anonStr) {
  const k = String(anonStr ?? '').trim();
  if (!k) return { ok: false, message: 'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY.' };
  if (k.length < 80) return { ok: false, message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY parece incompleta.' };
  if (!k.startsWith('eyJ')) return { ok: false, message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY deveria ser um JWT (eyJ...).' };
  return { ok: true };
}

/** Valida URL + service_role para Admin API (scripts auth). */
export function validateAdminSupabaseEnv(urlStr, keyStr) {
  const urlCheck = validatePublicSupabaseUrl(urlStr);
  if (!urlCheck.ok) return urlCheck;

  const k = String(keyStr ?? '').trim();
  if (!k) {
    return {
      ok: false,
      message:
        'Falta SUPABASE_SERVICE_ROLE_KEY (secret "service_role" em Supabase → Project Settings → API).',
    };
  }
  if (k.includes('<') || k.includes('>') || /^service_role$/i.test(k)) {
    return {
      ok: false,
      message:
        'SUPABASE_SERVICE_ROLE_KEY inválida. Copie o JWT completo da key "service_role" (Reveal no painel).',
    };
  }
  // JWT da service_role no Supabase costuma ter ~200+ caracteres; exemplos truncados falham aqui.
  if (k.length < 120) {
    return {
      ok: false,
      message:
        `SUPABASE_SERVICE_ROLE_KEY tem só ${k.length} caracteres — está incompleta. No painel, clique em "Reveal" na secret service_role e copie o JWT inteiro (uma linha longa, sem "..." no meio).`,
    };
  }
  if (k.includes('...')) {
    return {
      ok: false,
      message:
        'SUPABASE_SERVICE_ROLE_KEY contém "..." (truncada). Copie o JWT service_role completo, sem abreviar.',
    };
  }
  return { ok: true };
}

/**
 * Mensagem legível para falhas de rede/DNS ao falar com o Supabase (scripts Node).
 */
export function formatSupabaseNetworkError(err) {
  let cur = err;
  for (let i = 0; i < 6 && cur; i++) {
    const code = cur.code;
    const hostname = cur.hostname;
    if (code === 'ENOTFOUND' && hostname) {
      return (
        `Não foi possível resolver o host "${hostname}" (DNS ENOTFOUND).\n` +
        `O "Project URL" no Supabase é único por projeto (ex.: https://abcd1234efgh5678ijkl.supabase.co).\n` +
        `Não use exemplos da documentação (abcdefghijklmnop, <ref-prod>, xxx). Copie o URL em: Dashboard → Project Settings → API.`
      );
    }
    if (code === 'ECONNREFUSED') {
      return 'Ligação recusada ao servidor Supabase. Verifique URL, firewall ou se o projeto está pausado.';
    }
    cur = cur.cause;
  }
  const msg = err?.message ?? String(err);
  if (msg === 'fetch failed' || msg.includes('fetch failed')) {
    return (
      `Falha de rede ao contactar o Supabase (${msg}).\n` +
      `Confirme NEXT_PUBLIC_SUPABASE_URL (Project URL real), VPN/firewall e se o projeto não está em pausa.`
    );
  }
  return msg;
}
