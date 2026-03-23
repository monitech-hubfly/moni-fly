'use client';

import { useState } from 'react';
import { inviteAllPendingUsers } from './actions';

export function ConvidarPendentesButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-moni-dark">Convites em lote</h2>
      <p className="mt-1 text-xs text-stone-600">
        Envia e-mail com link <strong>/aceitar-convite</strong> para todos os usuários com papel{' '}
        <code className="rounded bg-stone-100 px-1">pending</code> e e-mail no domínio permitido.
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setMessage(null);
          setLoading(true);
          try {
            const r = await inviteAllPendingUsers();
            if (!r.ok) {
              setMessage(r.error ?? 'Falha ao convidar.');
            } else {
              const extra =
                r.failures.length > 0
                  ? ` Falhas: ${r.failures.length} (${r.failures.slice(0, 5).join(', ')}${r.failures.length > 5 ? '…' : ''}).`
                  : '';
              setMessage(`E-mails enviados: ${r.sent}.${extra}`);
            }
          } catch {
            setMessage('Erro inesperado.');
          } finally {
            setLoading(false);
          }
        }}
        className="btn-primary mt-3 text-sm disabled:opacity-60"
      >
        {loading ? 'Enviando…' : 'Convidar todos os pendentes'}
      </button>
      {message && <p className="mt-2 text-sm text-stone-700">{message}</p>}
    </div>
  );
}
