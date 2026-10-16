/**
 * Venda Casas Frank's — tela Em Construção (IMOB).
 * Sem kanban; em desenvolvimento para uma versão futura.
 */
import { requireFunisInternosNegocioAccess } from '@/lib/guards/kanban-funil-access';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Venda Casas Frank's | moni-fly",
};

export default async function VendaCasasFranksPage() {
  await requireFunisInternosNegocioAccess();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1.5rem',
        padding: '3rem 1.5rem',
        textAlign: 'center',
      }}
    >
      {/* Ícone decorativo */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 'var(--moni-radius-lg)',
          background: 'var(--moni-surface-100)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
        }}
      >
        🏗️
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: 480 }}>
        <h1
          style={{
            fontFamily: 'var(--moni-font-display)',
            fontSize: '1.75rem',
            fontWeight: 600,
            color: 'var(--moni-text-primary)',
            margin: 0,
          }}
        >
          Venda Casas Frank&apos;s
        </h1>

        <p
          style={{
            fontFamily: 'var(--moni-font-sans)',
            fontSize: '1rem',
            color: 'var(--moni-text-secondary)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Esta funcionalidade está em construção e estará disponível em breve.
        </p>
      </div>

      <span
        className="moni-tag-atencao"
        style={{
          fontFamily: 'var(--moni-font-sans)',
          fontSize: '0.75rem',
          padding: '4px 12px',
          borderRadius: 'var(--moni-radius-md)',
        }}
      >
        Em Construção
      </span>
    </div>
  );
}
