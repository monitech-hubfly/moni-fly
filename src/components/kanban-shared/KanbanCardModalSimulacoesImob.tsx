'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { KanbanCardModalMoedaField } from './KanbanCardModalMoedaField';
import {
  criarImobSimulacaoEmpreendimento,
  excluirImobSimulacaoEmpreendimento,
  salvarImobSimulacaoEmpreendimento,
} from '@/lib/actions/imob-simulacoes-card';
import { carregarImobSimulacoesCard } from '@/lib/kanban/carregar-imob-simulacoes-card';
import { createClient } from '@/lib/supabase/client';
import {
  IMOB_PRAZOS_BALAO,
  IMOB_SITUACOES,
  balaoKey,
  finKey,
  formatImobMoedaExibicao,
  type ImobCardEmpreendimentoDraft,
  type ImobMoneyKey,
  type ImobSituacaoId,
} from '@/lib/kanban/imob-simulacoes-card';

type Props = {
  cardId: string;
  podeEditar: boolean;
  prefetch?: { cardId: string; itens: ImobCardEmpreendimentoDraft[]; error: string | null } | null;
  esperarPrefetch?: boolean;
};

const inputCls =
  'mt-0.5 min-h-[44px] w-full rounded-md px-2 py-1 text-xs sm:min-h-0';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
} as const;
const labelCls = 'text-[10px] font-medium uppercase tracking-wide';
const labelStyle = { color: 'var(--moni-text-tertiary)' } as const;

function patchDraft(
  setItens: (fn: (prev: ImobCardEmpreendimentoDraft[]) => ImobCardEmpreendimentoDraft[]) => void,
  id: string,
  key: keyof ImobCardEmpreendimentoDraft,
  value: string,
) {
  setItens((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: value } : it)));
}

function CampoMoeda({
  label,
  value,
  podeEditar,
  onChange,
}: {
  label: string;
  value: string;
  podeEditar: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className={labelCls} style={labelStyle}>
        {label}
      </span>
      {podeEditar ? (
        <div
          className="mt-0.5 rounded-md"
          style={{ border: '0.5px solid var(--moni-border-default)' }}
        >
          <KanbanCardModalMoedaField
            value={value}
            onChange={onChange}
            className="flex min-h-[44px] items-center px-2 py-1 sm:min-h-0"
          />
        </div>
      ) : (
        <div className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-primary)' }}>
          {formatImobMoedaExibicao(value)}
        </div>
      )}
    </label>
  );
}

function EmpreendimentoBloco({
  item,
  index,
  total,
  podeEditar,
  salvandoId,
  onChange,
  onSalvar,
  onExcluir,
}: {
  item: ImobCardEmpreendimentoDraft;
  index: number;
  total: number;
  podeEditar: boolean;
  salvandoId: string | null;
  onChange: (key: keyof ImobCardEmpreendimentoDraft, value: string) => void;
  onSalvar: () => void;
  onExcluir: () => void;
}) {
  const setMoney = (key: ImobMoneyKey, value: string) => onChange(key, value);

  return (
    <div
      className="space-y-3 rounded-lg p-2"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        background: 'var(--moni-surface-50)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
          Empreendimento {index + 1}
          {total > 1 ? ` de ${total}` : ''}
        </p>
        {podeEditar && total > 0 ? (
          <button
            type="button"
            onClick={onExcluir}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-2 text-[11px] sm:min-h-0"
            style={{ color: 'var(--moni-text-secondary)' }}
            aria-label="Remover empreendimento"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remover
          </button>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
          Dados gerais
        </p>
        <div className="space-y-2">
          <label className="block">
            <span className={labelCls} style={labelStyle}>
              Nome do empreendimento
            </span>
            {podeEditar ? (
              <input
                type="text"
                value={item.nome}
                onChange={(e) => onChange('nome', e.target.value)}
                placeholder="Ex.: Residencial Verde"
                className={inputCls}
                style={inputStyle}
              />
            ) : (
              <div className="mt-0.5 text-xs" style={{ color: 'var(--moni-text-primary)' }}>
                {item.nome.trim() || '—'}
              </div>
            )}
          </label>
          <CampoMoeda
            label="Valor do imóvel à vista (R$)"
            value={item.valor_avista}
            podeEditar={podeEditar}
            onChange={(v) => setMoney('valor_avista', v)}
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
          Parcelas adicionais / chave
        </p>
        <p className="mb-2 text-[10px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
          Por situação × prazo (8, 18 e 24 meses).
        </p>
        <div className="space-y-3">
          {IMOB_SITUACOES.map((sit) => (
            <div key={sit.id}>
              <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                {sit.label}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {IMOB_PRAZOS_BALAO.map((prazo) => (
                  <CampoMoeda
                    key={`${sit.id}-${prazo}`}
                    label={`${prazo} meses`}
                    value={item[balaoKey(sit.id as ImobSituacaoId, prazo)]}
                    podeEditar={podeEditar}
                    onChange={(v) => setMoney(balaoKey(sit.id as ImobSituacaoId, prazo), v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
          Financiamento bancário
        </p>
        <p className="mb-2 text-[10px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
          Somente prazo 24 meses, por situação.
        </p>
        <div className="space-y-3">
          {IMOB_SITUACOES.map((sit) => (
            <div key={`fin-${sit.id}`}>
              <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                {sit.label}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <CampoMoeda
                  label="Valor a financiar (R$)"
                  value={item[finKey(sit.id as ImobSituacaoId, 'valor')]}
                  podeEditar={podeEditar}
                  onChange={(v) => setMoney(finKey(sit.id as ImobSituacaoId, 'valor'), v)}
                />
                <CampoMoeda
                  label="1ª parcela (R$/mês)"
                  value={item[finKey(sit.id as ImobSituacaoId, 'p1')]}
                  podeEditar={podeEditar}
                  onChange={(v) => setMoney(finKey(sit.id as ImobSituacaoId, 'p1'), v)}
                />
                <CampoMoeda
                  label="Última parcela (R$/mês)"
                  value={item[finKey(sit.id as ImobSituacaoId, 'ultima')]}
                  podeEditar={podeEditar}
                  onChange={(v) => setMoney(finKey(sit.id as ImobSituacaoId, 'ultima'), v)}
                />
                <CampoMoeda
                  label="Total geral (R$)"
                  value={item[finKey(sit.id as ImobSituacaoId, 'total')]}
                  podeEditar={podeEditar}
                  onChange={(v) => setMoney(finKey(sit.id as ImobSituacaoId, 'total'), v)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {podeEditar ? (
        <button
          type="button"
          onClick={onSalvar}
          disabled={salvandoId === item.id}
          className="min-h-[44px] w-full rounded-md px-3 py-1.5 text-xs font-medium sm:min-h-0"
          style={{
            background: 'var(--moni-navy-800)',
            color: 'var(--moni-text-inverse, #fff)',
          }}
        >
          {salvandoId === item.id ? 'Salvando…' : 'Salvar empreendimento'}
        </button>
      ) : null}
    </div>
  );
}

export function KanbanCardModalSimulacoesImob({
  cardId,
  podeEditar,
  prefetch = null,
  esperarPrefetch = false,
}: Props) {
  const prefetchOk = prefetch?.cardId === cardId ? prefetch : null;
  const [itens, setItens] = useState<ImobCardEmpreendimentoDraft[]>(() => prefetchOk?.itens ?? []);
  const [loading, setLoading] = useState(!prefetchOk);
  const [erro, setErro] = useState<string | null>(prefetchOk?.error ?? null);
  const [msg, setMsg] = useState<string | null>(null);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    const r = await carregarImobSimulacoesCard(createClient(), cardId);
    setLoading(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setItens(r.itens);
  }, [cardId]);

  useEffect(() => {
    if (prefetch?.cardId === cardId) {
      setItens(prefetch.itens);
      setErro(prefetch.error);
      setLoading(false);
      return;
    }
    if (esperarPrefetch) return;
    void recarregar();
  }, [cardId, prefetch, esperarPrefetch, recarregar]);

  async function handleSalvar(item: ImobCardEmpreendimentoDraft) {
    setSalvandoId(item.id);
    setErro(null);
    setMsg(null);
    const r = await salvarImobSimulacaoEmpreendimento(cardId, item);
    setSalvandoId(null);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setMsg('Empreendimento salvo.');
  }

  async function handleCriar() {
    setCriando(true);
    setErro(null);
    setMsg(null);
    const r = await criarImobSimulacaoEmpreendimento(cardId);
    setCriando(false);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setItens((prev) => [...prev, r.item]);
  }

  async function handleExcluir(id: string) {
    if (!window.confirm('Remover este empreendimento da simulação?')) return;
    setErro(null);
    setMsg(null);
    const r = await excluirImobSimulacaoEmpreendimento(cardId, id);
    if (!r.ok) {
      setErro(r.error);
      return;
    }
    setItens((prev) => prev.filter((it) => it.id !== id));
  }

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Carregando simulações…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
        Parâmetros do empreendimento para o simulador. Valor quitado, sinal e parcela mensal do cliente
        são preenchidos na simulação, não neste card.
      </p>

      {erro ? (
        <div
          className="rounded-md px-2 py-1.5 text-[11px]"
          style={{
            border: '0.5px solid var(--moni-status-overdue-border)',
            background: 'var(--moni-status-overdue-bg)',
            color: 'var(--moni-status-overdue-text)',
          }}
          role="alert"
        >
          {erro}
        </div>
      ) : null}
      {msg ? (
        <div
          className="rounded-md px-2 py-1.5 text-[11px]"
          style={{
            border: '0.5px solid var(--moni-status-done-border)',
            background: 'var(--moni-status-done-bg)',
            color: 'var(--moni-status-done-text)',
          }}
          role="status"
        >
          {msg}
        </div>
      ) : null}

      {itens.length === 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
          Nenhum empreendimento neste card.
        </p>
      ) : (
        <div className="space-y-3">
          {itens.map((item, idx) => (
            <EmpreendimentoBloco
              key={item.id}
              item={item}
              index={idx}
              total={itens.length}
              podeEditar={podeEditar}
              salvandoId={salvandoId}
              onChange={(key, value) => patchDraft(setItens, item.id, key, value)}
              onSalvar={() => void handleSalvar(item)}
              onExcluir={() => void handleExcluir(item.id)}
            />
          ))}
        </div>
      )}

      {podeEditar ? (
        <button
          type="button"
          onClick={() => void handleCriar()}
          disabled={criando}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium sm:min-h-0"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            background: 'var(--moni-surface-0)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {criando ? 'Adicionando…' : 'Adicionar empreendimento'}
        </button>
      ) : null}
    </div>
  );
}
