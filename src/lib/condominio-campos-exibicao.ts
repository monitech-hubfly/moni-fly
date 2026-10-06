import {
  formatCondominioInteiro,
  formatTicketCadastro,
  type CondominioRow,
} from '@/lib/condominios';
import { fmtPrazoAprovacaoLabel } from '@/lib/kanban/condominio-prazos-aprovacao';

function texto(value: string | null | undefined): string {
  const s = (value ?? '').trim();
  return s || '—';
}

function dataBr(iso: string | null | undefined): string {
  const s = (iso ?? '').trim().slice(0, 10);
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

export type CampoExibicaoCondominio = {
  key: string;
  label: string;
  valor: (row: CondominioRow) => string;
};

/** Mesmos campos do Cadastro de Condomínios, na ordem do formulário. */
export const CAMPOS_EXIBICAO_CONDOMINIO: CampoExibicaoCondominio[] = [
  { key: 'nome', label: 'Nome', valor: (r) => texto(r.nome) },
  { key: 'endereco', label: 'Endereço', valor: (r) => texto(r.endereco) },
  { key: 'numero', label: 'Número', valor: (r) => texto(r.numero) },
  { key: 'cep', label: 'CEP', valor: (r) => texto(r.cep) },
  { key: 'cidade', label: 'Cidade', valor: (r) => texto(r.cidade) },
  { key: 'estado', label: 'Estado', valor: (r) => texto(r.estado) },
  { key: 'descricao_breve', label: 'Descrição breve', valor: (r) => texto(r.descricao_breve) },
  { key: 'ticket_medio_lote', label: 'Ticket médio lote', valor: (r) => formatTicketCadastro(r.ticket_medio_lote) },
  { key: 'ticket_medio_casas', label: 'Ticket médio casas', valor: (r) => formatTicketCadastro(r.ticket_medio_casas) },
  { key: 'valor_tx_condominio', label: 'Valor Tx Condomínio', valor: (r) => formatTicketCadastro(r.valor_tx_condominio) },
  {
    key: 'estimativa_casas_vendidas_ano',
    label: 'Est. casas vendidas/ano',
    valor: (r) => formatCondominioInteiro(r.estimativa_casas_vendidas_ano),
  },
  {
    key: 'extrato_como_eram_casas',
    label: 'Extrato — Como eram essas casas',
    valor: (r) => texto(r.extrato_como_eram_casas),
  },
  {
    key: 'extrato_tempo_venda',
    label: 'Extrato — Quanto tempo demorou pra vender',
    valor: (r) => texto(r.extrato_tempo_venda),
  },
  {
    key: 'data_lancamento_vendas',
    label: 'Data de lançamento (vendas de lote)',
    valor: (r) => dataBr(r.data_lancamento_vendas),
  },
  {
    key: 'data_liberacao_tvo',
    label: 'Data liberação TVO (permissão de construir casas)',
    valor: (r) => dataBr(r.data_liberacao_tvo),
  },
  { key: 'quantidade_lotes', label: 'Quantidade de lotes', valor: (r) => formatCondominioInteiro(r.quantidade_lotes) },
  {
    key: 'metragem_lotes',
    label: 'Metragem dos lotes (média ou faixas)',
    valor: (r) => texto(r.metragem_lotes),
  },
  {
    key: 'metragem_casas',
    label: 'Metragem / tipologia média das casas (média ou faixas)',
    valor: (r) => texto(r.metragem_casas),
  },
  {
    key: 'planta_cadastral',
    label: 'Planta cadastral do condomínio / lotes com medidas (frente e lateral)',
    valor: (r) => texto(r.planta_cadastral),
  },
  { key: 'manual_obras', label: 'Manual de obras', valor: (r) => texto(r.manual_obras) },
  {
    key: 'casas_concorrentes',
    label: 'Exemplo / links de casas concorrentes',
    valor: (r) => texto(r.casas_concorrentes),
  },
  {
    key: 'prazo_aprovacao_condominio',
    label: 'Prazo de Aprovação no Condomínio',
    valor: (r) =>
      fmtPrazoAprovacaoLabel(r.prazo_aprovacao_condominio_dias, r.prazo_aprovacao_condominio_sla_tipo),
  },
  {
    key: 'prazo_aprovacao_prefeitura',
    label: 'Prazo de Aprovação na Prefeitura',
    valor: (r) =>
      fmtPrazoAprovacaoLabel(r.prazo_aprovacao_prefeitura_dias, r.prazo_aprovacao_prefeitura_sla_tipo),
  },
];
