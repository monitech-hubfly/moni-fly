'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import {
  getPreBatalhaSecoesParaHub,
  PRE_BATALHA_PUBLIC_LEITURA_PATH,
  type PreBatalhaSecao,
} from '@/lib/pre-batalha-secoes';

type Props = {
  secao: PreBatalhaSecao;
  /** Link público: só guia, modo leitura, sem sidebar Hub. */
  modoPublico?: boolean;
  /** Visitante já autenticado — mostra atalho ao Hub em vez de "Entrar". */
  usuarioLogado?: boolean;
};

/** Caminho canónico compartilhável: sem query (todos o mesmo link). */
const PATH_LEITURA_PUBLICA = PRE_BATALHA_PUBLIC_LEITURA_PATH;

export function PreBatalhaSecaoClient({ secao, modoPublico = false, usuarioLogado = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedPublico, setCopiedPublico] = useState(false);

  const iframeSrc = useMemo(() => {
    const q = new URLSearchParams();
    if (modoPublico) q.set('leitura', '1');
    const qs = q.toString();
    const base = `/embed/pre-batalha-casas.html${qs ? `?${qs}` : ''}`;
    /** Link público fixo: modo leitura exibe todas as seções — sem hash por aba. */
    if (modoPublico) return base;
    return `${base}#${secao}`;
  }, [secao, modoPublico]);

  const secoesHub = getPreBatalhaSecoesParaHub();
  const secaoLabel = secoesHub.find((x) => x.id === secao)?.label ?? secao;

  const pathInterno = `/pre-batalha/${secao}`;
  const pathPublicoLeitura = PATH_LEITURA_PUBLICA;

  const copyLinkInterno = async () => {
    try {
      const url = `${window.location.origin}${pathInterno}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const copyLinkPublico = async () => {
    try {
      const url = `${window.location.origin}${pathPublicoLeitura}`;
      await navigator.clipboard.writeText(url);
      setCopiedPublico(true);
      window.setTimeout(() => setCopiedPublico(false), 2500);
    } catch {
      setCopiedPublico(false);
    }
  };

  if (modoPublico) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-stone-100">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-800">Pré Batalha de Casas — modo leitura</p>
            <p className="truncate text-xs text-stone-500">
              Guia completo · link público · sem acesso ao Hub Fly
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyLinkPublico()}
              className="touch-manipulation inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-moni-primary shadow-sm hover:bg-moni-light/40 sm:min-h-0 sm:min-w-0 sm:py-1.5"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {copiedPublico ? 'Link copiado!' : 'Copiar link público (leitura)'}
            </button>
            {usuarioLogado ? (
              <Link
                href={`/pre-batalha/${secao}`}
                className="touch-manipulation flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 sm:min-h-0 sm:min-w-0 sm:py-1.5"
              >
                Abrir no Hub
              </Link>
            ) : (
              <Link
                href="/login"
                className="touch-manipulation flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 sm:min-h-0 sm:min-w-0 sm:py-1.5"
              >
                Entrar
              </Link>
            )}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:p-3">
          <iframe
            title="Pré Batalha de Casas — guia completo (leitura)"
            src={iframeSrc}
            className="block h-full w-full min-h-0 rounded-xl border border-stone-200 bg-white shadow-sm"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-50 lg:flex-row">
      <aside className="w-full shrink-0 border-b border-stone-200 bg-white lg:w-56 lg:border-b-0 lg:border-r lg:border-stone-200">
        <div className="max-h-[38vh] overflow-y-auto p-3 lg:sticky lg:top-0 lg:max-h-none">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Seções do guia
          </p>
          <nav className="space-y-0.5" aria-label="Seções do guia Pré Batalha de Casas">
            {secoesHub.map((s) => {
              const active = s.id === secao;
              return (
                <Link
                  key={s.id}
                  href={`/pre-batalha/${s.id}`}
                  className={`block rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-moni-light font-medium text-moni-primary'
                      : 'text-stone-700 hover:bg-stone-100 hover:text-moni-secondary'
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => void copyLinkInterno()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-moni-primary shadow-sm hover:bg-moni-light/40"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {copied ? 'Link copiado!' : 'Copiar link desta seção'}
            </button>
            <button
              type="button"
              onClick={() => void copyLinkPublico()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-900 shadow-sm hover:bg-emerald-100/80"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {copiedPublico ? 'Link público copiado!' : 'Copiar link público (leitura)'}
            </button>
            <p className="px-1 text-[10px] leading-snug text-stone-500">
              O link público é sempre o mesmo ({PRE_BATALHA_PUBLIC_LEITURA_PATH}), sem nome na URL — guia
              completo em modo leitura, sem menu do Hub.
            </p>
          </div>
        </div>
      </aside>
      <main className="relative min-h-0 min-w-0 flex-1 bg-stone-100/80 p-2 md:p-3">
        <iframe
          title={`Pré Batalha de Casas — ${secaoLabel}`}
          src={iframeSrc}
          className="h-[calc(100dvh-8rem)] w-full min-h-[360px] rounded-xl border border-stone-200 bg-white shadow-sm lg:h-[calc(100dvh-6.5rem)]"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </main>
    </div>
  );
}
