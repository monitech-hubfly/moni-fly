/**
 * Falha o build se houver marcadores de conflito git em src/ (e styles).
 * Causa histórica do board Kanban “empilhado” no desktop: conflito commitado
 * quebra o compile → CSS/JS 404 → layout sem flex (colunas em lista estreita).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const ROOTS = ['src', 'supabase/migrations'].filter((d) => {
  try {
    return statSync(join(ROOT, d)).isDirectory();
  } catch {
    return false;
  }
});

const EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.md',
  '.sql',
  '.json',
]);

const MARKER = /^(<<<<<<<|=======|>>>>>>>)($|\s)/m;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else {
      const i = name.lastIndexOf('.');
      const ext = i >= 0 ? name.slice(i) : '';
      if (EXT.has(ext)) out.push(p);
    }
  }
  return out;
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!MARKER.test(text)) continue;
    const lines = text.split(/\r?\n/);
    const at = [];
    lines.forEach((line, idx) => {
      if (/^(<<<<<<<|=======|>>>>>>>)/.test(line)) at.push(idx + 1);
    });
    hits.push({ file: relative(ROOT, file), lines: at.slice(0, 8) });
  }
}

if (hits.length) {
  console.error(
    'ERRO: marcadores de conflito git encontrados. Remova-os antes do build — eles quebram o layout do Kanban (CSS 404).',
  );
  for (const h of hits) {
    console.error(`  ${h.file}:${h.lines.join(',')}`);
  }
  process.exit(1);
}

console.log('check-no-conflict-markers: ok');
