'use client';

import { useState } from 'react';
import { redirecionarParaHDM } from './actions';
import type { HdmTime } from '@/types/sirene';

const HDM_OPCOES: HdmTime[] = ['Homologações', 'Produto', 'Modelo Virtual'];

type Props = { chamadoId: number; onClose: () => void; onSuccess?: () => void };

export function ModalRedirecionarHDM({ chamadoId, onClose, onSuccess }: Props) {
  const [hdmResponsavel, setHdmResponsavel] = useState<HdmTime | ''>('');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hdmResponsavel) return;
    setError(null);
    setLoading(true);
    const result = await redirecionarParaHDM(
      chamadoId,
      hdmResponsavel,
      observacao.trim() || undefined,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
    window.location.href = `/sirene/${chamadoId}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-stone-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-stone-800">Redirecionar para HDM</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Time HDM responsável *
            </label>
            <select
              value={hdmResponsavel}
              onChange={(e) => setHdmResponsavel((e.target.value || '') as HdmTime | '')}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
              required
            >
              <option value="">Selecione</option>
              {HDM_OPCOES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Observação (opcional)
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
              rows={3}
              placeholder="Motivo ou contexto do redirecionamento"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-stone-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !hdmResponsavel}
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Redirecionando…' : 'Redirecionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
