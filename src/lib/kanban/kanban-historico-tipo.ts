/** Categoria da coluna `kanban_historico.tipo` (NOT NULL no banco). */
export type KanbanHistoricoTipo =
  | 'fase'
  | 'interacao'
  | 'criacao'
  | 'arquivamento'
  | 'campo'
  | 'comentario'
  | 'vinculo'
  | 'bastao'
  | 'sla'
  | 'finalizacao'
  | 'sistema';

/**
 * Mapeia `acao` → `tipo` alinhado ao uso em PROD (`fase`, `interacao`)
 * e às ações inseridas pelo app.
 */
export function tipoKanbanHistoricoFromAcao(acao: string | null | undefined): KanbanHistoricoTipo {
  const a = String(acao ?? '').trim();
  switch (a) {
    case 'fase_avancada':
    case 'fase_retrocedida':
      return 'fase';
    case 'interacao_criada':
    case 'interacao_editada':
    case 'interacao_arquivada':
      return 'interacao';
    case 'card_criado':
      return 'criacao';
    case 'card_arquivado':
      return 'arquivamento';
    case 'campo_alterado':
      return 'campo';
    case 'comentario_criado':
      return 'comentario';
    case 'tag_vinculada':
    case 'tag_removida':
    case 'links_gbox_acoplamento':
      return 'vinculo';
    case 'bastao_retorno':
      return 'bastao';
    case 'sla_justificado':
      return 'sla';
    case 'card_finalizado':
    case 'card_concluido':
      return 'finalizacao';
    default:
      return 'sistema';
  }
}
