'use client';

import { useState } from 'react';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  carregarDadosNegocioLivro,
  listarCardsDoFunilLivro,
  type CardFunilLivro,
  type DadosNegocioLivro,
  type FunilLivroOpcao,
} from '@/app/apresentacoes/book-empreendimento/dados-negocio-actions';
import {
  faseLabelFromOpcoes,
  formatNegocioPrazoDisplay,
  negocioPrazoValoresFromProcessoModal,
} from '@/lib/kanban/dados-negocio-prazo';
import { displayOrDash, fmtMoedaKanban } from '@/lib/kanban/kanban-card-modal-detalhes';
import { isTipoPermutaParcial, isTipoPermutaVGV } from '@/lib/kanban/tipo-negociacao-terreno';

function dataBr(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim().slice(0, 10);
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function metro(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(Number(valor))) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(valor))} m²`;
}

function percentual(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(Number(valor))) return '—';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(valor))}%`;
}

function rotuloCard(card: CardFunilLivro): string {
  const titulo = card.titulo || card.nome_condominio || '(sem título)';
  const local = [card.quadra ? `Q ${card.quadra}` : '', card.lote ? `L ${card.lote}` : ''].filter(Boolean).join(' ');
  const condo = card.nome_condominio && card.nome_condominio !== titulo ? card.nome_condominio : '';
  const extra = [condo, local, card.arquivado ? 'arquivado' : ''].filter(Boolean).join(' · ');
  return extra ? `${titulo} — ${extra}` : titulo;
}

function camposDoProcesso(dados: DadosNegocioLivro): { key: string; label: string; valor: string; largo?: boolean }[] {
  const proc = dados.processo;
  if (!proc) return [];
  const fases = Array.isArray(dados.fases) ? dados.fases : [];
  const prazos = negocioPrazoValoresFromProcessoModal(proc, fases);
  const tipo = proc.tipo_aquisicao_terreno;
  const negociacao = (Array.isArray(proc.negociacao_linhas) ? proc.negociacao_linhas : [])
    .map((linha) => {
      const condicao = String(linha?.condicao ?? '').trim();
      const valor = String(linha?.valor ?? '').trim();
      const data = dataBr(linha?.dataPagamento);
      const partes = [condicao, valor ? fmtMoedaKanban(valor) : '', data === '—' ? '' : data].filter(Boolean);
      return partes.join(' · ');
    })
    .filter(Boolean)
    .join('\n');

  const campos: { key: string; label: string; valor: string; largo?: boolean }[] = [
    { key: 'tipo', label: 'Tipo de negociação', valor: displayOrDash(tipo) },
    { key: 'drive', label: 'Pasta do Drive', valor: displayOrDash(proc.link_pasta_drive), largo: true },
    { key: 'valor_terreno', label: 'Valor do Terreno', valor: fmtMoedaKanban(proc.valor_terreno) },
  ];
  if (isTipoPermutaParcial(tipo)) {
    campos.push({
      key: 'pct_parcial',
      label: '% Compra Parcial Terreno',
      valor: percentual(proc.pct_compra_parcial_terreno),
    });
  }
  if (isTipoPermutaVGV(tipo)) {
    campos.push({
      key: 'pct_vgv',
      label: '% VGV Terrenista',
      valor: percentual(proc.pct_vgv_terrenista),
    });
  }
  campos.push(
    { key: 'm2_terreno', label: 'M² Terreno', valor: metro(proc.m2_terreno) },
    { key: 'contratos', label: 'Contratos', valor: displayOrDash(proc.link_opcao_permuta), largo: true },
    {
      key: 'prazo_opcao',
      label: 'Prazo Opção',
      valor: formatNegocioPrazoDisplay(
        prazos.prazo_opcao,
        faseLabelFromOpcoes(prazos.prazo_opcao.faseId, fases),
      ),
    },
    { key: 'obs_opcao', label: 'Obs. Opção', valor: displayOrDash(proc.obs_opcao), largo: true },
    { key: 'data_opcao', label: 'Data Ass. Opção Terreno', valor: dataBr(proc.data_ass_opcao_terreno) },
    { key: 'produto', label: 'Produto / Modelo', valor: displayOrDash(proc.produto_modelo_casa) },
    {
      key: 'extrato',
      label: 'Extrato Modelo Configurado',
      valor: displayOrDash(proc.extrato_modelo_configurado),
      largo: true,
    },
    { key: 'm2_casa', label: 'M² Casa', valor: metro(proc.m2_casa) },
    { key: 'custo_obra', label: 'Custo da Obra', valor: fmtMoedaKanban(proc.custo_obra) },
    { key: 'bca', label: 'BCA', valor: displayOrDash(proc.link_bca), largo: true },
    { key: 'mapa', label: 'Mapa de Competidores', valor: displayOrDash(proc.link_mapa_competidores), largo: true },
    { key: 'vgv', label: 'VGV pretendido', valor: fmtMoedaKanban(proc.vgv_pretendido) },
    { key: 'recompra', label: 'Valor Recompra', valor: fmtMoedaKanban(proc.valor_recompra) },
    { key: 'acoplamento', label: 'Acoplamento', valor: displayOrDash(proc.link_acoplamento), largo: true },
    { key: 'gbox', label: 'GBOX', valor: displayOrDash(proc.link_gbox), largo: true },
    { key: 'gbox_oz', label: 'GBOX Ozempic', valor: displayOrDash(proc.link_gbox_ozempic), largo: true },
    {
      key: 'comite',
      label: 'Apresentação Comitê',
      valor: displayOrDash(proc.link_apresentacao_comite),
      largo: true,
    },
    { key: 'data_comite', label: 'Data Aprovação Comitê', valor: dataBr(proc.data_aprovacao_comite) },
    {
      key: 'prazo_inst',
      label: 'Prazo Instrumento Garantidor',
      valor: formatNegocioPrazoDisplay(
        prazos.prazo_instrumento_garantidor,
        faseLabelFromOpcoes(prazos.prazo_instrumento_garantidor.faseId, fases),
      ),
    },
    {
      key: 'obs_inst',
      label: 'Obs. Instrumento Garantidor',
      valor: displayOrDash(proc.obs_instrumento_garantidor),
      largo: true,
    },
    { key: 'data_contrato', label: 'Data Ass. Contrato Terreno', valor: dataBr(proc.data_ass_contrato_terreno) },
    { key: 'negociacao', label: 'Negociação', valor: negociacao || '—', largo: true },
  );
  return campos;
}

export function DadosNegocioBookSecao({ funis = [] }: { funis?: FunilLivroOpcao[] }) {
  const [funilId, setFunilId] = useState('');
  const [cards, setCards] = useState<CardFunilLivro[]>([]);
  const [cardId, setCardId] = useState('');
  const [dados, setDados] = useState<DadosNegocioLivro | null>(null);
  const [carregandoCards, setCarregandoCards] = useState(false);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function selecionarFunil(id: string) {
    setFunilId(id);
    setCardId('');
    setCards([]);
    setDados(null);
    setErro(null);
    if (!id) return;
    setCarregandoCards(true);
    try {
      const res = await listarCardsDoFunilLivro(id);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setCards(Array.isArray(res.cards) ? res.cards : []);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar os cards do funil.');
    } finally {
      setCarregandoCards(false);
    }
  }

  async function selecionarCard(id: string) {
    setCardId(id);
    setDados(null);
    setErro(null);
    if (!id) return;
    setCarregandoDados(true);
    try {
      const res = await carregarDadosNegocioLivro(id);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setDados(res.dados);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar os dados do negócio.');
    } finally {
      setCarregandoDados(false);
    }
  }

  let campos: { key: string; label: string; valor: string; largo?: boolean }[] = [];
  let erroLeitura: string | null = null;
  if (dados) {
    try {
      campos = camposDoProcesso(dados);
    } catch (falha) {
      erroLeitura = falha instanceof Error ? falha.message : 'Não foi possível ler os dados do negócio.';
    }
  }
  const semProcesso = Boolean(dados && !dados.processo);

  return (
    <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-[var(--moni-navy-800)]">Dados do Negócio</h2>
      <label className="mb-1 block text-xs text-stone-400" htmlFor="funil-livro">
        Funil
      </label>
      <SearchableSelect
        id="funil-livro"
        className="w-full"
        size="md"
        value={funilId}
        onChange={(id) => void selecionarFunil(id)}
        placeholder="Digite para buscar o funil"
        searchPlaceholder="Nome do funil"
        aria-label="Buscar funil"
        triggerClassName="min-h-11 w-full border-[var(--moni-border)] text-[var(--moni-navy-800)]"
        options={funis.map((funil) => ({ value: funil.id, label: funil.nome }))}
      />

      <label className="mb-1 mt-4 block text-xs text-stone-400" htmlFor="card-livro">
        Negócio
      </label>
      <SearchableSelect
        id="card-livro"
        className="w-full"
        size="md"
        value={cardId}
        onChange={(id) => void selecionarCard(id)}
        disabled={!funilId || carregandoCards}
        placeholder={
          !funilId
            ? 'Escolha o funil para buscar o card'
            : carregandoCards
              ? 'Carregando cards…'
              : 'Digite para buscar o card'
        }
        searchPlaceholder="Título, condomínio, quadra ou lote"
        aria-label="Buscar card do funil"
        triggerClassName="min-h-11 w-full border-[var(--moni-border)] text-[var(--moni-navy-800)]"
        options={cards.map((card) => ({
          value: String(card.id),
          label: rotuloCard(card),
          keywords: [card.titulo, card.nome_condominio, card.quadra, card.lote, card.id]
            .filter((parte) => parte != null && parte !== '')
            .join(' '),
        }))}
      />

      {erro || erroLeitura ? <p className="mt-3 text-xs text-red-700">{erro || erroLeitura}</p> : null}
      {carregandoDados ? <p className="mt-3 text-xs text-stone-400">Carregando dados do negócio…</p> : null}
      {semProcesso ? (
        <p className="mt-3 text-xs text-stone-400">Sem processo vinculado — dados de negócio indisponíveis.</p>
      ) : null}
      {campos.length > 0 ? (
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {campos.map((campo) => (
            <div key={campo.key} className={campo.largo ? 'sm:col-span-2' : ''}>
              <dt className="text-[11px] font-medium text-stone-400">{campo.label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap break-all text-sm text-[var(--moni-navy-800)]">{campo.valor}</dd>
            </div>
          ))}
        </dl>
      ) : !carregandoDados && !semProcesso ? (
        <p className="mt-3 text-xs text-stone-400">
          Escolha o funil e o card para ver os campos de Dados do Negócio.
        </p>
      ) : null}
    </div>
  );
}
