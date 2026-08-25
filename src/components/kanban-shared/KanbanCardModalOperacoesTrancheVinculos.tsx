'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { TrancheVinculoListItem } from '@/lib/operacoes/tranche-vinculos-service';
import {
  abrirTrancheVinculoClient,
  listarTrancheVinculosClient,
} from '@/lib/operacoes/tranche-vinculos-client';
import {
  configTrancheVinculo,
  faseOperacoesPresumePrimeiraTrancheCo,
  OPERACOES_TRANCHE_VINCULOS,
} from '@/lib/operacoes/tranche-vinculos-config';
import {
  estiloTagTrancheCreditoObra,
  trancheNumeroFromIndex,
} from '@/lib/kanban/credito-obra-tag-tranche';

const DIVIFY_OPEN_KEY = 'divify-open';

function lerDivifyOpen(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem(DIVIFY_OPEN_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

function gravarDivifyOpen(open: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DIVIFY_OPEN_KEY, open ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

function itensTrancheVinculoPreset(): TrancheVinculoListItem[] {
  return OPERACOES_TRANCHE_VINCULOS.map((cfg) => ({
    index: cfg.index,
    nome: cfg.nome,
    tagLabel: cfg.tagLabel,
    status: 'pendente' as const,
    concluido_em: null,
    filhoCreditoObraId: null,
  }));
}

function IconeRamificacao({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="4" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="4" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M4 4.5V11.5M4 8h6.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
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

function mensagemErroUsuario(raw: string | null | undefined): string {
  const m = String(raw ?? '').trim();
  if (!m) return 'Não foi possível abrir a tranche.';
  // Nunca exibir digest / RSC ao usuário — mensagem de negócio genérica.
  if (/server components render|omitted in production|digest|erro de render/i.test(m)) {
    return 'Não foi possível abrir a tranche. Tente novamente.';
  }
  return m;
}

type SidebarProps = {
  cardId: string;
  /** Slug da fase atual (modal) — fallback local para presumir 1ª tranche CO. */
  faseSlug?: string | null;
  basePath: string;
  refreshKey: number;
  podeGerenciar: boolean;
  cardDesabilitado?: boolean;
  onConcluido?: () => void;
};

export function KanbanCardModalOperacoesTrancheVinculosSidebar({
  cardId,
  faseSlug,
  basePath,
  refreshKey,
  podeGerenciar,
  cardDesabilitado = false,
  onConcluido,
}: SidebarProps) {
  const presumePrimeiraTrancheLocal = faseOperacoesPresumePrimeiraTrancheCo(faseSlug);
  const [items, setItems] = useState<TrancheVinculoListItem[]>([]);
  const [temPrimeiroCard, setTemPrimeiroCard] = useState(presumePrimeiraTrancheLocal);
  const [loading, setLoading] = useState(true);
  const [abrindoIndex, setAbrindoIndex] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [divifyOpen, setDivifyOpen] = useState(true);
  const readOnly = !podeGerenciar || cardDesabilitado;

  useEffect(() => {
    setDivifyOpen(lerDivifyOpen());
  }, []);

  function toggleDivify() {
    setDivifyOpen((prev) => {
      const next = !prev;
      gravarDivifyOpen(next);
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
        const res = await listarTrancheVinculosClient(cardId);
        if (!res.ok) {
          if (!options?.silencioso) {
            setErro(mensagemErroUsuario(res.error));
            setItems(itensTrancheVinculoPreset());
            setTemPrimeiroCard(presumePrimeiraTrancheLocal);
          }
          return;
        }
        setItems(res.items);
        setTemPrimeiroCard(res.temPrimeiroCardCreditoObra || presumePrimeiraTrancheLocal);
      } catch (e) {
        if (!options?.silencioso) {
          const msg = e instanceof Error ? e.message : 'Erro ao carregar vínculos.';
          setErro(mensagemErroUsuario(msg));
          setItems(itensTrancheVinculoPreset());
          setTemPrimeiroCard(presumePrimeiraTrancheLocal);
        }
      } finally {
        if (!options?.silencioso) setLoading(false);
      }
    },
    [cardId, presumePrimeiraTrancheLocal],
  );

  useEffect(() => {
    setTemPrimeiroCard((prev) => prev || presumePrimeiraTrancheLocal);
  }, [presumePrimeiraTrancheLocal]);

  useEffect(() => {
    void carregar();
  }, [carregar, refreshKey]);

  function marcarConcluidoLocal(index: number, tagLabel: string, filhoId?: string | null) {
    const agora = new Date().toISOString();
    setOkMsg(`Card Crédito Obra criado com tag "${tagLabel}".`);
    setErro(null);
    setItems((prev) =>
      prev.map((i) =>
        i.index === index
          ? {
              ...i,
              status: 'concluido' as const,
              concluido_em: agora,
              filhoCreditoObraId: filhoId ?? i.filhoCreditoObraId,
            }
          : i,
      ),
    );
    // Refresh do modal/board fora do fluxo da mutation — não pode afetar o estado de sucesso.
    window.setTimeout(() => {
      try {
        onConcluido?.();
      } catch {
        /* ignore */
      }
    }, 0);
  }

  async function handleAbrir(index: number) {
    const cfg = configTrancheVinculo(index);
    if (!cfg) {
      setErro('Vínculo inválido.');
      return;
    }

    const item = items.find((i) => i.index === index);

    if (abrindoIndex != null) return;

    if (item?.status === 'concluido') {
      return;
    }

    if (readOnly) {
      setErro('Sem permissão para abrir tranches neste card.');
      return;
    }

    if (!temPrimeiroCard) {
      setErro(
        'Abra o primeiro card no Funil Crédito Obra (1ª tranche) antes de solicitar tranches adicionais.',
      );
      return;
    }

    setErro(null);
    setOkMsg(null);
    setAbrindoIndex(index);

    try {
      const res = await abrirTrancheVinculoClient({
        operacoesCardId: cardId,
        trancheIndex: index,
        basePath,
      });

      if (res.ok) {
        marcarConcluidoLocal(index, cfg.tagLabel, res.creditoObraCardId);
        void carregar({ preserveErro: true, preserveOk: true, silencioso: true });
        return;
      }

      // Já concluído / card criado: sincroniza lista e trata como sucesso.
      if (
        res.error.includes('já foi concluído') ||
        res.error.includes('criado (') ||
        /já existe|already/i.test(res.error)
      ) {
        try {
          const check = await listarTrancheVinculosClient(cardId);
          if (check.ok) {
            setItems(check.items);
            setTemPrimeiroCard(check.temPrimeiroCardCreditoObra || presumePrimeiraTrancheLocal);
            const itemCheck = check.items.find((i) => i.index === index);
            if (itemCheck?.status === 'concluido' || itemCheck?.filhoCreditoObraId) {
              marcarConcluidoLocal(index, cfg.tagLabel, itemCheck.filhoCreditoObraId);
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
      // Rede/API falhou: tenta confirmar se a mutation chegou a persistir.
      try {
        const check = await listarTrancheVinculosClient(cardId);
        if (check.ok) {
          setItems(check.items);
          setTemPrimeiroCard(check.temPrimeiroCardCreditoObra || presumePrimeiraTrancheLocal);
          const itemCheck = check.items.find((i) => i.index === index);
          if (itemCheck?.status === 'concluido' || itemCheck?.filhoCreditoObraId) {
            marcarConcluidoLocal(index, cfg.tagLabel, itemCheck.filhoCreditoObraId);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      setErro(mensagemErroUsuario(raw));
      console.error('[tranche-vinculos] handleAbrir:', raw);
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

  const tranchesDisponiveis = items.filter((i) => i.status !== 'concluido').length;

  return (
    <div className="space-y-2">
      {!temPrimeiroCard ? (
        <p
          className="rounded-lg px-2 py-1.5 text-[10px] leading-snug"
          style={{
            border: 'var(--moni-border-width) solid var(--moni-gold-400)',
            background: 'var(--moni-kanban-credito-light)',
            color: 'var(--moni-text-secondary)',
            fontFamily: 'var(--moni-font-sans)',
          }}
        >
          Abra o primeiro card no Funil Crédito Obra (tag 1ª tranche) antes de solicitar tranches
          adicionais.
        </p>
      ) : (
        <p
          className="text-[10px] leading-snug"
          style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
        >
          Clique para criar um novo card Crédito Obra com a tag da tranche.
        </p>
      )}

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
          aria-expanded={divifyOpen}
          aria-controls="divify-tranche-body"
          onClick={toggleDivify}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleDivify();
            }
          }}
          className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-[11px] select-none"
          style={{ fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-primary)' }}
        >
          <IconeRamificacao className="shrink-0" />
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
            {tranchesDisponiveis}
          </span>
          <IconeChevron
            className="shrink-0"
            style={{
              color: 'var(--moni-text-tertiary)',
              transform: divifyOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 220ms ease',
            }}
          />
        </div>

        <div
          id="divify-tranche-body"
          style={{
            display: 'grid',
            gridTemplateRows: divifyOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 220ms ease',
          }}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="space-y-1 px-1.5 pb-1.5">
              {items.map((item) => {
                const concluido = item.status === 'concluido';
                const abrindo = abrindoIndex === item.index;
                const trancheNum = trancheNumeroFromIndex(item.index);
                const tagEstilo = estiloTagTrancheCreditoObra(trancheNum ?? 1);
                const bloqueado = readOnly || !temPrimeiroCard || concluido || abrindo;

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
                          → Crédito Obra
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
