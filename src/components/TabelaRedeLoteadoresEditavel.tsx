'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ClipboardList, ExternalLink } from 'lucide-react';
import { RedeLoteadorFichaModal } from '@/components/RedeLoteadorFichaModal';
import { usePaginaTabela } from '@/lib/use-pagina-tabela';
import {
  REDE_LOTEADOR_STATUS_LABEL,
  ordenarRedeLoteadoresPorNome,
  type RedeLoteadorRow,
  type RedeLoteadorStatus,
} from '@/lib/rede-loteadores';
import { arquivarRedeLoteador } from '@/app/rede-franqueados/rede-loteadores-actions';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';
import { redeAlertError, redeAlertSuccess, redeTh } from '@/app/rede-franqueados/rede-ui';

const PER_PAGE = 15;

type FichaState = { mode: 'edit'; row: RedeLoteadorRow } | { mode: 'create' } | null;

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
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [ficha, setFicha] = useState<FichaState>(null);

  const rowsOrdenadas = useMemo(() => ordenarRedeLoteadoresPorNome(rows), [rows]);
  const totalGeral = totalSemBusca ?? rows.length;
  const pageRows = useMemo(() => rowsOrdenadas.slice(start, start + PER_PAGE), [rowsOrdenadas, start]);
  const semLinhas = pageRows.length === 0;

  useEffect(() => {
    if (solicitarCriacao > 0) setFicha({ mode: 'create' });
  }, [solicitarCriacao]);

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

      <MoniTabelaScrollSync className="rounded-xl border border-stone-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[2200px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-100/90">
              {SECOES.map((secao, idx) => (
                <th
                  key={secao.id}
                  colSpan={secao.colunas.length}
                  scope="colgroup"
                  className={`px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-700 ${
                    idx > 0 ? 'border-l border-stone-300' : ''
                  }`}
                >
                  {secao.titulo}
                </th>
              ))}
              <th
                className="sticky right-0 z-20 w-28 min-w-[7rem] border-l border-stone-300 bg-stone-100 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-700"
                scope="colgroup"
              >
                Ações
              </th>
            </tr>
            <tr className="border-b border-stone-200 bg-stone-50/95">
              {SECOES.map((secao, idx) =>
                secao.colunas.map((col, colIdx) => (
                  <th
                    key={col.key}
                    className={`${redeTh} whitespace-nowrap ${
                      idx > 0 && colIdx === 0 ? 'border-l border-stone-200' : ''
                    }`}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                    scope="col"
                  >
                    {col.label}
                  </th>
                )),
              )}
              <th
                className="sticky right-0 z-20 w-28 min-w-[7rem] border-l border-stone-200 bg-stone-50 px-1 py-2 text-center"
                scope="col"
              >
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {semLinhas ? (
              <tr>
                <td colSpan={TOTAL_DATA_COLS + 1} className="px-3 py-10 text-center text-sm text-stone-500">
                  {buscaAtiva && totalGeral > 0
                    ? 'Nenhum loteador encontrado para esta pesquisa.'
                    : 'Nenhum loteador cadastrado ainda. Clique em “Novo Loteador” para adicionar o primeiro.'}
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.id} className="group border-b border-stone-100 align-top hover:bg-stone-50/70">
                  {SECOES.map((secao, idx) =>
                    secao.colunas.map((col, colIdx) => (
                      <td
                        key={`${r.id}-${col.key}`}
                        className={`px-3 py-2.5 text-stone-700 ${
                          col.key === 'nome' ? 'font-medium text-stone-900' : ''
                        } ${idx > 0 && colIdx === 0 ? 'border-l border-stone-100' : ''}`}
                      >
                        {col.render(r)}
                      </td>
                    )),
                  )}
                  <td className="sticky right-0 z-10 border-l border-stone-200 bg-white px-1 py-2 align-middle group-hover:bg-stone-50/90">
                    <div className="flex items-center justify-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                      <button
                        type="button"
                        title="Abrir ficha completa"
                        onClick={() => setFicha({ mode: 'edit', row: r })}
                        className="inline-flex rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80"
                      >
                        <ClipboardList className="h-4 w-4" />
                        <span className="sr-only">Ficha</span>
                      </button>
                      {r.status !== 'inativo' ? (
                        <button
                          type="button"
                          title="Arquivar"
                          onClick={() => void arquivar(r.id)}
                          disabled={saving}
                          className="rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80 disabled:opacity-50"
                        >
                          <Archive className="h-4 w-4" />
                          <span className="sr-only">Arquivar</span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
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
