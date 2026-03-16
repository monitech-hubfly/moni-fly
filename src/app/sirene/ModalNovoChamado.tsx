'use client';

import { useState } from 'react';
import { criarChamado } from './actions';
import type { HdmTime } from '@/types/sirene';

const HDM_OPCOES: { value: HdmTime; label: string }[] = [
  { value: 'Homologações', label: 'Homologações' },
  { value: 'Produto', label: 'Produto' },
  { value: 'Modelo Virtual', label: 'Modelo Virtual' },
];

type Props = { onClose: () => void; onSuccess?: () => void };

export function ModalNovoChamado({ onClose, onSuccess }: Props) {
  const [incendio, setIncendio] = useState('');
  const [timeAbertura, setTimeAbertura] = useState('');
  const [frankId, setFrankId] = useState('');
  const [frankNome, setFrankNome] = useState('');
  const [ehHdm, setEhHdm] = useState(false);
  const [hdmResponsavel, setHdmResponsavel] = useState<HdmTime | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData();
    formData.set('incendio', incendio.trim());
    formData.set('time_abertura', timeAbertura.trim());
    formData.set('frank_id', frankId.trim());
    formData.set('frank_nome', frankNome.trim());
    formData.set('tipo', ehHdm ? 'hdm' : 'padrao');
    if (ehHdm && hdmResponsavel) formData.set('hdm_responsavel', hdmResponsavel);

    const result = await criarChamado(formData);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSuccess?.();
    if (result.chamadoId) window.location.href = `/sirene/${result.chamadoId}`;
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="border-b border-stone-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-stone-800">Novo chamado</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Incêndio (resumo) *
            </label>
            <input
              type="text"
              value={incendio}
              onChange={(e) => setIncendio(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
              required
              placeholder="Breve descrição do problema"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Time de abertura
            </label>
            <input
              type="text"
              value={timeAbertura}
              onChange={(e) => setTimeAbertura(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
              placeholder="Ex.: ADM, Tech, Portfólio"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">ID Franqueado</label>
              <input
                type="text"
                value={frankId}
                onChange={(e) => setFrankId(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                Nome Franqueado
              </label>
              <input
                type="text"
                value={frankNome}
                onChange={(e) => setFrankNome(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
              />
            </div>
          </div>

          <div className="border-t border-stone-200 pt-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={ehHdm}
                onChange={(e) => {
                  setEhHdm(e.target.checked);
                  if (!e.target.checked) setHdmResponsavel('');
                }}
                className="h-4 w-4 rounded border-stone-300"
              />
              <span className="text-sm font-medium text-stone-700">Este chamado é HDM?</span>
            </label>
            {ehHdm && (
              <div className="mt-3">
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  Time HDM responsável *
                </label>
                <select
                  value={hdmResponsavel}
                  onChange={(e) => setHdmResponsavel((e.target.value || '') as HdmTime | '')}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-800"
                  required={ehHdm}
                >
                  <option value="">Selecione</option>
                  {HDM_OPCOES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
              disabled={loading || !incendio.trim() || (ehHdm && !hdmResponsavel)}
              className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-medium text-white hover:bg-moni-secondary disabled:opacity-50"
            >
              {loading ? 'Abrindo…' : 'Abrir chamado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
