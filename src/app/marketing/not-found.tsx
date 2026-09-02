import Link from 'next/link';

export default function MarketingNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p
        className="text-sm uppercase tracking-wide"
        style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        404
      </p>
      <h1
        className="text-3xl"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
      >
        Funil não encontrado
      </h1>
      <p className="max-w-md text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Este funil da sessão Marketing não existe ou ainda não foi publicado.
      </p>
      <Link
        href="/marketing"
        className="inline-flex items-center justify-center px-5 text-sm text-white"
        style={{
          minHeight: 44,
          borderRadius: 'var(--moni-radius-md)',
          background: 'var(--moni-navy-800)',
          fontFamily: 'var(--moni-font-sans)',
        }}
      >
        Voltar ao Hub de Funis
      </Link>
    </div>
  );
}
