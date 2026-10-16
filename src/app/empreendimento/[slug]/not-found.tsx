// src/app/empreendimento/[slug]/not-found.tsx
export default function EmpreendimentoNotFound() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        background: '#F5F2EC',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '3rem', margin: '0 0 16px' }}>🏡</p>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0C2633', margin: '0 0 10px' }}>
        Empreendimento não encontrado
      </h1>
      <p style={{ color: '#4a4a4a', maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
        O link que você acessou pode estar incorreto ou a página foi desativada.
        Entre em contato com a equipe Moní para mais informações.
      </p>
    </div>
  );
}
