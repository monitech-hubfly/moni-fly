/**
 * Gera o SQL de carga de public.customizacao_itens a partir da planilha Itens_customizacao_casas.xlsx.
 *
 * Uso:
 *   npx --yes tsx scripts/gerar-sql-customizacao-itens.ts [planilha.xlsx] [saida.sql]
 *
 * Padrões: ./Itens_customizacao_casas.xlsx → supabase/seed/customizacao_itens_carga.sql
 * O SQL é idempotente (upsert por item) e não apaga itens que saíram da planilha.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { IMOB_PRODUTOS_MODELO } from '../src/lib/kanban/imob-simulacoes-card';

const ABA = 'Itens';
const COL_ITEM = 'Item';
const COL_DESCRICAO = 'Descrição';
const COL_VALOR_PADRAO = 'Valor padrão';
const COL_ATIVO = 'Ativo';

type ItemCarga = {
  item: string;
  descricao: string | null;
  valor_padrao: number | null;
  valores_por_modelo: Record<string, number>;
  ativo: boolean;
  ordem: number;
};

function normalizarNome(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[™®]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function normalizarCabecalho(s: string): string {
  return String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function texto(v: unknown): string {
  return v == null ? '' : String(v).normalize('NFC').trim();
}

function parseValor(v: unknown, onde: string): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) throw new Error(`${onde}: valor inválido (${v}).`);
    return Math.round(v * 100) / 100;
  }
  const t = String(v).replace(/R\$/gi, '').replace(/\s/g, '').trim();
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${onde}: valor inválido ("${String(v)}").`);
  return Math.round(n * 100) / 100;
}

function parseAtivo(v: unknown, onde: string): boolean {
  const t = normalizarNome(texto(v)).normalize('NFD').replace(/\p{M}/gu, '');
  if (['sim', 's', 'true', '1'].includes(t)) return true;
  if (['nao', 'n', 'false', '0'].includes(t)) return false;
  throw new Error(`${onde}: Ativo deve ser "Sim" ou "Não" (veio "${texto(v)}").`);
}

function sqlTexto(s: string | null): string {
  return s == null ? 'NULL' : `'${s.replace(/'/g, "''")}'`;
}

function sqlNumero(n: number | null): string {
  return n == null ? 'NULL' : n.toFixed(2);
}

function lerPlanilha(arquivo: string): { itens: ItemCarga[]; modelos: string[] } {
  const wb = XLSX.readFile(arquivo);
  const ws = wb.Sheets[ABA];
  if (!ws) throw new Error(`Aba "${ABA}" não encontrada. Abas: ${wb.SheetNames.join(', ')}.`);

  const linhas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
  const cabecalho = (linhas[0] ?? []).map((c) => normalizarCabecalho(String(c ?? '')));
  const idx = (nome: string) => cabecalho.findIndex((c) => c === nome);

  const iItem = idx(COL_ITEM);
  const iDescricao = idx(COL_DESCRICAO);
  const iValorPadrao = idx(COL_VALOR_PADRAO);
  const iAtivo = idx(COL_ATIVO);
  const faltando = [
    [COL_ITEM, iItem],
    [COL_VALOR_PADRAO, iValorPadrao],
    [COL_ATIVO, iAtivo],
  ].filter(([, i]) => i === -1);
  if (faltando.length) {
    throw new Error(`Colunas obrigatórias ausentes: ${faltando.map(([n]) => n).join(', ')}.`);
  }

  const oficiais = new Map(IMOB_PRODUTOS_MODELO.map((m) => [normalizarNome(m), m as string]));
  const colunasModelo: { i: number; modelo: string }[] = [];
  const naoCasados: string[] = [];
  cabecalho.forEach((c, i) => {
    if (i === iValorPadrao) return;
    const m = /^Valor\s+(.+)$/i.exec(c);
    if (!m) return;
    const oficial = oficiais.get(normalizarNome(m[1]));
    if (oficial) colunasModelo.push({ i, modelo: oficial });
    else naoCasados.push(c);
  });
  if (naoCasados.length) {
    throw new Error(
      `Colunas de modelo sem correspondência na lista oficial do Hub Fly: ${naoCasados.join(', ')}.\n` +
        `Modelos oficiais: ${IMOB_PRODUTOS_MODELO.join(', ')}.`,
    );
  }

  const itens: ItemCarga[] = [];
  const vistos = new Set<string>();
  linhas.slice(1).forEach((linha, k) => {
    const n = k + 2;
    const item = texto(linha[iItem]);
    if (!item) return;
    const onde = `Linha ${n} ("${item}")`;
    if (vistos.has(item)) throw new Error(`${onde}: item repetido na planilha.`);
    vistos.add(item);

    const valores_por_modelo: Record<string, number> = {};
    for (const { i, modelo } of colunasModelo) {
      const v = parseValor(linha[i], `${onde}, coluna "${cabecalho[i]}"`);
      if (v != null) valores_por_modelo[modelo] = v;
    }
    const valor_padrao = parseValor(linha[iValorPadrao], `${onde}, coluna "${COL_VALOR_PADRAO}"`);
    if (valor_padrao == null && Object.keys(valores_por_modelo).length === 0) {
      throw new Error(`${onde}: sem Valor padrão e sem valor por modelo.`);
    }

    itens.push({
      item,
      descricao: iDescricao === -1 ? null : texto(linha[iDescricao]) || null,
      valor_padrao,
      valores_por_modelo,
      ativo: parseAtivo(linha[iAtivo], onde),
      ordem: itens.length + 1,
    });
  });

  if (itens.length === 0) throw new Error('Nenhum item encontrado na aba Itens.');
  return { itens, modelos: colunasModelo.map((c) => c.modelo) };
}

function gerarSql(itens: ItemCarga[], origem: string, modelos: string[]): string {
  const valores = itens
    .map(
      (it) =>
        `  (${sqlTexto(it.item)}, ${sqlTexto(it.descricao)}, ${sqlNumero(it.valor_padrao)}, ` +
        `${sqlTexto(JSON.stringify(it.valores_por_modelo))}::jsonb, ${it.ativo}, ${it.ordem})`,
    )
    .join(',\n');

  return `-- Carga de public.customizacao_itens (gerado por scripts/gerar-sql-customizacao-itens.ts)
-- Origem: ${origem}
-- Gerado em: ${new Date().toISOString()}
-- Itens: ${itens.length} (${itens.filter((i) => i.ativo).length} ativos)
-- Modelos com preço próprio: ${modelos.length ? modelos.join(', ') : '(nenhum)'}
-- Idempotente: upsert por item. Itens fora da planilha não são apagados.
-- Requer a migration 639_customizacao_itens.sql.

BEGIN;

INSERT INTO public.customizacao_itens
  (item, descricao, valor_padrao, valores_por_modelo, ativo, ordem)
VALUES
${valores}
ON CONFLICT (item) DO UPDATE SET
  descricao          = EXCLUDED.descricao,
  valor_padrao       = EXCLUDED.valor_padrao,
  valores_por_modelo = EXCLUDED.valores_por_modelo,
  ativo              = EXCLUDED.ativo,
  ordem              = EXCLUDED.ordem;

COMMIT;

SELECT item, valor_padrao, valores_por_modelo, ativo, ordem
FROM public.customizacao_itens
ORDER BY ordem, item;
`;
}

function main() {
  const raiz = process.cwd();
  const entrada = path.resolve(raiz, process.argv[2] ?? 'Itens_customizacao_casas.xlsx');
  const saida = path.resolve(raiz, process.argv[3] ?? 'supabase/seed/customizacao_itens_carga.sql');
  if (!fs.existsSync(entrada)) throw new Error(`Planilha não encontrada: ${entrada}`);

  const { itens, modelos } = lerPlanilha(entrada);
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, gerarSql(itens, path.basename(entrada), modelos), 'utf8');

  console.log(`SQL gerado: ${path.relative(raiz, saida)}`);
  for (const it of itens) {
    const porModelo = Object.entries(it.valores_por_modelo)
      .map(([m, v]) => `${m}=${v}`)
      .join(', ');
    console.log(
      `  ${it.ordem}. ${it.item} | padrão ${it.valor_padrao ?? '—'}${porModelo ? ` | ${porModelo}` : ''} | ${it.ativo ? 'ativo' : 'inativo'}`,
    );
  }
}

try {
  main();
} catch (e) {
  console.error(`[gerar-sql-customizacao-itens] ${(e as Error).message}`);
  process.exit(1);
}
