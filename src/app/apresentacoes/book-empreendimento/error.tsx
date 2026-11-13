'use client';

export default function BookEmpreendimentoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1
        className="text-xl text-[var(--moni-text-primary)]"
        style={{ fontFamily: 'var(--moni-font-display)' }}
      >
        Book do Empreendimento
      </h1>
      <p
        className="mt-3 text-sm text-[var(--moni-text-secondary)]"
        style={{ fontFamily: 'var(--moni-font-sans)' }}
      >
        Não foi possível carregar as informações.
        {error.message ? ` ${error.message}` : ''}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 px-5 text-sm text-white"
        style={{
          minHeight: 44,
          borderRadius: 'var(--moni-radius-md)',
          background: 'var(--moni-navy-800)',
          fontFamily: 'var(--moni-font-sans)',
        }}
      >
        Tentar de novo
      </button>
    </div>
  );
}
