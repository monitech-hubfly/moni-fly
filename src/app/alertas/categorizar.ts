export type CategoriaAlerta = 'sirene' | 'cards' | 'planejamento' | 'gerais';

export function categorizarAlerta(tipo: string): CategoriaAlerta {
  if (
    tipo === 'mencao_sirene' ||
    tipo === 'kanban_atividade_criada' ||
    tipo === 'kanban_atividade_atualizada' ||
    tipo === 'kanban_atividade_redirecionada' ||
    tipo === 'atribuicao_recusada' ||
    tipo === 'sla_atividade_atrasado' ||
    tipo === 'sla_atividade_atencao'
  ) return 'sirene';
  if (tipo === 'mencao_kanban_card' || tipo === 'mencao_card') return 'cards';
  if (tipo === 'status_preenchimento_lembrete') return 'planejamento';
  return 'gerais';
}

export type PrioridadeAlerta = 'critico' | 'importante' | 'informativo';

export function priorizarAlerta(tipo: string): PrioridadeAlerta {
  if (
    tipo === 'kanban_atividade_criada' ||
    tipo === 'atribuicao_recusada' ||
    tipo === 'sla_atividade_atrasado' ||
    tipo === 'mencao_sirene' ||
    tipo === 'mencao_kanban_card' ||
    tipo === 'mencao_card' ||
    tipo === 'aprovacao_fase' ||
    tipo === 'acoplamento_novo_projeto'
  ) return 'critico';
  if (
    tipo === 'sla_atividade_atencao' ||
    tipo === 'kanban_atividade_atualizada' ||
    tipo === 'kanban_atividade_redirecionada' ||
    tipo === 'status_preenchimento_lembrete'
  ) return 'importante';
  return 'informativo';
}

export function labelPrioridade(p: PrioridadeAlerta): string {
  if (p === 'critico') return '🔴 Crítico';
  if (p === 'importante') return '🟡 Importante';
  return '⚪ Informativo';
}

export function corPrioridade(p: PrioridadeAlerta) {
  if (p === 'critico') return {
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border-red-200',
    borda: 'border-l-red-400',
    bg: 'bg-red-50',
  };
  if (p === 'importante') return {
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    borda: 'border-l-amber-400',
    bg: 'bg-amber-50',
  };
  return {
    dot: 'bg-stone-300',
    badge: 'bg-stone-50 text-stone-500 border-stone-200',
    borda: 'border-l-stone-200',
    bg: 'bg-white',
  };
}
