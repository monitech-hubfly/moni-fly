import Link from 'next/link';

export default function NotFound() {
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
        Página não encontrada
      </h1>
      <p className="max-w-md text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        O endereço não existe ou foi movido.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center px-5 text-sm text-white"
        style={{
          minHeight: 44,
          borderRadius: 'var(--moni-radius-md)',
          background: 'var(--moni-navy-800)',
          fontFamily: 'var(--moni-font-sans)',
        }}
      >
        Ir para o Hub Fly
      </Link>
    </div>
  );
}
