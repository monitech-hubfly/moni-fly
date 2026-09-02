import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Confirmação de presença — Moní' };

type Props = { searchParams: { status?: string } };

export default function RsvpPage({ searchParams }: Props) {
  const status = searchParams.status ?? '';

  const cfg = {
    aceito:   { emoji: '✅', titulo: 'Presença confirmada!',  msg: 'Sua participação foi registrada. Nos vemos em breve.',         cor: '#16a34a' },
    recusado: { emoji: '❌', titulo: 'Presença recusada.',    msg: 'Tudo certo. O organizador foi notificado.',                    cor: '#dc2626' },
    invalido: { emoji: '⚠️', titulo: 'Link inválido.',        msg: 'Este link não é válido ou já foi utilizado.',                  cor: '#d97706' },
  }[status] ?? {  emoji: '📅', titulo: 'Resposta registrada.', msg: 'Obrigado pela resposta.', cor: '#3b82f6' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{cfg.emoji}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: cfg.cor, marginBottom: 8 }}>{cfg.titulo}</h1>
        <p style={{ color: '#6b7280', fontSize: 15, lineHeight: 1.5 }}>{cfg.msg}</p>
        <p style={{ color: '#d1d5db', fontSize: 12, marginTop: 32 }}>Moní HUB-FLY</p>
      </div>
    </div>
  );
}
