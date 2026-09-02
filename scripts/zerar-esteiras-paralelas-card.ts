/**
 * Remove cards filhos de esteiras paralelas (bastões) e zera flags no card pai do Portfólio.
 * Uso: npx tsx scripts/zerar-esteiras-paralelas-card.ts "FK0018"
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { KANBAN_IDS } from '../src/lib/constants/kanban-ids';

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (_) {}
}

loadEnvLocal();

if (process.env.SUPABASE_PROD_URL?.trim()) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_PROD_URL.trim();
}
if (process.env.SUPABASE_PROD_SERVICE_ROLE_KEY?.trim()) {
  const prodKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY.trim();
  process.env.SUPABASE_SERVICE_ROLE_KEY = prodKey;
}

const buscaTitulo = process.argv[2]?.trim() || 'FK0018';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const KANBANS_PARALELOS = [
  KANBAN_IDS.ACOPLAMENTO,
  KANBAN_IDS.CREDITO_OBRA,
  KANBAN_IDS.CONTABILIDADE,
  KANBAN_IDS.JURIDICO,
  KANBAN_IDS.MONI_CAPITAL,
] as const;

async function main() {
  const { data: pais, error: errPai } = await db
    .from('kanban_cards')
    .select('id, titulo, kanban_id')
    .eq('kanban_id', KANBAN_IDS.PORTFOLIO)
    .ilike('titulo', `%${buscaTitulo}%`);

  if (errPai) {
    console.error(errPai.message);
    process.exit(1);
  }

  if (!pais?.length) {
    console.error(`Nenhum card Portfólio com título contendo "${buscaTitulo}".`);
    process.exit(1);
  }

  if (pais.length > 1) {
    console.log('Vários cards encontrados:');
    for (const p of pais) {
      console.log(`  - ${p.id} | ${p.titulo}`);
    }
    console.error('Passe um termo mais específico.');
    process.exit(1);
  }

  const pai = pais[0] as { id: string; titulo: string };
  const paiId = pai.id;
  console.log(`Pai: ${pai.titulo} (${paiId})`);

  const { data: filhos, error: errFilhos } = await db
    .from('kanban_cards')
    .select('id, titulo, kanban_id, kanbans(nome)')
    .eq('origem_card_id', paiId);

  if (errFilhos) {
    console.error(errFilhos.message);
    process.exit(1);
  }

  const filhosParalelos = (filhos ?? []).filter((f) =>
    KANBANS_PARALELOS.includes(String((f as { kanban_id?: string }).kanban_id ?? '') as (typeof KANBANS_PARALELOS)[number]),
  );

  if (filhosParalelos.length === 0) {
    console.log('Nenhum card filho de esteira paralela encontrado.');
  } else {
    console.log('Filhos a remover:');
    for (const f of filhosParalelos) {
      const nome = (f as { kanbans?: { nome?: string } | null }).kanbans?.nome ?? f.kanban_id;
      console.log(`  - ${f.id} | ${nome} | ${f.titulo}`);
    }

    const ids = filhosParalelos.map((f) => String(f.id));
    const { error: errDel } = await db.from('kanban_cards').delete().in('id', ids);
    if (errDel) {
      console.error('Erro ao excluir filhos:', errDel.message);
      process.exit(1);
    }
    console.log(`Excluídos ${ids.length} card(s) filho.`);
  }

  const { error: errFlags } = await db
    .from('kanban_cards')
    .update({
      acoplamento_concluido: false,
      acoplamento_filho_fase_slug: null,
      acoplamento_filho_fase_nome: null,
      credito_terreno_ok: false,
      contabilidade_ok: false,
      juridico_ok: false,
      capital_ok: false,
    })
    .eq('id', paiId);

  if (errFlags) {
    console.error('Erro ao zerar flags:', errFlags.message);
    process.exit(1);
  }

  console.log('Flags paralelas zeradas no card pai.');
  console.log('Concluído.');
}

void main();
