'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import {
  BCA_TREINAMENTO_SECOES,
  type BcaTreinamentoSecao,
} from '@/lib/treinamento-bca-secoes';

type Props = { secao: BcaTreinamentoSecao };

export function TreinamentoBcaSecaoClient({ secao }: Props) {
  const sp = useSearchParams();
  const frank = sp.get('frank');
  const querySuffix = frank ? `?frank=${encodeURIComponent(frank)}` : '';
  const [copied, setCopied] = useState(false);

  const iframeSrc = useMemo(() => {
    const q = new URLSearchParams();
    if (frank) q.set('frank', frank);
    const qs = q.toString();
    return `/embed/bca-manual-moni.html${qs ? `?${qs}` : ''}#${secao}`;
  }, [frank, secao]);

  const secaoLabel = BCA_TREINAMENTO_SECOES.find((x) => x.id === secao)?.label ?? secao;

  const copyLink = async () => {
    try {
      const path = `/treinamento-bca/${secao}${querySuffix}`;
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-50 lg:flex-row">
      <aside className="w-full shrink-0 border-b border-stone-200 bg-white lg:w-56 lg:border-b-0 lg:border-r lg:border-stone-200">
        <div className="max-h-[38vh] overflow-y-auto p-3 lg:sticky lg:top-0 lg:max-h-none">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Seções do manual
          </p>
          <nav className="space-y-0.5" aria-label="Seções do manual BCA">
            {BCA_TREINAMENTO_SECOES.map((s) => {
              const active = s.id === secao;
              return (
                <Link
                  key={s.id}
                  href={`/treinamento-bca/${s.id}${querySuffix}`}
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
          <button
            type="button"
            onClick={() => void copyLink()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-moni-primary shadow-sm hover:bg-moni-light/40"
          >
            <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {copied ? 'Link copiado!' : 'Copiar link desta seção'}
          </button>
        </div>
      </aside>
      <main className="relative min-h-0 min-w-0 flex-1 bg-stone-100/80 p-2 md:p-3">
        <iframe
          title={`Treinamento BCA — ${secaoLabel}`}
          src={iframeSrc}
          className="h-[calc(100dvh-8rem)] w-full min-h-[360px] rounded-xl border border-stone-200 bg-white shadow-sm lg:h-[calc(100dvh-6.5rem)]"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </main>
    </div>
  );
}
