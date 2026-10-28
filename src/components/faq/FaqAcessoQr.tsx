'use client';

import { useEffect, useId, useState } from 'react';
import { QrCode, X } from 'lucide-react';

function urlPublicaAjuda(): string {
  if (typeof window === 'undefined') return '/ajuda';
  return `${window.location.origin}/ajuda`;
}

function corToken(nome: string, reserva: string): string {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return valor || reserva;
}

export function FaqAcessoQr({ aparencia = 'pagina' }: { aparencia?: 'pagina' | 'link' }) {
  const [aberto, setAberto] = useState(false);
  const [svg, setSvg] = useState('');
  const [url, setUrl] = useState('');
  const tituloId = useId();

  useEffect(() => {
    if (!aberto) return;
    const alvo = urlPublicaAjuda();
    setUrl(alvo);
    let ativo = true;
    void import('qrcode/lib/browser')
      .then((modulo) => {
        const gerar = modulo.toString ?? modulo.default.toString;
        const cor = {
          dark: corToken('--moni-navy-800', 'currentColor'),
          light: corToken('--moni-surface-0', 'transparent'),
        };
        return gerar(alvo, {
          type: 'svg',
          margin: 1,
          width: 220,
          errorCorrectionLevel: 'M',
          color: cor,
        });
      })
      .then((markup) => {
        if (!ativo) return;
        setSvg(String(markup).replace(/<\?xml[^>]*>/i, '').trim());
      })
      .catch(() => {
        if (ativo) setSvg('');
      });
    return () => {
      ativo = false;
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [aberto]);

  const botaoPagina =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--moni-radius-pill)] border-[length:var(--moni-border-width)] border-solid border-[var(--moni-border-default)] bg-[var(--moni-surface-0)] px-4 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-secondary)] transition-colors duration-200 hover:border-[var(--moni-navy-800)] hover:text-[var(--moni-text-primary)]';
  const botaoLink =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50';

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={aparencia === 'link' ? botaoLink : botaoPagina}
      >
        <QrCode className="h-4 w-4" aria-hidden />
        QR Code
      </button>
      {aberto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            className="absolute inset-0"
            style={{ background: 'color-mix(in srgb, var(--moni-navy-800) 40%, transparent)' }}
            onClick={() => setAberto(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            className="relative w-full max-w-sm p-6 text-center"
            style={{
              background: 'var(--moni-surface-0)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-lg)',
              boxShadow: 'var(--moni-shadow-card)',
            }}
          >
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar QR Code"
              className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-[var(--moni-radius-md)]"
              style={{ color: 'var(--moni-text-secondary)' }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <h2
              id={tituloId}
              className="pr-8 font-[family-name:var(--moni-font-display)] text-[length:var(--moni-text-xl)] text-[var(--moni-text-primary)]"
            >
              Acesse pelo celular
            </h2>
            <p className="mt-2 font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-sm)] text-[var(--moni-text-secondary)]">
              Aponte a câmera para abrir a Central de Ajuda.
            </p>
            <div
              className="mx-auto mt-5 flex h-[220px] w-[220px] items-center justify-center bg-[var(--moni-surface-0)] [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
            />
            {url ? (
              <p className="mt-4 break-all font-[family-name:var(--moni-font-sans)] text-[length:var(--moni-text-xs)] text-[var(--moni-text-tertiary)]">
                {url}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
