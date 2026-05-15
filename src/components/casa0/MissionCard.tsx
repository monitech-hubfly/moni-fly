'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

export type MissionCardMissao = {
  conteudo: string;
  status: string;
} | null;

export type MissionCardProps = {
  missao: MissionCardMissao;
  onSalvar: (conteudo: string) => Promise<void>;
  bloqueada: boolean;
};

const ENTREGAVEIS = [
  '3 condomínios mapeados',
  '3 corretores identificados',
  '1 hipótese inicial de mercado',
] as const;

function isSomenteLeitura(status: string | undefined) {
  return status === 'enviado' || status === 'aprovado';
}

export function MissionCard({ missao, onSalvar, bloqueada }: MissionCardProps) {
  const status = missao?.status ?? 'pendente';
  const conteudoSalvo = missao?.conteudo ?? '';
  const leitura = isSomenteLeitura(status);

  const [texto, setTexto] = useState(conteudoSalvo);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!leitura) {
      setTexto(conteudoSalvo);
    }
  }, [conteudoSalvo, leitura]);

  const podeEditar = !bloqueada && !leitura;

  async function handleEnviar() {
    const t = texto.trim();
    if (!t) {
      setErro('Descreva sua missão antes de enviar.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await onSalvar(t);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm',
        bloqueada && 'opacity-50',
      )}
    >
      {bloqueada ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/40 px-4 backdrop-blur-[1px]"
          role="region"
          aria-label="Missão bloqueada"
        >
          <p className="rounded-lg border border-stone-200 bg-white/95 px-4 py-2 text-center text-sm font-semibold text-stone-800 shadow-sm">
            Conclua o setup para desbloquear
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-stone-900">Primeira Missão Operacional</h3>
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 ring-1 ring-violet-200/80">
              +100 XP
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-600">Primeira Inteligência de Mercado</p>
        </div>
        {leitura ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
            Enviado ✓
          </span>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm text-stone-700">
        {ENTREGAVEIS.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {leitura ? (
          <div className="rounded-xl border border-stone-100 bg-stone-50/80 px-4 py-3 text-sm leading-relaxed text-stone-800 whitespace-pre-wrap">
            {conteudoSalvo ? conteudoSalvo : <span className="italic text-stone-500">(sem texto registrado)</span>}
          </div>
        ) : (
          <>
            <label htmlFor="mission-card-textarea" className="sr-only">
              Descrição da missão
            </label>
            <textarea
              id="mission-card-textarea"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                if (erro) setErro(null);
              }}
              disabled={!podeEditar || enviando}
              rows={6}
              placeholder="Descreva como você cumpriu os entregáveis (condomínios, corretores e hipótese de mercado)…"
              className="w-full resize-y rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-inner placeholder:text-stone-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-stone-50"
            />
            {erro ? <p className="mt-2 text-xs font-medium text-red-600">{erro}</p> : null}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleEnviar}
                disabled={!podeEditar || enviando || !texto.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? 'Enviando…' : 'Enviar missão'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
