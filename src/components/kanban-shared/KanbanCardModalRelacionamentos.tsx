'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  criarVinculoCard,
  listarVinculosCard,
  removerVinculoCard,
  buscarCardsParaVinculo,
  type BuscaCardVinculoRow,
  type KanbanCardVinculoListItem,
  type TipoVinculoKanbanCard,
} from '@/lib/actions/card-actions';
import {
  abrirFunilAcoplamentoManualDoCard,
  dispararEsteiraManualDoCard,
} from '@/lib/actions/kanban-bastoes';
import {
  DESTINOS_ESTEIRA_MANUAL,
  destinosEsteiraManualParaKanban,
  deveExibirBotaoPreObraObraLoteadores,
  kanbanPermiteDispararEsteiraManual,
  ordenarDestinosEsteiraManualParaExibicao,
  resolverKanbanOrigemIdParaEsteiraManual,
  type DestinoEsteiraManualKey,
} from '@/lib/kanban/esteira-manual-destinos';
import { kanbanPermiteAbrirFunilAcoplamentoManual } from '@/lib/kanban/portfolio-paralelas';
import { fetchCardsProjetoEsteiras } from '@/lib/kanban/fetch-cards-projeto-esteiras';
import { createClient } from '@/lib/supabase/client';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { KanbanCardModalProjetoTab } from './KanbanCardModalProjetoTab';
import { KanbanCardVinculosSection } from './KanbanCardVinculosSection';
import { agruparItensVinculoPorKanban } from '@/lib/kanban/kanban-vinculos-display';

const BOTAO_ABRIR_FUNIL_CLASS =
  'w-full rounded-md border border-stone-200 bg-white px-2.5 py-2 text-left text-[11px] font-semibold text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50';

const VINCULOS_MANUAIS_OPEN_KEY = 'vinculos-manuais-open';

const TIPOS_VINCULO: { value: TipoVinculoKanbanCard; label: string }[] = [
  { value: 'relacionado', label: 'relacionado' },
  { value: 'depende_de', label: 'depende_de' },
  { value: 'bloqueia', label: 'bloqueia' },
];

function lerVinculosManuaisOpen(temVinculos: boolean): boolean {
  try {
    if (typeof window === 'undefined') return temVinculos;
    const raw = window.localStorage.getItem(VINCULOS_MANUAIS_OPEN_KEY);
    if (raw === null) return temVinculos;
    return raw !== 'false';
  } catch {
    return temVinculos;
  }
}

function gravarVinculosManuaisOpen(open: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(VINCULOS_MANUAIS_OPEN_KEY, open ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

function IconeChevron({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function rotuloTipoVinculo(tipo: TipoVinculoKanbanCard): string {
  if (tipo === 'depende_de') return 'depende_de';
  if (tipo === 'bloqueia') return 'bloqueia';
  return 'relacionado';
}

type Props = {
  cardId: string;
  cardTitulo: string;
  kanbanId: string | null | undefined;
  kanbanNome?: string | null;
  basePath: string;
  podeGerenciar: boolean;
  disabled?: boolean;
  projetoId?: string | null;
  ocultarKanbansInternos?: boolean;
  cardDesabilitado?: boolean;
};

export function KanbanCardModalRelacionamentos({
  cardId,
  cardTitulo: _cardTitulo,
  kanbanId,
  kanbanNome = null,
  basePath,
  podeGerenciar,
  disabled = false,
  projetoId = null,
  ocultarKanbansInternos = false,
  cardDesabilitado = false,
}: Props) {
  const [vinculos, setVinculos] = useState<KanbanCardVinculoListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modoVincular, setModoVincular] = useState(false);
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculoKanbanCard>('relacionado');
  const [disparando, setDisparando] = useState(false);
  const [buscaVinculo, setBuscaVinculo] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<BuscaCardVinculoRow[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'ok' | 'erro'; msg: string; href?: string } | null>(
    null,
  );
  const [projetoPeerIds, setProjetoPeerIds] = useState<Set<string>>(new Set());
  const [camada3Open, setCamada3Open] = useState(false);

  const pid = projetoId != null && String(projetoId).trim() !== '' ? String(projetoId).trim() : null;

  const kanbanOrigemId = useMemo(
    () => resolverKanbanOrigemIdParaEsteiraManual(kanbanId, kanbanNome),
    [kanbanId, kanbanNome],
  );
  const destinosDisponiveis = useMemo(
    () =>
      ordenarDestinosEsteiraManualParaExibicao(
        kanbanOrigemId,
        destinosEsteiraManualParaKanban(kanbanId, kanbanNome, basePath),
        kanbanNome,
        basePath,
      ),
    [kanbanId, kanbanNome, kanbanOrigemId, basePath],
  );
  const exibirBotaoPreObraObra =
    podeGerenciar && !disabled && deveExibirBotaoPreObraObraLoteadores(kanbanId, kanbanNome, basePath);
  const mostrarAbrirFunilAcoplamento =
    podeGerenciar && kanbanPermiteAbrirFunilAcoplamentoManual(kanbanOrigemId);
  const botoesAbrirFunil = useMemo(() => {
    const items: { key: string; label: string; tipo: 'acoplamento' | 'esteira'; destinoKey?: DestinoEsteiraManualKey }[] =
      [];
    if (mostrarAbrirFunilAcoplamento) {
      items.push({ key: 'acoplamento', label: 'Acoplamento', tipo: 'acoplamento' });
    }
    if (podeGerenciar && kanbanPermiteDispararEsteiraManual(kanbanId, kanbanNome)) {
      for (const destinoKey of destinosDisponiveis) {
        if (destinoKey === 'pre_obra_obra' && exibirBotaoPreObraObra) continue;
        items.push({
          key: destinoKey,
          label: DESTINOS_ESTEIRA_MANUAL[destinoKey].label,
          tipo: 'esteira',
          destinoKey,
        });
      }
    }
    return items;
  }, [mostrarAbrirFunilAcoplamento, exibirBotaoPreObraObra, podeGerenciar, kanbanId, kanbanNome, destinosDisponiveis]);
  const mostrarSecaoDispararEsteira = exibirBotaoPreObraObra || (botoesAbrirFunil.length > 0 && !disabled);

  const recarregar = useCallback(async () => {
    if (!cardId || disabled) {
      setVinculos([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listarVinculosCard(cardId);
      setVinculos(res.ok ? res.items : []);
    } catch {
      setVinculos([]);
    } finally {
      setLoading(false);
    }
  }, [cardId, disabled]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const vinculosVisiveis = useMemo(
    () =>
      pid ? vinculos.filter((row) => !projetoPeerIds.has(row.outro_card.id)) : vinculos,
    [pid, vinculos, projetoPeerIds],
  );
  const temVinculosManuais = vinculosVisiveis.length > 0;

  useEffect(() => {
    setCamada3Open(lerVinculosManuaisOpen(temVinculosManuais));
  }, [temVinculosManuais]);

  useEffect(() => {
    if (!pid || !cardId || disabled) {
      setProjetoPeerIds(new Set());
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const list = await fetchCardsProjetoEsteiras(supabase, pid, cardId);
        if (!cancelled) {
          setProjetoPeerIds(new Set(list.map((row) => row.id)));
        }
      } catch {
        if (!cancelled) setProjetoPeerIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pid, cardId, disabled]);

  useEffect(() => {
    if (!modoVincular || !podeGerenciar) {
      setResultadosBusca([]);
      return;
    }
    const t = buscaVinculo.trim();
    const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t);
    if (!uuidOk && t.length < 2) {
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
  }, [buscaVinculo, modoVincular, podeGerenciar, cardId]);

  function fecharFormularioVincular() {
    setModoVincular(false);
    setBuscaVinculo('');
    setResultadosBusca([]);
    setTipoVinculo('relacionado');
  }

  function toggleCamada3() {
    setCamada3Open((prev) => {
      const next = !prev;
      gravarVinculosManuaisOpen(next);
      return next;
    });
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
      fecharFormularioVincular();
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
        tipo: tipoVinculo,
        basePath,
      });
      if (!res.ok) {
        setToast({ tipo: 'erro', msg: res.error });
        return;
      }
      setToast({ tipo: 'ok', msg: 'Vínculo criado.' });
      fecharFormularioVincular();
      setCamada3Open(true);
      gravarVinculosManuaisOpen(true);
      await recarregar();
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro ao vincular card.' });
    } finally {
      setDisparando(false);
    }
  }

  async function handleAbrirFunilAcoplamento() {
    setDisparando(true);
    setToast(null);
    try {
      const res = await abrirFunilAcoplamentoManualDoCard(cardId, basePath);
      if (!res.ok) {
        setToast({ tipo: 'erro', msg: res.error });
        return;
      }
      const href = hrefAbrirCardKanban(res.kanbanNome, res.cardFilhoId);
      setToast({
        tipo: 'ok',
        msg: res.jaExistia
          ? 'Card do Funil Acoplamento já existia.'
          : 'Card criado no Funil Acoplamento.',
        href,
      });
      fecharFormularioVincular();
      await recarregar();
    } catch {
      setToast({ tipo: 'erro', msg: 'Erro ao abrir Funil Acoplamento.' });
    } finally {
      setDisparando(false);
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

  const gruposManuais = useMemo(() => {
    const itens = vinculosVisiveis.map((row) => ({
      key: row.id,
      kanbanNome: row.outro_card.kanban_nome,
      titulo: row.outro_card.titulo,
      faseNome: rotuloTipoVinculo(row.tipo_vinculo),
      status: 'ativo' as const,
      dataLabel: null,
      href: hrefAbrirCardKanban(row.outro_card.kanban_nome, row.outro_card.id),
      onRemove:
        podeGerenciar
          ? () => {
              void handleRemover(row.id);
            }
          : undefined,
    }));
    return agruparItensVinculoPorKanban(itens);
  }, [vinculosVisiveis, podeGerenciar, basePath]);

  const mostrarCamada3 = !disabled && (podeGerenciar || temVinculosManuais);
  const bodyCamada3Visivel = camada3Open;

  return (
    <div className="min-w-0 space-y-3">
      {projetoId != null && String(projetoId).trim() !== '' ? (
        <div className="min-w-0 border-b border-stone-100 pb-3">
          <KanbanCardModalProjetoTab
            projetoId={projetoId}
            cardIdAtual={cardId}
            ocultarKanbansInternos={ocultarKanbansInternos}
            variant="sidebar"
          />
        </div>
      ) : null}

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

      {/* Camada 2 — Disparar esteira */}
      {mostrarSecaoDispararEsteira ? (
        <section
          className="min-w-0 space-y-1.5"
          aria-label="Disparar esteira"
          style={{
            borderTop: 'var(--moni-border-width) solid var(--moni-border-default)',
            paddingTop: '0.5rem',
          }}
        >
          <div>
            <p
              className="text-[11px] font-semibold"
              style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
            >
              Disparar esteira
            </p>
            <p
              className="text-[10px] leading-snug"
              style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
            >
              cria card filho
            </p>
          </div>
          {exibirBotaoPreObraObra ? (
            <button
              type="button"
              onClick={() => void handleDispararEsteira('pre_obra_obra')}
              disabled={disparando || cardDesabilitado}
              className={BOTAO_ABRIR_FUNIL_CLASS}
              data-moni-funil-destino="pre_obra_obra"
              title={`Criar card filho no funil ${DESTINOS_ESTEIRA_MANUAL.pre_obra_obra.label}`}
            >
              {disparando ? 'Abrindo…' : `+ ${DESTINOS_ESTEIRA_MANUAL.pre_obra_obra.label}`}
            </button>
          ) : null}
          {botoesAbrirFunil.length > 0 && !disabled
            ? botoesAbrirFunil.map((botao) => (
                <button
                  key={botao.key}
                  type="button"
                  onClick={() =>
                    void (botao.tipo === 'acoplamento'
                      ? handleAbrirFunilAcoplamento()
                      : handleDispararEsteira(botao.destinoKey!))
                  }
                  disabled={disparando || cardDesabilitado}
                  className={BOTAO_ABRIR_FUNIL_CLASS}
                  title={`Criar card filho no funil ${botao.label}`}
                >
                  {disparando ? 'Abrindo…' : `+ ${botao.label}`}
                </button>
              ))
            : null}
        </section>
      ) : null}

      {/* Camada 3 — Vincular card existente */}
      {mostrarCamada3 ? (
        <section
          className="min-w-0 overflow-hidden rounded-lg"
          aria-label="Vincular card existente"
          style={{
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
            background: 'var(--moni-surface-0)',
          }}
        >
          <div
            role="button"
            tabIndex={0}
            aria-expanded={bodyCamada3Visivel}
            aria-controls="vinculos-manuais-body"
            onClick={toggleCamada3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCamada3();
              }
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-[11px] select-none"
            style={{ fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-primary)' }}
          >
            <span className="min-w-0 flex-1" style={{ fontWeight: 600 }}>
              Vincular card existente
            </span>
            {temVinculosManuais ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums"
                style={{
                  background: 'var(--moni-navy-50)',
                  color: 'var(--moni-navy-600)',
                }}
              >
                {vinculosVisiveis.length}
              </span>
            ) : null}
            <IconeChevron
              className="shrink-0"
              style={{
                color: 'var(--moni-text-tertiary)',
                transform: bodyCamada3Visivel ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 220ms ease',
              }}
            />
          </div>

          <div
            id="vinculos-manuais-body"
            style={{
              display: 'grid',
              gridTemplateRows: bodyCamada3Visivel ? '1fr' : '0fr',
              transition: 'grid-template-rows 220ms ease',
            }}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="space-y-2 px-1.5 pb-1.5">
                <p
                  className="px-1 text-[10px] leading-snug"
                  style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
                >
                  relacionado · depende_de · bloqueia
                </p>

                <KanbanCardVinculosSection
                  grupos={gruposManuais}
                  loading={loading}
                  emptyMessage={temVinculosManuais ? null : 'Nenhum vínculo manual'}
                  variant="sidebar"
                />

                {podeGerenciar && !disabled ? (
                  <div className="space-y-2 pt-1">
                    {!modoVincular ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModoVincular(true);
                          if (!camada3Open) {
                            setCamada3Open(true);
                            gravarVinculosManuaisOpen(true);
                          }
                        }}
                        className="w-full rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition hover:bg-stone-50"
                        style={{
                          border: 'var(--moni-border-width) solid var(--moni-border-default)',
                          color: 'var(--moni-text-primary)',
                          fontFamily: 'var(--moni-font-sans)',
                        }}
                      >
                        + Buscar card para vincular
                      </button>
                    ) : (
                      <div
                        className="space-y-2 rounded-md p-2"
                        style={{
                          border: 'var(--moni-border-width) solid var(--moni-border-default)',
                          background: 'var(--moni-surface-0)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block text-[10px] font-medium"
                          style={{ color: 'var(--moni-text-secondary)' }}
                        >
                          Tipo
                          <select
                            value={tipoVinculo}
                            onChange={(e) => setTipoVinculo(e.target.value as TipoVinculoKanbanCard)}
                            className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-800"
                          >
                            {TIPOS_VINCULO.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label
                          className="block text-[10px] font-medium"
                          style={{ color: 'var(--moni-text-secondary)' }}
                        >
                          Buscar por título ou ID (FK / UUID)
                          <input
                            type="search"
                            value={buscaVinculo}
                            onChange={(e) => setBuscaVinculo(e.target.value)}
                            placeholder="Ex.: FK0006, UUID ou nome…"
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
                        ) : buscaVinculo.trim().length >= 2 ||
                          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                            buscaVinculo.trim(),
                          ) ? (
                          <p className="text-[10px] text-stone-500">Nenhum card encontrado.</p>
                        ) : null}
                        <button
                          type="button"
                          onClick={fecharFormularioVincular}
                          disabled={disparando}
                          className="text-[10px] text-stone-500 hover:underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
