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
