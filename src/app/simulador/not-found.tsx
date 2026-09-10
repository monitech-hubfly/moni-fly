export default function SimuladorNaoEncontrado() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center"
      style={{ background: 'var(--moni-surface-50)' }}
    >
      <p className="text-sm" style={{ color: 'var(--moni-gold-400)', fontFamily: 'var(--moni-font-sans)' }}>
        Simulador
      </p>
      <h1
        className="mt-2 text-3xl"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
      >
        Link inválido ou expirado
      </h1>
      <p className="mt-2 max-w-sm text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
        Peça um novo QR code para a equipe do loteamento.
      </p>
    </div>
  );
}
