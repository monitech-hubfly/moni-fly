export default function SimuladorOfertasLoading() {
  return (
    <main
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6"
      style={{ background: 'var(--moni-surface-50)', minHeight: '100%' }}
    >
      <div
        className="h-4 w-40 rounded-[var(--moni-radius-md)]"
        style={{ background: 'var(--moni-border-default)' }}
      />
      <div
        className="mt-6 h-10 w-72 rounded-[var(--moni-radius-md)]"
        style={{ background: 'var(--moni-border-default)' }}
      />
      <div
        className="mt-8 h-40 rounded-[var(--moni-radius-lg)]"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
        }}
      />
      <div
        className="mt-4 h-64 rounded-[var(--moni-radius-lg)]"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
        }}
      />
    </main>
  );
}
