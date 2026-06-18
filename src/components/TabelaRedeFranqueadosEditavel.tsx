'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePaginaTabela } from '@/lib/use-pagina-tabela';
import { useRouter } from 'next/navigation';
import { Check, FileText, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import type { RedeFranqueadoDbKey, RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import {
  COLUNAS_REDE_FRANQUEADOS,
  formatNFranquiaRedeExibicao,
  isRedeColunaDadoSensivel,
  ordenarRedePorNFranquia,
  REDE_FRANQUEADOS_TABLE_KEYS,
} from '@/lib/rede-franqueados';
import { RedeFranqueadoSensitiveBlur } from '@/components/RedeFranqueadoSensitiveBlur';
import { atualizarRedeFranqueado, excluirRedeFranqueado } from '@/app/rede-franqueados/actions';
import { UFS_BRASIL } from '@/lib/uf';
import { RedeFranqueadoCellValue } from '@/components/RedeFranqueadoCellValue';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';
import { redeAlertError, redeAlertSuccess, redeTh } from '@/app/rede-franqueados/rede-ui';

type AreaAtuacaoItem = { estado: string; cidade: string };
type CidadeIBGE = { id: number; nome: string };

function parseAreaAtuacao(s: string | null | undefined): AreaAtuacaoItem[] {
  if (!s || typeof s !== 'string') return [];
  return s
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf(' - ');
      if (i < 0) return null;
      return { estado: part.slice(0, i).trim(), cidade: part.slice(i + 3).trim() };
    })
    .filter((x): x is AreaAtuacaoItem => x !== null && Boolean(x.estado && x.cidade));
}

function CidadeCombobox({
  id,
  disabled,
  loading,
  placeholder,
  value,
  onChange,
  items,
}: {
  id: string;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  value: string;
  onChange: (cidade: string) => void;
  items: CidadeIBGE[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.nome.toLowerCase().includes(q));
  }, [items, query]);
  useEffect(() => setQuery(''), [items]);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-left text-sm ${
          disabled ? 'border-stone-200 bg-stone-100 text-stone-500' : 'border-stone-300 bg-white'
        }`}
      >
        {value ? value : loading ? 'Carregando...' : placeholder ?? '— Cidade —'}
      </button>
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
          <div className="border-b border-stone-200 p-1.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
              autoFocus
            />
          </div>
          <ul id={id} role="listbox" className="max-h-48 overflow-auto py-1">
            {loading ? (
              <li className="px-2 py-1.5 text-sm text-stone-500">Carregando...</li>
            ) : filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-stone-500">Nenhuma cidade.</li>
            ) : (
              filtered.map((c) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={c.nome === value}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(c.nome);
                    setOpen(false);
                  }}
                  className="cursor-pointer px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                >
                  {c.nome}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const PER_PAGE = 15;

/** Primeiras colunas fixas ao rolar horizontalmente (até Status da Franquia). */
const REDE_STICKY_COLUMN_COUNT = 4;
const REDE_STICKY_COLUMN_WIDTHS_REM = [5.5, 7, 13, 10] as const;

function stickyLeftRem(index: number): number {
  let left = 0;
  for (let i = 0; i < index; i++) left += REDE_STICKY_COLUMN_WIDTHS_REM[i] ?? 0;
  return left;
}

function stickyCellProps(
  index: number,
  variant: 'head' | 'body',
): { className: string; style?: React.CSSProperties } {
  if (index >= REDE_STICKY_COLUMN_COUNT) {
    return {
      className:
        variant === 'head'
          ? redeTh
          : 'min-w-0 max-w-[14rem] overflow-hidden px-3 py-2.5 align-top text-stone-700',
    };
  }
  const widthRem = REDE_STICKY_COLUMN_WIDTHS_REM[index];
  const isLastSticky = index === REDE_STICKY_COLUMN_COUNT - 1;
  return {
    className: [
      variant === 'head' ? redeTh : 'overflow-hidden px-3 py-2.5 align-top text-stone-700',
      'sticky border-r',
      isLastSticky ? 'border-stone-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]' : 'border-stone-100/90',
      variant === 'head' ? 'bg-stone-50/95' : 'bg-white group-hover:bg-stone-50/90',
    ].join(' '),
    style: {
      left: `${stickyLeftRem(index)}rem`,
      minWidth: `${widthRem}rem`,
      width: `${widthRem}rem`,
      maxWidth: `${widthRem}rem`,
      zIndex: variant === 'head' ? 32 + index : 14 + index,
    },
  };
}

type Props = {
  rows: RedeFranqueadoRowDb[];
  /** Apenas administradores (e perfis equivalentes no authz) podem editar/excluir linhas. */
  canEditRows?: boolean;
  /** Oculta CPF, endereço, sócios etc. (usuários que não são role `admin`). */
  maskSensitiveColumns?: boolean;
  /** Total de linhas antes do filtro de busca (para mensagens de contagem). */
  totalSemBusca?: number;
  /** Indica que há texto na busca (distinto de tabela vazia). */
  buscaAtiva?: boolean;
  buscaResetKey?: string;
};

function toInputDate(val: string | null | undefined): string {
  if (!val) return '';
  // Se vier como YYYY-MM-DD já serve; se vier com timezone/ISO pega os 10 primeiros
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  if (val.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  return val;
}

function isDateKey(k: RedeFranqueadoDbKey): boolean {
  return (
    k === 'data_ass_cof' ||
    k === 'data_ass_contrato' ||
    k === 'data_expiracao_franquia' ||
    k === 'data_nasc_frank' ||
    k === 'data_recebimento_kit_boas_vindas'
  );
}

export function TabelaRedeFranqueadosEditavel({
  rows,
  canEditRows = true,
  maskSensitiveColumns = false,
  totalSemBusca,
  buscaAtiva = false,
  buscaResetKey = '',
}: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Record<RedeFranqueadoDbKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Área de atuação (Estado + Cidade) — só usado quando está editando
  const [areaAtuacaoItens, setAreaAtuacaoItens] = useState<AreaAtuacaoItem[]>([]);
  const [estadoAtuacao, setEstadoAtuacao] = useState('');
  const [cidadeAtuacao, setCidadeAtuacao] = useState('');
  const [cidadesAtuacao, setCidadesAtuacao] = useState<CidadeIBGE[]>([]);
  const [loadingCidadesAtuacao, setLoadingCidadesAtuacao] = useState(false);

  const rowsOrdenadas = useMemo(() => ordenarRedePorNFranquia(rows), [rows]);
  const totalGeral = totalSemBusca ?? rows.length;
  const { page: safePage, setPage, totalPages, start } = usePaginaTabela(
    rowsOrdenadas.length,
    PER_PAGE,
    buscaResetKey,
  );
  const pageRows = useMemo(
    () => rowsOrdenadas.slice(start, start + PER_PAGE),
    [rowsOrdenadas, start],
  );

  useEffect(() => {
    if (!canEditRows && editingId) {
      setEditingId(null);
      setDraft({});
      setAreaAtuacaoItens([]);
    }
  }, [canEditRows, editingId]);

  useEffect(() => {
    if (!editingId || !estadoAtuacao) {
      setCidadesAtuacao([]);
      setCidadeAtuacao('');
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingCidadesAtuacao(true);
        const res = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoAtuacao}/municipios`,
          { signal: controller.signal },
        );
        const lista = (await res.json()) as CidadeIBGE[];
        setCidadesAtuacao(Array.isArray(lista) ? lista : []);
        setCidadeAtuacao('');
      } catch {
        setCidadesAtuacao([]);
      } finally {
        setLoadingCidadesAtuacao(false);
      }
    })();
    return () => controller.abort();
  }, [editingId, estadoAtuacao]);

  const headers = useMemo(() => [...COLUNAS_REDE_FRANQUEADOS], []);
  const keys = useMemo(() => [...REDE_FRANQUEADOS_TABLE_KEYS], []);

  const beginEdit = (r: RedeFranqueadoRowDb) => {
    if (!canEditRows) return;
    setMsg(null);
    setEditingId(r.id);
    const d: Partial<Record<RedeFranqueadoDbKey, string>> = {};
    for (const k of keys) {
      const v = (r[k] ?? '') as string;
      const raw = isDateKey(k) ? toInputDate(v) : v;
      d[k] = k === 'n_franquia' ? formatNFranquiaRedeExibicao(raw, r.ordem) : raw;
    }
    setDraft(d);
    setAreaAtuacaoItens(parseAreaAtuacao(d.area_atuacao));
    setEstadoAtuacao('');
    setCidadeAtuacao('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
    setAreaAtuacaoItens([]);
    setEstadoAtuacao('');
    setCidadeAtuacao('');
    setMsg(null);
  };

  const save = async () => {
    if (!canEditRows || !editingId) return;
    setSaving(true);
    setMsg(null);

    // Envia tudo do draft (simples e consistente). String vazia vira null na action.
    const patch: Partial<Record<RedeFranqueadoDbKey, string | null>> = {};
    for (const k of keys) patch[k] = (draft[k] ?? '') as string;

    const r = await atualizarRedeFranqueado(editingId, patch);
    setSaving(false);
    if (r.ok) {
      setMsg({ tipo: 'ok', texto: r.mensagem });
      setEditingId(null);
      setDraft({});
      setAreaAtuacaoItens([]);
      setEstadoAtuacao('');
      setCidadeAtuacao('');
      router.refresh();
    } else {
      setMsg({ tipo: 'erro', texto: r.error });
    }
  };

  const excluir = async (id: string) => {
    if (!canEditRows || saving) return;
    setMsg(null);
    const ok = window.confirm('Excluir esta linha da Rede de Franqueados? Essa ação não pode ser desfeita.');
    if (!ok) return;
    setSaving(true);
    const r = await excluirRedeFranqueado(id);
    setSaving(false);
    if (r.ok) {
      setMsg({ tipo: 'ok', texto: r.mensagem });
      router.refresh();
    } else {
      setMsg({ tipo: 'erro', texto: r.error });
    }
  };

  if (rowsOrdenadas.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-600">
        <p className="font-medium">
          {buscaAtiva && totalGeral > 0
            ? 'Nenhum franqueado encontrado para esta pesquisa.'
            : 'Nenhum franqueado cadastrado na rede.'}
        </p>
        {buscaAtiva && totalGeral > 0 ? (
          <p className="mt-1 text-stone-500">Tente outro termo ou limpe o campo de pesquisa.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {msg && (
        <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
          {msg.texto}
        </div>
      )}

      <MoniTabelaScrollSync className="rounded-xl border border-stone-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[1700px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/95">
              {headers.map((h, i) => {
                const sticky = stickyCellProps(i, 'head');
                return (
                  <th key={i} className={sticky.className} style={sticky.style} scope="col">
                    {h}
                  </th>
                );
              })}
              {canEditRows ? (
                <th
                  className="sticky right-0 z-20 w-14 min-w-[3.5rem] border-l border-stone-200 bg-stone-50 px-1 py-2 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]"
                  scope="col"
                >
                  <span className="sr-only">Operações</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => {
              const isEditing = editingId === r.id;
              return (
                <tr key={r.id} className="group border-b border-stone-100 align-top transition-colors hover:bg-stone-50/70">
                  {keys.map((k, colIndex) => {
                    const current = (r[k] ?? '') as string;
                    const value = (draft[k] ?? '') as string;
                    const shown =
                      k === 'n_franquia' ? formatNFranquiaRedeExibicao(current, r.ordem) : current;
                    const isAreaAtuacao = k === 'area_atuacao';
                    const maskCell = maskSensitiveColumns && isRedeColunaDadoSensivel(k);
                    const sticky = stickyCellProps(colIndex, 'body');
                    return (
                      <td key={k} className={sticky.className} style={sticky.style}>
                        {!isEditing ? (
                          maskCell ? (
                            <RedeFranqueadoSensitiveBlur />
                          ) : (
                            <RedeFranqueadoCellValue field={k} text={shown} titleText={current} />
                          )
                        ) : isAreaAtuacao ? (
                          <div className="min-w-[280px] space-y-2">
                            {areaAtuacaoItens.length > 0 && (
                              <ul className="flex flex-wrap gap-1.5">
                                {areaAtuacaoItens.map((item, idx) => (
                                  <li
                                    key={`${item.estado}-${item.cidade}-${idx}`}
                                    className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-xs"
                                  >
                                    <span>{item.estado} – {item.cidade}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = areaAtuacaoItens.filter((_, i) => i !== idx);
                                        setAreaAtuacaoItens(next);
                                        setDraft((d) => ({
                                          ...d,
                                          area_atuacao: next.map((i) => `${i.estado} - ${i.cidade}`).join('; '),
                                        }));
                                      }}
                                      className="rounded p-0.5 text-stone-500 hover:bg-stone-200 hover:text-stone-700"
                                      aria-label="Remover"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="w-20">
                                <label className="text-xs text-stone-500">Estado</label>
                                <select
                                  value={estadoAtuacao}
                                  onChange={(e) => setEstadoAtuacao(e.target.value)}
                                  className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-sm"
                                >
                                  <option value="">—</option>
                                  {UFS_BRASIL.map((uf) => (
                                    <option key={uf.sigla} value={uf.sigla}>
                                      {uf.sigla}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="min-w-[140px] flex-1">
                                <label className="text-xs text-stone-500">Cidade</label>
                                <CidadeCombobox
                                  id="tab-rede-cidade-atuacao"
                                  disabled={!estadoAtuacao}
                                  loading={loadingCidadesAtuacao}
                                  value={cidadeAtuacao}
                                  onChange={setCidadeAtuacao}
                                  items={cidadesAtuacao}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!estadoAtuacao || !cidadeAtuacao) return;
                                  const next = [...areaAtuacaoItens, { estado: estadoAtuacao, cidade: cidadeAtuacao }];
                                  setAreaAtuacaoItens(next);
                                  setDraft((d) => ({
                                    ...d,
                                    area_atuacao: next.map((i) => `${i.estado} - ${i.cidade}`).join('; '),
                                  }));
                                  setEstadoAtuacao('');
                                  setCidadeAtuacao('');
                                }}
                                disabled={!estadoAtuacao || !cidadeAtuacao}
                                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                              >
                                <Plus className="inline h-4 w-4" /> Adicionar
                              </button>
                            </div>
                          </div>
                        ) : isDateKey(k) ? (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                            className="w-44 rounded-md border border-stone-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                            className="w-56 rounded-md border border-stone-300 px-2 py-1 text-sm"
                          />
                        )}
                      </td>
                    );
                  })}

                  {canEditRows ? (
                    <td className="sticky right-0 z-10 w-14 min-w-[3.5rem] border-l border-stone-200 bg-white px-1 py-2 align-middle shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] group-hover:bg-stone-50/90">
                      {!isEditing ? (
                        <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100">
                          <Link
                            href={`/rede-franqueados/${r.id}`}
                            title="Documentos"
                            className="rounded-md p-1.5 text-moni-primary hover:bg-moni-light/60"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">Documentos</span>
                          </Link>
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => beginEdit(r)}
                            className="rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </button>
                          <button
                            type="button"
                            title="Excluir"
                            onClick={() => void excluir(r.id)}
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Excluir</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1 sm:flex-row">
                          <button
                            type="button"
                            title="Salvar"
                            onClick={() => void save()}
                            disabled={saving}
                            className="rounded-md p-1.5 text-white bg-moni-primary hover:bg-moni-secondary disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            <span className="sr-only">Salvar</span>
                          </button>
                          <button
                            type="button"
                            title="Cancelar"
                            onClick={cancelEdit}
                            disabled={saving}
                            className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Cancelar</span>
                          </button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </MoniTabelaScrollSync>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
        <p className="text-sm text-stone-600">
          Mostrando {start + 1}–{Math.min(start + PER_PAGE, rowsOrdenadas.length)} de {rowsOrdenadas.length}{' '}
          franqueado{rowsOrdenadas.length === 1 ? '' : 's'}
          {buscaAtiva && totalGeral > rowsOrdenadas.length ? (
            <span className="text-stone-500"> (filtrado de {totalGeral})</span>
          ) : null}
        </p>

        {totalPages > 1 ? (
          <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação da tabela">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-50"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-w-[2.25rem] rounded-lg border px-2 py-1.5 text-sm font-medium ${
                  p === safePage
                    ? 'border-moni-primary bg-moni-primary text-white'
                    : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:pointer-events-none disabled:opacity-50"
            >
              Próxima
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

