'use client';

import { useState, useTransition } from 'react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  aceitarPrazoSubInteracao,
  aceitarPrazoSubInteracaoComoAbridor,
  adminOverridePrazoSubInteracao,
  proporPrazoSubInteracao,
  recusarPrazoSubInteracao,
} from '@/lib/actions/prazo-negociacao-actions';
import {
  negociacaoExpirada,
  normalizarPrazoStatus,
  prazoIsoExibicao,
  rotuloPrazoStatusPt,
  type PrazoNegociacaoCampos,
} from '@/lib/kanban/prazo-negociacao';

type Props = {
  topicoId: string;
  row: PrazoNegociacaoCampos & { responsaveis_ids?: string[] };
  sessionUserId: string | null;
  abridorId: string | null;
  isAdmin: boolean;
  basePath?: string;
  compact?: boolean;
  onUpdated?: () => void;
};

export function PrazoNegociacaoPanel({
  topicoId,
  row,
  sessionUserId,
  abridorId,
  isAdmin,
  basePath,
  compact = false,
  onUpdated,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [novaData, setNovaData] = useState(prazoIsoExibicao(row) ?? '');

  const uid = sessionUserId ?? '';
  const status = normalizarPrazoStatus(row.prazo_status);
  const expirada = negociacaoExpirada(row.prazo_negociacao_expira_em);
  const respIds = (row.responsaveis_ids ?? []).map(String);
  const ehResponsavel = uid !== '' && respIds.includes(uid);
  const ehAbridor = uid !== '' && (uid === abridorId || uid === row.prazo_abridor_id || uid === row.prazo_proposto_por);
  const prazoFmt = prazoIsoExibicao(row);
  const text = compact ? 'text-[10px]' : 'text-xs';

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

  const podeProporLivre = isAdmin || !expirada;
  const inputTravado = expirada && !isAdmin;

  return (
    <div className={`rounded border border-stone-200 bg-stone-50/80 p-2 ${text}`}>
      <p className="font-medium text-stone-700">
        Prazo limite
        {prazoFmt ? `: ${formatIsoDateOnlyPtBr(prazoFmt) ?? prazoFmt}` : ''}
      </p>
      {status && status !== 'aceito' ? (
        <p className="mt-0.5 text-amber-800">{rotuloPrazoStatusPt(status)}</p>
      ) : null}
      {expirada && status !== 'aceito' ? (
        <p className="mt-0.5 text-stone-500">Janela de negociação (24h) encerrada.</p>
      ) : null}

      {status === 'pendente_aceite_responsavel' && ehResponsavel ? (
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            disabled={pending}
            className="rounded bg-emerald-600 px-2 py-0.5 text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => run(() => aceitarPrazoSubInteracao(topicoId, basePath))}
          >
            Aceitar prazo
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded border border-stone-300 bg-white px-2 py-0.5 hover:bg-stone-100 disabled:opacity-50"
            onClick={() => run(() => recusarPrazoSubInteracao(topicoId, basePath))}
          >
            Recusar
          </button>
        </div>
      ) : null}

      {status === 'pendente_aceite_abridor' && (ehAbridor || isAdmin) ? (
        <div className="mt-2">
          <button
            type="button"
            disabled={pending}
            className="rounded bg-emerald-600 px-2 py-0.5 text-white hover:bg-emerald-700 disabled:opacity-50"
            onClick={() => run(() => aceitarPrazoSubInteracaoComoAbridor(topicoId, basePath))}
          >
            Aceitar contraproposta
          </button>
        </div>
      ) : null}

      {(status === 'recusado' && ehResponsavel) ||
      (podeProporLivre && (ehAbridor || ehResponsavel || isAdmin) && status !== 'pendente_aceite_responsavel') ? (
        <div className="mt-2 flex flex-wrap items-end gap-1">
          <label className="block min-w-0 flex-1">
            <span className="mb-0.5 block text-stone-600">
              {status === 'recusado' ? 'Novo prazo (responsável)' : 'Alterar prazo'}
            </span>
            <input
              type="date"
              value={novaData}
              disabled={inputTravado && !isAdmin}
              onChange={(e) => setNovaData(e.target.value)}
              className="w-full px-1.5 py-0.5"
              style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
            />
          </label>
          <button
            type="button"
            disabled={pending || (!novaData.trim() && !isAdmin)}
            className="shrink-0 rounded bg-stone-800 px-2 py-0.5 text-white hover:bg-stone-900 disabled:opacity-50"
            onClick={() =>
              run(() =>
                isAdmin && expirada
                  ? adminOverridePrazoSubInteracao(topicoId, novaData, basePath)
                  : proporPrazoSubInteracao(topicoId, novaData, basePath),
              )
            }
          >
            {isAdmin && expirada ? 'Salvar (admin)' : 'Propor'}
          </button>
        </div>
      ) : null}

      {isAdmin && expirada && status === 'aceito' ? (
        <div className="mt-2 flex flex-wrap items-end gap-1">
          <input
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            className="min-w-0 flex-1 px-1.5 py-0.5"
            style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
          />
          <button
            type="button"
            disabled={pending}
            className="rounded bg-violet-700 px-2 py-0.5 text-white hover:bg-violet-800 disabled:opacity-50"
            onClick={() => run(() => adminOverridePrazoSubInteracao(topicoId, novaData, basePath))}
          >
            Override admin
          </button>
        </div>
      ) : null}

      {msg ? <p className="mt-1 text-red-600">{msg}</p> : null}
    </div>
  );
}
