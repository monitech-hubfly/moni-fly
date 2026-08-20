'use client';

import { useEffect, useMemo, useState, type ReactNode, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Check, X, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca';
import { redeTh } from '@/app/rede-franqueados/rede-ui';
import {
  agruparPorCondominio,
  imobEmpreendimentoRowMatchesBusca,
  ordenarImobEmpreendimentosPorNome,
  type ImobEmpreendimentoRow,
} from '@/lib/imob-empreendimentos';
import {
  criarImobEmpreendimento,
  atualizarImobEmpreendimento,
  vincularCorretorEmpreendimento,
  desvincularCorretorEmpreendimento,
} from '@/app/rede-franqueados/imob-empreendimentos-actions';
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync';
import type { CondominioRow } from '@/lib/condominios';
import type { RedeCorretorRow } from '@/lib/rede-corretores';

type Props = {
  rows: ImobEmpreendimentoRow[];
  condominiosRows: CondominioRow[];
  corretoresRows: RedeCorretorRow[];
  children?: ReactNode;
  solicitarCriacao?: number;
};

const td = 'px-3 py-2.5 text-stone-700 text-sm';
const tdNowrap = `${td} whitespace-nowrap`;

function dash(s: string | null | undefined): string {
  return String(s ?? '').trim() || '—';
}

function linkSimulador(row: ImobEmpreendimentoRow): string | null {
  const t = row.share_token?.trim();
  if (!t) return null;
  return `https://moni.casa/corretor?token=${t}`;
}

// ─── Modal de criação/edição ──────────────────────────────────────────────────

type ModalProps = {
  row: ImobEmpreendimentoRow | null; // null = novo
  condominiosRows: CondominioRow[];
  corretoresRows: RedeCorretorRow[];
  onClose: () => void;
};

function EmpreendimentoModal({ row, condominiosRows, corretoresRows, onClose }: ModalProps) {
  const router = useRouter();
  const isNovo = row === null;

  const [nome, setNome] = useState(row?.nome ?? '');
  const [condominioId, setCondominioId] = useState(row?.condominio_id ?? '');
  const [specs, setSpecs] = useState(row?.specs ?? '');
  const [imagemUrl, setImagemUrl] = useState(row?.imagem_url ?? '');
  const [ativo, setAtivo] = useState(row?.ativo ?? true);

  // Corretores vinculados (ids)
  const [vinculados, setVinculados] = useState<Set<string>>(
    new Set(row?.corretor_ids ?? []),
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const patch = {
      nome,
      condominio_id: condominioId || null,
      specs: specs || null,
      imagem_url: imagemUrl || null,
      ativo,
    };
    const res = isNovo
      ? await criarImobEmpreendimento(patch)
      : await atualizarImobEmpreendimento(row!.id, patch);
    setSalvando(false);
    if (!res.ok) { setErro(res.error); return; }
    router.refresh();
    onClose();
  }

  async function toggleCorretor(corretorId: string) {
    if (!row) return; // só para edição
    setVinculandoId(corretorId);
    const isVinculado = vinculados.has(corretorId);
    const res = isVinculado
      ? await desvincularCorretorEmpreendimento(corretorId, row.id)
      : await vincularCorretorEmpreendimento(corretorId, row.id);
    if (res.ok) {
      setVinculados((prev) => {
        const next = new Set(prev);
        if (isVinculado) next.delete(corretorId); else next.add(corretorId);
        return next;
      });
    }
    setVinculandoId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-10">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl ring-1 ring-stone-200 mx-4">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-900">
            {isNovo ? 'Novo empreendimento' : 'Editar empreendimento'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void salvar(e)} className="px-6 py-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Nome do empreendimento <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Ex.: Lago Azul II"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none focus:ring-1 focus:ring-[var(--moni-navy-800)]"
            />
          </div>

          {/* Condomínio */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Condomínio</label>
            <select
              value={condominioId}
              onChange={(e) => setCondominioId(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none"
            >
              <option value="">— Selecionar condomínio —</option>
              {condominiosRows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.cidade ? ` · ${c.cidade}` : ''}
                  {c.estado ? `/${c.estado}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Specs */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Especificações (texto livre para o flyer)
            </label>
            <textarea
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              rows={3}
              placeholder="Ex.: 120m² · 3 dorms · 2 vagas"
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none resize-none"
            />
          </div>

          {/* Imagem URL */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              URL da imagem principal
            </label>
            <input
              type="url"
              value={imagemUrl}
              onChange={(e) => setImagemUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-[var(--moni-navy-800)] focus:outline-none"
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-2">
            <input
              id="ativo-check"
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-[var(--moni-navy-800)]"
            />
            <label htmlFor="ativo-check" className="text-sm text-stone-700">
              Empreendimento ativo
            </label>
          </div>

          {erro ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-md bg-[var(--moni-navy-800,#0c2633)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {salvando ? 'Salvando…' : isNovo ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </form>

        {/* Corretores vinculados — apenas em edição */}
        {!isNovo && corretoresRows.length > 0 ? (
          <div className="border-t border-stone-100 px-6 py-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Corretores vinculados
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {corretoresRows.map((c) => {
                const linked = vinculados.has(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
                  >
                    <input
                      type="checkbox"
                      checked={linked}
                      disabled={vinculandoId === c.id}
                      onChange={() => void toggleCorretor(c.id)}
                      className="h-4 w-4 rounded border-stone-300 text-[var(--moni-navy-800)]"
                    />
                    <span className="text-stone-700">{c.nome}</span>
                    {c.n_corretor ? (
                      <span className="text-stone-400">#{c.n_corretor}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ImobEmpreendimentosTabelaComBusca({
  rows,
  condominiosRows,
  corretoresRows,
  children,
  solicitarCriacao = 0,
}: Props) {
  const [busca, setBusca] = useState('');
  const [modalRow, setModalRow] = useState<ImobEmpreendimentoRow | null | undefined>(undefined);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (solicitarCriacao > 0) setModalRow(null);
  }, [solicitarCriacao]);

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim();
    const base = q
      ? rows.filter((r) => imobEmpreendimentoRowMatchesBusca(r, q))
      : rows;
    return ordenarImobEmpreendimentosPorNome(base);
  }, [rows, busca]);

  const grupos = useMemo(() => agruparPorCondominio(rowsFiltradas), [rowsFiltradas]);

  function toggleGrupo(key: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar empreendimentos…"
        ariaLabel="Pesquisar empreendimentos"
      >
        {children}
      </RedeTabelaToolbarBusca>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center text-sm text-stone-500 shadow-sm">
          Nenhum empreendimento cadastrado ainda.{' '}
          <button
            type="button"
            onClick={() => setModalRow(null)}
            className="font-medium text-[var(--moni-navy-800)] underline-offset-2 hover:underline"
          >
            Criar o primeiro
          </button>
        </div>
      ) : grupos.length === 0 && busca.trim() ? (
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center text-sm text-stone-500 shadow-sm">
          Nenhum empreendimento encontrado para &ldquo;{busca}&rdquo;.
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo) => {
            const key = grupo.condominio_id ?? '__sem_condominio__';
            const aberto = !expandidos.has(key);
            return (
              <div
                key={key}
                className="rounded-lg border border-stone-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Header do grupo */}
                <button
                  type="button"
                  onClick={() => toggleGrupo(key)}
                  className="flex w-full items-center gap-2 border-b border-stone-100 bg-stone-50/70 px-4 py-3 text-left"
                >
                  {aberto ? (
                    <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" />
                  )}
                  <span className="font-semibold text-stone-800 text-sm">
                    {grupo.condominio_nome}
                  </span>
                  <span className="ml-auto text-xs text-stone-400">
                    {grupo.rows.length} empreendimento{grupo.rows.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {aberto ? (
                  <MoniTabelaScrollSync>
                    <table className="min-w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-stone-100 bg-stone-50/40">
                          <th className={redeTh}>Nome</th>
                          <th className={redeTh}>Card vinculado</th>
                          <th className={redeTh}>Especificações</th>
                          <th className={redeTh}>Corretores</th>
                          <th className={redeTh}>Unidades IMOB</th>
                          <th className={redeTh}>Status</th>
                          <th className={redeTh}>Link simulador</th>
                          <th className={`${redeTh} w-10`}>
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.rows.map((row) => {
                          const simLink = linkSimulador(row);
                          return (
                            <tr
                              key={row.id}
                              className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60"
                            >
                              <td className={`${td} font-medium text-stone-900 min-w-[10rem]`}>
                                {row.nome}
                                {!row.ativo ? (
                                  <span className="ml-2 inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                                    Inativo
                                  </span>
                                ) : null}
                              </td>
                              <td className={`${td} min-w-[10rem]`}>
                                {dash(row.card_titulo)}
                              </td>
                              <td className={`${td} min-w-[14rem] max-w-[20rem]`}>
                                <span className="line-clamp-2">{dash(row.specs)}</span>
                              </td>
                              <td className={tdNowrap}>
                                {row.corretores_count != null ? (
                                  <span
                                    className={
                                      (row.corretores_count ?? 0) > 0
                                        ? 'font-medium text-stone-900'
                                        : 'text-stone-400'
                                    }
                                  >
                                    {row.corretores_count}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className={tdNowrap}>
                                {row.unidades_count != null ? (
                                  <span
                                    className={
                                      (row.unidades_count ?? 0) > 0
                                        ? 'font-medium text-stone-900'
                                        : 'text-stone-400'
                                    }
                                  >
                                    {row.unidades_count}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className={tdNowrap}>
                                {row.ativo ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                                    <Check className="h-3 w-3" />
                                    Ativo
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                                    Inativo
                                  </span>
                                )}
                              </td>
                              <td className={`${td} min-w-[10rem]`}>
                                {simLink ? (
                                  <a
                                    href={simLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[var(--moni-navy-800)] underline-offset-2 hover:underline text-xs"
                                  >
                                    <Link2 className="h-3 w-3 shrink-0" />
                                    {row.share_token}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className={`${td} text-right`}>
                                <button
                                  type="button"
                                  title="Editar empreendimento"
                                  onClick={() => setModalRow(row)}
                                  className="rounded-md p-1.5 text-stone-500 hover:bg-stone-200/80 hover:text-stone-700"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </MoniTabelaScrollSync>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {modalRow !== undefined ? (
        <EmpreendimentoModal
          row={modalRow}
          condominiosRows={condominiosRows}
          corretoresRows={corretoresRows}
          onClose={() => setModalRow(undefined)}
        />
      ) : null}
    </div>
  );
}
