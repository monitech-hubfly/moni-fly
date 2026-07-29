'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  abrirTrancheVinculoOperacoes,
  listarTrancheVinculosOperacoes,
  type TrancheVinculoListItem,
} from '@/lib/actions/operacoes-tranche-vinculos';
import {
  configTrancheVinculo,
  OPERACOES_TRANCHE_VINCULOS,
} from '@/lib/operacoes/tranche-vinculos-config';
import {
  corTagTrancheCreditoObra,
  trancheNumeroFromIndex,
} from '@/lib/kanban/credito-obra-tag-tranche';

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

function corTextoTagTranche(cor: string): string {
  const hex = cor.replace('#', '');
  if (hex.length !== 6) return 'var(--moni-text-inverse)';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? 'var(--moni-text-primary)' : 'var(--moni-text-inverse)';
}

type SidebarProps = {
  cardId: string;
  basePath: string;
  refreshKey: number;
  podeGerenciar: boolean;
  cardDesabilitado?: boolean;
  onConcluido?: () => void;
};

export function KanbanCardModalOperacoesTrancheVinculosSidebar({
  cardId,
  basePath,
  refreshKey,
  podeGerenciar,
  cardDesabilitado = false,
  onConcluido,
}: SidebarProps) {
  const [items, setItems] = useState<TrancheVinculoListItem[]>([]);
  const [temPrimeiroCard, setTemPrimeiroCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [abrindoIndex, setAbrindoIndex] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!cardId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const res = await listarTrancheVinculosOperacoes(cardId);
      if (!res.ok) {
        if (res.error === 'Faça login.' || res.error.includes('Funil Pré Obra')) {
          setErro(res.error);
          setItems([]);
          setTemPrimeiroCard(false);
          return;
        }
        setErro(null);
        setItems(itensTrancheVinculoPreset());
        setTemPrimeiroCard(false);
        return;
      }
      setItems(res.items);
      setTemPrimeiroCard(res.temPrimeiroCardCreditoObra);
    } catch {
      setErro(null);
      setItems(itensTrancheVinculoPreset());
      setTemPrimeiroCard(false);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    void carregar();
  }, [carregar, refreshKey]);

  async function handleAbrir(index: number) {
    const cfg = configTrancheVinculo(index);
    if (!cfg) return;

    const item = items.find((i) => i.index === index);
    if (item?.status === 'concluido') return;

    if (
      !confirm(
        `Abrir card no Funil Crédito Obra com tag "${cfg.tagLabel}"?\n\nSerá criado um novo card filho vinculado a este projeto.`,
      )
    ) {
      return;
    }

    setErro(null);
    setOkMsg(null);
    setAbrindoIndex(index);
    try {
      const res = await abrirTrancheVinculoOperacoes({
        operacoesCardId: cardId,
        trancheIndex: index,
        basePath,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setOkMsg(`Card Crédito Obra criado com tag "${cfg.tagLabel}".`);
      await carregar();
      onConcluido?.();
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

  if (erro && items.length === 0) {
    return (
      <p
        className="rounded-lg px-2 py-1.5 text-[11px]"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-card-status-vermelho)',
          background: 'color-mix(in srgb, var(--moni-card-status-vermelho) 12%, white)',
          color: 'var(--moni-earth-800)',
          fontFamily: 'var(--moni-font-sans)',
        }}
      >
        {erro}
      </p>
    );
  }

  const readOnly = !podeGerenciar || cardDesabilitado;

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

      <ul className="space-y-1">
        {items.map((item) => {
          const concluido = item.status === 'concluido';
          const abrindo = abrindoIndex === item.index;
          const trancheNum = trancheNumeroFromIndex(item.index);
          const tagCor = trancheNum ? corTagTrancheCreditoObra(trancheNum) : 'var(--moni-navy-800)';
          const tagTextoCor = trancheNum ? corTextoTagTranche(tagCor) : 'var(--moni-text-inverse)';
          const desabilitado = readOnly || !temPrimeiroCard || concluido || abrindo;

          return (
            <li key={item.index}>
              <button
                type="button"
                onClick={() => void handleAbrir(item.index)}
                disabled={desabilitado}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition disabled:cursor-default disabled:opacity-60"
                style={{
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                  background: concluido ? 'var(--moni-kanban-portfolio-light)' : 'var(--moni-surface-0)',
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
                  style={{ color: 'var(--moni-text-primary)' }}
                >
                  {item.nome}
                </span>
                <span
                  className="shrink-0 px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{
                    borderRadius: 'var(--moni-radius-md)',
                    background: tagCor,
                    color: tagTextoCor,
                  }}
                >
                  {item.tagLabel}
                </span>
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
  );
}
