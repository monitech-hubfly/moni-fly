'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ExternalLink, Loader2, Pencil, X } from 'lucide-react';
import type { MoniCapitalCadastroRow, MoniCapitalCadastroUpsertDados } from '@/lib/moni-capital-cadastros';
import { atualizarCadastroMoniCapital } from '@/lib/moni-capital-cadastros-actions';
import { redeAlertError, redeAlertSuccess, redeTh } from './rede-ui';
import { usePaginaTabela } from '@/lib/use-pagina-tabela';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';

const PER_PAGE = 15;
const inputCls =
  'w-full min-w-0 rounded-md border px-2 py-1 text-sm';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
};

type CadastroDraft = Required<{
  [K in keyof MoniCapitalCadastroUpsertDados]: string;
}>;

function emptyDraft(): CadastroDraft {
  return {
    broker_nome: '',
    broker_email: '',
    broker_telefone: '',
    investidor_nome: '',
    investidor_email: '',
    investidor_telefone: '',
  };
}

function rowToDraft(row: MoniCapitalCadastroRow): CadastroDraft {
  return {
    broker_nome: row.broker_nome ?? '',
    broker_email: row.broker_email ?? '',
    broker_telefone: row.broker_telefone ?? '',
    investidor_nome: row.investidor_nome ?? '',
    investidor_email: row.investidor_email ?? '',
    investidor_telefone: row.investidor_telefone ?? '',
  };
}

function draftToUpsert(d: CadastroDraft): MoniCapitalCadastroUpsertDados {
  return {
    broker_nome: d.broker_nome.trim() || null,
    broker_email: d.broker_email.trim() || null,
    broker_telefone: d.broker_telefone.trim() || null,
    investidor_nome: d.investidor_nome.trim() || null,
    investidor_email: d.investidor_email.trim() || null,
    investidor_telefone: d.investidor_telefone.trim() || null,
  };
}

type Props = {
  linhas: MoniCapitalCadastroRow[];
  buscaAtiva?: boolean;
  totalSemBusca?: number;
  buscaResetKey?: string;
};

export function CadastrosMoniCapitalTabela({
  linhas,
  buscaAtiva = false,
  totalSemBusca,
  buscaResetKey = '',
}: Props) {
  const router = useRouter();
  const { page: safePage, setPage, totalPages, start } = usePaginaTabela(
    linhas.length,
    PER_PAGE,
    buscaResetKey,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CadastroDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const totalGeral = totalSemBusca ?? linhas.length;
  const pageRows = useMemo(() => linhas.slice(start, start + PER_PAGE), [linhas, start]);

  const thGroup =
    'border-b bg-stone-100/90 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-stone-600';

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setMsg(null);
  };

  const beginEdit = (row: MoniCapitalCadastroRow) => {
    setMsg(null);
    setEditingId(row.id);
    setDraft(rowToDraft(row));
  };

  const save = async (id: string) => {
    setSaving(true);
    setMsg(null);
    const res = await atualizarCadastroMoniCapital(id, draftToUpsert(draft));
    setSaving(false);
    if (!res.ok) {
      setMsg({ tipo: 'erro', texto: res.error });
      return;
    }
    setMsg({ tipo: 'ok', texto: res.mensagem ?? 'Cadastro salvo.' });
    cancelEdit();
    router.refresh();
  };

  if (linhas.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center text-sm"
        style={{
          border: '0.5px solid var(--moni-border-default)',
          background: 'var(--moni-surface-50)',
          color: 'var(--moni-text-secondary)',
        }}
      >
        {buscaAtiva && totalGeral > 0
          ? 'Nenhum cadastro encontrado para esta pesquisa.'
          : 'Nenhum cadastro Moní Capital ainda.'}
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
            <tr>
              <th colSpan={1} className={thGroup} style={{ borderColor: 'var(--moni-border-default)' }}>
                Cadastro
              </th>
              <th
                colSpan={3}
                className={`${thGroup} border-l`}
                style={{ borderColor: 'var(--moni-border-default)' }}
              >
                Broker
              </th>
              <th
                colSpan={3}
                className={`${thGroup} border-l`}
                style={{ borderColor: 'var(--moni-border-default)' }}
              >
                Investidor
              </th>
              <th
                rowSpan={2}
                className="sticky right-0 z-30 w-24 min-w-[6rem] border-l bg-stone-50 align-bottom px-1 py-2"
                style={{ borderColor: 'var(--moni-border-default)' }}
              >
                <span className="sr-only">Ações</span>
              </th>
            </tr>
            <tr className="border-b bg-stone-50/95" style={{ borderColor: 'var(--moni-border-default)' }}>
              <th className={redeTh}>Nº Cadastro</th>
              <th className={`${redeTh} border-l`} style={{ borderColor: 'var(--moni-border-default)' }}>
                Nome
              </th>
              <th className={redeTh}>E-mail</th>
              <th className={redeTh}>Telefone</th>
              <th className={`${redeTh} border-l`} style={{ borderColor: 'var(--moni-border-default)' }}>
                Nome
              </th>
              <th className={redeTh}>E-mail</th>
              <th className={redeTh}>Telefone</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const isEditing = editingId === row.id;
              if (isEditing) {
                return (
                  <tr
                    key={row.id}
                    className="border-b bg-stone-50/90 align-top"
                    style={{ borderColor: 'var(--moni-border-default)' }}
                  >
                    <td className="px-3 py-2 font-medium text-stone-900">{row.n_cadastro}</td>
                    <EditCells draft={draft} setDraft={setDraft} prefix="broker" borderLeft />
                    <EditCells draft={draft} setDraft={setDraft} prefix="investidor" borderLeft />
                    <td
                      className="sticky right-0 border-l bg-stone-50 px-1 py-2 align-middle"
                      style={{ borderColor: 'var(--moni-border-default)' }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          title="Salvar"
                          disabled={saving}
                          onClick={() => void save(row.id)}
                          className="rounded-md p-1.5 text-white disabled:opacity-50"
                          style={{ background: 'var(--moni-navy-800)' }}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          title="Cancelar"
                          disabled={saving}
                          onClick={cancelEdit}
                          className="rounded-md border bg-white p-1.5 text-stone-700 hover:bg-stone-100"
                          style={{ border: '0.5px solid var(--moni-border-default)' }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={row.id}
                  className="group border-b align-top hover:bg-stone-50/70"
                  style={{ borderColor: 'var(--moni-border-default)' }}
                >
                  <td className="px-3 py-2.5 font-medium text-stone-900">{row.n_cadastro}</td>
                  <td
                    className="border-l px-3 py-2.5 text-stone-700"
                    style={{ borderColor: 'var(--moni-border-default)' }}
                  >
                    {row.broker_nome?.trim() || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-stone-700">{row.broker_email?.trim() || '—'}</td>
                  <td className="px-3 py-2.5 text-stone-700">{row.broker_telefone?.trim() || '—'}</td>
                  <td
                    className="border-l px-3 py-2.5 text-stone-700"
                    style={{ borderColor: 'var(--moni-border-default)' }}
                  >
                    {row.investidor_nome?.trim() || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-stone-700">{row.investidor_email?.trim() || '—'}</td>
                  <td className="px-3 py-2.5 text-stone-700">{row.investidor_telefone?.trim() || '—'}</td>
                  <td
                    className="sticky right-0 border-l bg-white px-1 py-2 align-middle group-hover:bg-stone-50/90"
                    style={{ borderColor: 'var(--moni-border-default)' }}
                  >
                    <div className="flex flex-col items-center justify-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                      {row.kanban_card_id ? (
                        <Link
                          href={`/funil-funding?card=${row.kanban_card_id}`}
                          title="Abrir card Funding"
                          className="rounded-md p-1.5 hover:bg-stone-200/80"
                          style={{ color: 'var(--moni-navy-800)' }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Card Funding</span>
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        title="Editar cadastro"
                        disabled={editingId !== null}
                        onClick={() => beginEdit(row)}
                        className="rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80 disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </MoniTabelaScrollSync>

      <div
        className="moni-tabela-footer flex flex-wrap items-center justify-between gap-3 border-t pt-3"
        style={{ borderColor: 'var(--moni-border-default)' }}
      >
        <p className="text-sm text-stone-600">
          Mostrando {start + 1}–{Math.min(start + PER_PAGE, linhas.length)} de {linhas.length} cadastro
          {linhas.length === 1 ? '' : 's'}
          {buscaAtiva && totalGeral > linhas.length ? (
            <span className="text-stone-500"> (filtrado de {totalGeral})</span>
          ) : null}
        </p>
        {totalPages > 1 ? (
          <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação cadastros Moní Capital">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              style={{ border: '0.5px solid var(--moni-border-default)' }}
            >
              Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`min-w-[2.25rem] rounded-lg border px-2 py-1.5 text-sm font-medium ${
                  p === safePage ? 'text-white' : 'bg-white text-stone-700 hover:bg-stone-50'
                }`}
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  background: p === safePage ? 'var(--moni-navy-800)' : undefined,
                }}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              style={{ border: '0.5px solid var(--moni-border-default)' }}
            >
              Próxima
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function EditCells({
  draft,
  setDraft,
  prefix,
  borderLeft = false,
}: {
  draft: CadastroDraft;
  setDraft: React.Dispatch<React.SetStateAction<CadastroDraft>>;
  prefix: 'broker' | 'investidor';
  borderLeft?: boolean;
}) {
  const cell = borderLeft ? 'border-l px-2 py-2' : 'px-2 py-2';
  const nomeKey = `${prefix}_nome` as keyof CadastroDraft;
  const emailKey = `${prefix}_email` as keyof CadastroDraft;
  const telKey = `${prefix}_telefone` as keyof CadastroDraft;

  return (
    <>
      <td className={cell} style={borderLeft ? { borderColor: 'var(--moni-border-default)' } : undefined}>
        <input
          type="text"
          value={draft[nomeKey]}
          onChange={(e) => setDraft((d) => ({ ...d, [nomeKey]: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="Nome"
        />
      </td>
      <td className={cell}>
        <input
          type="email"
          value={draft[emailKey]}
          onChange={(e) => setDraft((d) => ({ ...d, [emailKey]: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="E-mail"
        />
      </td>
      <td className={cell}>
        <input
          type="tel"
          value={draft[telKey]}
          onChange={(e) => setDraft((d) => ({ ...d, [telKey]: e.target.value }))}
          className={inputCls}
          style={inputStyle}
          placeholder="DDD + telefone"
        />
      </td>
    </>
  );
}
