'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ClipboardList, ExternalLink, Save, X } from 'lucide-react';
import { RedeLoteadorFichaModal } from '@/components/RedeLoteadorFichaModal';
import { usePaginaTabela } from '@/lib/use-pagina-tabela';
import {
  REDE_LOTEADOR_STATUS_LABEL,
  ordenarRedeLoteadoresPorCodigo,
  type RedeLoteadorRow,
  type RedeLoteadorStatus,
  type RedeLoteadorDiagPatch,
} from '@/lib/rede-loteadores';
import { arquivarRedeLoteador } from '@/app/rede-franqueados/rede-loteadores-actions';
import { salvarDiagnosticoLoteador } from '@/app/rede-franqueados/rede-loteadores-diagnostico-actions';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';
import { redeAlertError, redeAlertSuccess, redeTh } from '@/app/rede-franqueados/rede-ui';
import { DimCell, NpsCell, CsatCell } from '@/components/diagnostico-rede/cells';
import {
  calcLoteadorRelacao,
  calcLoteadorPriority,
  calcLoteadorGrupo,
  isLoteadorAdormecido,
  LOTEADOR_GA_NOME,
  type LoteadorDiagPriority,
  type LoteadorDiagGrupo,
} from '@/lib/loteador-diagnostico-engine';

const PER_PAGE = 15;

type FichaState = { mode: 'edit'; row: RedeLoteadorRow } | { mode: 'create' } | null;

// ─── Diagnóstico helpers ─────────────────────────────────────────────────────

const LOTE_P_STYLE: Record<LoteadorDiagPriority, string> = {
  P1: 'bg-red-900', P2: 'bg-red-600', P3: 'bg-pink-600', P4: 'bg-amber-600',
  P5: 'bg-lime-600', P6: 'bg-sky-600', P7: 'bg-violet-600',
  AD: 'bg-stone-500', NC: 'bg-stone-700',
};

const LOTE_GA_BADGE: Record<LoteadorDiagGrupo, string> = {
  GA1: 'bg-red-100 text-red-800', GA2: 'bg-pink-100 text-pink-800',
  GA3: 'bg-sky-100 text-sky-800', GA4: 'bg-green-100 text-green-800',
  GA5: 'bg-stone-100 text-stone-600',
};

const REL_STYLE: Record<string, string> = {
  saudavel: 'text-green-700', atencao: 'text-amber-700',
  critica: 'text-red-700', 'nao-aferida': 'text-stone-400',
};
const REL_LABEL: Record<string, string> = {
  saudavel: 'Saudável', atencao: 'Atenção', critica: 'Crítica', 'nao-aferida': '—',
};

type DiagDraft = {
  diag_d: string;
  diag_nps: string;
  diag_csat: string;
  diag_adormecido: boolean;
  diag_proxima_acao: string;
  diag_tend_rel: string;
};

function rowToDraft(r: RedeLoteadorRow): DiagDraft {
  return {
    diag_d: r.diag_d !== null && r.diag_d !== undefined ? String(r.diag_d) : '',
    diag_nps: r.diag_nps !== null && r.diag_nps !== undefined ? String(r.diag_nps) : '',
    diag_csat: r.diag_csat !== null && r.diag_csat !== undefined ? String(r.diag_csat) : '',
    diag_adormecido: r.diag_adormecido,
    diag_proxima_acao: r.diag_proxima_acao ?? '',
    diag_tend_rel: r.diag_tend_rel ?? '',
  };
}

function draftToPatch(draft: DiagDraft): RedeLoteadorDiagPatch {
  return {
    diag_d: draft.diag_d !== '' ? Number(draft.diag_d) : null,
    diag_nps: draft.diag_nps !== '' ? parseInt(draft.diag_nps, 10) : null,
    diag_csat: draft.diag_csat !== '' ? parseFloat(draft.diag_csat.replace(',', '.')) : null,
    diag_adormecido: draft.diag_adormecido,
    diag_proxima_acao: draft.diag_proxima_acao.trim() || null,
    diag_tend_rel: draft.diag_tend_rel || null,
  };
}

const inpCls = 'w-full rounded border border-stone-300 bg-white px-1.5 py-1 text-xs text-stone-800';
const selCls = `${inpCls} pr-5`;
const DIM_OPTS = [
  { value: '', label: '—' }, { value: '0', label: '0 · Sem capital' },
  { value: '1', label: '1 · Moderado' }, { value: '2', label: '2 · Tem capital' },
];
const TEND_OPTS = [
  { value: '', label: '—' }, { value: '↑', label: '↑' },
  { value: '→', label: '→' }, { value: '↓', label: '↓' },
];

type SecaoColuna = {
  key: string;
  label: string;
  minWidth?: string;
  render: (r: RedeLoteadorRow) => React.ReactNode;
};

type Secao = {
  id: string;
  titulo: string;
  colunas: SecaoColuna[];
};

function formatDateBr(iso: string | null | undefined): string {
  const s = (iso ?? '').trim().slice(0, 10);
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function cellText(value: string | number | null | undefined, max = 48): React.ReactNode {
  if (value == null) return '—';
  const s = String(value).trim();
  if (!s) return '—';
  if (s.length <= max) return s;
  return <span title={s}>{`${s.slice(0, max - 1)}…`}</span>;
}

function cellAnexo(url: string | null | undefined): React.ReactNode {
  const href = (url ?? '').trim();
  if (!href) return '—';
  const isUrl = /^https?:\/\//i.test(href);
  if (!isUrl) {
    return <span title={href}>{href.length > 28 ? `${href.slice(0, 27)}…` : href}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--moni-navy-800)] hover:underline"
      title={href}
    >
      Abrir
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

function StatusBadge({ status }: { status: RedeLoteadorStatus }) {
  const label = REDE_LOTEADOR_STATUS_LABEL[status];
  const cls =
    status === 'ativo'
      ? 'bg-green-100 text-green-800 border-green-200'
      : status === 'em_analise'
        ? 'bg-amber-100 text-amber-900 border-amber-200'
        : 'bg-stone-100 text-stone-600 border-stone-200';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}

const SECOES: Secao[] = [
  {
    id: 'identificacao',
    titulo: 'Identificação',
    colunas: [
      {
        key: 'codigo',
        label: 'Código',
        minWidth: '5.5rem',
        render: (r) => (
          <span className="font-mono text-xs text-stone-500">{r.codigo?.trim() || '—'}</span>
        ),
      },
      { key: 'nome', label: 'Nome', minWidth: '10rem', render: (r) => cellText(r.nome, 40) },
      { key: 'cnpj', label: 'CNPJ', minWidth: '8rem', render: (r) => cellText(r.cnpj) },
      { key: 'cidade', label: 'Cidade', render: (r) => cellText(r.cidade) },
      { key: 'estado', label: 'UF', minWidth: '3.5rem', render: (r) => cellText(r.estado) },
      { key: 'contato_nome', label: 'Contato', render: (r) => cellText(r.contato_nome) },
      { key: 'contato_telefone', label: 'Telefone', render: (r) => cellText(r.contato_telefone) },
      { key: 'contato_email', label: 'E-mail', minWidth: '10rem', render: (r) => cellText(r.contato_email, 36) },
      {
        key: 'portfolio_descricao',
        label: 'Portfólio',
        minWidth: '12rem',
        render: (r) => cellText(r.portfolio_descricao, 56),
      },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      {
        key: 'observacoes',
        label: 'Observações',
        minWidth: '10rem',
        render: (r) => cellText(r.observacoes, 48),
      },
    ],
  },
  {
    id: 'parceiro',
    titulo: 'Parceiro / interlocutor',
    colunas: [
      {
        key: 'interlocutor_nome',
        label: 'Responsável',
        minWidth: '10rem',
        render: (r) => cellText(r.interlocutor_nome),
      },
      { key: 'interlocutor_cargo', label: 'Cargo', render: (r) => cellText(r.interlocutor_cargo) },
      {
        key: 'interlocutor_telefone',
        label: 'Telefone',
        render: (r) => cellText(r.interlocutor_telefone),
      },
      {
        key: 'interlocutor_email',
        label: 'E-mail',
        minWidth: '10rem',
        render: (r) => cellText(r.interlocutor_email, 36),
      },
    ],
  },
  {
    id: 'condominio',
    titulo: 'Condomínio',
    colunas: [
      {
        key: 'condominio_nome',
        label: 'Nome',
        minWidth: '10rem',
        render: (r) => cellText(r.condominio_nome),
      },
      {
        key: 'condominio_data_lancamento',
        label: 'Lançamento / TVO',
        render: (r) => formatDateBr(r.condominio_data_lancamento),
      },
      { key: 'condominio_cidade', label: 'Cidade', render: (r) => cellText(r.condominio_cidade) },
      {
        key: 'condominio_estado',
        label: 'UF',
        minWidth: '3.5rem',
        render: (r) => cellText(r.condominio_estado ?? r.estado),
      },
      {
        key: 'condominio_qtd_lotes',
        label: 'Qtd. lotes',
        render: (r) => cellText(r.condominio_qtd_lotes),
      },
      {
        key: 'condominio_preco_lotes',
        label: 'Preço lotes',
        minWidth: '9rem',
        render: (r) => cellText(r.condominio_preco_lotes, 40),
      },
      {
        key: 'condominio_metragem_lotes',
        label: 'Metragem lotes',
        minWidth: '9rem',
        render: (r) => cellText(r.condominio_metragem_lotes, 40),
      },
      {
        key: 'condominio_preco_casas',
        label: 'Preço casas',
        minWidth: '9rem',
        render: (r) => cellText(r.condominio_preco_casas, 40),
      },
      {
        key: 'condominio_metragem_casas',
        label: 'Metragem casas',
        minWidth: '9rem',
        render: (r) => cellText(r.condominio_metragem_casas, 40),
      },
      {
        key: 'anexo_planta_cadastral',
        label: 'Planta cadastral',
        render: (r) => cellAnexo(r.anexo_planta_cadastral),
      },
      {
        key: 'anexo_manual_obras',
        label: 'Manual de obras',
        render: (r) => cellAnexo(r.anexo_manual_obras),
      },
      {
        key: 'anexo_casas_concorrentes',
        label: 'Casas concorrentes',
        render: (r) => cellAnexo(r.anexo_casas_concorrentes),
      },
    ],
  },
  {
    id: 'carteira',
    titulo: 'Venda e carteira',
    colunas: [
      {
        key: 'carteira_lotes_disponiveis',
        label: 'Disponíveis',
        render: (r) => cellText(r.carteira_lotes_disponiveis),
      },
      {
        key: 'carteira_lotes_vendidos_quitados',
        label: 'Vendidos quitados',
        render: (r) => cellText(r.carteira_lotes_vendidos_quitados),
      },
      {
        key: 'carteira_carteira_curta_qtd',
        label: 'Carteira curta (qtd)',
        render: (r) => cellText(r.carteira_carteira_curta_qtd),
      },
      {
        key: 'carteira_curta_financiamento',
        label: 'Financ. curta',
        minWidth: '10rem',
        render: (r) => cellText(r.carteira_curta_financiamento, 40),
      },
      {
        key: 'carteira_longa_qtd',
        label: 'Carteira longa (qtd)',
        render: (r) => cellText(r.carteira_longa_qtd),
      },
      {
        key: 'carteira_longa_financiamento',
        label: 'Financ. longa',
        minWidth: '10rem',
        render: (r) => cellText(r.carteira_longa_financiamento, 40),
      },
      {
        key: 'anexo_tabela_precos',
        label: 'Tabela de preços',
        render: (r) => cellAnexo(r.anexo_tabela_precos),
      },
    ],
  },
  {
    id: 'livre',
    titulo: 'Campo livre',
    colunas: [
      {
        key: 'campo_livre',
        label: 'Informações adicionais',
        minWidth: '14rem',
        render: (r) => cellText(r.campo_livre, 72),
      },
      {
        key: 'anexo_material_extra',
        label: 'Material complementar',
        render: (r) => cellAnexo(r.anexo_material_extra),
      },
    ],
  },
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico',
    colunas: [
      {
        key: 'diag_d',
        label: 'D · Capital',
        minWidth: '6rem',
        render: (r) => <DimCell val={r.diag_d} />,
      },
      {
        key: 'diag_nps',
        label: 'NPS',
        minWidth: '5rem',
        render: (r) => <NpsCell nps={r.diag_nps} />,
      },
      {
        key: 'diag_csat',
        label: 'CSAT',
        minWidth: '5rem',
        render: (r) => <CsatCell csat={r.diag_csat} />,
      },
      {
        key: 'diag_rel',
        label: 'Relação',
        minWidth: '6rem',
        render: (r) => {
          const rel = calcLoteadorRelacao(r);
          return <span className={`text-xs font-semibold ${REL_STYLE[rel]}`}>{REL_LABEL[rel]}</span>;
        },
      },
      {
        key: 'diag_prio',
        label: 'Prio.',
        minWidth: '4rem',
        render: (r) => {
          const p = calcLoteadorPriority(r);
          return (
            <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold text-white ${LOTE_P_STYLE[p]}`}>
              {p}
            </span>
          );
        },
      },
      {
        key: 'diag_grupo',
        label: 'Grupo',
        minWidth: '9rem',
        render: (r) => {
          const g = calcLoteadorGrupo(r);
          if (!g) return <span className="text-stone-300">—</span>;
          return (
            <div className="flex flex-col gap-0.5">
              <span className={`inline-block rounded px-1.5 py-px text-[10px] font-bold ${LOTE_GA_BADGE[g]}`}>{g}</span>
              <span className="text-[9px] text-stone-500">{LOTEADOR_GA_NOME[g]}</span>
            </div>
          );
        },
      },
      {
        key: 'diag_proxima_acao',
        label: 'Próxima ação',
        minWidth: '12rem',
        render: (r) => cellText(r.diag_proxima_acao, 60),
      },
      {
        key: 'diag_avaliado',
        label: 'Avaliado em',
        minWidth: '7rem',
        render: (r) => {
          if (!r.diag_ultima_aval) return <span className="text-stone-300">—</span>;
          return (
            <div className="text-[11px] text-stone-500">
              <div>{formatDateBr(r.diag_ultima_aval)}</div>
              {r.diag_avaliado_por ? (
                <div className="truncate text-[9px] text-stone-400">{r.diag_avaliado_por}</div>
              ) : null}
            </div>
          );
        },
      },
    ],
  },
];

const TOTAL_DATA_COLS = SECOES.reduce((acc, s) => acc + s.colunas.length, 0);

type Props = {
  rows: RedeLoteadorRow[];
  buscaAtiva?: boolean;
  totalSemBusca?: number;
  buscaResetKey?: string;
  solicitarCriacao?: number;
};

export function TabelaRedeLoteadoresEditavel({
  rows,
  buscaAtiva = false,
  totalSemBusca,
  buscaResetKey = '',
  solicitarCriacao = 0,
}: Props) {
  const router = useRouter();
  const { page: safePage, setPage, totalPages, start } = usePaginaTabela(
    rows.length,
    PER_PAGE,
    buscaResetKey,
  );
  const [saving, setSaving] = useState(false);
  const [savingDiag, setSavingDiag] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [ficha, setFicha] = useState<FichaState>(null);
  const [editingDiag, setEditingDiag] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DiagDraft>>({});

  const rowsOrdenadas = useMemo(() => ordenarRedeLoteadoresPorCodigo(rows), [rows]);
  const totalGeral = totalSemBusca ?? rows.length;
  const pageRows = useMemo(() => rowsOrdenadas.slice(start, start + PER_PAGE), [rowsOrdenadas, start]);
  const semLinhas = pageRows.length === 0;

  useEffect(() => {
    if (solicitarCriacao > 0) setFicha({ mode: 'create' });
  }, [solicitarCriacao]);

  const openDiag = (r: RedeLoteadorRow) => {
    setDrafts((d) => ({ ...d, [r.id]: rowToDraft(r) }));
    setEditingDiag(r.id);
  };

  const saveDiag = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingDiag(id);
    const res = await salvarDiagnosticoLoteador(id, {
      ...draftToPatch(draft),
      diag_ultima_aval: new Date().toISOString().slice(0, 10),
    });
    setSavingDiag(null);
    if (!res.ok) { setMsg({ tipo: 'erro', texto: res.error }); return; }
    setEditingDiag(null);
    setMsg({ tipo: 'ok', texto: 'Diagnóstico salvo.' });
    router.refresh();
  };

  const arquivar = async (id: string) => {
    if (saving) return;
    const ok = window.confirm('Arquivar este loteador? O status passará para Inativo.');
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    const r = await arquivarRedeLoteador(id);
    setSaving(false);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    setMsg({ tipo: 'ok', texto: 'Loteador arquivado.' });
    router.refresh();
  };

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {msg ? (
        <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
          {msg.texto}
        </div>
      ) : null}

      <p className="text-xs text-stone-500">
        Edição pela ficha completa. Role horizontalmente para ver todas as seções.
      </p>

      <MoniTabelaScrollSync className="rounded-xl border border-[color:var(--moni-border-default)] bg-[color:var(--moni-surface-50)] shadow-sm">
        <table className="moni-tabela-loteadores w-full min-w-[2200px] border-collapse bg-[color:var(--moni-surface-50)] text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--moni-border-default)]">
              {SECOES.map((secao, idx) => (
                <th
                  key={secao.id}
                  colSpan={secao.colunas.length}
                  scope="colgroup"
                  className={`px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-primary)] ${
                    idx > 0 ? 'border-l border-[color:var(--moni-border-default)]' : ''
                  }`}
                >
                  {secao.titulo}
                </th>
              ))}
              <th
                className="sticky right-0 z-20 w-28 min-w-[7rem] border-l border-[color:var(--moni-border-default)] px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-primary)]"
                scope="colgroup"
              >
                Ações
              </th>
            </tr>
            <tr className="border-b border-[color:var(--moni-border-default)]">
              {SECOES.map((secao, idx) =>
                secao.colunas.map((col, colIdx) => (
                  <th
                    key={col.key}
                    className={`${redeTh} whitespace-nowrap ${
                      idx > 0 && colIdx === 0 ? 'border-l border-[color:var(--moni-border-default)]' : ''
                    }`}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                    scope="col"
                  >
                    {col.label}
                  </th>
                )),
              )}
              <th
                className="sticky right-0 z-20 w-28 min-w-[7rem] border-l border-[color:var(--moni-border-default)] px-1 py-2 text-center"
                scope="col"
              >
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {semLinhas ? (
              <tr>
                <td colSpan={TOTAL_DATA_COLS + 1} className="px-3 py-10 text-center text-sm text-[color:var(--moni-text-tertiary)]">
                  {buscaAtiva && totalGeral > 0
                    ? 'Nenhum loteador encontrado para esta pesquisa.'
                    : 'Nenhum loteador cadastrado ainda. Clique em “Novo Loteador” para adicionar o primeiro.'}
                </td>
              </tr>
            ) : (
              pageRows.map((r) => {
                const isEditDiag = editingDiag === r.id;
                const draft = drafts[r.id];
                const adorm = isLoteadorAdormecido(r);
                const rowCls = r.status === 'inativo'
                  ? 'bg-stone-50 opacity-60 hover:opacity-100'
                  : adorm ? 'bg-blue-50/40 opacity-70 hover:opacity-100' : '';

                return (
                  <tr key={r.id} className={`group border-b border-[color:var(--moni-border-default)] align-top ${rowCls}`}>
                    {SECOES.map((secao, idx) =>
                      secao.colunas.map((col, colIdx) => (
                        <td
                          key={`${r.id}-${col.key}`}
                          className={`bg-inherit px-3 py-2.5 text-[color:var(--moni-text-secondary)] ${
                            col.key === 'nome' ? 'font-medium text-[color:var(--moni-text-primary)]' : ''
                          } ${idx > 0 && colIdx === 0 ? 'border-l border-[color:var(--moni-border-default)]' : ''}`}
                        >
                          {/* No modo de edição diag, mostrar campos editáveis na seção diagnóstico */}
                          {isEditDiag && secao.id === 'diagnostico' && draft ? (
                            col.key === 'diag_d' ? (
                              <select value={draft.diag_d} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id]!, diag_d: e.target.value } }))} className={selCls}>
                                {DIM_OPTS.map((o) => <option key={o.value || 'na'} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : col.key === 'diag_nps' ? (
                              <input type="number" min={0} max={10} value={draft.diag_nps} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id]!, diag_nps: e.target.value } }))} className={inpCls} placeholder="—" />
                            ) : col.key === 'diag_csat' ? (
                              <input type="number" min={1} max={5} step={0.1} value={draft.diag_csat} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id]!, diag_csat: e.target.value } }))} className={inpCls} placeholder="—" />
                            ) : col.key === 'diag_rel' ? (
                              <select value={draft.diag_tend_rel} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id]!, diag_tend_rel: e.target.value } }))} className={selCls} aria-label="Tendência relação">
                                {TEND_OPTS.map((o) => <option key={o.value || 'na'} value={o.value}>{o.label || '—'}</option>)}
                              </select>
                            ) : col.key === 'diag_proxima_acao' ? (
                              <textarea rows={2} value={draft.diag_proxima_acao} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id]!, diag_proxima_acao: e.target.value } }))} className={`${inpCls} resize-y min-w-[120px]`} placeholder="Próxima ação…" />
                            ) : col.key === 'diag_avaliado' ? (
                              <label className="flex items-center gap-1 text-xs text-stone-600 cursor-pointer">
                                <input type="checkbox" checked={draft.diag_adormecido} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id]!, diag_adormecido: e.target.checked } }))} className="h-3.5 w-3.5" />
                                Adormecido
                              </label>
                            ) : col.render(r)
                          ) : col.render(r)}
                        </td>
                      )),
                    )}
                    <td className="sticky right-0 z-10 bg-inherit border-l border-[color:var(--moni-border-default)] px-1 py-2 align-middle">
                      <div className="flex flex-col items-center gap-1">
                        {isEditDiag ? (
                          <>
                            <button type="button" title="Salvar diagnóstico" onClick={() => void saveDiag(r.id)} disabled={savingDiag === r.id}
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--moni-radius-md)] p-1.5 text-green-700 hover:bg-green-50 disabled:opacity-50">
                              <Save className="h-4 w-4" />
                            </button>
                            <button type="button" title="Cancelar" onClick={() => setEditingDiag(null)}
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--moni-radius-md)] p-1.5 text-stone-500 hover:bg-stone-100">
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" title="Editar diagnóstico" onClick={() => openDiag(r)}
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--moni-radius-md)] p-1.5 text-[color:var(--moni-text-secondary)] hover:bg-[color:var(--moni-surface-100)]">
                              <span className="text-[9px] font-bold text-stone-500">DIAG</span>
                            </button>
                            <button type="button" title="Abrir ficha completa" onClick={() => setFicha({ mode: 'edit', row: r })}
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--moni-radius-md)] p-1.5 text-[color:var(--moni-text-secondary)] hover:bg-[color:var(--moni-surface-100)]">
                              <ClipboardList className="h-4 w-4" />
                            </button>
                            {r.status !== 'inativo' ? (
                              <button type="button" title="Arquivar" onClick={() => void arquivar(r.id)} disabled={saving}
                                className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-[var(--moni-radius-md)] p-1.5 text-[color:var(--moni-text-secondary)] hover:bg-[color:var(--moni-surface-100)] disabled:opacity-50">
                                <Archive className="h-4 w-4" />
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </MoniTabelaScrollSync>

      <div className="moni-tabela-footer flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
        <p className="text-sm text-stone-600">
          Mostrando {rowsOrdenadas.length === 0 ? 0 : start + 1}–
          {Math.min(start + PER_PAGE, rowsOrdenadas.length)} de {rowsOrdenadas.length} loteador
          {rowsOrdenadas.length === 1 ? '' : 'es'}
          {buscaAtiva && totalGeral > rowsOrdenadas.length ? (
            <span className="text-stone-500"> (filtrado de {totalGeral})</span>
          ) : null}
        </p>
        {totalPages > 1 ? (
          <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação da tabela de loteadores">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
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
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Próxima
            </button>
          </nav>
        ) : null}
      </div>

      {ficha?.mode === 'edit' ? (
        <RedeLoteadorFichaModal row={ficha.row} onClose={() => setFicha(null)} />
      ) : null}
      {ficha?.mode === 'create' ? <RedeLoteadorFichaModal onClose={() => setFicha(null)} /> : null}
    </div>
  );
}
