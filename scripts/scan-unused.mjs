/**
 * Análise estática → docs/DESUSO.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'src');

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) {
      if (['node_modules', '.next', '__pycache__'].includes(n.name)) continue;
      walk(p, exts, out);
    } else if (exts.some((e) => n.name.endsWith(e))) out.push(p);
  }
  return out;
}

const exts = ['.ts', '.tsx'];
const allFiles = walk(src, exts);
const read = (f) => fs.readFileSync(f, 'utf8');
const toPosix = (f) => f.split(path.sep).join('/');

const allBlob = allFiles.map((f) => read(f)).join('\n');
const otherBlob = (exclude) =>
  allFiles
    .filter((x) => x !== exclude)
    .map((f) => read(f))
    .join('\n');

// 1) components
const compDir = path.join(src, 'components');
const compFiles = fs.existsSync(compDir) ? walk(compDir, exts) : [];
const compUnused = [];
for (const f of compFiles) {
  const compBase = path.join(src, 'components');
  const compRel = toPosix(path.relative(compBase, f)).replace(/\.(tsx?)$/, '');
  const importPath = '@/' + toPosix(path.join('components', compRel));
  if (otherBlob(f).indexOf(importPath) === -1) {
    compUnused.push({
      arquivo: 'src/components/' + toPosix(path.relative(compBase, f)),
      import: importPath,
    });
  }
}

// 2) rotas
const appDir = path.join(src, 'app');
const appPages = walk(appDir, exts).filter((p) => toPosix(p).endsWith('page.tsx'));
const navBlob = allBlob;
const routeUnlinked = [];
for (const f of appPages) {
  const rel = toPosix(path.relative(path.join(src, 'app'), f)).replace(/(^|\/)page\.tsx$/, '');
  const pr = rel
    .split('/')
    .filter((s) => s && !/^\(/.test(s));
  const route = pr.length ? '/' + pr.join('/') : '/';
  if (route === '/page' || !route) continue;
  if (route === '/' && (navBlob.match(/['"`][ ]*\/[ ]*['"`]/) || navBlob.includes("href: '/'") || navBlob.includes('href="/"') || navBlob.includes("href: \"/\""))) { continue; }
  let found = false;
  for (const t of [route, route + '/']) {
    if (t.length < 1) continue;
    const e = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('["\']' + e + '["\']').test(navBlob) || new RegExp('`' + e + '`').test(navBlob)) { found = true; break; }
  }
  if (/\[/.test(route)) {
    const p = route.replace(/\/\[[^/]]+\]$/g, '') || route.replace(/\/\[[^/]]+\]$/g, '');
    if (p && p !== route && p.length > 0) {
      const e2 = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp('["\']' + e2 + '["\']').test(navBlob) || new RegExp('["\']' + e2 + '\/["\']').test(navBlob)) { found = true; }
    }
  }
  if (!found) routeUnlinked.push({ arquivo: toPosix(path.relative(root, f)), rota: route });
}

// 3) actions
const actSet = new Set([
  ...walk(path.join(src, 'lib', 'actions'), exts),
  ...allFiles.filter((p) => path.basename(p) === 'actions.ts'),
]);
const actFiles = [...actSet];
function actionExports(t) {
  const s = new Set();
  for (const m of t.matchAll(/export\s+async\s+function\s+(\w+)/g)) s.add(m[1]);
  for (const m of t.matchAll(/export\s+function\s+(\w+)/g)) s.add(m[1]);
  for (const m of t.matchAll(/export\s+const\s+(\w+)\s*[:=]/g)) s.add(m[1]);
  return s;
}
function isImportedInOther(name, fromFile) {
  const o = allFiles
    .filter((x) => x !== fromFile)
    .map((f) => read(f))
    .join('\n');
  for (const line of o.split('\n')) {
    if (!/^\s*import\s/.test(line) || /^\s*\/\//.test(line)) continue;
    if (!line.includes('from ')) continue;
    const m = line.match(/import\s*\{([^}]*)\}\s*from/);
    if (m) {
      const parts = m[1].split(',').map((p) => p.trim().split(/\s+as\s+/)[0].replace(/^\btype\s+/, '').trim());
      if (parts.includes(name)) return true;
    }
    if (new RegExp('^import\\s+type\\s*\\*\\s*as\\s+' + name + '\\b').test(line)) return true;
    if (new RegExp('^import\\s*\\*\\s*as\\s+' + name + '\\b').test(line)) return true;
    const def = line.match(/^\s*import\s+(\w+)\s+from/);
    if (def && def[1] === name) return true;
  }
  return false;
}
const actionUnused = [];
for (const f of actFiles) {
  const t = read(f);
  for (const name of actionExports(t)) {
    if (name.length < 2 || name === 'metadata' || name === 'default' || name.startsWith('_')) continue;
    if (!isImportedInOther(name, f)) {
      actionUnused.push({ arquivo: toPosix(path.relative(root, f)), export: name });
    }
  }
}

// 4) hooks
const hookFiles = [
  ...walk(path.join(src, 'hooks'), exts),
  ...walk(path.join(src, 'lib', 'hooks'), exts),
];
const hookUnused = [];
for (const f of hookFiles) {
  const rel = toPosix(path.relative(root, f));
  const fromSrc = toPosix(path.relative(src, f)).replace(/\.(tsx?)$/, '');
  const importPath = '@/' + fromSrc;
  const o = otherBlob(f);
  if (o.indexOf(importPath) === -1) {
    const base = path.basename(f, path.extname(f));
    const byName = o
      .split('\n')
      .some(
        (line) =>
          /^\s*import\s/.test(line) &&
          line.includes(base) &&
          line.includes('from'),
      );
    if (!byName) hookUnused.push({ arquivo: rel, simbolo: base, import: importPath });
  }
}

// 5) types in src/types
const typeRe = /export\s+(type|interface)\s+(\w+)/g;
const typeOrphans = [];
const typeFiles = walk(path.join(src, 'types'), ['.ts']);
for (const f of typeFiles) {
  if (f.endsWith('.d.ts')) continue;
  const t = read(f);
  for (const m of t.matchAll(typeRe)) {
    const tname = m[2];
    if (!tname) continue;
    const o = otherBlob(f);
    if (!o.includes(tname)) {
      typeOrphans.push({ arquivo: toPosix(path.relative(root, f)), export: tname });
    }
  }
}

// 5b) src/lib top-level .ts (not in subfolder)
const libOrphans = [];
const libTop = allFiles.filter((f) => {
  const p = toPosix(f);
  if (!p.match(/src\/lib\/[^/]+\.ts$/)) return false;
  if (p.includes('node_modules')) return false;
  return true;
});
for (const f of libTop) {
  const t = read(f);
  for (const m of t.matchAll(typeRe)) {
    const tname = m[2];
    if (!/^[A-Z]/.test(tname)) continue;
    const o = otherBlob(f);
    if (!o.includes(tname)) {
      libOrphans.push({ arquivo: toPosix(path.relative(root, f)), export: tname });
    }
  }
}

// --- geração docs/DESUSO.md
const outPath = path.join(root, 'docs', 'DESUSO.md');
const hoje = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push(`# Código de possível desuso (análise estática em \`src\`)`, '');
lines.push(`> Gerado em: **${hoje}** (script: \`scripts/scan-unused.mjs\`)`, '');
lines.push(
  '## Limitações (leia antes de apagar ficheiros)',
  '',
  '- A análise **não** executa a app, não resolve módulos como o TypeScript, e **ignora** ficheiros fora de `src/`.',
  '- **Componentes:** só procura a substring `@/components/...` noutros ficheiros. Imports relativos (`../components/`), re-exports dinâmicos, ou usos em testes/CI em pastas fora de `src` dão **falsos positivos**.',
  '- **Rotas (páginas “sem ligação”):** a rota derivada de `app/.../page.tsx` procura a path como string em ficheiros `src/**` (ex. `"/foo"` em `Link`, `href`, `redirect`, etc.). Não vê ligação por menus dinâmicos, middleware, sitemaps, ou atalhos noutro repositório.',
  '- **Actions:** export com nome; ignora padrões como `\"use server\"` em barrel files se o identificador não for importado por nome. **Falsos negativos** se só for usado com `import *` ou re-export com outro nome.',
  '- **Hooks / tipos:** hooks por `@/caminho` e nome; tipos com nome: se o **nome** não existir noutro ficheiro, lista como órfão. Nomes genéricos (`Data`, `Props`) têm muitos **falsos positivos**.',
  '',
);

function secNada() {
  lines.push('*Nada reportado com esta heurística.*', '');
}

lines.push('## 1. Componentes em `src/components/`: módulo não referido por `@/components/...`', '');
if (compUnused.length === 0) secNada();
else {
  for (const it of compUnused) {
    lines.push(
      `- **Ficheiro:** \`${it.arquivo}\` — **não** foi encontrada a substring de import \`${it.import}\` noutro ficheiro de \`src\` (apenas o próprio ficheiro é ignorado).`,
    );
  }
  lines.push('');
}

lines.push('## 2. Páginas `page.tsx` cuja rota (URL) não aparece como string noutro ficheiro de `src`', '');
if (routeUnlinked.length === 0) secNada();
else {
  for (const it of routeUnlinked) {
    lines.push(
      `- **Ficheiro:** \`${it.arquivo}\`  **Rota:** \`${it.rota}\` — **não** foi encontrada esta path como string em \`src\` (p.ex. \`Link\`, \`href\`, \`router.push\`, \`redirect\`); a heurística não vê ligação dinâmica nem middleware fora de \`src\`.`,
    );
  }
  lines.push('');
}

lines.push('## 3. Ficheiros `actions.ts` (e `src/lib/actions/**`): `export` com nome sem `import` desse identificador a partir de outro ficheiro', '');
if (actionUnused.length === 0) secNada();
else {
  for (const it of actionUnused) {
    lines.push(
      `- **Ficheiro:** \`${it.arquivo}\`  **identificador:** \`${it.export}\` — **não** foi encontrado \`import\` nomeado, default, nem \`* as ${it.export}\` a partir de outro ficheiro de \`src\`.`,
    );
  }
  lines.push('');
}

lines.push('## 4. Hooks (pastas `src/hooks/`, `src/lib/hooks/`): ficheiro não importado', '');
if (hookUnused.length === 0) secNada();
else {
  for (const it of hookUnused) {
    lines.push(
      `- **Ficheiro:** \`${it.arquivo}\`  **Símbolo (nome ficheiro):** \`${it.simbolo}\` — **não** ocorre \`${it.import}\` noutro ficheiro, nem linha de \`import\` contendo o nome. **Confirmação:** o módulo não é referido pelo alias usado (heurística).`,
    );
  }
  lines.push('');
}

lines.push('## 5. Tipos (`export type` / `export interface`) com nome de tipo sem ocorrência noutro ficheiro de `src`', '', '### 5.1. Em `src/types/**` (exceto `.d.ts`)', '');
if (typeOrphans.length === 0) secNada();
else {
  for (const it of typeOrphans) {
    lines.push(
      `- \`${it.arquivo}\` — \`${it.export}\` — **não** ocorre o nome noutro ficheiro (texto) em \`src\` excluindo o próprio ficheiro. *Pode ser falso positivo* (nomes comuns, só usados em ficheiros fora de \`src\`, etc.).`,
    );
  }
  lines.push('');
}
lines.push('### 5.2. Ficheiros `.ts` de topo em `src/lib/*.ts` (não subpastas) — `export` com nome a começar por maiúscula e nome não reutilizado', '');
if (libOrphans.length === 0) secNada();
else {
  for (const it of libOrphans) {
    lines.push(
      `- \`${it.arquivo}\` — \`${it.export}\` — **não** ocorre o nome a seguir a \`import\` ou em texto a referir o tipo, noutro ficheiro. *Heurística arriscada.*`,
    );
  }
  lines.push('');
}

if (!fs.existsSync(path.join(root, 'docs'))) fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log('Gravado:', toPosix(path.relative(root, outPath)));
