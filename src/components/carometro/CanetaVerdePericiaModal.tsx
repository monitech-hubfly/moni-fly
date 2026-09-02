'use client';

/**
 * Popup opcional ao marcar Caneta Verde no Carômetro:
 * vincula o comportamento/tarefa a uma perícia Sirene (passo 2 do redesenho v3).
 */

import { useState, useTransition } from 'react';
import { PericiaSelect } from '@/components/sirene/PericiaSelect';
import { vincularCarometroPericia } from '@/app/sirene/pericias/actions';

export type CanetaVerdePericiaModalProps = {
  itemTipo: 'acao' | 'tarefa';
  itemId: string;
  itemDescricao: string;
  franqueadoId?: string | null;
  onClose: () => void;
};

export function CanetaVerdePericiaModal({
  itemTipo,
  itemId,
  itemDescricao,
  franqueadoId,
  onClose,
}: CanetaVerdePericiaModalProps) {
  const [periciaVinculada, setPericiaVinculada] = useState<{
    id: number;
    numero: string;
    titulo: string;
    status: string;
    dominio: string;
  } | null>(null);
  const [vinculando, startVinculo] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleVincular() {
    if (!periciaVinculada) return;
    setErro(null);
    startVinculo(async () => {
      const r = await vincularCarometroPericia(
        periciaVinculada.id,
        itemTipo,
        itemId,
        itemDescricao.trim() || 'Item caneta verde',
        franqueadoId,
      );
      if ('error' in r) {
        setErro(r.error as string);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-sm rounded-xl border bg-[var(--moni-surface-0)] p-6 shadow-2xl"
        style={{ borderColor: 'var(--moni-border-default)', borderWidth: 'var(--moni-border-width)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="caneta-verde-pericia-titulo"
      >
        <h3
          id="caneta-verde-pericia-titulo"
          className="mb-1 text-base font-semibold text-[color:var(--moni-text-primary)]"
        >
          Caneta Verde — vincular perícia
        </h3>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
          Comportamento
        </p>
        <p className="mb-4 text-sm leading-snug text-[color:var(--moni-text-secondary)]">
          {itemDescricao}
        </p>
        <p className="mb-3 text-sm text-[color:var(--moni-text-secondary)]">
          Opcional: selecione a perícia que representa este padrão para acompanhar em Perícias
          (Caneta Verde).
        </p>

        <PericiaSelect
          onSelect={(id, info) => setPericiaVinculada({ id, ...info })}
          onCriarNova={(dominio) => {
            window.open(
              `/sirene/pericias?criar=true&dominio=${encodeURIComponent(dominio)}`,
              '_blank',
            );
          }}
        />

        {erro ? <p className="mt-3 text-xs text-red-600">{erro}</p> : null}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            disabled={vinculando}
            onClick={onClose}
            className="text-sm text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-secondary)] disabled:opacity-50"
          >
            Pular
          </button>
          <button
            type="button"
            disabled={!periciaVinculada || vinculando}
            onClick={handleVincular}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: 'var(--moni-navy-800)',
              borderRadius: 'var(--moni-radius-md)',
              minHeight: 44,
            }}
          >
            {vinculando ? 'Vinculando…' : 'Vincular e fechar'}
          </button>
        </div>
      </div>
    </div>
  );
}
