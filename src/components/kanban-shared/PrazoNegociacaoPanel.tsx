'use client';

import { useState, useTransition } from 'react';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  aceitarPrazoSubInteracao,
  aceitarPrazoSubInteracaoComoAbridor,
  proporPrazoSubInteracao,
  recusarPrazoSubInteracao,
} from '@/lib/actions/prazo-negociacao-actions';
import {
  normalizarPrazoStatus,
  prazoIsoExibicao,
  rotuloPrazoStatusPt,
  type PrazoNegociacaoCampos,
} from '@/lib/kanban/prazo-negociacao';

type HistoricoEvento = {
  tipo: string;
  em: string;
  por?: string | null;
  detalhe?: string | null;
};

type Props = {
  topicoId: string;
  row: PrazoNegociacaoCampos & { responsaveis_ids?: string[] };
  sessionUserId: string | null;
  abridorId: string | null;
  isAdmin: boolean;
  basePath?: string;
  compact?: boolean;
  onUpdated?: () => void;
  historico?: HistoricoEvento[];
  nomePorId?: Map<string, string>;
};

const HIST_TIPO_LABEL: Record<string, string> = {
  'Prazo proposto': 'Proposto',
  'Prazo aceito': 'Aceito',
  'Prazo recusado': 'Recusado',
  'Prazo aceito automaticamente': 'Aceito automaticamente',
  'Prazo admin override': 'Alterado (admin)',
  'Prazo atualizado': 'Atualizado',
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
  historico,
  nomePorId,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [novaData, setNovaData] = useState(prazoIsoExibicao(row) ?? '');
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const uid = sessionUserId ?? '';
  const status = normalizarPrazoStatus(row.prazo_status);
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

  const historicoPrazo = (historico ?? []).filter((e) =>
    e.tipo.startsWith('Prazo') || e.tipo === 'Prazo proposto' || e.tipo === 'Prazo aceito' || e.tipo === 'Prazo recusado'
  );

  return (
    <div className={`rounded border border-stone-200 bg-stone-50/80 p-2 ${text}`}>
      <p className="flex items-center gap-1 font-medium text-stone-700">
        Prazo limite
        {prazoFmt ? `: ${formatIsoDateOnlyPtBr(prazoFmt) ?? prazoFmt}` : ''}
        {historicoPrazo.length > 1 ? (
          <button
            type="button"
            onClick={() => setHistoricoAberto((v) => !v)}
            className="ml-auto text-[9px] text-stone-400 hover:text-stone-600 underline"
          >
            {historicoAberto ? 'Ocultar histórico' : `Histórico (${historicoPrazo.length})`}
          </button>
        ) : null}
      </p>

      {historicoAberto && historicoPrazo.length > 0 ? (
        <ol className="mt-1.5 space-y-0.5 border-l-2 border-stone-200 pl-2">
          {historicoPrazo.map((evt, i) => {
            const dataPrazo = evt.detalhe ? (formatIsoDateOnlyPtBr(evt.detalhe.slice(0, 10)) ?? evt.detalhe.slice(0, 10)) : null;
            const dataEvento = evt.em ? new Date(evt.em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;
            const autor = evt.por ? (nomePorId?.get(evt.por) ?? null) : null;
            return (
              <li key={i} className="text-[9px] text-stone-500">
                <span className="font-medium text-stone-600">{HIST_TIPO_LABEL[evt.tipo] ?? evt.tipo}</span>
                {dataPrazo ? <span className="ml-1">→ {dataPrazo}</span> : null}
                {dataEvento ? <span className="ml-1 text-stone-400">em {dataEvento}</span> : null}
                {autor ? <span className="ml-1 text-stone-400">por {autor}</span> : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {status && status !== 'aceito' ? (
        <p className="mt-0.5 text-amber-800">{rotuloPrazoStatusPt(status)}</p>
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

      {(ehResponsavel || ehAbridor || isAdmin) ? (
        <div className="mt-2 flex flex-wrap items-end gap-1">
          <label className="block min-w-0 flex-1">
            <span className="mb-0.5 block text-stone-600">Propor novo prazo</span>
            <input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className="w-full px-1.5 py-0.5"
              style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
            />
          </label>
          <button
            type="button"
            disabled={pending || !novaData.trim()}
            className="shrink-0 rounded bg-stone-800 px-2 py-0.5 text-white hover:bg-stone-900 disabled:opacity-50"
            onClick={() => run(() => proporPrazoSubInteracao(topicoId, novaData, basePath))}
          >
            Propor
          </button>
        </div>
      ) : null}

      {msg ? <p className="mt-1 text-red-600">{msg}</p> : null}
    </div>
  );
}
