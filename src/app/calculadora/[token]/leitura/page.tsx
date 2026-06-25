import { notFound } from 'next/navigation';
import { KanbanCardModalCalculadoraFases } from '@/components/kanban-shared/KanbanCardModalCalculadoraFases';
import { fetchCalculadoraPublicaByToken } from '@/lib/kanban/fetch-calculadora-publica';

type Props = {
  params: Promise<{ token: string }>;
};

export default async function CalculadoraPublicaPage({ params }: Props) {
  const { token } = await params;
  const pack = await fetchCalculadoraPublicaByToken(token);

  if (!pack) notFound();

  const { card, linhas, fasesFlat, fasesMeta, marcos, negociacaoLinhas } = pack;

  return (
    <div
      className="moni-calculadora--modo-publico min-h-screen"
      style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '28px 20px 80px',
        fontFamily: 'var(--moni-font-sans)',
        background: 'var(--moni-surface-0, #fff)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          paddingBottom: 14,
          borderBottom: '0.5px solid var(--moni-calc-separator, #e8e6e0)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--moni-font-display, Georgia, serif)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--moni-navy-800, #0C2633)',
          }}
        >
          Moní
        </span>
        <span style={{ fontSize: 11, color: 'var(--moni-text-tertiary, #aaa)' }}>
          {card.titulo} · Calculadora de fases
        </span>
      </header>

      <KanbanCardModalCalculadoraFases
        linhas={linhas}
        faseAtualId={card.fase_id}
        cardConcluido={card.concluido}
        fases={fasesFlat}
        fasesMeta={fasesMeta}
        marcos={marcos}
        variant="painel"
        modoPublico
        negociacaoLinhas={negociacaoLinhas}
      />

      <p
        style={{
          marginTop: 28,
          fontSize: 10,
          color: 'var(--moni-text-tertiary, #ccc)',
          textAlign: 'center',
        }}
      >
        Link específico para este projeto — pode expirar após 90 dias.
      </p>
    </div>
  );
}
