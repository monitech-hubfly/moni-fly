import { rotuloSlaAtividadeDiasUteis } from '@/lib/dias-uteis';

type Props = {
  prazoIso: string | null | undefined;
  status?: string | boolean;
  /** Exibe texto interno quando em dia (variante ok). */
  showOkText?: boolean;
  className?: string;
};

export function SlaAtividadeBadge({
  prazoIso,
  status,
  showOkText = true,
  className = '',
}: Props) {
  const sla = rotuloSlaAtividadeDiasUteis(prazoIso, status);

  if (sla.variante === 'nenhum') {
    return (
      <span className={`text-xs text-[var(--moni-text-tertiary)] ${className}`.trim()}>{sla.texto}</span>
    );
  }

  if (sla.variante === 'ok') {
    if (!showOkText) return null;
    return (
      <span className={`text-xs text-[var(--moni-text-tertiary)] ${className}`.trim()}>{sla.texto}</span>
    );
  }

  const isAtrasado = sla.variante === 'atrasado';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`.trim()}
      style={
        isAtrasado
          ? {
              background: 'var(--moni-status-overdue-bg)',
              color: 'var(--moni-status-overdue-text)',
              border: '1px solid var(--moni-status-overdue-border)',
            }
          : {
              background: 'var(--moni-status-attention-bg)',
              color: 'var(--moni-status-attention-text)',
              border: '1px solid var(--moni-status-attention-border)',
            }
      }
    >
      {sla.texto}
    </span>
  );
}
