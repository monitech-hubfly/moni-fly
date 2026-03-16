'use client';

import { useState, useTransition } from 'react';
import type { DocInstanceRevisao } from './actions';

type Props = {
  instance: DocInstanceRevisao;
  onApprove: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onReject: (id: string, motivo: string) => Promise<{ ok: boolean; error?: string }>;
};

export function DocumentosRevisaoClient({ instance, onApprove, onReject }: Props) {
  const [showReject, setShowReject] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const handleApprove = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await onApprove(instance.id);
      if (res.ok) {
        setMessage({ type: 'ok', text: 'Documento aprovado. A página será atualizada.' });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: res.error ?? 'Erro ao aprovar.' });
      }
    });
  };

  const handleReject = () => {
    if (!motivo.trim() && !showReject) {
      setShowReject(true);
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await onReject(instance.id, motivo.trim() || 'Reprovado pelo consultor.');
      if (res.ok) {
        setMessage({ type: 'ok', text: 'Documento reprovado. O franqueado será notificado.' });
        window.location.reload();
      } else {
        setMessage({ type: 'error', text: res.error ?? 'Erro ao reprovar.' });
      }
    });
  };

  const stepLabel = instance.step === 3 ? 'Step 3: Opções' : 'Step 7: Contrato do Terreno';
  const diff = instance.diff_json;
  const totalDiffs = diff?.summary?.total ?? 0;
  const changes = diff?.changes ?? [];

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-stone-800">
            {instance.processo_cidade ?? '—'}
            {instance.processo_estado ? `, ${instance.processo_estado}` : ''}
          </span>
          <span className="mx-2 text-stone-400">·</span>
          <span className="text-sm text-stone-600">{stepLabel}</span>
          <span className="mx-2 text-stone-400">·</span>
          <span className="text-xs text-stone-500">Versão {instance.versao}</span>
          <span className="ml-2 text-xs text-stone-400">
            {new Date(instance.created_at).toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={pending}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Aprovar
          </button>
          <button
            type="button"
            onClick={() => (showReject ? handleReject() : setShowReject(true))}
            disabled={pending}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Reprovado
          </button>
        </div>
      </div>

      {message && (
        <p className={`mt-2 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
          {message.text}
        </p>
      )}

      {showReject && (
        <div className="mt-3 rounded border border-stone-200 bg-stone-50 p-3">
          <label className="block text-sm font-medium text-stone-700">
            Motivo da reprovação (obrigatório para o franqueado corrigir)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: Ajustar valor do item X na cláusula 2..."
            className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5 text-sm"
            rows={3}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={pending || !motivo.trim()}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              Confirmar reprovação
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="rounded border border-stone-200 px-3 py-1 text-sm text-stone-600 hover:bg-stone-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {totalDiffs > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-stone-700">
            Divergências em relação ao template ({totalDiffs})
          </summary>
          <ul className="mt-2 max-h-60 overflow-y-auto rounded border border-stone-200 bg-stone-50 p-2 text-sm">
            {changes.slice(0, 30).map((c, i) => (
              <li key={i} className="border-b border-stone-100 py-1.5 last:border-0">
                <span className="text-xs font-medium text-stone-500">{c.context}</span>
                {c.type === 'add' && (
                  <p className="mt-0.5 text-green-800">
                    <span className="font-medium">+ </span>
                    {c.documentSlice}
                  </p>
                )}
                {c.type === 'remove' && (
                  <p className="mt-0.5 text-red-800">
                    <span className="font-medium">− </span>
                    {c.templateSlice}
                  </p>
                )}
                {c.type === 'replace' && (
                  <>
                    <p className="mt-0.5 text-red-800">
                      <span className="font-medium">− </span>
                      {c.templateSlice}
                    </p>
                    <p className="mt-0.5 text-green-800">
                      <span className="font-medium">+ </span>
                      {c.documentSlice}
                    </p>
                  </>
                )}
              </li>
            ))}
            {changes.length > 30 && (
              <li className="py-1 text-stone-500">… e mais {changes.length - 30} divergência(s)</li>
            )}
          </ul>
        </details>
      )}

      {totalDiffs === 0 && diff && (
        <p className="mt-2 text-xs text-stone-500">
          Nenhuma divergência detectada em relação ao template (comparação por texto).
        </p>
      )}
    </div>
  );
}
