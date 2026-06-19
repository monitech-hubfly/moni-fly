'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Check, ClipboardList, Loader2, Pencil, X } from 'lucide-react';
import { RedeLoteadorFichaModal } from '@/components/RedeLoteadorFichaModal';
import { usePaginaTabela } from '@/lib/use-pagina-tabela';
import {
  REDE_LOTEADOR_STATUS_LABEL,
  ordenarRedeLoteadoresPorNome,
  type RedeLoteadorRow,
  type RedeLoteadorStatus,
} from '@/lib/rede-loteadores';
import { arquivarRedeLoteador, atualizarRedeLoteador, criarRedeLoteador } from '@/app/rede-franqueados/rede-loteadores-actions';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';
import { redeAlertError, redeAlertSuccess, redeTh } from '@/app/rede-franqueados/rede-ui';
import { UFS_BRASIL } from '@/lib/uf';

const PER_PAGE = 15;

type Draft = {
  nome: string;
  cnpj: string;
  cidade: string;
  estado: string;
  contato_nome: string;
  contato_telefone: string;
  contato_email: string;
  portfolio_descricao: string;
  status: RedeLoteadorStatus;
};

function emptyDraft(): Draft {
  return {
    nome: '',
    cnpj: '',
    cidade: '',
    estado: '',
    contato_nome: '',
    contato_telefone: '',
    contato_email: '',
    portfolio_descricao: '',
    status: 'ativo',
  };
}

function rowToDraft(r: RedeLoteadorRow): Draft {
  return {
    nome: r.nome ?? '',
    cnpj: r.cnpj ?? '',
    cidade: r.cidade ?? '',
    estado: r.estado ?? '',
    contato_nome: r.contato_nome ?? '',
    contato_telefone: r.contato_telefone ?? '',
    contato_email: r.contato_email ?? '',
    portfolio_descricao: r.portfolio_descricao ?? '',
    status: r.status,
  };
}

function draftToPatch(d: Draft) {
  return {
    nome: d.nome.trim(),
    cnpj: d.cnpj.trim() || null,
    cidade: d.cidade.trim() || null,
    estado: d.estado.trim() || null,
    contato_nome: d.contato_nome.trim() || null,
    contato_telefone: d.contato_telefone.trim() || null,
    contato_email: d.contato_email.trim() || null,
    portfolio_descricao: d.portfolio_descricao.trim() || null,
    status: d.status,
  };
}

function formatCidadeEstado(cidade: string | null, estado: string | null): string {
  const c = (cidade ?? '').trim();
  const e = (estado ?? '').trim();
  if (c && e) return `${c} / ${e}`;
  return c || e || '—';
}

function formatContato(nome: string | null, telefone: string | null): string {
  const n = (nome ?? '').trim();
  const t = (telefone ?? '').trim();
  if (n && t) return `${n} · ${t}`;
  return n || t || '—';
}

function resumirPortfolio(text: string | null, max = 72): string {
  const s = (text ?? '').trim();
  if (!s) return '—';
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
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

const inputCls = 'w-full min-w-0 rounded-md border border-stone-300 px-2 py-1 text-sm';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [fichaRow, setFichaRow] = useState<RedeLoteadorRow | null>(null);

  const rowsOrdenadas = useMemo(() => ordenarRedeLoteadoresPorNome(rows), [rows]);
  const totalGeral = totalSemBusca ?? rows.length;
  const pageRows = useMemo(() => rowsOrdenadas.slice(start, start + PER_PAGE), [rowsOrdenadas, start]);

  const cancelEdit = () => {
    setEditingId(null);
    setCreating(false);
    setDraft(emptyDraft());
    setMsg(null);
  };

  const beginEdit = (r: RedeLoteadorRow) => {
    setMsg(null);
    setCreating(false);
    setEditingId(r.id);
    setDraft(rowToDraft(r));
  };

  const beginCreate = () => {
    setMsg(null);
    setEditingId(null);
    setCreating(true);
    setDraft(emptyDraft());
  };

  useEffect(() => {
    if (solicitarCriacao > 0) beginCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick externo da toolbar
  }, [solicitarCriacao]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const patch = draftToPatch(draft);
    const r = creating
      ? await criarRedeLoteador(patch)
      : editingId
        ? await atualizarRedeLoteador(editingId, patch)
        : { ok: false as const, error: 'Nenhuma linha em edição.' };
    setSaving(false);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    setMsg({ tipo: 'ok', texto: r.mensagem });
    cancelEdit();
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
    if (editingId === id) cancelEdit();
    router.refresh();
  };

  const busy = saving;
  const emEdicao = creating || editingId !== null;

  if (rowsOrdenadas.length === 0 && !creating) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-600">
        <p className="font-medium">
          {buscaAtiva && totalGeral > 0
            ? 'Nenhum loteador encontrado para esta pesquisa.'
            : 'Nenhum loteador cadastrado.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      {msg ? (
        <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
          {msg.texto}
        </div>
      ) : null}

      <MoniTabelaScrollSync className="rounded-xl border border-stone-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/95">
              <th className={redeTh} scope="col">
                Nome
              </th>
              <th className={redeTh} scope="col">
                CNPJ
              </th>
              <th className={redeTh} scope="col">
                Cidade / Estado
              </th>
              <th className={redeTh} scope="col">
                Contato
              </th>
              <th className={`${redeTh} min-w-[12rem]`} scope="col">
                Portfólio
              </th>
              <th className={redeTh} scope="col">
                Status
              </th>
              <th className={`${redeTh} w-16 text-center`} scope="col">
                Ficha
              </th>
              <th
                className="sticky right-0 z-20 w-28 min-w-[7rem] border-l border-stone-200 bg-stone-50 px-1 py-2 text-center"
                scope="col"
              >
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {creating ? (
              <LoteadorEditRow
                draft={draft}
                setDraft={setDraft}
                onSave={() => void save()}
                onCancel={cancelEdit}
                saving={busy}
              />
            ) : null}
            {pageRows.map((r) => {
              const isEditing = editingId === r.id;
              if (isEditing) {
                return (
                  <LoteadorEditRow
                    key={r.id}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={() => void save()}
                    onCancel={cancelEdit}
                    saving={busy}
                  />
                );
              }
              return (
                <tr key={r.id} className="group border-b border-stone-100 align-top hover:bg-stone-50/70">
                  <td className="px-3 py-2.5 font-medium text-stone-900">{r.nome}</td>
                  <td className="px-3 py-2.5 text-stone-700">{r.cnpj?.trim() || '—'}</td>
                  <td className="px-3 py-2.5 text-stone-700">{formatCidadeEstado(r.cidade, r.estado)}</td>
                  <td className="px-3 py-2.5 text-stone-700">{formatContato(r.contato_nome, r.contato_telefone)}</td>
                  <td className="max-w-xs px-3 py-2.5 text-stone-700" title={r.portfolio_descricao ?? undefined}>
                    {resumirPortfolio(r.portfolio_descricao)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-2 py-2.5 text-center align-middle">
                    <button
                      type="button"
                      title="Abrir ficha completa"
                      onClick={() => setFichaRow(r)}
                      disabled={emEdicao}
                      className="inline-flex rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80 disabled:opacity-50"
                    >
                      <ClipboardList className="h-4 w-4" />
                      <span className="sr-only">Ficha</span>
                    </button>
                  </td>
                  <td className="sticky right-0 z-10 border-l border-stone-200 bg-white px-1 py-2 align-middle group-hover:bg-stone-50/90">
                    <div className="flex items-center justify-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => beginEdit(r)}
                        disabled={emEdicao}
                        className="rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80 disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </button>
                      {r.status !== 'inativo' ? (
                        <button
                          type="button"
                          title="Arquivar"
                          onClick={() => void arquivar(r.id)}
                          disabled={emEdicao || busy}
                          className="rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80 disabled:opacity-50"
                        >
                          <Archive className="h-4 w-4" />
                          <span className="sr-only">Arquivar</span>
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </MoniTabelaScrollSync>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
        <p className="text-sm text-stone-600">
          Mostrando {rowsOrdenadas.length === 0 ? 0 : start + 1}–{Math.min(start + PER_PAGE, rowsOrdenadas.length)} de{' '}
          {rowsOrdenadas.length} loteador{rowsOrdenadas.length === 1 ? '' : 'es'}
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

      {fichaRow ? <RedeLoteadorFichaModal row={fichaRow} onClose={() => setFichaRow(null)} /> : null}
    </div>
  );
}

function LoteadorEditRow({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <tr className="border-b border-stone-200 bg-stone-50/80 align-top">
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.nome}
          onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
          className={inputCls}
          placeholder="Nome *"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.cnpj}
          onChange={(e) => setDraft((d) => ({ ...d, cnpj: e.target.value }))}
          className={inputCls}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <input
            type="text"
            value={draft.cidade}
            onChange={(e) => setDraft((d) => ({ ...d, cidade: e.target.value }))}
            className={inputCls}
            placeholder="Cidade"
          />
          <select
            value={draft.estado}
            onChange={(e) => setDraft((d) => ({ ...d, estado: e.target.value }))}
            className={`${inputCls} max-w-[4.5rem]`}
          >
            <option value="">UF</option>
            {UFS_BRASIL.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.contato_nome}
          onChange={(e) => setDraft((d) => ({ ...d, contato_nome: e.target.value }))}
          className={`${inputCls} mb-1`}
          placeholder="Nome contato"
        />
        <input
          type="text"
          value={draft.contato_telefone}
          onChange={(e) => setDraft((d) => ({ ...d, contato_telefone: e.target.value }))}
          className={inputCls}
          placeholder="Telefone"
        />
      </td>
      <td className="px-3 py-2">
        <textarea
          rows={3}
          value={draft.portfolio_descricao}
          onChange={(e) => setDraft((d) => ({ ...d, portfolio_descricao: e.target.value }))}
          className={`${inputCls} resize-y`}
          placeholder="Descrição do portfólio"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={draft.status}
          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as RedeLoteadorStatus }))}
          className={inputCls}
        >
          {(Object.keys(REDE_LOTEADOR_STATUS_LABEL) as RedeLoteadorStatus[]).map((s) => (
            <option key={s} value={s}>
              {REDE_LOTEADOR_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2 text-center text-stone-400">—</td>
      <td className="sticky right-0 border-l border-stone-200 bg-stone-50 px-1 py-2 align-middle">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            title="Salvar"
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-moni-primary p-1.5 text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            title="Cancelar"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-stone-300 bg-white p-1.5 text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
