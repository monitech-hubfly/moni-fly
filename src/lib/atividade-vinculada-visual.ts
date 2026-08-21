import { classificarSlaFundoChamado, getPrazoTagAtividade } from '@/lib/painel-tarefas-filtros';

/** Estado visual da linha/card de atividade (cores + ícone). */
export type AtividadeVinculadaKind =
  | 'concluido'
  | 'atrasado'
  | 'atencao'
  | 'em_andamento'
  | 'pendente'
  | 'cancelada'
  /** Kanban — SLA “vence hoje / 1 d.u.” (fundo dourado claro). */
  | 'prazo_proximo'
  /** Kanban — SLA tranquilo ou sem prazo (fundo cinza claro). */
  | 'prazo_calm';

export function resolveAtividadeVinculadaKind(input: {
  concluido: boolean;
  status?: string | null;
  prazo?: string | null;
  /** Ex.: Funil Kanban — `urgente` / `alta` reforçam vermelho / amarelo quando não há tag de prazo. */
  prioridade?: string | null;
}): AtividadeVinculadaKind {
  if (input.concluido) return 'concluido';
  const st = String(input.status ?? 'nao_iniciada').trim().toLowerCase();
  if (st === 'concluido' || st === 'concluida') return 'concluido';
  if (st === 'cancelada') return 'cancelada';
  const stPrazo = st === 'pendente' ? 'nao_iniciada' : st;
  const tag = getPrazoTagAtividade(input.prazo, stPrazo);
  if (tag === 'atrasado') return 'atrasado';
  if (tag === 'atencao') return 'atencao';
  if (st === 'em_andamento') return 'em_andamento';
  const pr = String(input.prioridade ?? '').trim().toLowerCase();
  if (pr === 'urgente') return 'atrasado';
  if (pr === 'alta') return 'atencao';
  return 'pendente';
}

/**
 * Fundo da linha do chamado no modal Kanban: só por SLA do prazo efetivo
 * (concluída/cancelada preservam os estilos “feitos”).
 */
export function resolveKanbanChamadoSurfaceKind(
  status: string,
  prazoIso: string | null | undefined,
): AtividadeVinculadaKind {
  const st = String(status ?? '').trim().toLowerCase();
  if (st === 'concluido' || st === 'concluida') return 'concluido';
  if (st === 'cancelada') return 'cancelada';
  const f = classificarSlaFundoChamado(prazoIso ?? null);
  if (f === 'atrasado') return 'atrasado';
  if (f === 'proximo') return 'prazo_proximo';
  return 'prazo_calm';
}

/**
 * Ícone da linha no Kanban: prioriza alerta de sub atrasada, senão status (manual ou derivado).
 */
export function resolveKanbanChamadoIconKind(input: {
  status: string;
  alertaSubAtrasada: boolean;
}): AtividadeVinculadaKind {
  if (input.alertaSubAtrasada) return 'atrasado';
  const st = String(input.status ?? '').trim().toLowerCase();
  if (st === 'concluido' || st === 'concluida') return 'concluido';
  if (st === 'cancelada') return 'cancelada';
  if (st === 'em_andamento') return 'em_andamento';
  return 'pendente';
}

/** Container “cartão” com leve relevo (borda + sombra + highlight superior), alinhado ao Funil/exemplos. */
export function atividadeVinculadaRaisedSurface(kind: AtividadeVinculadaKind): {
  background: string;
  border: string;
  borderRadius: string;
  boxShadow: string;
} {
  const row = atividadeVinculadaRowStyles(kind);
  return {
    background: row.background,
    border: `0.5px solid ${row.borderColor}`,
    borderRadius: 'var(--moni-radius-lg)',
    boxShadow: [
      'inset 0 1px 0 rgba(255, 255, 255, 0.52)',
      'inset 0 -1px 0 rgba(12, 38, 51, 0.05)',
      '0 1px 2px rgba(12, 38, 51, 0.06)',
      '0 5px 16px rgba(12, 38, 51, 0.09)',
    ].join(', '),
  };
}

export function labelChecklistStatusParaPill(status: 'nao_iniciada' | 'em_andamento' | 'concluido'): string {
  if (status === 'nao_iniciada') return 'Não iniciada';
  if (status === 'em_andamento') return 'Em andamento';
  return 'Concluída';
}

/** Status em `kanban_atividades` e equivalentes. */
export function labelKanbanAtividadeParaPill(status: string): string {
  const st = String(status ?? '').trim().toLowerCase();
  if (st === 'pendente') return 'Pendente';
  if (st === 'em_andamento') return 'Em andamento';
  if (st === 'concluida' || st === 'concluido') return 'Concluída';
  if (st === 'cancelada') return 'Cancelada';
  return status || '—';
}

export function atividadeVinculadaRowStyles(kind: AtividadeVinculadaKind): {
  background: string;
  borderColor: string;
  iconColor: string;
} {
  switch (kind) {
    case 'concluido':
      return {
        background: 'var(--moni-status-done-bg)',
        borderColor: 'var(--moni-status-done-border)',
        iconColor: 'var(--moni-status-done-text)',
      };
    case 'atrasado':
      return {
        background: '#fef2f2',
        borderColor: '#fecaca',
        iconColor: 'var(--moni-status-overdue-text)',
      };
    case 'atencao':
      return {
        background: 'var(--moni-status-attention-bg)',
        borderColor: 'var(--moni-status-attention-border)',
        iconColor: 'var(--moni-status-attention-text)',
      };
    case 'prazo_proximo':
      return {
        background: 'var(--moni-gold-50)',
        borderColor: 'var(--moni-gold-200)',
        iconColor: 'var(--moni-gold-800)',
      };
    case 'prazo_calm':
      return {
        background: '#fafaf9',
        borderColor: '#e7e5e4',
        iconColor: 'var(--moni-text-tertiary)',
      };
    case 'em_andamento':
      return {
        background: 'var(--moni-status-active-bg)',
        borderColor: 'var(--moni-status-active-border)',
        iconColor: 'var(--moni-status-active-text)',
      };
    case 'cancelada':
      return {
        background: 'var(--moni-status-archived-bg)',
        borderColor: 'var(--moni-status-archived-border)',
        iconColor: 'var(--moni-status-archived-text)',
      };
    default:
      return {
        background: 'var(--moni-surface-0)',
        borderColor: 'var(--moni-border-default)',
        iconColor: 'var(--moni-text-tertiary)',
      };
  }
}
