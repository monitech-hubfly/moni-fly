'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { usePaginaTabela } from '@/lib/use-pagina-tabela';
import {
  decimalInputFromValue,
  formatCidadeEstadoCondominio,
  formatCondominioInteiro,
  formatCondominioMoeda,
  formatEnderecoNumero,
  integerInputFromValue,
  ordenarCondominiosPorNome,
  parseDecimalInput,
  parseIntegerInput,
  type CondominioRow,
} from '@/lib/condominios';
import {
  atualizarCondominio,
  criarCondominio,
  excluirCondominio,
} from '@/app/rede-franqueados/condominios-actions';
import { redeAlertError, redeAlertSuccess, redeTh } from '@/app/rede-franqueados/rede-ui';
import { UFS_BRASIL } from '@/lib/uf';

const PER_PAGE = 15;

type Draft = {
  nome: string;
  endereco: string;
  numero: string;
  cep: string;
  cidade: string;
  estado: string;
  ticket_medio_lote: string;
  ticket_medio_casas: string;
  ticket_medio_casas_rsm2: string;
  estimativa_casas_vendidas_ano: string;
  extrato_como_eram_casas: string;
  extrato_tempo_venda: string;
};

function emptyDraft(): Draft {
  return {
    nome: '',
    endereco: '',
    numero: '',
    cep: '',
    cidade: '',
    estado: '',
    ticket_medio_lote: '',
    ticket_medio_casas: '',
    ticket_medio_casas_rsm2: '',
    estimativa_casas_vendidas_ano: '',
    extrato_como_eram_casas: '',
    extrato_tempo_venda: '',
  };
}

function rowToDraft(r: CondominioRow): Draft {
  return {
    nome: r.nome ?? '',
    endereco: r.endereco ?? '',
    numero: r.numero ?? '',
    cep: r.cep ?? '',
    cidade: r.cidade ?? '',
    estado: r.estado ?? '',
    ticket_medio_lote: decimalInputFromValue(r.ticket_medio_lote),
    ticket_medio_casas: decimalInputFromValue(r.ticket_medio_casas),
    ticket_medio_casas_rsm2: decimalInputFromValue(r.ticket_medio_casas_rsm2),
    estimativa_casas_vendidas_ano: integerInputFromValue(r.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: r.extrato_como_eram_casas ?? '',
    extrato_tempo_venda: r.extrato_tempo_venda ?? '',
  };
}

function draftToPatch(d: Draft) {
  return {
    nome: d.nome.trim(),
    endereco: d.endereco.trim() || null,
    numero: d.numero.trim() || null,
    cep: d.cep.trim() || null,
    cidade: d.cidade.trim() || null,
    estado: d.estado.trim() || null,
    ticket_medio_lote: parseDecimalInput(d.ticket_medio_lote),
    ticket_medio_casas: parseDecimalInput(d.ticket_medio_casas),
    ticket_medio_casas_rsm2: parseDecimalInput(d.ticket_medio_casas_rsm2),
    estimativa_casas_vendidas_ano: parseIntegerInput(d.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: d.extrato_como_eram_casas.trim() || null,
    extrato_tempo_venda: d.extrato_tempo_venda.trim() || null,
  };
}

const inputCls = 'w-full min-w-0 rounded-md border border-stone-300 px-2 py-1 text-sm';

type Props = {
  rows: CondominioRow[];
  canEdit?: boolean;
  buscaAtiva?: boolean;
  totalSemBusca?: number;
  buscaResetKey?: string;
  solicitarCriacao?: number;
};

export function TabelaCondominiosEditavel({
  rows,
  canEdit = true,
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

  const rowsOrdenadas = useMemo(() => ordenarCondominiosPorNome(rows), [rows]);
  const totalGeral = totalSemBusca ?? rows.length;
  const pageRows = useMemo(() => rowsOrdenadas.slice(start, start + PER_PAGE), [rowsOrdenadas, start]);

  const cancelEdit = () => {
    setEditingId(null);
    setCreating(false);
    setDraft(emptyDraft());
    setMsg(null);
  };

  const beginEdit = (r: CondominioRow) => {
    if (!canEdit) return;
    setMsg(null);
    setCreating(false);
    setEditingId(r.id);
    setDraft(rowToDraft(r));
  };

  const beginCreate = () => {
    if (!canEdit) return;
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
      ? await criarCondominio(patch)
      : editingId
        ? await atualizarCondominio(editingId, patch)
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

  const excluir = async (id: string) => {
    if (!canEdit || saving) return;
    const ok = window.confirm('Excluir este condomínio? Esta ação não pode ser desfeita.');
    if (!ok) return;
    setSaving(true);
    setMsg(null);
    const r = await excluirCondominio(id);
    setSaving(false);
    if (!r.ok) {
      setMsg({ tipo: 'erro', texto: r.error });
      return;
    }
    setMsg({ tipo: 'ok', texto: 'Condomínio excluído.' });
    if (editingId === id) cancelEdit();
    router.refresh();
  };

  const busy = saving;
  const emEdicao = canEdit && (creating || editingId !== null);

  if (rowsOrdenadas.length === 0 && !creating) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-600">
        <p className="font-medium">
          {buscaAtiva && totalGeral > 0
            ? 'Nenhum condomínio encontrado para esta pesquisa.'
            : 'Nenhum condomínio cadastrado.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {msg ? (
        <div className={msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError} role="status">
          {msg.texto}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-stone-200/90 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/95">
              <th className={redeTh} scope="col">
                Nome
              </th>
              <th className={redeTh} scope="col">
                Endereço + Nº
              </th>
              <th className={redeTh} scope="col">
                CEP
              </th>
              <th className={redeTh} scope="col">
                Cidade / Estado
              </th>
              <th className={redeTh} scope="col">
                Ticket Médio Lote
              </th>
              <th className={redeTh} scope="col">
                Ticket Médio Casas
              </th>
              <th className={redeTh} scope="col">
                Ticket Médio Casas (R$/m²)
              </th>
              <th className={redeTh} scope="col">
                Est. casas vendidas/ano
              </th>
              <th className={redeTh} scope="col">
                Extrato — Como eram
              </th>
              <th className={redeTh} scope="col">
                Extrato — Tempo venda
              </th>
              {canEdit ? (
                <th
                  className="sticky right-0 z-20 w-28 min-w-[7rem] border-l border-stone-200 bg-stone-50 px-1 py-2 text-center"
                  scope="col"
                >
                  <span className="sr-only">Ações</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {creating ? (
              <CondominioEditRow
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
                  <CondominioEditRow
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
                  <td className="px-3 py-2.5 text-stone-700">{formatEnderecoNumero(r.endereco, r.numero)}</td>
                  <td className="px-3 py-2.5 text-stone-700">{r.cep?.trim() || '—'}</td>
                  <td className="px-3 py-2.5 text-stone-700">
                    {formatCidadeEstadoCondominio(r.cidade, r.estado)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-700">
                    {formatCondominioMoeda(r.ticket_medio_lote)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-700">
                    {formatCondominioMoeda(r.ticket_medio_casas)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-700">
                    {formatCondominioMoeda(r.ticket_medio_casas_rsm2)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-700">
                    {formatCondominioInteiro(r.estimativa_casas_vendidas_ano)}
                  </td>
                  <td className="max-w-[12rem] px-3 py-2.5 text-stone-700">
                    <span className="line-clamp-2 text-xs" title={r.extrato_como_eram_casas ?? ''}>
                      {r.extrato_como_eram_casas?.trim() || '—'}
                    </span>
                  </td>
                  <td className="max-w-[12rem] px-3 py-2.5 text-stone-700">
                    <span className="line-clamp-2 text-xs" title={r.extrato_tempo_venda ?? ''}>
                      {r.extrato_tempo_venda?.trim() || '—'}
                    </span>
                  </td>
                  {canEdit ? (
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
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => void excluir(r.id)}
                          disabled={emEdicao || busy}
                          className="rounded-md p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Excluir</span>
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-3">
        <p className="text-sm text-stone-600">
          Mostrando {rowsOrdenadas.length === 0 ? 0 : start + 1}–{Math.min(start + PER_PAGE, rowsOrdenadas.length)} de{' '}
          {rowsOrdenadas.length} condomínio{rowsOrdenadas.length === 1 ? '' : 's'}
          {buscaAtiva && totalGeral > rowsOrdenadas.length ? (
            <span className="text-stone-500"> (filtrado de {totalGeral})</span>
          ) : null}
        </p>
        {totalPages > 1 ? (
          <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação da tabela de condomínios">
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
    </div>
  );
}

function CondominioEditRow({
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
          value={draft.endereco}
          onChange={(e) => setDraft((d) => ({ ...d, endereco: e.target.value }))}
          className={`${inputCls} mb-1`}
          placeholder="Endereço"
        />
        <input
          type="text"
          value={draft.numero}
          onChange={(e) => setDraft((d) => ({ ...d, numero: e.target.value }))}
          className={inputCls}
          placeholder="Nº"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={draft.cep}
          onChange={(e) => setDraft((d) => ({ ...d, cep: e.target.value }))}
          className={inputCls}
          placeholder="CEP"
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
          inputMode="decimal"
          value={draft.ticket_medio_lote}
          onChange={(e) => setDraft((d) => ({ ...d, ticket_medio_lote: e.target.value }))}
          className={inputCls}
          placeholder="R$"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={draft.ticket_medio_casas}
          onChange={(e) => setDraft((d) => ({ ...d, ticket_medio_casas: e.target.value }))}
          className={inputCls}
          placeholder="R$"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={draft.ticket_medio_casas_rsm2}
          onChange={(e) => setDraft((d) => ({ ...d, ticket_medio_casas_rsm2: e.target.value }))}
          className={inputCls}
          placeholder="R$/m²"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={draft.estimativa_casas_vendidas_ano}
          onChange={(e) => setDraft((d) => ({ ...d, estimativa_casas_vendidas_ano: e.target.value }))}
          className={inputCls}
          placeholder="Ex.: 120"
        />
      </td>
      <td className="px-3 py-2">
        <textarea
          rows={2}
          value={draft.extrato_como_eram_casas}
          onChange={(e) => setDraft((d) => ({ ...d, extrato_como_eram_casas: e.target.value }))}
          className={`${inputCls} min-w-[10rem]`}
          placeholder="Como eram as casas"
        />
      </td>
      <td className="px-3 py-2">
        <textarea
          rows={2}
          value={draft.extrato_tempo_venda}
          onChange={(e) => setDraft((d) => ({ ...d, extrato_tempo_venda: e.target.value }))}
          className={`${inputCls} min-w-[10rem]`}
          placeholder="Tempo para vender"
        />
      </td>
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
