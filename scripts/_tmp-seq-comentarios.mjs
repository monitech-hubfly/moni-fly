/**
 * Gera texto: sequência de cards ativos Loteadores + Portfólio,
 * fase atual e últimos 3 comentários.
 *   node --env-file=.env.local scripts/_tmp-seq-comentarios.mjs
 */
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const PORTFOLIO = 'c57120a0-991c-422b-8def-4d16a9411d45';
const LOTEADORES = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c';
const FUNIL_NOME = {
  [PORTFOLIO]: 'Funil Portfólio',
  [LOTEADORES]: 'Funil Loteadores',
};

const url = process.env.SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_PROD_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function clean(s) {
  return String(s ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Evita estourar o relatório com comentários gigantes (ex.: colagens). */
function clipTexto(s, max = 2500) {
  const t = clean(s);
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n       […] (texto truncado — ${t.length} caracteres no total)`;
}

function fmtData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const { data: cards, error: cardsErr } = await supabase
  .from('kanban_cards')
  .select('id, titulo, kanban_id, fase_id')
  .in('kanban_id', [PORTFOLIO, LOTEADORES])
  .eq('arquivado', false)
  .eq('concluido', false);

if (cardsErr) {
  console.error(cardsErr);
  process.exit(1);
}

const cardList = cards ?? [];
const faseIds = [...new Set(cardList.map((c) => c.fase_id).filter(Boolean))];

const { data: fases } = await supabase
  .from('kanban_fases')
  .select('id, nome, slug, ordem, kanban_id')
  .in('id', faseIds.length ? faseIds : ['00000000-0000-0000-0000-000000000000']);

const faseMap = new Map((fases ?? []).map((f) => [f.id, f]));

const cardIds = cardList.map((c) => c.id);
const comentarios = [];
for (let i = 0; i < cardIds.length; i += 80) {
  const slice = cardIds.slice(i, i + 80);
  const { data, error } = await supabase
    .from('kanban_card_comentarios')
    .select('id, card_id, conteudo, created_at, autor_nome')
    .in('card_id', slice)
    .is('sirene_chamado_id', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  comentarios.push(...(data ?? []));
}

const last3ByCard = new Map();
for (const cm of comentarios) {
  const list = last3ByCard.get(cm.card_id) ?? [];
  if (list.length >= 3) continue;
  list.push(cm);
  last3ByCard.set(cm.card_id, list);
}

const byFunil = {
  [LOTEADORES]: [],
  [PORTFOLIO]: [],
};

for (const c of cardList) {
  const fase = c.fase_id ? faseMap.get(c.fase_id) : null;
  byFunil[c.kanban_id]?.push({
    id: c.id,
    titulo: (c.titulo && String(c.titulo).trim()) || c.id,
    faseNome: fase?.nome ?? 'Sem fase',
    faseSlug: fase?.slug ?? null,
    faseOrdem: fase?.ordem ?? 9999,
    comentarios: last3ByCard.get(c.id) ?? [],
  });
}

for (const kid of [LOTEADORES, PORTFOLIO]) {
  byFunil[kid].sort((a, b) => {
    if (a.faseOrdem !== b.faseOrdem) return a.faseOrdem - b.faseOrdem;
    return a.titulo.localeCompare(b.titulo, 'pt-BR');
  });
}

const lines = [];
lines.push('SEQUÊNCIA DE CARDS ATIVOS — FUNIL LOTEADORES E FUNIL PORTFÓLIO');
lines.push(`Gerado em: ${fmtData(new Date().toISOString())} (PROD)`);
lines.push('Critério: cards não arquivados e não concluídos.');
lines.push('Para cada card: fase atual + últimos 3 comentários/observações (mais recentes primeiro).');
lines.push('');

for (const kid of [LOTEADORES, PORTFOLIO]) {
  const lista = byFunil[kid];
  lines.push('════════════════════════════════════════════════════════════');
  lines.push(FUNIL_NOME[kid].toUpperCase());
  lines.push(`Total de cards ativos: ${lista.length}`);
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('');

  let seq = 0;
  let faseAtual = null;
  for (const card of lista) {
    if (card.faseNome !== faseAtual) {
      faseAtual = card.faseNome;
      lines.push(`—— Fase: ${faseAtual}${card.faseOrdem < 9999 ? ` (ordem ${card.faseOrdem})` : ''} ——`);
      lines.push('');
    }
    seq += 1;
    lines.push(`${seq}. ${card.titulo}`);
    lines.push(`   Fase atual: ${card.faseNome}`);
    if (!card.comentarios.length) {
      lines.push('   Últimos comentários: (nenhum)');
      lines.push('');
      continue;
    }
    lines.push(`   Últimos ${Math.min(3, card.comentarios.length)} comentário(s):`);
    card.comentarios.forEach((cm, idx) => {
      const texto = clipTexto(cm.conteudo) || '(vazio)';
      const autor = (cm.autor_nome && String(cm.autor_nome).trim()) || '—';
      lines.push(`   (${idx + 1}) ${fmtData(cm.created_at)} — ${autor}`);
      // indentar cada linha do texto
      for (const tl of texto.split('\n')) {
        lines.push(`       ${tl}`);
      }
    });
    lines.push('');
  }
}

const text = lines.join('\n');
const outTxt = 'scripts/_tmp-sequencia-cards-comentarios.txt';
const outMd = 'scripts/_tmp-sequencia-cards-comentarios.md';
writeFileSync(outTxt, text, 'utf8');
writeFileSync(outMd, text, 'utf8');
console.log(text);
console.error('\n--- wrote', outTxt, 'chars', text.length);
