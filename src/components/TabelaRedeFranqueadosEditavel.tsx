'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { usePaginaTabela } from '@/lib/use-pagina-tabela';
import { useRouter } from 'next/navigation';
import { Check, FileText, Loader2, Maximize2, Minimize2, Pencil, Plus, Stethoscope, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import type { RedeFranqueadoDbKey, RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import {
  COLUNAS_REDE_FRANQUEADOS,
  formatNFranquiaRedeExibicao,
  isRedeColunaDadoSensivel,
  ordenarRedePorNFranquia,
  REDE_FRANQUEADOS_TABLE_KEYS,
} from '@/lib/rede-franqueados';
import { calcEngajamento, isAdormecido, isStatusNC } from '@/lib/rede-diagnostico-engine';
import {
  DimCell,
  NpsCell,
  CsatCell,
  ScoreCell,
  IndCell,
  AdimplenciaCell,
  GrupoCell,
  PriorityBadge,
  PerfilCell,
  TendCell,
  PmaCell,
} from '@/components/diagnostico-rede/cells';
import { DiagnosticoHeaderTh } from '@/components/diagnostico-rede/DiagnosticoHeaderTh';
import { DiagnosticoRedePainelEdit } from '@/components/diagnostico-rede/DiagnosticoRedePainelEdit';
import {
  DiagnosticoInlineComputed,
  DiagnosticoInlineCsat,
  DiagnosticoInlineDim,
  DiagnosticoInlineExtras,
  DiagnosticoInlineIndicador,
  DiagnosticoInlineAdimplencia,
  DiagnosticoInlineNps,
  DiagnosticoInlineProximaAcao,
  DiagnosticoInlineScore,
  DiagnosticoInlineTendencias,
} from '@/components/diagnostico-rede/DiagnosticoRedeInlineEdit';
import {
  parseRedeDiagnosticoDraft,
  redeRowToDiagnosticoDraft,
  type RedeDiagnosticoDraft,
  type RedeDiagnosticoSource,
} from '@/lib/rede-diagnostico-form';
import { RedeFranqueadoSensitiveBlur } from '@/components/RedeFranqueadoSensitiveBlur';
import { atualizarRedeFranqueado, excluirRedeFranqueado, atualizarRedeFranqueadoDiagnostico } from '@/app/rede-franqueados/actions';
import { UFS_BRASIL } from '@/lib/uf';
import {
  parseAreaAtuacao,
  serializeAreaAtuacao,
  type AreaAtuacaoPar,
} from '@/lib/rede-area-atuacao';
import { RedeFranqueadoCellValue } from '@/components/RedeFranqueadoCellValue';
import { redeRowConteudoExpansivel } from '@/components/RedeFranqueadoAreaAtuacaoCell';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';
import { redeAlertError, redeAlertSuccess, redeTh } from '@/app/rede-franqueados/rede-ui';
import { REDE_OPCOES_STATUS_FRANQUIA } from '@/lib/rede-franqueado-form-options';

type AreaAtuacaoItem = { estado: string; cidade: string };
type CidadeIBGE = { id: number; nome: string };

function paresParaItens(pares: AreaAtuacaoPar[]): AreaAtuacaoItem[] {
  return pares.map((p) => ({ estado: p.uf, cidade: p.cidade }));
}

function itensParaPares(itens: AreaAtuacaoItem[]): AreaAtuacaoPar[] {
  return itens.map((i) => ({ uf: i.estado, cidade: i.cidade }));
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
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'below' | 'above';
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.nome.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => setQuery(''), [items]);

  const reposicionar = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 180);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const placement: 'below' | 'above' =
      spaceBelow >= 220 || spaceBelow >= rect.top ? 'below' : 'above';
    setPos({
      top: placement === 'below' ? rect.bottom + 4 : Math.max(8, rect.top - 4),
      left,
      width,
      placement,
    });
  };

  useLayoutEffect(() => {
    if (!open || disabled) return;
    reposicionar();
  }, [open, disabled, items.length]);

  useEffect(() => {
    if (!open || disabled) return;
    const onScrollOrResize = () => reposicionar();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, disabled]);

  useEffect(() => {
    if (!open || disabled) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, disabled]);

  const panel =
    open && !disabled && pos ? (
      <div
        ref={panelRef}
        className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 9999,
          transform: pos.placement === 'above' ? 'translateY(-100%)' : undefined,
        }}
        role="dialog"
        aria-label="Selecionar cidade"
      >
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
    ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
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
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}

const PER_PAGE = 40;

function rowAsDiagSource(r: RedeFranqueadoRowDb, statusOverride?: string | null): RedeDiagnosticoSource {
  return {
    id: r.id,
    ordem: r.ordem,
    status_franquia: statusOverride ?? r.status_franquia ?? null,
    diag_d: r.diag_d ?? null,
    diag_c: r.diag_c ?? null,
    diag_k: r.diag_k ?? null,
    diag_d_desc: r.diag_d_desc ?? null,
    diag_c_desc: r.diag_c_desc ?? null,
    diag_k_desc: r.diag_k_desc ?? null,
    diag_nps: r.diag_nps ?? null,
    diag_csat: r.diag_csat ?? null,
    diag_contratos_12m: r.diag_contratos_12m ?? null,
    diag_ano_meta: r.diag_ano_meta ?? null,
    diag_tend_eng: r.diag_tend_eng ?? null,
    diag_tend_rel: r.diag_tend_rel ?? null,
    diag_tend_ind: r.diag_tend_ind ?? null,
    diag_proxima_acao: r.diag_proxima_acao ?? null,
    diag_adormecido: r.diag_adormecido === true,
    diag_adimplente:
      r.diag_adimplente === true ? true : r.diag_adimplente === false ? false : null,
    diag_ultimo_contato: r.diag_ultimo_contato ?? null,
    diag_ultima_aval: r.diag_ultima_aval ?? null,
    diag_avaliado_por: r.diag_avaliado_por ?? null,
    diag_grupo_sec: r.diag_grupo_sec ?? null,
  };
}

/** Primeiras colunas fixas ao rolar horizontalmente (até Status da Franquia). */
const REDE_STICKY_COLUMN_COUNT = 4;
const REDE_STICKY_COLUMN_WIDTHS_REM = [5.5, 7, 13, 10] as const;

function stickyLeftRem(index: number): number {
  let left = 0;
  for (let i = 0; i < index; i++) left += REDE_STICKY_COLUMN_WIDTHS_REM[i] ?? 0;
  return left;
}

type RedeStickyRowTone = 'default' | 'inativa' | 'adormecida';

function stickyBodyBackground(tone: RedeStickyRowTone): string {
  switch (tone) {
    case 'inativa':
      return 'bg-[color:var(--moni-surface-50)] group-hover:bg-[color:var(--moni-surface-100)]';
    case 'adormecida':
      return 'bg-[color:var(--moni-surface-100)] group-hover:bg-[color:var(--moni-surface-200)]';
    default:
      return 'bg-[color:var(--moni-surface-0)] group-hover:bg-[color:var(--moni-surface-50)]';
  }
}

function stickyCellProps(
  index: number,
  variant: 'head' | 'body',
  rowTone: RedeStickyRowTone = 'default',
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
      'sticky border-r moni-rede-sticky-col',
      isLastSticky ? 'moni-rede-sticky-col-last border-stone-200' : 'border-stone-100/90',
      variant === 'head'
        ? 'bg-[color:var(--moni-surface-50)]'
        : stickyBodyBackground(rowTone),
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
  /** Exibe labels internos no diagnóstico (ex.: "Alta Prontidão" em vez de "Alta Capacidade"). */
  internalView?: boolean;
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
  internalView = false,
}: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [diagPanelId, setDiagPanelId] = useState<string | null>(null);
  const [expandedContentRows, setExpandedContentRows] = useState<Set<string>>(() => new Set());
  const [draft, setDraft] = useState<Partial<Record<RedeFranqueadoDbKey, string>>>({});
  const [diagDraft, setDiagDraft] = useState<RedeDiagnosticoDraft>(() => redeRowToDiagnosticoDraft({
    id: '',
    ordem: 0,
    status_franquia: null,
  } as RedeDiagnosticoSource));
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
      setDiagDraft(redeRowToDiagnosticoDraft({ id: '', ordem: 0, status_franquia: null } as RedeDiagnosticoSource));
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

  const diagColSpan = keys.length + 14 + (canEditRows ? 1 : 0);

  const toggleDiagPanel = (id: string) => {
    setDiagPanelId((prev) => (prev === id ? null : id));
  };

  const toggleContentExpand = (id: string) => {
    setExpandedContentRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const beginEdit = (r: RedeFranqueadoRowDb) => {
    if (!canEditRows) return;
    setDiagPanelId(null);
    setMsg(null);
    setEditingId(r.id);
    const d: Partial<Record<RedeFranqueadoDbKey, string>> = {};
    for (const k of keys) {
      const v = (r[k] ?? '') as string;
      const raw = isDateKey(k) ? toInputDate(v) : v;
      d[k] = k === 'n_franquia' ? formatNFranquiaRedeExibicao(raw, r.ordem) : raw;
    }
    const itens = paresParaItens(parseAreaAtuacao(d.area_atuacao));
    // Normaliza legado em prosa para o formato canônico ao abrir a edição.
    if (itens.length > 0) {
      d.area_atuacao = serializeAreaAtuacao(itensParaPares(itens));
    }
    setDraft(d);
    setDiagDraft(redeRowToDiagnosticoDraft(rowAsDiagSource(r)));
    setAreaAtuacaoItens(itens);
    setEstadoAtuacao('');
    setCidadeAtuacao('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
    setDiagDraft(redeRowToDiagnosticoDraft({ id: '', ordem: 0, status_franquia: null } as RedeDiagnosticoSource));
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

    const diagParsed = parseRedeDiagnosticoDraft(diagDraft);
    if (!diagParsed.ok) {
      setSaving(false);
      setMsg({ tipo: 'erro', texto: diagParsed.error });
      return;
    }

    const r = await atualizarRedeFranqueado(editingId, patch);
    if (!r.ok) {
      setSaving(false);
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }

    const rd = await atualizarRedeFranqueadoDiagnostico(editingId, diagParsed.patch);
    setSaving(false);
    if (!rd.ok) {
      setMsg({ tipo: 'erro', texto: rd.error });
      return;
    }
    setMsg({ tipo: 'ok', texto: 'Linha e diagnóstico atualizados.' });
    setEditingId(null);
    setDraft({});
    setDiagDraft(redeRowToDiagnosticoDraft({ id: '', ordem: 0, status_franquia: null } as RedeDiagnosticoSource));
    setAreaAtuacaoItens([]);
    setEstadoAtuacao('');
    setCidadeAtuacao('');
    router.refresh();
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
    <div className="min-w-0 max-w-full space-y-4">
      {msg && (
        <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
          {msg.texto}
        </div>
      )}

      <MoniTabelaScrollSync className="rounded-xl border border-stone-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[2400px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              {headers.map((h, i) => {
                const sticky = stickyCellProps(i, 'head');
                return (
                  <th key={i} className={sticky.className} style={sticky.style} scope="col">
                    {h}
                  </th>
                );
              })}

              {/* ── Diagnóstico: Engajamento ── */}
              <DiagnosticoHeaderTh
                tooltipKey="score"
                className={`${redeTh} border-t-[3px] border-t-green-700 bg-green-50`}
                style={{ minWidth: 80 }}
              >
                Score
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="d"
                className={`${redeTh} border-t-[3px] border-t-green-700 bg-green-50`}
                style={{ minWidth: 60 }}
              >
                D
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="c"
                className={`${redeTh} border-t-[3px] border-t-green-700 bg-green-50`}
                style={{ minWidth: 60 }}
              >
                C
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="k"
                className={`${redeTh} border-t-[3px] border-t-green-700 bg-green-50`}
                style={{ minWidth: 60 }}
              >
                K
              </DiagnosticoHeaderTh>

              {/* ── Diagnóstico: Relação ── */}
              <DiagnosticoHeaderTh
                tooltipKey="nps"
                className={`${redeTh} border-t-[3px] border-t-rose-600 bg-rose-50`}
                style={{ minWidth: 80 }}
              >
                NPS
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="csat"
                className={`${redeTh} border-t-[3px] border-t-rose-600 bg-rose-50`}
                style={{ minWidth: 80 }}
              >
                CSAT
              </DiagnosticoHeaderTh>

              {/* ── Diagnóstico: Indicador ── */}
              <DiagnosticoHeaderTh
                tooltipKey="contratos12m"
                className={`${redeTh} border-t-[3px] border-t-blue-700 bg-blue-50`}
                style={{ minWidth: 110 }}
              >
                Contratos 12m
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="adimplencia"
                className={`${redeTh} border-t-[3px] border-t-blue-700 bg-blue-50`}
                style={{ minWidth: 80 }}
              >
                Adimplência
              </DiagnosticoHeaderTh>

              {/* ── Diagnóstico: Gestão ── */}
              <DiagnosticoHeaderTh
                tooltipKey="prio"
                className={`${redeTh} border-t-[3px] border-t-stone-500 bg-stone-50`}
                style={{ minWidth: 60 }}
              >
                Prio.
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="perfil"
                className={`${redeTh} border-t-[3px] border-t-stone-500 bg-stone-50`}
                style={{ minWidth: 140 }}
              >
                Perfil
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="grupo"
                className={`${redeTh} border-t-[3px] border-t-stone-500 bg-stone-50`}
                style={{ minWidth: 155 }}
              >
                Grupo
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="tendencia"
                className={`${redeTh} border-t-[3px] border-t-stone-500 bg-stone-50`}
                style={{ minWidth: 70 }}
              >
                Tendência
              </DiagnosticoHeaderTh>
              <DiagnosticoHeaderTh
                tooltipKey="proximaAcao"
                className={`${redeTh} border-t-[3px] border-t-stone-500 bg-stone-50`}
                style={{ minWidth: 200 }}
              >
                Próxima ação
              </DiagnosticoHeaderTh>

              {canEditRows ? (
                <th
                  className="sticky right-0 z-20 w-14 min-w-[3.5rem] border-l border-stone-200 bg-[color:var(--moni-surface-50)] px-1 py-2 text-center shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]"
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
              const diagSource = isEditing
                ? rowAsDiagSource(r, (draft.status_franquia as string | undefined) ?? r.status_franquia)
                : rowAsDiagSource(r);
              const diagOpen = diagPanelId === r.id;
              const rowInativa = isStatusNC(r);
              const rowAdormecida = isAdormecido(r);
              const rowMutedClass = rowInativa
                ? 'bg-stone-50 opacity-60 hover:opacity-100 focus-within:opacity-100'
                : rowAdormecida
                  ? 'bg-blue-50/40 opacity-70 hover:opacity-100 focus-within:opacity-100'
                  : '';
              const stickyRowTone: RedeStickyRowTone = rowInativa
                ? 'inativa'
                : rowAdormecida
                  ? 'adormecida'
                  : 'default';
              const rowContentExpanded = expandedContentRows.has(r.id);
              const rowExpansivel = redeRowConteudoExpansivel(String(r.area_atuacao ?? ''));
              const toggleRowContent = () => toggleContentExpand(r.id);
              return (
                <Fragment key={r.id}>
                <tr
                  className={`group border-b border-stone-100 align-top transition-[opacity,colors] duration-200 hover:bg-stone-50/70 ${rowMutedClass}`}
                >
                  {keys.map((k, colIndex) => {
                    const current = (r[k] ?? '') as string;
                    const value = (draft[k] ?? '') as string;
                    const shown =
                      k === 'n_franquia' ? formatNFranquiaRedeExibicao(current, r.ordem) : current;
                    const isAreaAtuacao = k === 'area_atuacao';
                    const maskCell = maskSensitiveColumns && isRedeColunaDadoSensivel(k);
                    const sticky = stickyCellProps(colIndex, 'body', stickyRowTone);
                    const areaEditando = isEditing && isAreaAtuacao;
                    const cellClassName = areaEditando
                      ? sticky.className
                          .replace('overflow-hidden', 'overflow-visible')
                          .replace('max-w-[14rem]', 'max-w-none min-w-[18rem]')
                      : sticky.className;
                    return (
                      <td key={k} className={cellClassName} style={sticky.style}>
                        {!isEditing ? (
                          maskCell ? (
                            <RedeFranqueadoSensitiveBlur />
                          ) : (
                            <RedeFranqueadoCellValue
                              field={k}
                              text={shown}
                              titleText={current}
                              contentExpanded={rowContentExpanded}
                              onToggleContentExpand={rowExpansivel ? toggleRowContent : undefined}
                            />
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
                                          area_atuacao: serializeAreaAtuacao(itensParaPares(next)),
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
                                    area_atuacao: serializeAreaAtuacao(itensParaPares(next)),
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
                        ) : k === 'status_franquia' ? (
                          <select
                            value={value}
                            onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                            className="w-56 rounded-md border border-stone-300 px-2 py-1 text-sm"
                          >
                            <option value="">—</option>
                            {REDE_OPCOES_STATUS_FRANQUIA.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                            {value &&
                            !REDE_OPCOES_STATUS_FRANQUIA.some((op) => op.value === value) ? (
                              <option value={value}>{value}</option>
                            ) : null}
                          </select>
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

                  {/* ── Diagnóstico: Engajamento ── */}
                  <td className="px-3 py-2.5 align-top bg-green-50/20">
                    {isEditing ? (
                      <DiagnosticoInlineScore row={diagSource} draft={diagDraft} internalView={internalView} />
                    ) : (
                      <ScoreCell score={calcEngajamento(r)} internalView={internalView} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top bg-green-50/20">
                    {isEditing ? (
                      <DiagnosticoInlineDim field="diag_d" draft={diagDraft} setDraft={setDiagDraft} />
                    ) : (
                      <DimCell val={r.diag_d} desc={r.diag_d_desc} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top bg-green-50/20">
                    {isEditing ? (
                      <DiagnosticoInlineDim field="diag_c" draft={diagDraft} setDraft={setDiagDraft} />
                    ) : (
                      <DimCell val={r.diag_c} desc={r.diag_c_desc} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top bg-green-50/20">
                    {isEditing ? (
                      <DiagnosticoInlineDim field="diag_k" draft={diagDraft} setDraft={setDiagDraft} />
                    ) : (
                      <DimCell val={r.diag_k} desc={r.diag_k_desc} />
                    )}
                  </td>

                  {/* ── Diagnóstico: Relação ── */}
                  <td className="px-3 py-2.5 align-top bg-rose-50/20">
                    {isEditing ? (
                      <DiagnosticoInlineNps draft={diagDraft} setDraft={setDiagDraft} />
                    ) : (
                      <NpsCell nps={r.diag_nps} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top bg-rose-50/20">
                    {isEditing ? (
                      <DiagnosticoInlineCsat draft={diagDraft} setDraft={setDiagDraft} />
                    ) : (
                      <CsatCell csat={r.diag_csat} />
                    )}
                  </td>

                  {/* ── Diagnóstico: Indicador ── */}
                  <td className="px-3 py-2.5 align-top bg-blue-50/20">
                    {isEditing ? (
                      <DiagnosticoInlineIndicador draft={diagDraft} setDraft={setDiagDraft} row={diagSource} />
                    ) : (
                      <IndCell row={r} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top bg-blue-50/20">
                    {isEditing ? (
                      <DiagnosticoInlineAdimplencia draft={diagDraft} setDraft={setDiagDraft} />
                    ) : (
                      <AdimplenciaCell adimplente={r.diag_adimplente ?? null} />
                    )}
                  </td>

                  {/* ── Diagnóstico: Gestão ── */}
                  <td className="px-3 py-2.5 align-top">
                    {isEditing ? (
                      <DiagnosticoInlineComputed row={diagSource} draft={diagDraft} kind="prio" />
                    ) : (
                      <PriorityBadge row={r} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {isEditing ? (
                      <DiagnosticoInlineComputed row={diagSource} draft={diagDraft} kind="perfil" internalView={internalView} />
                    ) : (
                      <PerfilCell row={r} internalView={internalView} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {isEditing ? (
                      <div>
                        <DiagnosticoInlineComputed row={diagSource} draft={diagDraft} kind="grupo" />
                        <DiagnosticoInlineExtras draft={diagDraft} setDraft={setDiagDraft} />
                      </div>
                    ) : (
                      <GrupoCell row={r} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {isEditing ? (
                      <DiagnosticoInlineTendencias draft={diagDraft} setDraft={setDiagDraft} />
                    ) : (
                      <TendCell row={r} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    {isEditing ? (
                      <DiagnosticoInlineProximaAcao draft={diagDraft} setDraft={setDiagDraft} />
                    ) : (
                      <PmaCell text={r.diag_proxima_acao} />
                    )}
                  </td>

                  {canEditRows ? (
                    <td className="sticky right-0 z-10 w-14 min-w-[3.5rem] border-l border-stone-200 bg-[color:var(--moni-surface-0)] px-1 py-2 align-middle shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)] group-hover:bg-[color:var(--moni-surface-50)]">
                      {!isEditing ? (
                        <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100">
                          {rowExpansivel ? (
                            <button
                              type="button"
                              title={rowContentExpanded ? 'Minimizar linha' : 'Expandir linha'}
                              onClick={toggleRowContent}
                              className={`rounded-md p-1.5 ${
                                rowContentExpanded
                                  ? 'bg-stone-800 text-white'
                                  : 'text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
                              }`}
                            >
                              {rowContentExpanded ? (
                                <Minimize2 className="h-4 w-4" aria-hidden />
                              ) : (
                                <Maximize2 className="h-4 w-4" aria-hidden />
                              )}
                              <span className="sr-only">
                                {rowContentExpanded ? 'Minimizar linha' : 'Expandir linha'}
                              </span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            title="Diagnóstico"
                            onClick={() => toggleDiagPanel(r.id)}
                            className={`rounded-md p-1.5 ${
                              diagOpen
                                ? 'bg-stone-800 text-white'
                                : 'text-stone-600 hover:bg-stone-200/80 hover:text-stone-900'
                            }`}
                          >
                            <Stethoscope className="h-4 w-4" />
                            <span className="sr-only">Diagnóstico</span>
                          </button>
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
                {canEditRows && diagOpen ? (
                  <tr className={`border-b border-stone-100 bg-stone-50/40 ${rowMutedClass}`}>
                    <td colSpan={diagColSpan} className="px-3 py-3">
                      <DiagnosticoRedePainelEdit
                        row={diagSource}
                        internalView={internalView}
                        compact
                        draft={isEditing ? diagDraft : undefined}
                        onDraftChange={isEditing ? setDiagDraft : undefined}
                        hideSave={isEditing}
                        onCancel={() => setDiagPanelId(null)}
                        onSaved={() => setDiagPanelId(null)}
                      />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </MoniTabelaScrollSync>

      <div className="moni-tabela-footer flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--moni-border-default)] pt-3">
        <p className="text-sm text-[color:var(--moni-text-secondary)]">
          Mostrando {start + 1}–{Math.min(start + PER_PAGE, rowsOrdenadas.length)} de {rowsOrdenadas.length}{' '}
          franqueado{rowsOrdenadas.length === 1 ? '' : 's'}
          {buscaAtiva && totalGeral > rowsOrdenadas.length ? (
            <span className="text-[color:var(--moni-text-tertiary)]"> (filtrado de {totalGeral})</span>
          ) : null}
        </p>

        {totalPages > 1 ? (
          <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação da tabela">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-3 py-1.5 text-sm font-medium text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-50)] disabled:pointer-events-none disabled:opacity-50"
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-h-[44px] min-w-[2.25rem] rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] px-2 py-1.5 text-sm font-medium ${
                  p === safePage
                    ? 'border-[color:var(--moni-navy-800)] bg-[var(--moni-navy-800)] text-white'
                    : 'border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-50)]'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="min-h-[44px] rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-3 py-1.5 text-sm font-medium text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-50)] disabled:pointer-events-none disabled:opacity-50"
            >
              Próxima
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

