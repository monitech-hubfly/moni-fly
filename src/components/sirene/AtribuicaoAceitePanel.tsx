'use client';

import { useState, useTransition } from 'react';
import {
  aceitarAtribuicaoTopico,
  recusarAtribuicaoTopico,
  redirecionarAtribuicaoTopico,
} from '@/lib/actions/atribuicao-topico-actions';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Props = {
  topicoId: string;
  atribuicaoStatus: string | null;
  atribuicaoJustificativa: string | null;
  atribuicaoRecusadoPor: string | null;
  recusadoPorNome: string | null;
  sessionUserId: string | null;
  responsavelId: string | null;
  abridorId?: string | null;
  responsaveisOpcoes?: { id: string; nome: string }[];
  onArquivar?: () => void;
  basePath?: string;
  compact?: boolean;
  onUpdated?: () => void;
};

export function AtribuicaoAceitePanel({
  topicoId,
  atribuicaoStatus,
  atribuicaoJustificativa,
  atribuicaoRecusadoPor,
  recusadoPorNome,
  sessionUserId,
  responsavelId,
  abridorId,
  responsaveisOpcoes,
  onArquivar,
  basePath,
  compact = false,
  onUpdated,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [redirecionando, setRedirecionando] = useState(false);
  const [novoRespId, setNovoRespId] = useState('');
  const [showConfirmarEncerrar, setShowConfirmarEncerrar] = useState(false);

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
    const ehAbridor = Boolean(sessionUserId && abridorId && sessionUserId === abridorId);
    const opcoesRedir = (responsaveisOpcoes ?? []).filter(r => r.id !== atribuicaoRecusadoPor);
    return (
      <div className={`rounded border border-red-200 bg-red-50/80 p-2 ${text}`}>
        <p className="font-medium text-red-700">Atividade recusada</p>
        {(recusadoPorNome || atribuicaoJustificativa) ? (
          <p className="mt-0.5 text-red-600">
            {recusadoPorNome ? `${recusadoPorNome}: ` : ''}
            {atribuicaoJustificativa ?? ''}
          </p>
        ) : null}
        {ehAbridor && !redirecionando ? (
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={pending}
              className="rounded bg-stone-700 px-2 py-0.5 text-white hover:bg-stone-800 disabled:opacity-50"
              onClick={() => { setRedirecionando(true); setNovoRespId(''); setMsg(null); }}
            >
              Redirecionar
            </button>
            {onArquivar ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded border border-stone-300 bg-white px-2 py-0.5 hover:bg-stone-100 disabled:opacity-50"
                  onClick={() => setShowConfirmarEncerrar(true)}
                >
                  Encerrar
                </button>
                <ConfirmModal
                  open={showConfirmarEncerrar}
                  title="Encerrar atividade"
                  description="A atividade será encerrada sem reatribuição. Esta ação não pode ser desfeita."
                  confirmLabel="Encerrar"
                  destructive
                  onConfirm={() => { setShowConfirmarEncerrar(false); onArquivar(); }}
                  onClose={() => setShowConfirmarEncerrar(false)}
                />
              </>
            ) : null}
          </div>
        ) : null}
        {ehAbridor && redirecionando ? (
          <div className="mt-2 space-y-1">
            <select
              value={novoRespId}
              onChange={e => setNovoRespId(e.target.value)}
              className="w-full rounded border border-stone-300 bg-white px-1.5 py-0.5"
            >
              <option value="">Selecione o responsável…</option>
              {opcoesRedir.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={pending || !novoRespId}
                className="rounded bg-stone-700 px-2 py-0.5 text-white hover:bg-stone-800 disabled:opacity-50"
                onClick={() => run(() => redirecionarAtribuicaoTopico(topicoId, novoRespId, basePath))}
              >
                Confirmar
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded border border-stone-300 bg-white px-2 py-0.5 hover:bg-stone-100 disabled:opacity-50"
                onClick={() => { setRedirecionando(false); setNovoRespId(''); setMsg(null); }}
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
