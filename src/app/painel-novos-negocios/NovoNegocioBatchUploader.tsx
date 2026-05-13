'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { createProcesso } from '@/app/step-one/actions';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

type TipoNegociacao = 'Permuta' | 'Permuta + Compra e venda' | 'Compra e Venda';
type ProdutoModelo =
  | 'Lis (Carbon/ita)'
  | 'Cissa (Vista)'
  | 'Gal (Moni One)'
  | 'Ivy (Fly Standard)'
  | 'Eva (Fly Premium)'
  | 'Mia (Birá)'
  | 'Sol';

const OPCOES_TIPO_NEGOCIACAO_TERRENO: Array<{ value: TipoNegociacao; label: string }> = [
  { value: 'Permuta', label: 'Permuta' },
  { value: 'Permuta + Compra e venda', label: 'Permuta + Compra e venda' },
  { value: 'Compra e Venda', label: 'Compra e Venda' },
];

const OPCOES_PRODUTO_MODELO_CASA: Array<{ value: ProdutoModelo; label: string }> = [
  { value: 'Lis (Carbon/ita)', label: 'Lis (Carbon/ita)' },
  { value: 'Cissa (Vista)', label: 'Cissa (Vista)' },
  { value: 'Gal (Moni One)', label: 'Gal (Moni One)' },
  { value: 'Ivy (Fly Standard)', label: 'Ivy (Fly Standard)' },
  { value: 'Eva (Fly Premium)', label: 'Eva (Fly Premium)' },
  { value: 'Mia (Birá)', label: 'Mia (Birá)' },
  { value: 'Sol', label: 'Sol' },
];

type AreaAtuacao = { estado: string; cidade: string };

function parseAreaAtuacaoRede(raw: string | null | undefined): AreaAtuacao[] {
  if (!raw) return [];
  const parts = raw
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean);

  const out: AreaAtuacao[] = [];
  for (const part of parts) {
    // Ex.: "SP - Campinas"
    const segs = part.split('-').map((s) => s.trim());
    if (segs.length < 2) continue;
    const estado = segs[0] ?? '';
    const cidade = segs.slice(1).join('-').trim();
    if (estado && cidade) out.push({ estado, cidade });
  }
  return out;
}

function uniqueSorted(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

function formatQuadraLote(quadra: string, lote: string): string | null {
  const q = quadra.trim();
  const l = lote.trim();
  const hasQ = q.length > 0;
  const hasL = l.length > 0;
  if (!hasQ && !hasL) return null;
  if (hasQ && hasL) return `${q}, ${l}`;
  return hasQ ? q : l;
}

function sanitizeMoedaInput(val: string): string {
  const cleaned = String(val ?? '').replace(/[^\d.,]/g, '');
  if (!cleaned) return '';

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const lastSep = Math.max(lastComma, lastDot);

  if (lastSep === -1) return cleaned.replace(/[.,]/g, '');

  const intPart = cleaned.slice(0, lastSep).replace(/[.,]/g, '');
  const decRaw = cleaned.slice(lastSep + 1).replace(/[.,]/g, '');
  const decPart = decRaw.slice(0, 2);
  const intClean = intPart || '0';
  if (!decPart) return intClean;
  return `${intClean},${decPart}`;
}

function moedaStringToNumber(input: string): number | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  // Remove milhar (pontos) e troca vírgula decimal por ponto.
  // Aceita tanto "1.234,56" quanto "1234,56" e "1234.56".
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function moedaStringToNumericString(input: string): string | null {
  const num = moedaStringToNumber(input);
  if (num == null) return null;
  if (num <= 0) return null;
  return num.toFixed(2);
}

function isValidHttpUrl(url: string): boolean {
  const s = String(url ?? '').trim();
  if (!s) return true;
  return /^https?:\/\/.+/i.test(s);
}

function parseFirstAreaFromRede(raw: string | null | undefined): { estado: string; cidade: string } | null {
  const areas = parseAreaAtuacaoRede(raw);
  if (!areas.length) return null;
  return { estado: areas[0].estado ?? '', cidade: areas[0].cidade ?? '' };
}

const NOVO_NEGOCIO_TEMPLATE_COLUMNS = [
  // Identificação do franqueado (para mapear automaticamente)
  'n_franquia',
  'franqueado_nome',
  // Dados do card / etapa step_2
  'tipo_negociacao',
  'valor_terreno',
  'vgv_pretendido',
  'produto_modelo',
  'link_pasta_drive',
  'nome_condominio',
  'quadra',
  'lote',
  'observacoes',
  // Opcional (caso existam múltiplas opções de área_atuacao)
  'estado',
  'cidade',
] as const;

function buildNovoNegocioTemplateCsv(): string {
  // Delimitador ";" para funcionar bem em Excel BR com decimais em vírgula.
  const sep = ';';
  const headers = [...NOVO_NEGOCIO_TEMPLATE_COLUMNS].join(sep);
  const exampleRow = [
    'FK0001',
    '',
    'Permuta + Compra e venda',
    'R$ 1.500.000,00',
    'R$ 2.100.000,00',
    'Lis (Carbon/ita)',
    'https://drive.google.com/...',
    'Condomínio Exemplo',
    'Quadra 1',
    'Lote 12',
    'Observações aqui',
    '', // estado (opcional)
    '', // cidade (opcional)
  ];
  const example = exampleRow.join(sep);
  return `${headers}\n${example}\n`;
}

function downloadTextFile(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type NovoNegocioBatchRow = {
  id: string;

  franqueadoId: string | null;
  nome_franqueado: string;
  n_franquia: string;
  email_franqueado: string;

  estadosOptions: string[];
  cidadesOptions: string[];
  estado: string;
  cidade: string;

  tipo_negociacao: TipoNegociacao | '';
  valor_terreno: string;
  vgv_pretendido: string;
  produto_modelo: ProdutoModelo | '';

  link_pasta_drive: string;
  nome_condominio: string;
  quadra: string;
  lote: string;
  observacoes: string;
};

type RowErrorKey =
  | 'franqueado'
  | 'estado'
  | 'cidade'
  | 'tipo_negociacao'
  | 'valor_terreno'
  | 'vgv_pretendido'
  | 'produto_modelo'
  | 'link_pasta_drive'
  | 'nome_condominio';

type RowErrors = Partial<Record<RowErrorKey, string>>;

function emptyRow(): NovoNegocioBatchRow {
  return {
    id: crypto.randomUUID(),
    franqueadoId: null,
    nome_franqueado: '',
    n_franquia: '',
    email_franqueado: '',
    estadosOptions: [],
    cidadesOptions: [],
    estado: '',
    cidade: '',
    tipo_negociacao: '',
    valor_terreno: '',
    vgv_pretendido: '',
    produto_modelo: '',
    link_pasta_drive: '',
    nome_condominio: '',
    quadra: '',
    lote: '',
    observacoes: '',
  };
}

function FieldError({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="mt-1 text-xs text-red-600">{text}</p>;
}

function MoedaInput({
  value,
  onChange,
  placeholder,
  inputId,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputId: string;
  error?: string;
}) {
  return (
    <div>
      <div className="mt-1 flex items-center rounded-lg border border-stone-300 px-3 py-2 focus-within:border-moni-accent focus-within:ring-1 focus-within:ring-moni-accent">
        <span className="mr-2 text-sm font-medium text-stone-500">R$</span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(sanitizeMoedaInput(e.target.value))}
          placeholder={placeholder ?? '0,00'}
          className={`w-full border-0 bg-transparent p-0 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none ${
            error ? 'text-red-700' : ''
          }`}
        />
      </div>
      <FieldError text={error} />
    </div>
  );
}

function FranqueadoCombobox({
  valueId,
  valueNome,
  items,
  loading,
  onSelect,
  error,
}: {
  valueId: string | null;
  valueNome: string;
  items: RedeFranqueadoRowDb[];
  loading?: boolean;
  onSelect: (fr: RedeFranqueadoRowDb) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 15);
    return items
      .filter((f) => {
        const nome = String(f.nome_completo ?? '').toLowerCase();
        const num = String(f.n_franquia ?? '').toLowerCase();
        return nome.includes(q) || num.includes(q) || String(f.id).includes(q);
      })
      .slice(0, 15);
  }, [items, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef && !containerRef.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [containerRef]);

  const inputValue = open ? query : valueNome;

  return (
    <div>
      <div ref={setContainerRef} className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`mt-1 w-full rounded-lg border px-3 py-2 text-left text-sm ${
            open ? 'border-moni-accent bg-white' : 'border-stone-300 bg-white'
          }`}
        >
          {inputValue ? inputValue : loading ? 'Carregando…' : '— Selecione o franqueado —'}
        </button>

        {open && (
          <div
            className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg"
            role="dialog"
          >
            <div className="border-b border-stone-200 p-2">
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou nº da franquia"
                className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              />
            </div>

            <ul className="max-h-56 overflow-auto py-1" role="listbox">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-stone-500">Nenhum franqueado encontrado.</li>
              ) : (
                filtered.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-stone-100 ${
                        valueId === f.id ? 'bg-moni-primary/10 font-medium text-moni-dark' : 'text-stone-800'
                      }`}
                      onClick={() => {
                        onSelect(f);
                        setQuery('');
                        setOpen(false);
                      }}
                    >
                      {f.nome_completo ?? 'Sem nome'}
                      {(f.n_franquia ?? null) && f.nome_completo ? (
                        <span className="ml-1 text-stone-500">({f.n_franquia})</span>
                      ) : null}
                      {valueId === f.id ? (
                        <span className="ml-2 text-[11px] text-stone-400">(selecionado)</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="border-t border-stone-200 p-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
      <FieldError text={error} />
    </div>
  );
}

export function NovoNegocioBatchUploader({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [franqueados, setFranqueados] = useState<RedeFranqueadoRowDb[]>([]);
  const [loadingFranqueados, setLoadingFranqueados] = useState(false);

  const [rows, setRows] = useState<NovoNegocioBatchRow[]>([emptyRow()]);
  const [errorsByRowId, setErrorsByRowId] = useState<Record<string, RowErrors>>({});

  const resetFormState = () => {
    setRows([emptyRow()]);
    setErrorsByRowId({});
    setSuccessMsg(null);
    setImportError(null);
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoadingFranqueados(true);
      try {
        const { data, error } = await supabase
          .from('rede_franqueados')
          .select('id, nome_completo, n_franquia, email_frank, area_atuacao, status_franquia')
          .eq('status_franquia', 'Em Operação')
          .order('nome_completo', { ascending: true });
        if (error) throw error;
        if (!alive) return;
        setFranqueados((data ?? []) as RedeFranqueadoRowDb[]);
      } catch (e) {
        // Não bloqueia a UI inteira; o usuário pode tentar novamente.
        // eslint-disable-next-line no-console
        console.error('Erro ao carregar franqueados para lote:', e);
      } finally {
        if (alive) setLoadingFranqueados(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, supabase]);

  const validateRow = (row: NovoNegocioBatchRow): RowErrors => {
    const errs: RowErrors = {};
    const tipoAllowed = new Set(OPCOES_TIPO_NEGOCIACAO_TERRENO.map((o) => o.value));
    if (row.tipo_negociacao && !tipoAllowed.has(row.tipo_negociacao as TipoNegociacao)) {
      errs.tipo_negociacao = 'Tipo de negociação inválido.';
    }
    const produtoAllowed = new Set(OPCOES_PRODUTO_MODELO_CASA.map((o) => o.value));
    if (row.produto_modelo && !produtoAllowed.has(row.produto_modelo as ProdutoModelo)) {
      errs.produto_modelo = 'Produto/modelo inválido.';
    }

    if (row.link_pasta_drive.trim() && !isValidHttpUrl(row.link_pasta_drive)) {
      errs.link_pasta_drive = 'Informe uma URL válida (http/https).';
    }

    return errs;
  };

  const validateAll = (): boolean => {
    const next: Record<string, RowErrors> = {};
    let anyError = false;
    for (const r of rows) {
      const e = validateRow(r);
      if (Object.keys(e).length > 0) anyError = true;
      next[r.id] = e;
    }
    setErrorsByRowId(next);
    return !anyError;
  };

  const handleDownloadTemplate = () => {
    const csv = buildNovoNegocioTemplateCsv();
    downloadTextFile('novo-negocio-lote-template.csv', csv, 'text/csv;charset=utf-8');
  };

  const handleImportFile = async (file: File) => {
    setImportLoading(true);
    setImportError(null);
    try {
      if (loadingFranqueados || franqueados.length === 0) {
        throw new Error('Aguarde o carregamento dos franqueados antes de importar.');
      }

      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) throw new Error('Planilha inválida (sem aba).');

      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Array<Record<string, unknown>>;

      const getStr = (obj: Record<string, unknown>, key: string) => String(obj[key] ?? '').trim();

      const tipoAllowed = new Set(OPCOES_TIPO_NEGOCIACAO_TERRENO.map((o) => o.value));
      const produtoAllowed = new Set(OPCOES_PRODUTO_MODELO_CASA.map((o) => o.value));

      const imported: NovoNegocioBatchRow[] = [];
      for (const obj of json) {
        const hintN = getStr(obj, 'n_franquia');
        const hintNome = getStr(obj, 'franqueado_nome');

        const tipo = getStr(obj, 'tipo_negociacao');
        const valorTerreno = getStr(obj, 'valor_terreno');
        const vgvPretendido = getStr(obj, 'vgv_pretendido');
        const produtoModelo = getStr(obj, 'produto_modelo');
        const link = getStr(obj, 'link_pasta_drive');
        const nomeCondominio = getStr(obj, 'nome_condominio');
        const quadra = getStr(obj, 'quadra');
        const lote = getStr(obj, 'lote');
        const observacoes = getStr(obj, 'observacoes');
        const estadoImported = getStr(obj, 'estado');
        const cidadeImported = getStr(obj, 'cidade');

        // Linha "vazia" (tenta ignorar).
        const hasAny =
          Boolean(hintN) ||
          Boolean(hintNome) ||
          Boolean(tipo) ||
          Boolean(valorTerreno) ||
          Boolean(vgvPretendido) ||
          Boolean(produtoModelo) ||
          Boolean(nomeCondominio) ||
          Boolean(link) ||
          Boolean(quadra) ||
          Boolean(lote) ||
          Boolean(observacoes);
        if (!hasAny) continue;

        const fr =
          hintN
            ? franqueados.find((f) => String(f.n_franquia ?? '').trim() === hintN) ?? null
            : hintNome
              ? franqueados.find((f) => String(f.nome_completo ?? '').trim().toLowerCase() === hintNome.toLowerCase()) ?? null
              : null;

        const row = emptyRow();
        row.tipo_negociacao = tipo as any;
        row.valor_terreno = sanitizeMoedaInput(valorTerreno);
        row.vgv_pretendido = sanitizeMoedaInput(vgvPretendido);
        row.produto_modelo = produtoModelo as any;
        row.link_pasta_drive = link;
        row.nome_condominio = nomeCondominio;
        row.quadra = quadra;
        row.lote = lote;
        row.observacoes = observacoes;

        if (fr) {
          const parsed = parseAreaAtuacaoRede(fr.area_atuacao);
          const estadosOptions = uniqueSorted(parsed.map((a) => a.estado));
          const defaultEstado = estadosOptions.length === 1 ? estadosOptions[0] : '';
          const estadoSel = estadoImported && estadosOptions.includes(estadoImported) ? estadoImported : defaultEstado;

          const citiesForEstado = estadoSel
            ? uniqueSorted(parsed.filter((a) => a.estado === estadoSel).map((a) => a.cidade))
            : [];
          const defaultCidade = citiesForEstado.length === 1 ? citiesForEstado[0] : '';
          const cidadeSel = cidadeImported && citiesForEstado.includes(cidadeImported) ? cidadeImported : defaultCidade;

          row.franqueadoId = fr.id;
          row.nome_franqueado = fr.nome_completo ?? '';
          row.n_franquia = fr.n_franquia ?? '';
          row.email_franqueado = fr.email_frank ?? '';
          row.estadosOptions = estadosOptions;
          row.cidadesOptions = citiesForEstado;
          row.estado = estadoSel;
          row.cidade = cidadeSel;
        } else {
          row.franqueadoId = null;
          row.nome_franqueado = hintNome;
          row.n_franquia = hintN;
          row.email_franqueado = '';
          row.estadosOptions = estadoImported ? [estadoImported] : [];
          row.cidadesOptions = cidadeImported ? [cidadeImported] : [];
          row.estado = estadoImported;
          row.cidade = cidadeImported;
        }

        // Early-normalize para ajudar validação.
        if (row.tipo_negociacao && !tipoAllowed.has(row.tipo_negociacao as TipoNegociacao)) row.tipo_negociacao = row.tipo_negociacao;
        if (row.produto_modelo && !produtoAllowed.has(row.produto_modelo as ProdutoModelo)) row.produto_modelo = row.produto_modelo;

        imported.push(row);
      }

      if (imported.length === 0) {
        throw new Error('Nenhuma linha válida encontrada no arquivo.');
      }

      setRows(imported);
      setSuccessMsg(null);

      // Validação imediata (para mostrar erros inline).
      const nextErrors: Record<string, RowErrors> = {};
      let anyError = false;
      for (const r of imported) {
        const e = validateRow(r);
        if (Object.keys(e).length > 0) anyError = true;
        nextErrors[r.id] = e;
      }
      setErrorsByRowId(nextErrors);
      if (!anyError) setImportError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao importar planilha.';
      setImportError(msg);
    } finally {
      setImportLoading(false);
    }
  };

  const updateRow = (rowId: string, patch: Partial<NovoNegocioBatchRow>) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const applyFranqueadoToRow = (rowId: string, fr: RedeFranqueadoRowDb) => {
    const parsed = parseAreaAtuacaoRede(fr.area_atuacao);
    const estadosOptions = uniqueSorted(parsed.map((a) => a.estado));
    const defaultEstado = estadosOptions.length === 1 ? estadosOptions[0] : '';

    const citiesForEstado = defaultEstado
      ? uniqueSorted(parsed.filter((a) => a.estado === defaultEstado).map((a) => a.cidade))
      : [];

    const cidadeOptions = citiesForEstado;
    const defaultCidade = cidadeOptions.length === 1 ? cidadeOptions[0] : '';

    setRows((prev) =>
      prev.map((r) =>
        r.id !== rowId
          ? r
          : {
              ...r,
              franqueadoId: fr.id,
              nome_franqueado: fr.nome_completo ?? '',
              n_franquia: fr.n_franquia ?? '',
              email_franqueado: fr.email_frank ?? '',
              estadosOptions,
              cidadesOptions: citiesForEstado,
              estado: defaultEstado,
              cidade: defaultCidade,
            },
      ),
    );
  };

  const recalcCitiesForEstado = (rowId: string, estado: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row?.franqueadoId) return;
    const fr = franqueados.find((f) => f.id === row.franqueadoId);
    if (!fr) return;
    const parsed = parseAreaAtuacaoRede(fr.area_atuacao);
    const cities = uniqueSorted(parsed.filter((a) => a.estado === estado).map((a) => a.cidade));
    const nextCidade = cities.length === 1 ? cities[0] : '';
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, estado, cidadesOptions: cities, cidade: nextCidade } : r)));
  };

  const handleSubmit = async () => {
    setSuccessMsg(null);
    setErrorsByRowId({});
    if (loading) return;

    const ok = validateAll();
    if (!ok) return;

    setLoading(true);
    try {
      // Inserção sequencial para dar uma falha "limpa" e evitar sobrecarga.
      for (const row of rows) {
        const fr = franqueados.find((f) => f.id === row.franqueadoId) ?? null;
        const fallbackArea = parseFirstAreaFromRede(fr?.area_atuacao ?? null);
        const cidade = row.cidade.trim() || fallbackArea?.cidade || 'A definir';
        const estado = row.estado.trim() || fallbackArea?.estado || 'UF';
        const tipo = row.tipo_negociacao || '';

        const valorNumeric = moedaStringToNumericString(row.valor_terreno);
        const vgvNumeric = moedaStringToNumericString(row.vgv_pretendido);

        await createProcesso(
          cidade,
          estado,
          tipo || null,
          row.observacoes.trim() || null,
          'step_2',
          {
            nomeFranqueado: row.nome_franqueado.trim() || null,
            emailFranqueado: row.email_franqueado.trim() || null,
            nomeCondominio: row.nome_condominio.trim() || null,
            quadraLote: formatQuadraLote(row.quadra, row.lote),
            tipoNegociacaoTerreno: tipo || null,
            valorTerreno: valorNumeric,
            vgvPretendido: vgvNumeric,
            produtoModeloCasa: row.produto_modelo || null,
            linkPastaDrive: row.link_pasta_drive.trim() ? row.link_pasta_drive.trim() : null,
            observacoes: row.observacoes.trim() || null,
          },
          fr
            ? {
                numeroFranquia: fr.n_franquia ?? null,
                modalidade: fr.modalidade ?? null,
                nomeCompletoFranqueado: fr.nome_completo ?? null,
                statusFranquia: fr.status_franquia ?? null,
                classificacaoFranqueado: fr.classificacao_franqueado ?? null,
                areaAtuacaoFranquia: fr.area_atuacao ?? null,
                emailFrank: fr.email_frank ?? null,
                responsavelComercial: fr.responsavel_comercial ?? null,
                tamanhoCamisetaFrank: (fr as any).tamanho_camisa_frank ?? null,
                socios: fr.socios ?? null,
                telefoneFrank: fr.telefone_frank ?? null,
                cpfFrank: fr.cpf_frank ?? null,
                dataNascFrank: fr.data_nasc_frank ?? null,
                dataAssCof: fr.data_ass_cof ?? null,
                dataAssContrato: fr.data_ass_contrato ?? null,
                dataExpiracaoFranquia: fr.data_expiracao_franquia ?? null,
                enderecoCasaRuaFrank: fr.endereco_casa_frank ?? null,
                enderecoCasaNumeroFrank: fr.endereco_casa_frank_numero ?? null,
                enderecoCasaComplementoFrank: fr.endereco_casa_frank_complemento ?? null,
                cepCasaFrank: fr.cep_casa_frank ?? null,
                estadoCasaFrank: fr.estado_casa_frank ?? null,
                cidadeCasaFrank: fr.cidade_casa_frank ?? null,
              }
            : null,
        );
      }

      setSuccessMsg('Processos criados com sucesso.');
      setRows([emptyRow()]);
      setErrorsByRowId({});
      onCreated?.();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao criar processos em lote.';
      setSuccessMsg(msg);
      // eslint-disable-next-line no-console
      console.error(msg, e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetFormState();
          setOpen(true);
        }}
        className="w-full rounded-md border border-stone-300 bg-transparent px-2 py-1 text-center text-[11px] font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-800"
      >
        Subir em lote
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-stone-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-stone-800">Novo Negócio (upload em lote)</h3>
                <p className="mt-1 text-xs text-stone-500">
                  Selecione o franqueado para auto-preencher nº, e-mail e as opções de Estado/Cidade.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetFormState();
                  setOpen(false);
                }}
                className="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm text-stone-700 hover:bg-stone-50"
              >
                Fechar
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto p-4">
              <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-stone-700">Importar planilha</p>
                    <p className="mt-1 text-xs text-stone-500">
                      Baixe o template e faça o upload (as colunas `n_franquia` / `franqueado_nome` mapeiam o franqueado automaticamente).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      disabled={importLoading}
                      className="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                    >
                      Baixar template
                    </button>
                    <label className="cursor-pointer rounded-md border border-moni-primary bg-white px-3 py-1 text-xs font-medium text-moni-primary hover:bg-stone-50 disabled:opacity-60">
                      {importLoading ? 'Importando…' : 'Upload da planilha'}
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        disabled={importLoading}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          handleImportFile(file);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                {importError ? <p className="mt-2 text-xs text-red-600">{importError}</p> : null}
              </div>

              {successMsg ? (
                <div
                  className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
                    successMsg.startsWith('Processos') ? 'border-green-200 bg-green-50/50 text-green-800' : 'border-red-200 bg-red-50/50 text-red-800'
                  }`}
                >
                  {successMsg}
                </div>
              ) : null}

              {rows.map((row, idx) => {
                const rowErrors = errorsByRowId[row.id] ?? {};
                return (
                  <div key={row.id} className="mb-4 rounded-lg border border-stone-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-stone-700">Linha {idx + 1}</p>
                        {(row.nome_franqueado || row.n_franquia || row.email_franqueado) && (
                          <p className="mt-1 text-xs text-stone-500">
                            {row.nome_franqueado ? row.nome_franqueado : '—'} {row.n_franquia ? `(${row.n_franquia})` : ''}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRows((prev) => prev.filter((r) => r.id !== row.id));
                          setErrorsByRowId((prev) => {
                            const next = { ...prev };
                            delete next[row.id];
                            return next;
                          });
                        }}
                        disabled={rows.length === 1}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-stone-700">Nome do Franqueado</label>
                        <FranqueadoCombobox
                          valueId={row.franqueadoId}
                          valueNome={row.nome_franqueado}
                          items={franqueados}
                          loading={loadingFranqueados}
                          onSelect={(fr) => applyFranqueadoToRow(row.id, fr)}
                          error={rowErrors.franqueado}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">Número da Franquia</label>
                        <div className="mt-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                          {row.n_franquia || '—'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">E-mail do Franqueado</label>
                        <div className="mt-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                          {row.email_franqueado || '—'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">Estado (UF)</label>
                        {row.estadosOptions.length <= 1 ? (
                          <div className="mt-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                            {row.estado || '—'}
                          </div>
                        ) : (
                          <select
                            value={row.estado}
                            onChange={(e) => recalcCitiesForEstado(row.id, e.target.value)}
                            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                          >
                            <option value="">— Selecione o estado —</option>
                            {row.estadosOptions.map((uf) => (
                              <option key={uf} value={uf}>
                                {uf}
                              </option>
                            ))}
                          </select>
                        )}
                        <FieldError text={rowErrors.estado} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">Cidade</label>
                        {row.cidadesOptions.length <= 1 ? (
                          <div className="mt-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                            {row.cidade || '—'}
                          </div>
                        ) : (
                          <select
                            value={row.cidade}
                            onChange={(e) => updateRow(row.id, { cidade: e.target.value })}
                            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                          >
                            <option value="">— Selecione a cidade —</option>
                            {row.cidadesOptions.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        )}
                        <FieldError text={rowErrors.cidade} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">Tipo de negociação</label>
                        <select
                          value={row.tipo_negociacao}
                          onChange={(e) => updateRow(row.id, { tipo_negociacao: e.target.value as TipoNegociacao })}
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                        >
                          <option value="">— Selecione —</option>
                          {OPCOES_TIPO_NEGOCIACAO_TERRENO.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        <FieldError text={rowErrors.tipo_negociacao} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">Produto / Modelo da Casa</label>
                        <select
                          value={row.produto_modelo}
                          onChange={(e) => updateRow(row.id, { produto_modelo: e.target.value as ProdutoModelo })}
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                        >
                          <option value="">— Selecione —</option>
                          {OPCOES_PRODUTO_MODELO_CASA.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        <FieldError text={rowErrors.produto_modelo} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">Valor do Terreno</label>
                        <MoedaInput
                          inputId={`valor-terreno-lote-${row.id}`}
                          value={row.valor_terreno}
                          onChange={(v) => updateRow(row.id, { valor_terreno: v })}
                          placeholder="0,00"
                          error={rowErrors.valor_terreno}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">VGV Pretendido</label>
                        <MoedaInput
                          inputId={`vgv-pretendido-lote-${row.id}`}
                          value={row.vgv_pretendido}
                          onChange={(v) => updateRow(row.id, { vgv_pretendido: v })}
                          placeholder="0,00"
                          error={rowErrors.vgv_pretendido}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-stone-700">Link pasta no drive compartilhado</label>
                        <input
                          type="url"
                          value={row.link_pasta_drive}
                          onChange={(e) => updateRow(row.id, { link_pasta_drive: e.target.value })}
                          placeholder="https://..."
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                        />
                        <FieldError text={rowErrors.link_pasta_drive} />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-stone-700">Nome do Condomínio</label>
                        <input
                          type="text"
                          value={row.nome_condominio}
                          onChange={(e) => updateRow(row.id, { nome_condominio: e.target.value })}
                          placeholder="Nome do condomínio"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                        />
                        <FieldError text={rowErrors.nome_condominio} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">Quadra</label>
                        <input
                          type="text"
                          value={row.quadra}
                          onChange={(e) => updateRow(row.id, { quadra: e.target.value })}
                          placeholder="Se houver definido"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700">Lote</label>
                        <input
                          type="text"
                          value={row.lote}
                          onChange={(e) => updateRow(row.id, { lote: e.target.value })}
                          placeholder="Se houver definido"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-stone-700">Observações (opcional)</label>
                        <textarea
                          value={row.observacoes}
                          onChange={(e) => updateRow(row.id, { observacoes: e.target.value })}
                          rows={3}
                          placeholder="Observações adicionais (opcional)"
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, emptyRow()])}
                  disabled={loading}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                >
                  + Adicionar linha
                </button>
                <p className="text-xs text-stone-500">Total de {rows.length} linha(s).</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-stone-200 p-4">
              <button
                type="button"
                onClick={() => {
                  resetFormState();
                  setOpen(false);
                }}
                disabled={loading}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || rows.length === 0}
                className="rounded-lg bg-moni-primary px-3 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-60"
              >
                {loading ? 'Criando…' : 'Salvar em lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

