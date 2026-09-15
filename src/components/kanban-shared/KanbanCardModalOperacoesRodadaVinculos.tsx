'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { RodadaVinculoListItem } from '@/lib/operacoes/rodada-vinculos-service';
import {
  abrirRodadaVinculoClient,
  fetchRodadaVinculos,
} from '@/lib/operacoes/rodada-vinculos-client';
import {
  configRodadaVinculo,
  OPERACOES_RODADA_VINCULOS,
} from '@/lib/operacoes/rodada-vinculos-config';
import {
  estiloTagRodadaDivify,
  rodadaNumeroFromIndex,
} from '@/lib/kanban/divify-tag-rodada';

const DIVIFY_RODADAS_OPEN_KEY = 'divify-rodadas-open';

function lerDivifyRodadasOpen(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem(DIVIFY_RODADAS_OPEN_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

function gravarDivifyRodadasOpen(open: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DIVIFY_RODADAS_OPEN_KEY, open ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

function itensRodadaVinculoPreset(): RodadaVinculoListItem[] {
  return OPERACOES_RODADA_VINCULOS.map((cfg) => ({
    index: cfg.index,
    nome: cfg.nome,
    tagLabel: cfg.tagLabel,
    status: 'pendente' as const,
    concluido_em: null,
    filhoDivifyId: null,
    filhoTitulo: null,
    filhoArquivado: false,
    filhoStatus: null,
  }));
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

const ERRO_ABRIR_RODADA =
  'Não foi possível abrir a rodada (erro de servidor). Recarregue e verifique o Funil Divify.';

function mensagemErroUsuario(raw: string | null | undefined): string {
  const m = String(raw ?? '').trim();
  if (!m) return ERRO_ABRIR_RODADA;
  // Nunca exibir digest / RSC ao usuário — mensagem sóbria fixa.
  if (/server components render|omitted in production|digest|erro de render|erro de servidor/i.test(m)) {
    return ERRO_ABRIR_RODADA;
  }
  // Mensagens de negócio (já concluído / permissão) permanecem legíveis.
  if (
    /já foi concluído|sem permissão|faça login|dados inválidos|vínculo inválido|disponível apenas/i.test(
      m,
    )
  ) {
    return m;
  }
  return ERRO_ABRIR_RODADA;
}

type SidebarProps = {
  cardId: string;
  basePath: string;
  refreshKey: number;
  podeGerenciar: boolean;
  cardDesabilitado?: boolean;
  onConcluido?: () => void;
};

export function KanbanCardModalOperacoesRodadaVinculosSidebar({
  cardId,
  basePath: _basePath,
  refreshKey,
  podeGerenciar,
  cardDesabilitado = false,
  onConcluido,
}: SidebarProps) {
  const [items, setItems] = useState<RodadaVinculoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [abrindoIndex, setAbrindoIndex] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [divifyRodadasOpen, setDivifyRodadasOpen] = useState(true);
  const readOnly = !podeGerenciar || cardDesabilitado;

  useEffect(() => {
    setDivifyRodadasOpen(lerDivifyRodadasOpen());
  }, []);

  function toggleDivifyRodadas() {
    setDivifyRodadasOpen((prev) => {
      const next = !prev;
      gravarDivifyRodadasOpen(next);
      return next;
    });
  }

  const carregar = useCallback(
    async (options?: { preserveErro?: boolean; preserveOk?: boolean; silencioso?: boolean }) => {
      if (!cardId) {
        setItems([]);
        return;
      }
      if (!options?.silencioso) setLoading(true);
      if (!options?.preserveErro) setErro(null);
      if (!options?.preserveOk) setOkMsg(null);
      try {
        const res = await fetchRodadaVinculos(cardId);
        if (!res.ok) {
          if (!options?.silencioso) {
            setErro(mensagemErroUsuario(res.error));
            setItems(itensRodadaVinculoPreset());
          }
          return;
        }
        setItems(res.items);
      } catch (e) {
        if (!options?.silencioso) {
          const msg = e instanceof Error ? e.message : 'Erro ao carregar vínculos.';
          setErro(mensagemErroUsuario(msg));
          setItems(itensRodadaVinculoPreset());
        }
      } finally {
        if (!options?.silencioso) setLoading(false);
      }
    },
    [cardId],
  );

  useEffect(() => {
    void carregar();
  }, [carregar, refreshKey]);

  function marcarConcluidoLocal(index: number, tagLabel: string, filhoId?: string | null) {
    const agora = new Date().toISOString();
    setOkMsg(`Card Divify criado com tag "${tagLabel}".`);
    setErro(null);
    setItems((prev) =>
      prev.map((i) =>
        i.index === index
          ? {
              ...i,
              status: 'concluido' as const,
              concluido_em: agora,
              filhoDivifyId: filhoId ?? i.filhoDivifyId,
            }
          : i,
      ),
    );
    window.setTimeout(() => {
      try {
        onConcluido?.();
      } catch {
        /* ignore */
      }
    }, 0);
  }

  async function handleAbrir(index: number) {
    const cfg = configRodadaVinculo(index);
    if (!cfg) {
      setErro('Vínculo inválido.');
      return;
    }

    const item = items.find((i) => i.index === index);

    if (abrindoIndex != null) return;

    if (item?.status === 'concluido' || item?.filhoDivifyId) {
      return;
    }

    if (readOnly) {
      setErro('Sem permissão para abrir rodadas neste card.');
      return;
    }

    setErro(null);
    setOkMsg(null);
    setAbrindoIndex(index);

    try {
      const res = await abrirRodadaVinculoClient(cardId, index);

      if (res.ok) {
        marcarConcluidoLocal(index, cfg.tagLabel, res.cardId);
        void carregar({ preserveErro: true, preserveOk: true, silencioso: true });
        return;
      }

      if (
        res.error.includes('já foi concluído') ||
        res.error.includes('criado (') ||
        /já existe|already/i.test(res.error)
      ) {
        try {
          const check = await fetchRodadaVinculos(cardId);
          if (check.ok) {
            setItems(check.items);
            const itemCheck = check.items.find((i) => i.index === index);
            if (itemCheck?.status === 'concluido' || itemCheck?.filhoDivifyId) {
              marcarConcluidoLocal(index, cfg.tagLabel, itemCheck.filhoDivifyId);
              return;
            }
          }
        } catch {
          /* ignore */
        }
        marcarConcluidoLocal(index, cfg.tagLabel, null);
        return;
      }

      setErro(mensagemErroUsuario(res.error));
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      try {
        const check = await fetchRodadaVinculos(cardId);
        if (check.ok) {
          setItems(check.items);
          const itemCheck = check.items.find((i) => i.index === index);
          if (itemCheck?.status === 'concluido' || itemCheck?.filhoDivifyId) {
            marcarConcluidoLocal(index, cfg.tagLabel, itemCheck.filhoDivifyId);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setErro(mensagemErroUsuario(raw));
      console.error('[rodada-vinculos] handleAbrir:', raw);
    } finally {
      setAbrindoIndex(null);
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center gap-2 py-2 text-[11px]"
        style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Carregando vínculos…
      </div>
    );
  }

  const rodadasPendentes = items.filter((i) => i.status !== 'concluido' && !i.filhoDivifyId).length;

  return (
    <div className="space-y-2">
      <p
        className="text-[10px] leading-snug"
        style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        Clique para criar um novo card Divify com a tag de rodada.
      </p>

      {erro ? (
        <p
          className="rounded-lg px-2 py-1.5 text-[10px]"
          style={{
            border: 'var(--moni-border-width) solid var(--moni-card-status-vermelho)',
            background: 'color-mix(in srgb, var(--moni-card-status-vermelho) 12%, white)',
            color: 'var(--moni-earth-800)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          {erro}
        </p>
      ) : null}

      {okMsg ? (
        <p
          className="rounded-lg px-2 py-1.5 text-[10px]"
          style={{
            border: 'var(--moni-border-width) solid var(--moni-green-800)',
            background: 'var(--moni-kanban-portfolio-light)',
            color: 'var(--moni-green-800)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          {okMsg}
        </p>
      ) : null}

      <div
        className="rounded-lg"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-md)',
          background: 'var(--moni-surface-0)',
        }}
      >
        <div
          role="button"
          tabIndex={0}
          aria-expanded={divifyRodadasOpen}
          aria-controls="divify-rodadas-body"
          onClick={toggleDivifyRodadas}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDivifyRodadas();
            }
          }}
          className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-[11px] select-none"
          style={{ fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-primary)' }}
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1" style={{ fontWeight: 600 }}>
            Divify
          </span>
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums"
            style={{
              background: 'var(--moni-navy-50)',
              color: 'var(--moni-navy-600)',
            }}
          >
            {rodadasPendentes}
          </span>
          <IconeChevron
            className="shrink-0"
            style={{
              color: 'var(--moni-text-tertiary)',
              transform: divifyRodadasOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 220ms ease',
            }}
          />
        </div>

        <div
          id="divify-rodadas-body"
          style={{
            display: 'grid',
            gridTemplateRows: divifyRodadasOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 220ms ease',
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="space-y-1 px-1.5 pb-1.5">
              {items.map((item) => {
                const concluido = item.status === 'concluido' || Boolean(item.filhoDivifyId);
                const abrindo = abrindoIndex === item.index;
                const rodadaNum = rodadaNumeroFromIndex(item.index);
                const tagEstilo = estiloTagRodadaDivify(rodadaNum ?? 1);
                // Sem gate de 1ª — disabled só por permissão / já criado / abrindo
                const bloqueado = readOnly || concluido || abrindo;

                return (
                  <li key={item.index}>
                    <button
                      type="button"
                      disabled={bloqueado}
                      onClick={() => {
                        if (bloqueado) return;
                        void handleAbrir(item.index);
                      }}
                      className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition disabled:cursor-default disabled:opacity-60"
                      style={{
                        border: 'var(--moni-border-width) solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                        background: concluido
                          ? 'var(--moni-kanban-portfolio-light)'
                          : 'var(--moni-surface-0)',
                        fontFamily: 'var(--moni-font-sans)',
                      }}
                    >
                      {abrindo ? (
                        <Loader2
                          className="h-3 w-3 shrink-0 animate-spin"
                          style={{ color: 'var(--moni-text-tertiary)' }}
                          aria-hidden
                        />
                      ) : concluido ? (
                        <CheckCircle2
                          className="h-3 w-3 shrink-0"
                          style={{ color: 'var(--moni-green-800)' }}
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: 'var(--moni-border-default)' }}
                          aria-hidden
                        />
                      )}
                      <span
                        className="min-w-0 flex-1 font-medium"
                        style={{
                          color: 'var(--moni-text-primary)',
                          textDecoration: concluido ? 'line-through' : undefined,
                        }}
                      >
                        {item.nome}
                      </span>
                      <span
                        className="shrink-0 px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{
                          borderRadius: 'var(--moni-radius-md)',
                          ...tagEstilo,
                        }}
                      >
                        {item.tagLabel}
                      </span>
                      {!concluido ? (
                        <span
                          className="pointer-events-none shrink-0 px-1.5 py-0.5 text-[9px] font-semibold opacity-0 -translate-x-1 transition-all duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100"
                          style={{
                            borderRadius: 'var(--moni-radius-md)',
                            background: 'var(--moni-navy-400)',
                            color: 'var(--moni-text-inverse)',
                          }}
                          aria-hidden
                        >
                          → Divify
                        </span>
                      ) : null}
                      {concluido ? (
                        <span className="moni-tag-concluido shrink-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                          Criado
                        </span>
                      ) : abrindo ? (
                        <span
                          className="shrink-0 text-[9px] font-semibold uppercase"
                          style={{ color: 'var(--moni-text-tertiary)' }}
                        >
                          Abrindo…
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
