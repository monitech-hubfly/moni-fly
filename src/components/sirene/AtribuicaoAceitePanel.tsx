'use client';

import { useState, useTransition } from 'react';
import {
  aceitarAtribuicaoTopico,
  recusarAtribuicaoTopico,
} from '@/lib/actions/atribuicao-topico-actions';

type Props = {
  topicoId: string;
  atribuicaoStatus: string | null;
  atribuicaoJustificativa: string | null;
  recusadoPorNome: string | null;
  sessionUserId: string | null;
  responsavelId: string | null;
  basePath?: string;
  compact?: boolean;
  onUpdated?: () => void;
};

export function AtribuicaoAceitePanel({
  topicoId,
  atribuicaoStatus,
  atribuicaoJustificativa,
  recusadoPorNome,
  sessionUserId,
  responsavelId,
  basePath,
  compact = false,
  onUpdated,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [justificativa, setJustificativa] = useState('');

  const text = compact ? 'text-[10px]' : 'text-xs';
  const ehResponsavel = sessionUserId != null && sessionUserId === responsavelId;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? 'Erro');
      else {
        setMsg(null);
        onUpdated?.();
      }
    });
  };

  if (atribuicaoStatus === 'recusado') {
    return (
      <div className={`rounded border border-red-200 bg-red-50/80 p-2 ${text}`}>
        <p className="font-medium text-red-700">Atividade recusada</p>
        {(recusadoPorNome || atribuicaoJustificativa) ? (
          <p className="mt-0.5 text-red-600">
            {recusadoPorNome ? `${recusadoPorNome}: ` : ''}
            {atribuicaoJustificativa ?? ''}
          </p>
        ) : null}
      </div>
    );
  }

  if (atribuicaoStatus !== 'pendente_aceite') return null;

  return (
    <div className={`rounded border border-amber-200 bg-amber-50/80 p-2 ${text}`}>
      <p className="font-medium text-amber-800">Aguardando aceite da atribuição</p>

      {ehResponsavel && !recusando ? (
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            disabled={pending}
            className="rounded bg-emerald-600 px-2 py-0.5 text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => run(() => aceitarAtribuicaoTopico(topicoId, basePath))}
          >
            Aceitar
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded border border-stone-300 bg-white px-2 py-0.5 hover:bg-stone-100 disabled:opacity-50"
            onClick={() => setRecusando(true)}
          >
            Recusar
          </button>
        </div>
      ) : null}

      {ehResponsavel && recusando ? (
        <div className="mt-2 space-y-1">
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Justificativa (obrigatória)"
            rows={2}
            className="w-full resize-y px-1.5 py-0.5"
            style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
          />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={pending || !justificativa.trim()}
              className="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-700 disabled:opacity-50"
              onClick={() => run(() => recusarAtribuicaoTopico(topicoId, justificativa, basePath))}
            >
              Confirmar recusa
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded border border-stone-300 bg-white px-2 py-0.5 hover:bg-stone-100 disabled:opacity-50"
              onClick={() => { setRecusando(false); setJustificativa(''); setMsg(null); }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {msg ? <p className="mt-1 text-red-600">{msg}</p> : null}
    </div>
  );
}
