import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { formatDataPtBr } from '@/lib/kanban/kanban-card-datas';
import {
  displayOrDash,
  fmtMoedaKanban,
  preObraDraftFromProcesso,
  type KanbanCardModalDetalhes,
} from '@/lib/kanban/kanban-card-modal-detalhes';
import { kanbanExibeSecaoCondominioSidebar } from '@/lib/kanban/kanban-secao-condominio';
import { isKanbanFunilLoteadoresRef } from '@/lib/kanban/loteadores-card-titulo';
import {
  formatNegocioPrazoDisplay,
  faseLabelFromOpcoes,
  negocioPrazoValoresFromProcessoModal,
  type FaseNegocioPrazoOpcao,
} from '@/lib/kanban/dados-negocio-prazo';
import { fundingDraftFromRow } from '@/lib/kanban/funding-card-fields';
import {
  FRANQUEADO_EMPRESA_STATUS_LABEL,
  formatContaBancariaEmpresa,
} from '@/lib/franqueado-empresas';
import {
  calcularSlaKanbanCard,
  tagSlaKanbanParaExibicao,
} from '@/lib/kanban/kanban-card-sla';
import type { CalculadoraResumoExecutivo } from '@/lib/kanban/calculadora-fases';
import type { RedeLoteadorFichaDraft } from '@/lib/rede-loteador-ficha-draft';
import type { MoniCapitalCadastroUpsertDados } from '@/lib/moni-capital-cadastros';

export type KanbanExportSectionId =
  | 'cronologia'
  | 'franqueado'
  | 'loteador'
  | 'moniCapital'
  | 'condominio'
  | 'novoNegocio'
  | 'dadosEmpresas'
  | 'preObra'
  | 'kanban'
  | 'calculadora';

export type KanbanExportFieldDef = {
  id: string;
  label: string;
  section: KanbanExportSectionId;
  order: number;
  getValue: (ctx: KanbanExportRowContext) => string;
  isVisible?: (ctx: KanbanExportVisibilityContext) => boolean;
};

export type KanbanExportVisibilityContext = {
  kanbanId: string;
  kanbanNome: string;
  isLegado: boolean;
  isLoteador: boolean;
  isFunding: boolean;
  exibirCondominio: boolean;
  fases: KanbanFase[];
  faseAtualId: string;
};

export type KanbanExportRowContext = {
  card: KanbanCardBrief;
  detalhes: KanbanCardModalDetalhes;
  fase: KanbanFase | null;
  slaTag: string;
  loteador: RedeLoteadorFichaDraft | null;
  moniCapital: MoniCapitalCadastroUpsertDados | null;
  calculadoraResumo: CalculadoraResumoExecutivo | null;
  fases: KanbanFase[];
  kanbanNome: string;
  visibility: KanbanExportVisibilityContext;
};

export const KANBAN_EXPORT_SECTION_LABELS: Record<KanbanExportSectionId, string> = {
  cronologia: 'ID e datas do funil',
  franqueado: 'Dados do Franqueado',
  loteador: 'Dados do Loteador',
  moniCapital: 'Dados do Investidor/Broker',
  condominio: 'Dados do Condomínio',
  novoNegocio: 'Dados do Negócio',
  dadosEmpresas: 'Dados das Empresas',
  preObra: 'Dados Pré Obra',
  kanban: 'Campos do Kanban',
  calculadora: 'Calculadora — resumo executivo',
};

function fmtDataHoraExport(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const data = d.toLocaleDateString('pt-BR');
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${data} ${hora}`;
}

function fmtDataExport(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim();
  if (!s) return '—';
  const fmt = formatDataPtBr(s.slice(0, 10));
  return fmt || s;
}

function enderecoCasaRede(rede: KanbanCardModalDetalhes['rede']): string {
  if (!rede) return '—';
  const parts = [
    rede.endereco_casa_frank,
    rede.endereco_casa_frank_numero,
    rede.endereco_casa_frank_complemento,
    rede.cep_casa_frank,
    rede.cidade_casa_frank,
    rede.estado_casa_frank,
  ]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

function fmtAtrasoAcumulado(uteis: number, corridos: number): string {
  if (uteis <= 0 && corridos <= 0) return 'Nenhum';
  const parts: string[] = [];
  if (uteis > 0) parts.push(`${uteis} d.u.`);
  if (corridos > 0) parts.push(`${corridos} d.c.`);
  return parts.join(' + ');
}

function fmtGargaloResumo(g: NonNullable<CalculadoraResumoExecutivo['maiorGargalo']>): string {
  const un = g.unidade === 'corridos' ? 'd.c.' : 'd.u.';
  return `${g.faseNome} +${g.dias} ${un}`;
}

function statusCardExport(card: KanbanCardBrief): string {
  if (card.arquivado) return 'Arquivado';
  if (card.concluido) return 'Concluído';
  return 'Ativo';
}

function boolExport(v: boolean | null | undefined): string {
  return v ? 'Sim' : 'Não';
}

function fasesParaNegocioPrazo(fases: KanbanFase[]): FaseNegocioPrazoOpcao[] {
  return fases.map((f) => ({ id: f.id, label: f.nome }));
}

function negocioLinks(proc: KanbanCardModalDetalhes['processo'], key: keyof NonNullable<typeof proc>): string {
  const v = proc?.[key];
  return displayOrDash(v != null ? String(v) : null);
}

function field(
  id: string,
  label: string,
  section: KanbanExportSectionId,
  order: number,
  getValue: (ctx: KanbanExportRowContext) => string,
  isVisible?: (ctx: KanbanExportVisibilityContext) => boolean,
): KanbanExportFieldDef {
  return { id, label, section, order, getValue, isVisible };
}

const ALL_KANBAN_EXPORT_FIELDS: KanbanExportFieldDef[] = [
  // —— Cronologia ——
  field('cronologia.card_id', 'ID do card', 'cronologia', 1, (ctx) => ctx.card.id),
  field('cronologia.data_entrada', 'Data de entrada no funil', 'cronologia', 2, (ctx) =>
    fmtDataHoraExport(ctx.card.created_at),
  ),
  field('cronologia.data_conclusao', 'Data de conclusão', 'cronologia', 3, (ctx) =>
    fmtDataHoraExport(ctx.card.concluido_em ?? null),
  ),

  // —— Franqueado ——
  field(
    'franqueado.responsavel_card',
    'Responsável (card)',
    'franqueado',
    1,
    (ctx) => displayOrDash(ctx.card.profiles?.full_name),
    (v) => !v.isLoteador && !v.isFunding,
  ),
  field('franqueado.n_franquia', 'Nº Franquia', 'franqueado', 2, (ctx) => displayOrDash(ctx.detalhes.rede?.n_franquia), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.modalidade', 'Modalidade', 'franqueado', 3, (ctx) => displayOrDash(ctx.detalhes.rede?.modalidade), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.nome', 'Nome', 'franqueado', 4, (ctx) => displayOrDash(ctx.detalhes.rede?.nome_completo), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.status', 'Status', 'franqueado', 5, (ctx) => displayOrDash(ctx.detalhes.rede?.status_franquia), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.classificacao', 'Classificação', 'franqueado', 6, (ctx) => displayOrDash(ctx.detalhes.rede?.classificacao_franqueado), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.area_atuacao', 'Área de atuação', 'franqueado', 7, (ctx) => displayOrDash(ctx.detalhes.rede?.area_atuacao), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.email', 'E-mail', 'franqueado', 8, (ctx) => displayOrDash(ctx.detalhes.rede?.email_frank), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.telefone', 'Telefone', 'franqueado', 9, (ctx) => displayOrDash(ctx.detalhes.rede?.telefone_frank), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.cpf', 'CPF', 'franqueado', 10, (ctx) => displayOrDash(ctx.detalhes.rede?.cpf_frank), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.nascimento', 'Nascimento', 'franqueado', 11, (ctx) => fmtDataExport(ctx.detalhes.rede?.data_nasc_frank), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.responsavel_comercial', 'Responsável comercial', 'franqueado', 12, (ctx) => displayOrDash(ctx.detalhes.rede?.responsavel_comercial), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.camiseta', 'Camiseta', 'franqueado', 13, (ctx) => displayOrDash(ctx.detalhes.rede?.tamanho_camisa_frank), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.ass_cof', 'Ass. COF', 'franqueado', 14, (ctx) => fmtDataExport(ctx.detalhes.rede?.data_ass_cof), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.ass_contrato', 'Ass. Contrato', 'franqueado', 15, (ctx) => fmtDataExport(ctx.detalhes.rede?.data_ass_contrato), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.expiracao', 'Expiração', 'franqueado', 16, (ctx) => fmtDataExport(ctx.detalhes.rede?.data_expiracao_franquia), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.endereco', 'Endereço (casa)', 'franqueado', 17, (ctx) => enderecoCasaRede(ctx.detalhes.rede), (v) => !v.isLoteador && !v.isFunding),
  field('franqueado.socios', 'Sócios', 'franqueado', 18, (ctx) => displayOrDash(ctx.detalhes.rede?.socios), (v) => !v.isLoteador && !v.isFunding),

  // —— Loteador ——
  field('loteador.nome', 'Nome', 'loteador', 1, (ctx) => displayOrDash(ctx.loteador?.nome), (v) => v.isLoteador),
  field('loteador.cnpj', 'CNPJ', 'loteador', 2, (ctx) => displayOrDash(ctx.loteador?.cnpj), (v) => v.isLoteador),
  field('loteador.cidade', 'Cidade', 'loteador', 3, (ctx) => displayOrDash(ctx.loteador?.cidade), (v) => v.isLoteador),
  field('loteador.estado', 'Estado', 'loteador', 4, (ctx) => displayOrDash(ctx.loteador?.estado), (v) => v.isLoteador),
  field('loteador.contato_nome', 'Contato', 'loteador', 5, (ctx) => displayOrDash(ctx.loteador?.contato_nome), (v) => v.isLoteador),
  field('loteador.contato_telefone', 'Telefone contato', 'loteador', 6, (ctx) => displayOrDash(ctx.loteador?.contato_telefone), (v) => v.isLoteador),
  field('loteador.contato_email', 'E-mail contato', 'loteador', 7, (ctx) => displayOrDash(ctx.loteador?.contato_email), (v) => v.isLoteador),
  field('loteador.status', 'Status', 'loteador', 8, (ctx) => displayOrDash(ctx.loteador?.status), (v) => v.isLoteador),
  field('loteador.interlocutor_nome', 'Interlocutor', 'loteador', 9, (ctx) => displayOrDash(ctx.loteador?.interlocutor_nome), (v) => v.isLoteador),
  field('loteador.condominio_nome', 'Condomínio (loteador)', 'loteador', 10, (ctx) => displayOrDash(ctx.loteador?.condominio_nome), (v) => v.isLoteador),
  field('loteador.observacoes', 'Observações', 'loteador', 11, (ctx) => displayOrDash(ctx.loteador?.observacoes), (v) => v.isLoteador),

  // —— Moní Capital / Funding cadastro ——
  field('moniCapital.broker_nome', 'Broker — Nome', 'moniCapital', 1, (ctx) => displayOrDash(ctx.moniCapital?.broker_nome), (v) => v.isFunding && !v.isLegado),
  field('moniCapital.broker_email', 'Broker — E-mail', 'moniCapital', 2, (ctx) => displayOrDash(ctx.moniCapital?.broker_email), (v) => v.isFunding && !v.isLegado),
  field('moniCapital.broker_telefone', 'Broker — Telefone', 'moniCapital', 3, (ctx) => displayOrDash(ctx.moniCapital?.broker_telefone), (v) => v.isFunding && !v.isLegado),
  field('moniCapital.investidor_nome', 'Investidor — Nome', 'moniCapital', 4, (ctx) => displayOrDash(ctx.moniCapital?.investidor_nome), (v) => v.isFunding && !v.isLegado),
  field('moniCapital.investidor_email', 'Investidor — E-mail', 'moniCapital', 5, (ctx) => displayOrDash(ctx.moniCapital?.investidor_email), (v) => v.isFunding && !v.isLegado),
  field('moniCapital.investidor_telefone', 'Investidor — Telefone', 'moniCapital', 6, (ctx) => displayOrDash(ctx.moniCapital?.investidor_telefone), (v) => v.isFunding && !v.isLegado),

  // —— Condomínio ——
  field('condominio.nome', 'Condomínio', 'condominio', 1, (ctx) => {
    const proc = ctx.detalhes.processo;
    const cardNome = (ctx.card as { nome_condominio?: string | null }).nome_condominio;
    return displayOrDash(proc?.nome_condominio ?? cardNome);
  }, (v) => v.exibirCondominio),
  field('condominio.quadra', 'Quadra', 'condominio', 2, (ctx) => {
    const proc = ctx.detalhes.processo;
    return displayOrDash(proc?.quadra ?? null);
  }, (v) => v.exibirCondominio),
  field('condominio.lote', 'Lote', 'condominio', 3, (ctx) => {
    const proc = ctx.detalhes.processo;
    return displayOrDash(proc?.lote ?? null);
  }, (v) => v.exibirCondominio),

  // —— Negócio (Funding) ——
  field('novoNegocio.funding_tipo', 'Tipo', 'novoNegocio', 1, (ctx) => {
    const d = fundingDraftFromRow(ctx.card);
    return displayOrDash(d.funding_tipo);
  }, (v) => v.isFunding && !v.isLegado),
  field('novoNegocio.funding_nome', 'Nome', 'novoNegocio', 2, (ctx) => displayOrDash(ctx.card.titulo), (v) => v.isFunding && !v.isLegado),
  field('novoNegocio.funding_localizacao', 'Localização', 'novoNegocio', 3, (ctx) => displayOrDash(ctx.card.funding_localizacao), (v) => v.isFunding && !v.isLegado),
  field('novoNegocio.funding_descritivo', 'Descritivo', 'novoNegocio', 4, (ctx) => displayOrDash(ctx.card.funding_descritivo), (v) => v.isFunding && !v.isLegado),
  field('novoNegocio.proxima_atividade', 'Próxima atividade', 'novoNegocio', 5, (ctx) => displayOrDash(ctx.card.proxima_atividade), (v) => v.isFunding && !v.isLegado),
  field('novoNegocio.prazo_atividade', 'Prazo', 'novoNegocio', 6, (ctx) => fmtDataExport(ctx.card.prazo_atividade), (v) => v.isFunding && !v.isLegado),

  // —— Negócio (processo) ——
  field('novoNegocio.tipo_negociacao', 'Tipo de negociação', 'novoNegocio', 10, (ctx) => displayOrDash(ctx.detalhes.processo?.tipo_aquisicao_terreno), (v) => !v.isFunding),
  field('novoNegocio.valor_terreno', 'Valor do Terreno', 'novoNegocio', 11, (ctx) => fmtMoedaKanban(ctx.detalhes.processo?.valor_terreno), (v) => !v.isFunding),
  field('novoNegocio.vgv', 'VGV pretendido', 'novoNegocio', 12, (ctx) => fmtMoedaKanban(ctx.detalhes.processo?.vgv_pretendido), (v) => !v.isFunding),
  field('novoNegocio.produto', 'Produto / Modelo', 'novoNegocio', 13, (ctx) => displayOrDash(ctx.detalhes.processo?.produto_modelo_casa), (v) => !v.isFunding),
  field('novoNegocio.link_drive', 'Link pasta no Drive', 'novoNegocio', 14, (ctx) => negocioLinks(ctx.detalhes.processo, 'link_pasta_drive'), (v) => !v.isFunding),
  field('novoNegocio.prazo_opcao', 'Prazo Opção', 'novoNegocio', 15, (ctx) => {
    const proc = ctx.detalhes.processo;
    if (!proc) return '—';
    const prazos = negocioPrazoValoresFromProcessoModal(proc, fasesParaNegocioPrazo(ctx.fases));
    return formatNegocioPrazoDisplay(
      prazos.prazo_opcao,
      faseLabelFromOpcoes(prazos.prazo_opcao.faseId, fasesParaNegocioPrazo(ctx.fases)),
    );
  }, (v) => !v.isFunding),
  field('novoNegocio.prazo_instrumento', 'Prazo Instrumento Garantidor', 'novoNegocio', 16, (ctx) => {
    const proc = ctx.detalhes.processo;
    if (!proc) return '—';
    const prazos = negocioPrazoValoresFromProcessoModal(proc, fasesParaNegocioPrazo(ctx.fases));
    return formatNegocioPrazoDisplay(
      prazos.prazo_instrumento_garantidor,
      faseLabelFromOpcoes(prazos.prazo_instrumento_garantidor.faseId, fasesParaNegocioPrazo(ctx.fases)),
    );
  }, (v) => !v.isFunding),
  field('novoNegocio.negociacao_linhas_qtd', 'Linhas de negociação (qtd.)', 'novoNegocio', 17, (ctx) => {
    const n = ctx.detalhes.processo?.negociacao_linhas?.length ?? 0;
    return String(n);
  }, (v) => !v.isFunding),
  field('novoNegocio.link_bca', 'Link BCA', 'novoNegocio', 18, (ctx) => negocioLinks(ctx.detalhes.processo, 'link_bca'), (v) => !v.isFunding),
  field('novoNegocio.link_gbox', 'Link GBox', 'novoNegocio', 19, (ctx) => negocioLinks(ctx.detalhes.processo, 'link_gbox'), (v) => !v.isFunding),
  field('novoNegocio.link_mapa_competidores', 'Link mapa competidores', 'novoNegocio', 20, (ctx) => negocioLinks(ctx.detalhes.processo, 'link_mapa_competidores'), (v) => !v.isFunding),

  // —— Empresas ——
  field('dadosEmpresas.incorporadora_razao', 'Incorporadora — Razão social', 'dadosEmpresas', 1, (ctx) => displayOrDash(ctx.detalhes.empresas?.incorporadora?.razao_social), (v) => !v.isLoteador),
  field('dadosEmpresas.incorporadora_cnpj', 'Incorporadora — CNPJ', 'dadosEmpresas', 2, (ctx) => displayOrDash(ctx.detalhes.empresas?.incorporadora?.cnpj), (v) => !v.isLoteador),
  field('dadosEmpresas.incorporadora_status', 'Incorporadora — Status', 'dadosEmpresas', 3, (ctx) => {
    const st = ctx.detalhes.empresas?.incorporadora?.status;
    return st ? FRANQUEADO_EMPRESA_STATUS_LABEL[st] : '—';
  }, (v) => !v.isLoteador),
  field('dadosEmpresas.gestora_razao', 'Gestora — Razão social', 'dadosEmpresas', 4, (ctx) => displayOrDash(ctx.detalhes.empresas?.gestora?.razao_social), (v) => !v.isLoteador),
  field('dadosEmpresas.gestora_cnpj', 'Gestora — CNPJ', 'dadosEmpresas', 5, (ctx) => displayOrDash(ctx.detalhes.empresas?.gestora?.cnpj), (v) => !v.isLoteador),
  field('dadosEmpresas.spe_nome_projeto', 'SPE — Nome do projeto', 'dadosEmpresas', 6, (ctx) => displayOrDash(ctx.detalhes.empresas?.spe?.nome_projeto), (v) => !v.isLoteador),
  field('dadosEmpresas.spe_razao', 'SPE — Razão social', 'dadosEmpresas', 7, (ctx) => displayOrDash(ctx.detalhes.empresas?.spe?.razao_social), (v) => !v.isLoteador),
  field('dadosEmpresas.spe_cnpj', 'SPE — CNPJ', 'dadosEmpresas', 8, (ctx) => displayOrDash(ctx.detalhes.empresas?.spe?.cnpj), (v) => !v.isLoteador),
  field('dadosEmpresas.spe_status', 'SPE — Status', 'dadosEmpresas', 9, (ctx) => {
    const st = ctx.detalhes.empresas?.spe?.status;
    return st ? FRANQUEADO_EMPRESA_STATUS_LABEL[st] : '—';
  }, (v) => !v.isLoteador),
  field('dadosEmpresas.spe_conta', 'SPE — Conta bancária', 'dadosEmpresas', 10, (ctx) => {
    const spe = ctx.detalhes.empresas?.spe;
    if (!spe) return '—';
    return formatContaBancariaEmpresa(
      spe.conta_banco,
      spe.conta_agencia,
      spe.conta_numero,
      spe.conta_pix_tipo,
      spe.conta_pix_chave,
    );
  }, (v) => !v.isLoteador),

  // —— Pré Obra ——
  ...([
    ['preObra.prev_condominio', 'Previsão de Aprovação no Condomínio', 'previsao_aprovacao_condominio'],
    ['preObra.prev_prefeitura', 'Previsão de Aprovação na Prefeitura', 'previsao_aprovacao_prefeitura'],
    ['preObra.prev_alvara', 'Previsão de Emissão do Alvará', 'previsao_emissao_alvara'],
    ['preObra.prev_credito_obra', 'Envio para Crédito Obra', 'previsao_liberacao_credito_obra'],
    ['preObra.prev_inicio_obra', 'Previsão de Início de Obra', 'previsao_inicio_obra'],
    ['preObra.data_condominio', 'Data de Aprovação no Condomínio', 'data_aprovacao_condominio'],
    ['preObra.data_prefeitura', 'Data de Aprovação na Prefeitura', 'data_aprovacao_prefeitura'],
    ['preObra.data_alvara', 'Data de Emissão do Alvará', 'data_emissao_alvara'],
    ['preObra.data_credito', 'Data de aprovação do crédito', 'data_aprovacao_credito'],
  ] as const).map(([id, label, key], idx) =>
    field(id, label, 'preObra', idx + 1, (ctx) => {
      const draft = preObraDraftFromProcesso(ctx.detalhes.processo);
      return fmtDataExport(draft[key]);
    }, (v) => !v.isLoteador),
  ),

  // —— Kanban ——
  field('kanban.titulo', 'Título do card', 'kanban', 1, (ctx) => displayOrDash(ctx.card.titulo)),
  field('kanban.fase', 'Fase', 'kanban', 2, (ctx) => displayOrDash(ctx.fase?.nome)),
  field('kanban.tags', 'Tags', 'kanban', 3, (ctx) => {
    const tags = ctx.card.tagsCard?.map((t) => t.nome).filter(Boolean) ?? [];
    return tags.length > 0 ? tags.join('; ') : '—';
  }),
  field('kanban.status', 'Status', 'kanban', 4, (ctx) => statusCardExport(ctx.card)),
  field('kanban.responsavel_fase', 'Responsável da fase', 'kanban', 5, (ctx) =>
    displayOrDash(ctx.card.responsavel_fase_nome),
  ),
  field('kanban.arquivado', 'Arquivado', 'kanban', 6, (ctx) => boolExport(ctx.card.arquivado)),
  field('kanban.concluido', 'Concluído', 'kanban', 7, (ctx) => boolExport(ctx.card.concluido)),
  field('kanban.sla', 'SLA da fase', 'kanban', 8, (ctx) => ctx.slaTag),
  field('kanban.motivo_arquivamento', 'Motivo arquivamento', 'kanban', 9, (ctx) =>
    displayOrDash(ctx.card.motivo_arquivamento),
  ),
  field('kanban.resultado', 'Resultado', 'kanban', 10, (ctx) => displayOrDash(ctx.card.resultado)),

  // —— Calculadora ——
  field(
    'calculadora.fase_atual',
    'Fase atual (Calculadora)',
    'calculadora',
    1,
    (ctx) => displayOrDash(ctx.calculadoraResumo?.faseAtualNome),
    (v) => !v.isLoteador,
  ),
  field('calculadora.dias_na_fase', 'Dias na fase', 'calculadora', 2, (ctx) => {
    const r = ctx.calculadoraResumo;
    if (r?.diasNaFase == null) return '—';
    const un = r.diasNaFaseTipo === 'corridos' ? 'd.c.' : 'd.u.';
    return `${r.diasNaFase} ${un}`;
  }, (v) => !v.isLoteador),
  field(
    'calculadora.status_geral',
    'Status geral',
    'calculadora',
    3,
    (ctx) => displayOrDash(ctx.calculadoraResumo?.statusGeralLabel),
    (v) => !v.isLoteador,
  ),
  field('calculadora.atraso_acumulado', 'Atraso acumulado', 'calculadora', 4, (ctx) => {
    const r = ctx.calculadoraResumo;
    if (!r) return '—';
    return fmtAtrasoAcumulado(r.atrasoAcumuladoUteis, r.atrasoAcumuladoCorridos);
  }, (v) => !v.isLoteador),
  field('calculadora.percentual', 'Progresso', 'calculadora', 5, (ctx) => {
    const r = ctx.calculadoraResumo;
    if (!r) return '—';
    return `${r.percentualConcluido}% (${r.fasesConcluidas}/${r.fasesTotal})`;
  }, (v) => !v.isLoteador),
  field(
    'calculadora.previsao_conclusao',
    'Previsão conclusão',
    'calculadora',
    6,
    (ctx) => fmtDataExport(ctx.calculadoraResumo?.previsaoConclusao),
    (v) => !v.isLoteador,
  ),
  field('calculadora.maior_gargalo', 'Maior gargalo', 'calculadora', 7, (ctx) => {
    const g = ctx.calculadoraResumo?.maiorGargalo;
    return g ? fmtGargaloResumo(g) : '—';
  }, (v) => !v.isLoteador),
  field(
    'calculadora.dados_parciais',
    'Dados parciais',
    'calculadora',
    8,
    (ctx) => boolExport(ctx.calculadoraResumo?.dadosParciais),
    (v) => !v.isLoteador,
  ),
];

export function buildKanbanExportVisibilityContext(input: {
  kanbanId: string;
  kanbanNome: string;
  card: KanbanCardBrief;
  fases: KanbanFase[];
}): KanbanExportVisibilityContext {
  const isLegado = input.card.origem === 'legado';
  const isLoteador = !isLegado && isKanbanFunilLoteadoresRef(input.kanbanId, input.kanbanNome);
  const isFunding =
    input.card.kanban_id === KANBAN_IDS.FUNDING || input.kanbanNome === 'Funding';
  const faseAtual = input.fases.find((f) => f.id === input.card.fase_id) ?? null;
  const exibirCondominio = kanbanExibeSecaoCondominioSidebar({
    isLegado,
    kanbanId: input.kanbanId,
    kanbanNome: input.kanbanNome,
    faseAtual,
    fases: input.fases,
  });

  return {
    kanbanId: input.kanbanId,
    kanbanNome: input.kanbanNome,
    isLegado,
    isLoteador,
    isFunding,
    exibirCondominio,
    fases: input.fases,
    faseAtualId: input.card.fase_id,
  };
}

/** Campos visíveis para o funil/card (ordem global: seção → order). */
export function listKanbanExportFieldsVisible(ctx: KanbanExportVisibilityContext): KanbanExportFieldDef[] {
  return ALL_KANBAN_EXPORT_FIELDS.filter((f) => (f.isVisible ? f.isVisible(ctx) : true)).sort(
    (a, b) => {
      const sectionOrder: KanbanExportSectionId[] = [
        'cronologia',
        'franqueado',
        'loteador',
        'moniCapital',
        'condominio',
        'novoNegocio',
        'dadosEmpresas',
        'preObra',
        'kanban',
        'calculadora',
      ];
      const sa = sectionOrder.indexOf(a.section);
      const sb = sectionOrder.indexOf(b.section);
      if (sa !== sb) return sa - sb;
      return a.order - b.order;
    },
  );
}

export function resolveKanbanExportFields(
  selectedFieldIds: string[],
  visibility: KanbanExportVisibilityContext,
): KanbanExportFieldDef[] {
  const visible = listKanbanExportFieldsVisible(visibility);
  const idSet = new Set(selectedFieldIds);
  return visible.filter((f) => idSet.has(f.id));
}

export function defaultKanbanExportFieldIds(visibility: KanbanExportVisibilityContext): string[] {
  return listKanbanExportFieldsVisible(visibility).map((f) => f.id);
}

export function buildKanbanExportRow(
  ctx: KanbanExportRowContext,
  fields: KanbanExportFieldDef[],
): Record<string, string> {
  const row: Record<string, string> = {};
  for (const f of fields) {
    row[f.label] = f.getValue(ctx);
  }
  return row;
}

export function groupKanbanExportFieldsBySection(
  fields: KanbanExportFieldDef[],
): { section: KanbanExportSectionId; label: string; fields: KanbanExportFieldDef[] }[] {
  const order: KanbanExportSectionId[] = [
    'cronologia',
    'franqueado',
    'loteador',
    'moniCapital',
    'condominio',
    'novoNegocio',
    'dadosEmpresas',
    'preObra',
    'kanban',
    'calculadora',
  ];
  const map = new Map<KanbanExportSectionId, KanbanExportFieldDef[]>();
  for (const f of fields) {
    const list = map.get(f.section) ?? [];
    list.push(f);
    map.set(f.section, list);
  }
  return order
    .filter((s) => map.has(s))
    .map((section) => ({
      section,
      label: KANBAN_EXPORT_SECTION_LABELS[section],
      fields: (map.get(section) ?? []).sort((a, b) => a.order - b.order),
    }));
}
