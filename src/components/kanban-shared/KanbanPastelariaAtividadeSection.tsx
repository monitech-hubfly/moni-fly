'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getAtividadePastelaria,
  type GetAtividadePastelariaResult,
} from '@/app/sirene/actions';

type Loaded = Extract<GetAtividadePastelariaResult, { hasVinculo: true }>;

export function KanbanPastelariaAtividadeSection({
  sireneChamadoId,
}: {
  sireneChamadoId: number;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Loaded | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErro(null);
    setData(null);

    void getAtividadePastelaria(sireneChamadoId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setErro(res.error);
        setData(null);
      } else if (res.hasVinculo) {
        setData(res);
        setErro(null);
      } else {
        setData(null);
        setErro(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [sireneChamadoId]);

  if (loading) {
    return (
      <section
        className="mb-4 rounded-lg p-4 text-sm text-stone-500"
        style={{
          background: 'var(--moni-surface-50)',
          border: '0.5px solid var(--moni-border-default)',
        }}
        aria-busy="true"
      >
        Carregando atividade na Pastelaria…
      </section>
    );
  }

  if (erro) {
    return (
      <section
        className="mb-4 rounded-lg border px-4 py-3 text-sm text-red-700"
        style={{ borderColor: 'var(--moni-status-error-border, #fecaca)' }}
        role="alert"
      >
        Não foi possível carregar a Pastelaria: {erro}
      </section>
    );
  }

  if (!data) return null;

  return (
    <section
      className="mb-4 rounded-lg p-4"
      style={{
        background: 'var(--moni-surface-50)',
        border: '0.5px solid var(--moni-border-default)',
      }}
      aria-label="Atividade na Pastelaria"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
          Atividade na Pastelaria
        </h4>
        <Link
          href="/carometro/pastelaria"
          className="text-xs font-medium text-moni-primary hover:underline"
        >
          Abrir Pastelaria
        </Link>
      </div>
      <p className="mb-1 text-xs text-stone-600">
        <span className="font-medium text-stone-700">Status do pastel:</span>{' '}
        {data.colunaLabel}
        <span className="ml-2 text-stone-400">({data.coluna})</span>
      </p>
      <p className="mb-3 text-xs text-stone-600">
        <span className="font-medium text-stone-700">Responsável:</span>{' '}
        {data.responsavelNome ?? '—'}
      </p>

      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        Comentários do chamado Sirene
      </h5>
      <ul className="max-h-48 space-y-2 overflow-y-auto">
        {data.mensagens.length === 0 ? (
          <li className="text-sm text-stone-500">Nenhum comentário no chamado ainda.</li>
        ) : (
          data.mensagens.map((m) => (
            <li
              key={m.id}
              className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-stone-500">
                <span className="font-medium text-stone-700">{m.autor_nome ?? 'Sistema'}</span>
                {m.autor_time ? <span>({m.autor_time})</span> : null}
                <time dateTime={m.created_at}>
                  {new Date(m.created_at).toLocaleString('pt-BR')}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-stone-800">{m.texto}</p>
            </li>
          ))
        )}
      </ul>
      <p className="mt-3 text-[10px] text-stone-400">
        Somente leitura — responda na Sirene ou mova o pastel no Carômetro.
      </p>
    </section>
  );
}
