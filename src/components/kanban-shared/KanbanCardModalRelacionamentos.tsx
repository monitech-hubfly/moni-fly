'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  buscarCardsParaVinculo,
  criarVinculoCard,
  listarRelacionamentosCard,
  removerVinculoCard,
  type BuscaCardVinculoRow,
  type RelacionamentoCardRow,
  type TipoRelacionamentoDisplay,
} from '@/lib/actions/card-actions';
import {
  abrirChamadoJuridicoDoCard,
  dispararEsteiraManualDoCard,
  existeChamadoJuridicoParaCard,
} from '@/lib/actions/kanban-bastoes';
import {
  DESTINOS_ESTEIRA_MANUAL,
  destinosEsteiraManualParaKanban,
  kanbanPermiteDispararEsteiraManual,
  type DestinoEsteiraManualKey,
} from '@/lib/kanban/esteira-manual-destinos';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { MSG_CHAMADO_JURIDICO_JA_EXISTE } from '@/lib/constants/kanban-ids';
import { KanbanParalelasChips } from './KanbanParalelasChips';
import { KanbanCardModalProjetoTab } from './KanbanCardModalProjetoTab';
import type { ParalelaChip } from '@/lib/kanban/kanban-paralelas-chips';

function iconeTipoRelacionamento(tipo: TipoRelacionamentoDisplay): string {
  if (tipo === 'originou') return '🔗';
  if (tipo === 'depende_de') return '⬆';
  if (tipo === 'bloqueia') return '🚫';
  if (tipo === 'retornou') return '↩';
  return '↔';
}

function labelTipoRelacionamento(tipo: TipoRelacionamentoDisplay): string {
  if (tipo === 'originou') return 'originou';
  if (tipo === 'depende_de') return 'depende_de';
  if (tipo === 'bloqueia') return 'bloqueia';
  if (tipo === 'retornou') return 'retornou';
  return 'relacionado';
}

type Props = {
  cardId: string;
  cardTitulo: string;
  kanbanId: string | null | undefined;
  basePath: string;
  podeGerenciar: boolean;
  disabled?: boolean;
  chipsParalelas?: ParalelaChip[];
  projetoId?: string | null;
  ocultarKanbansInternos?: boolean;
  mostrarBotaoJuridico?: boolean;
  cardDesabilitado?: boolean;
};

export function KanbanCardModalRelacionamentos({
  cardId,
  cardTitulo,
  kanbanId,
  basePath,
  podeGerenciar,
  disabled = false,
  chipsParalelas = [],
  projetoId = null,
  ocultarKanbansInternos = false,
  mostrarBotaoJuridico = false,
  cardDesabilitado = false,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<RelacionamentoCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [modo, setModo] = useState<'none' | 'esteira' | 'vincular'>('none');
  const [disparando, setDisparando] = useState(false);
  const [buscaVinculo, setBuscaVinculo] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<BuscaCardVinculoRow[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'ok' | 'erro'; msg: string; href?: string } | null>(
    null,
  );
  const [abrindoChamadoJuridico, setAbrindoChamadoJuridico] = useState(false);

  const tituloAtualLc = (cardTitulo || '').trim().toLowerCase();
  const destinosDisponiveis = useMemo(
    () => destinosEsteiraManualParaKanban(kanbanId),
    [kanbanId],
  );
  const mostrarDispararEsteira =
    podeGerenciar && kanbanPermiteDispararEsteiraManual(kanbanId) && destinosDisponiveis.length > 0;

  const recarregar = useCallback(async () => {
    if (!cardId || disabled) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listarRelacionamentosCard(cardId);
      setRows(res.ok ? res.items : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cardId, disabled]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    if (modo !== 'vincular' || !podeGerenciar) {
      setResultadosBusca([]);
      return;
    }
    const t = buscaVinculo.trim();
    if (t.length < 2) {
      setResultadosBusca([]);
      return;
    }
    let cancelled = false;
    setBuscando(true);
    void (async () => {
      try {
        const r = await buscarCardsParaVinculo(t, cardId);
        if (!cancelled) setResultadosBusca(r.ok ? r.items : []);
      } finally {
        if (!cancelled) setBuscando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buscaVinculo, modo, podeGerenciar, cardId]);

  function fecharFormularios() {
    setModo('none');
    setMenuAberto(false);
    setBuscaVinculo('');
    setResultadosBusca([]);
  }

  async function handleDispararEsteira(destinoKey: DestinoEsteiraManualKey) {
    setDisparando(true);
    setToast(null);
    try {
      const res = await dispararEsteiraManualDoCard(cardId, destinoKey, basePath);
      if (!res.ok) {
        setToast({ tipo: 'erro', msg: res.error });
        return;
      }
      const href = hrefAbrirCardKanban(res.kanbanNome, res.cardFilhoId);
      setToast({
        tipo: 'ok',
        msg: res.jaExistia
          ? `Card já existia em ${DESTINOS_ESTEIRA_MANUAL[destinoKey].label}.`
          : `Card criado em ${DESTINOS_ESTEIRA_MANUAL[destinoKey].label}.`,
        href,
      });
      fecharFormularios();
      await recarregar();
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro ao disparar esteira.' });
    } finally {
      setDisparando(false);
    }
  }

  async function handleVincular(destinoId: string) {
    setDisparando(true);
    setToast(null);
    try {
      const res = await criarVinculoCard({
        cardOrigemId: cardId,
        cardDestinoId: destinoId,
        tipo: 'relacionado',
        basePath,
      });
      if (!res.ok) {
        setToast({ tipo: 'erro', msg: res.error });
        return;
      }
      setToast({ tipo: 'ok', msg: 'Vínculo criado.' });
      fecharFormularios();
      await recarregar();
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro ao vincular card.' });
    } finally {
      setDisparando(false);
    }
  }

  async function handleAbrirChamadoJuridico() {
    setAbrindoChamadoJuridico(true);
    setToast(null);
    try {
      const jaExiste = await existeChamadoJuridicoParaCard(cardId);
      if (jaExiste) {
        setToast({ tipo: 'erro', msg: MSG_CHAMADO_JURIDICO_JA_EXISTE });
        return;
      }
      if (!confirm('Criar chamado jurídico para este card?')) return;

      const res = await abrirChamadoJuridicoDoCard(cardId, basePath);
      if (!res.ok) {
        setToast({ tipo: 'erro', msg: res.error });
        return;
      }
      setToast({ tipo: 'ok', msg: 'Chamado jurídico criado.' });
      await recarregar();
      router.refresh();
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro ao criar chamado jurídico.' });
    } finally {
      setAbrindoChamadoJuridico(false);
    }
  }

  async function handleRemover(vinculoId: string) {
    const res = await removerVinculoCard(vinculoId, basePath);
    if (!res.ok) {
      setToast({ tipo: 'erro', msg: res.error });
      return;
    }
    await recarregar();
  }

  return (
    <div className="space-y-3">
      {chipsParalelas.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            Status das esteiras
          </p>
          <KanbanParalelasChips chips={chipsParalelas} compact />
        </div>
      ) : null}

      {projetoId != null && String(projetoId).trim() !== '' ? (
        <div className="border-b border-stone-100 pb-3">
          <KanbanCardModalProjetoTab
            projetoId={projetoId}
            cardIdAtual={cardId}
            ocultarKanbansInternos={ocultarKanbansInternos}
            variant="sidebar"
          />
        </div>
      ) : null}

      {chipsParalelas.length > 0 || (projetoId != null && String(projetoId).trim() !== '') ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Vínculos manuais</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Carregando…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-stone-500">Nenhum relacionamento</p>
      ) : (
        <ul className="list-none space-y-2">
          {rows.map((row) => {
            const href = hrefAbrirCardKanban(row.kanban_nome, row.card_id);
            const tituloDiferente = row.titulo.trim().toLowerCase() !== tituloAtualLc;
            return (
              <li
                key={row.key}
                className="flex items-start justify-between gap-2 rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-stone-600">
                    <span title={labelTipoRelacionamento(row.tipo)} aria-hidden>
                      {iconeTipoRelacionamento(row.tipo)}
                    </span>
                    <span className="font-medium text-stone-700">{row.kanban_nome}</span>
                    <span className="text-stone-400">·</span>
                    <span>{row.fase_nome}</span>
                  </div>
                  {tituloDiferente ? (
                    <Link
                      href={href}
                      className="mt-0.5 block text-[11px] font-medium text-moni-primary hover:underline"
                    >
                      {row.titulo}
                    </Link>
                  ) : (
                    <Link
                      href={href}
                      className="mt-0.5 block text-[11px] font-medium text-moni-primary hover:underline"
                    >
                      Abrir card
                    </Link>
                  )}
                </div>
                {podeGerenciar && row.vinculo_id ? (
                  <button
                    type="button"
                    onClick={() => void handleRemover(row.vinculo_id!)}
                    className="shrink-0 rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-red-600"
                    aria-label="Remover vínculo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {toast ? (
        <p
          className="rounded-md px-2 py-1 text-[10px] font-medium leading-snug"
          role="status"
          style={
            toast.tipo === 'ok'
              ? {
                  background: 'var(--moni-green-50)',
                  color: 'var(--moni-green-800)',
                  border: '0.5px solid var(--moni-green-400)',
                }
              : {
                  background: 'var(--moni-status-archived-bg)',
                  color: 'var(--moni-status-archived-text)',
                  border: '0.5px solid var(--moni-status-archived-border)',
                }
          }
        >
          {toast.msg}{' '}
          {toast.href ? (
            <Link href={toast.href} className="font-semibold underline">
              Abrir card
            </Link>
          ) : null}
        </p>
      ) : null}

      {mostrarBotaoJuridico ? (
        <div className="border-t border-stone-100 pt-2">
          <button
            type="button"
            onClick={() => void handleAbrirChamadoJuridico()}
            disabled={abrindoChamadoJuridico || cardDesabilitado}
            className="w-full rounded-md px-2.5 py-2 text-left text-[11px] font-semibold leading-snug text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--moni-navy-800)' }}
          >
            {abrindoChamadoJuridico ? 'Abrindo…' : 'Abrir chamado jurídico'}
          </button>
        </div>
      ) : null}

      {podeGerenciar && !disabled ? (
        <div className="border-t border-stone-100 pt-2">
          {!menuAberto && modo === 'none' ? (
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-moni-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Adicionar
            </button>
          ) : (
            <div className="space-y-2">
              {modo === 'none' ? (
                <div className="space-y-1">
                  {mostrarDispararEsteira ? (
                    <button
                      type="button"
                      onClick={() => setModo('esteira')}
                      className="block w-full rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-700 hover:bg-stone-100"
                    >
                      Disparar esteira
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setModo('vincular')}
                    className="block w-full rounded px-2 py-1.5 text-left text-[11px] font-medium text-stone-700 hover:bg-stone-100"
                  >
                    Vincular card existente
                  </button>
                  <button
                    type="button"
                    onClick={fecharFormularios}
                    className="text-[10px] text-stone-500 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}

              {modo === 'esteira' ? (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-stone-600">Destino da esteira</p>
                  {destinosDisponiveis.map((key) => (
                    <button
                      key={key}
                      type="button"
                      disabled={disparando}
                      onClick={() => void handleDispararEsteira(key)}
                      className="block w-full rounded border border-stone-200 bg-white px-2 py-1.5 text-left text-[11px] font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                    >
                      {DESTINOS_ESTEIRA_MANUAL[key].label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={fecharFormularios}
                    disabled={disparando}
                    className="text-[10px] text-stone-500 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}

              {modo === 'vincular' ? (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-stone-600">
                    Buscar por título
                    <input
                      type="search"
                      value={buscaVinculo}
                      onChange={(e) => setBuscaVinculo(e.target.value)}
                      placeholder="Mín. 2 caracteres…"
                      className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-800"
                    />
                  </label>
                  {buscando ? (
                    <p className="text-[10px] text-stone-500">Buscando…</p>
                  ) : resultadosBusca.length > 0 ? (
                    <ul className="max-h-40 list-none space-y-1 overflow-y-auto rounded border border-stone-100 bg-white p-1">
                      {resultadosBusca.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => void handleVincular(row.id)}
                            disabled={disparando}
                            className="w-full rounded px-2 py-1.5 text-left text-[11px] transition hover:bg-stone-50 disabled:opacity-50"
                          >
                            <span className="font-medium text-stone-800">{row.titulo}</span>
                            <span className="text-stone-500"> · {row.kanban_nome}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : buscaVinculo.trim().length >= 2 ? (
                    <p className="text-[10px] text-stone-500">Nenhum card encontrado.</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={fecharFormularios}
                    disabled={disparando}
                    className="text-[10px] text-stone-500 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
