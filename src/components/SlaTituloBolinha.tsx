import { rotuloSlaAtividadeDiasUteis } from '@/lib/dias-uteis';

type Props = {
  prazoIso: string | null | undefined;
  statusPainel: string;
  className?: string;
};

export function SlaTituloBolinha({ prazoIso, statusPainel, className = '' }: Props) {
  const sla = rotuloSlaAtividadeDiasUteis(prazoIso, statusPainel);
  if (sla.variante !== 'atrasado' && sla.variante !== 'atencao') return null;
  const cor = sla.variante === 'atrasado' ? 'vermelho' : 'amarelo';
  const title =
    cor === 'vermelho' ? 'SLA em atraso (dias úteis)' : 'SLA: vence hoje ou em 1 dia útil';
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`.trim()}
      style={{
        background: cor === 'vermelho' ? 'var(--moni-status-overdue-border)' : 'var(--moni-status-attention-border)',
      }}
      title={title}
      aria-hidden
    />
  );
}
