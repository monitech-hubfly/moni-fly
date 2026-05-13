'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcularStatusSLA } from '@/lib/dias-uteis';
import {
  atualizarEtapaPainel,
  getRelacionadosProcesso,
  getResumoProcessoStep1,
  updateDadosPreObra,
  type ProcessoRelacionado,
  type ProcessoResumoStep1,
} from './actions';
import {
  PAINEL_COLUMNS,
  getOrderedKeysForPainelCardModal,
  getPainelColumnSlaDiasUteis,
  isPainelKanbanDropBlocked,
  type PainelCardModalBoard,
  type PainelColumnKey,
} from './painelColumns';
import { ATIVIDADE_TIMES } from '@/lib/atividade-times';
import { itemMatchesResponsavelFilter, itemMatchesTimeFilter } from '@/lib/checklist-atividade-arrays';
import { addChecklistItem, removeChecklistItem, updateChecklistItemStatus } from './card-actions';
import { CardDetalheModal, isChecklistAnexosEstruturalCard } from './CardDetalheModal';
import { AtividadeVinculadaCard } from '@/components/AtividadeVinculadaCard';
import { AtividadeVinculadaIcon } from '@/components/AtividadeVinculadaIcon';
import { AtividadeVinculadaStatusPill } from '@/components/AtividadeVinculadaStatusPill';
import {
  labelChecklistStatusParaPill,
  resolveAtividadeVinculadaKind,
} from '@/lib/atividade-vinculada-visual';
import {
  checklistPassaFiltroLista,
  ordenarItensChecklistLista,
  type FiltroSituacaoChecklist,
  type ListaAtividadesCard,
} from '@/lib/atividades-card-listagem';
import { ProcessoQuatroSecoesDados, type DadosPreObraFormState } from './ProcessoQuatroSecoesDados';

const EMPTY_PRE_OBRA_FORM: DadosPreObraFormState = {
  previsao_aprovacao_condominio: '',
  previsao_aprovacao_prefeitura: '',
  previsao_emissao_alvara: '',
  data_aprovacao_condominio: '',
  data_aprovacao_prefeitura: '',
  data_emissao_alvara: '',
  data_aprovacao_credito: '',
  previsao_liberacao_credito_obra: '',
  previsao_inicio_obra: '',
};

type ProcessoRow = {
  id: string;
  cidade: string | null;
  estado: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  etapa_painel: string | null;
  numero_franquia: string | null;
  nome_franqueado: string | null;
  nome_condominio: string | null;
  quadra_lote: string | null;
  tipo_aquisicao_terreno: string | null;
  observacoes: string | null;
  historico_base_id: string | null;
  trava_painel: boolean | null;
};

type ChecklistRow = {
  id: string;
  titulo: string;
  concluido: boolean;
  etapa_painel: string;
  status: string | null;
  prazo: string | null;
  responsavel_nome: string | null;
  time_nome: string | null;
  times_nomes: string[];
  responsaveis_nomes: string[];
  ordem: number | null;
};

function tituloCartao(p: ProcessoRow, etapaKey: string): string {
  const numero = p.numero_franquia ?? '—';
  if (etapaKey === 'step_1') return numero;
  const quadra = p.quadra_lote ? ` - ${p.quadra_lote}` : '';
  return `${numero} - ${p.nome_condominio ?? '—'}${quadra}`;
}

function nomeFasePainel(etapaKey: string | null): string {
  const col = PAINEL_COLUMNS.find((c) => c.key === etapaKey);
  return col?.title ?? etapaKey ?? 'Etapa';
}

function defaultLegacyEtapa(board: PainelCardModalBoard): PainelColumnKey {
  if (board === 'credito') return 'credito_terreno';
  if (board === 'contabilidade') return 'contabilidade_incorporadora';
  return 'step_1';
}

function dateInputToPrazoDb(iso: string): string | null {
  const t = iso.trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const [y, m, d] = t.split('-');
  return `${d}/${m}/${y}`;
}

/** Alinhado ao `CardDetalheModal` — opções de responsável por time ao criar/filtrar atividades. */
const RESPONSAVEIS_POR_TIME: Record<string, string[]> = {
  Marketing: ['Negão'],
  'Novos Franks': ['Paula'],
  'Portfólio': ['Helenna'],
  Portfolio: ['Helenna'],
  Acoplamento: ['Elisabete'],
  Waysers: ['Nathalia', 'Rafael'],
  'Frank Moní': [],
  Crédito: ['Kim', 'Neil'],
  Produto: ['Vini', 'Fábio'],
  Homologações: ['Karoline', 'Helena', 'Jéssica', 'Letícia'],
  'Modelo Virtual': ['Bruna', 'Larissa', 'Vitor'],
  Executivo: ['Bruna', 'Larissa', 'Vitor'],
  'Caneta Verde': ['Fernanda', 'Ingrid'],
};

export function PainelProcessoCardModal({
  processoId,
  onClose,
  board,
}: {
  processoId: string;
  onClose: () => void;
  board: PainelCardModalBoard;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processo, setProcesso] = useState<ProcessoRow | null>(null);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [abasOutrasEtapas, setAbasOutrasEtapas] = useState<Set<string>>(new Set());
  const [novoComentario, setNovoComentario] = useState('');
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);
  const [listaAtividadesModo, setListaAtividadesModo] = useState<ListaAtividadesCard>('abertas');
  const [filtroAtSituacao, setFiltroAtSituacao] = useState<FiltroSituacaoChecklist>('qualquer');
  const [filtroAtTime, setFiltroAtTime] = useState('todos');
  const [filtroAtResp, setFiltroAtResp] = useState('todos');
  const [ordemAt, setOrdemAt] = useState<'prazo' | 'responsavel'>('prazo');
  const [novaAtTitulo, setNovaAtTitulo] = useState('');
  const [novaAtPrazo, setNovaAtPrazo] = useState('');
  const [novaAtTime, setNovaAtTime] = useState('');
  const [novaAtResp, setNovaAtResp] = useState('');
  const [addingAtividade, setAddingAtividade] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [dadosResumo, setDadosResumo] = useState<ProcessoResumoStep1 | null>(null);
  const [dadosRelacionados, setDadosRelacionados] = useState<{
    pai: ProcessoRelacionado | null;
    filhos: ProcessoRelacionado[];
    irmaos: ProcessoRelacionado[];
  }>({ pai: null, filhos: [], irmaos: [] });
  const [dadosPreObraFormCard, setDadosPreObraFormCard] = useState<DadosPreObraFormState>(EMPTY_PRE_OBRA_FORM);
  const [savingDadosPreObraCard, setSavingDadosPreObraCard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: proc, error } = await supabase
        .from('processo_step_one')
        .select(
          'id, cidade, estado, status, created_at, updated_at, etapa_painel, numero_franquia, nome_franqueado, nome_condominio, quadra_lote, tipo_aquisicao_terreno, observacoes, historico_base_id, trava_painel',
        )
        .eq('id', processoId)
        .maybeSingle();

      if (error || !proc) {
        alert('Processo não encontrado.');
        onClose();
        return;
      }

      const row = proc as ProcessoRow;
      setProcesso(row);

      const [rSum, rRel] = await Promise.all([getResumoProcessoStep1(row.id), getRelacionadosProcesso(row.id)]);
      if (rSum.ok) {
        setDadosResumo(rSum.data);
        setDadosPreObraFormCard({
          previsao_aprovacao_condominio: rSum.data.previsao_aprovacao_condominio ?? '',
          previsao_aprovacao_prefeitura: rSum.data.previsao_aprovacao_prefeitura ?? '',
          previsao_emissao_alvara: rSum.data.previsao_emissao_alvara ?? '',
          data_aprovacao_condominio: rSum.data.data_aprovacao_condominio ?? '',
          data_aprovacao_prefeitura: rSum.data.data_aprovacao_prefeitura ?? '',
          data_emissao_alvara: rSum.data.data_emissao_alvara ?? '',
          data_aprovacao_credito: rSum.data.data_aprovacao_credito ?? '',
          previsao_liberacao_credito_obra: rSum.data.previsao_liberacao_credito_obra ?? '',
          previsao_inicio_obra: rSum.data.previsao_inicio_obra ?? '',
        });
      } else {
        setDadosResumo(null);
        setDadosPreObraFormCard(EMPTY_PRE_OBRA_FORM);
      }
      if (rRel.ok) {
        setDadosRelacionados({ pai: rRel.pai, filhos: rRel.filhos, irmaos: rRel.irmaos });
      } else {
        setDadosRelacionados({ pai: null, filhos: [], irmaos: [] });
      }

      const baseId = (row.historico_base_id as string | null) ?? row.id;
      const { data: items } = await supabase
        .from('processo_card_checklist')
        .select(
          'id, titulo, concluido, etapa_painel, status, prazo, responsavel_nome, time_nome, times_nomes, responsaveis_nomes, ordem',
        )
        .eq('processo_id', baseId)
        .order('ordem', { ascending: true });

      const rows: ChecklistRow[] = (items ?? []).map((raw) => {
        const r = raw as Record<string, unknown>;
        const tn = r.times_nomes;
        const rn = r.responsaveis_nomes;
        return {
          id: String(r.id ?? ''),
          titulo: String(r.titulo ?? ''),
          concluido: Boolean(r.concluido),
          etapa_painel: String(r.etapa_painel ?? ''),
          status: (r.status as string | null) ?? null,
          prazo: (r.prazo as string | null) ?? null,
          responsavel_nome: (r.responsavel_nome as string | null) ?? null,
          time_nome: (r.time_nome as string | null) ?? null,
          times_nomes: Array.isArray(tn) ? (tn as string[]) : [],
          responsaveis_nomes: Array.isArray(rn) ? (rn as string[]) : [],
          ordem: typeof r.ordem === 'number' ? r.ordem : Number(r.ordem ?? 0),
        };
      });
      setChecklist(rows);

      const etapa = String(row.etapa_painel ?? '');
      const minimizadas = new Set<string>();
      for (const it of rows) {
        if (it.etapa_painel && it.etapa_painel !== etapa) {
          minimizadas.add(it.etapa_painel);
        }
      }
      setAbasOutrasEtapas(minimizadas);
    } catch (e) {
      console.error('[PainelProcessoCardModal]', e);
      alert('Erro ao carregar o processo.');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [processoId, onClose]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (listaAtividadesModo === 'abertas' && filtroAtSituacao === 'concluido') {
      setFiltroAtSituacao('qualquer');
    }
  }, [listaAtividadesModo, filtroAtSituacao]);

  async function handleSalvarDadosPreObraCard() {
    setSavingDadosPreObraCard(true);
    try {
      const res = await updateDadosPreObra(processoId, {
        previsao_aprovacao_condominio: dadosPreObraFormCard.previsao_aprovacao_condominio || null,
        previsao_aprovacao_prefeitura: dadosPreObraFormCard.previsao_aprovacao_prefeitura || null,
        previsao_emissao_alvara: dadosPreObraFormCard.previsao_emissao_alvara || null,
        data_aprovacao_condominio: dadosPreObraFormCard.data_aprovacao_condominio || null,
        data_aprovacao_prefeitura: dadosPreObraFormCard.data_aprovacao_prefeitura || null,
        data_emissao_alvara: dadosPreObraFormCard.data_emissao_alvara || null,
        data_aprovacao_credito: dadosPreObraFormCard.data_aprovacao_credito || null,
        previsao_liberacao_credito_obra: dadosPreObraFormCard.previsao_liberacao_credito_obra || null,
        previsao_inicio_obra: dadosPreObraFormCard.previsao_inicio_obra || null,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      const r2 = await getResumoProcessoStep1(processoId);
      if (r2.ok) setDadosResumo(r2.data);
      await load();
      router.refresh();
    } finally {
      setSavingDadosPreObraCard(false);
    }
  }

  const etapaAtual = processo?.etapa_painel ?? null;
  const etapaAtualKey = (etapaAtual as PainelColumnKey | null) ?? null;
  const tituloHeader = processo ? tituloCartao(processo, etapaAtual ?? '') : '';

  const checklistFaseAtual = useMemo(
    () => checklist.filter((c) => c.etapa_painel === etapaAtual),
    [checklist, etapaAtual],
  );

  const checklistOutrasFases = useMemo(() => {
    const map = new Map<string, ChecklistRow[]>();
    for (const it of checklist) {
      if (it.etapa_painel === etapaAtual) continue;
      const arr = map.get(it.etapa_painel) ?? [];
      arr.push(it);
      map.set(it.etapa_painel, arr);
    }
    return map;
  }, [checklist, etapaAtual]);

  const etStr = String(etapaAtual ?? '');
  const checklistAnexoItensFase = useMemo(
    () => checklistFaseAtual.filter((it) => isChecklistAnexosEstruturalCard(etStr, it.titulo)),
    [checklistFaseAtual, etStr],
  );
  const atividadesVincBase = useMemo(
    () => checklistFaseAtual.filter((it) => !isChecklistAnexosEstruturalCard(etStr, it.titulo)),
    [checklistFaseAtual, etStr],
  );

  const atividadesVincFiltradas = useMemo(() => {
    const situacaoFiltro =
      listaAtividadesModo === 'concluidas' ? ('qualquer' as const) : filtroAtSituacao;
    const filtrados = atividadesVincBase.filter((item) => {
      if (!checklistPassaFiltroLista(item, listaAtividadesModo, situacaoFiltro)) return false;
      if (!itemMatchesTimeFilter(item.times_nomes, item.time_nome, filtroAtTime)) return false;
      if (!itemMatchesResponsavelFilter(item.responsaveis_nomes, item.responsavel_nome, filtroAtResp)) {
        return false;
      }
      return true;
    });
    return ordenarItensChecklistLista(filtrados, listaAtividadesModo, ordemAt);
  }, [
    atividadesVincBase,
    listaAtividadesModo,
    filtroAtSituacao,
    filtroAtTime,
    filtroAtResp,
    ordemAt,
  ]);

  const responsaveisOpcoesFiltro = useMemo(() => {
    const timeKey = filtroAtTime === 'todos' ? null : filtroAtTime;
    const base =
      timeKey === null
        ? Object.values(RESPONSAVEIS_POR_TIME).flat()
        : (RESPONSAVEIS_POR_TIME[timeKey] ?? []);
    const s = new Set<string>(base.map((x) => x.trim()).filter(Boolean));
    for (const it of atividadesVincBase) {
      if (timeKey && !itemMatchesTimeFilter(it.times_nomes, it.time_nome, timeKey)) continue;
      if (it.responsaveis_nomes?.length) {
        for (const x of it.responsaveis_nomes) {
          const t = String(x).trim();
          if (t) s.add(t);
        }
      } else if (it.responsavel_nome?.trim()) {
        s.add(it.responsavel_nome.trim());
      }
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [atividadesVincBase, filtroAtTime]);

  useEffect(() => {
    if (filtroAtResp === 'todos') return;
    if (!responsaveisOpcoesFiltro.includes(filtroAtResp)) setFiltroAtResp('todos');
  }, [responsaveisOpcoesFiltro, filtroAtResp]);

  const responsaveisNovaAtividade = useMemo(() => {
    const base = new Set<string>();
    if (novaAtTime) {
      for (const x of RESPONSAVEIS_POR_TIME[novaAtTime] ?? []) base.add(x.trim());
    } else {
      for (const arr of Object.values(RESPONSAVEIS_POR_TIME)) {
        for (const x of arr) base.add(x.trim());
      }
    }
    for (const it of atividadesVincBase) {
      if (novaAtTime) {
        const itTimes =
          it.times_nomes.length > 0
            ? it.times_nomes
            : (it.time_nome ?? '')
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean);
        if (!itTimes.includes(novaAtTime)) continue;
      }
      if (it.responsaveis_nomes?.length) {
        for (const x of it.responsaveis_nomes) {
          if (x.trim()) base.add(x.trim());
        }
      } else if (it.responsavel_nome?.trim()) {
        base.add(it.responsavel_nome.trim());
      }
    }
    return [...base].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [atividadesVincBase, novaAtTime]);

  const sla = useMemo(() => {
    const ref = processo?.created_at ?? processo?.updated_at;
    const et = String(processo?.etapa_painel ?? '') as PainelColumnKey;
    if (!ref || !PAINEL_COLUMNS.some((c) => c.key === et)) {
      return { label: '', status: 'ok' as const, classe: '' };
    }
    return calcularStatusSLA(new Date(ref), getPainelColumnSlaDiasUteis(et));
  }, [processo?.created_at, processo?.updated_at, processo?.etapa_painel]);

  async function handleAddAtividade() {
    if (!processo || !novaAtTitulo.trim()) return;
    setAddingAtividade(true);
    try {
      const prazoDb = dateInputToPrazoDb(novaAtPrazo);
      const res = await addChecklistItem(
        processo.id,
        String(processo.etapa_painel ?? 'step_1'),
        novaAtTitulo.trim(),
        prazoDb,
        null,
        null,
        'nao_iniciada',
        novaAtTime ? [novaAtTime] : [],
        novaAtResp ? [novaAtResp] : [],
      );
      if (!res.ok) {
        alert(res.error ?? 'Erro ao adicionar atividade.');
        return;
      }
      setNovaAtTitulo('');
      setNovaAtPrazo('');
      setNovaAtTime('');
      setNovaAtResp('');
      await load();
      router.refresh();
    } finally {
      setAddingAtividade(false);
    }
  }

  async function handleChangeAtividadeStatus(
    id: string,
    status: 'nao_iniciada' | 'em_andamento' | 'concluido',
  ) {
    setUpdatingStatusId(id);
    try {
      const res = await updateChecklistItemStatus(id, status);
      if (!res.ok) {
        alert(res.error ?? 'Erro ao atualizar status.');
        return;
      }
      await load();
      router.refresh();
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function handleRemoveAtividade(id: string) {
    if (!confirm('Remover esta atividade?')) return;
    const res = await removeChecklistItem(id);
    if (!res.ok) {
      alert(res.error ?? 'Erro ao remover.');
      return;
    }
    await load();
    router.refresh();
  }

  async function toggleItem(id: string, concluido: boolean) {
    const supabase = createClient();
    const { error } = await supabase
      .from('processo_card_checklist')
      .update({ concluido: !concluido, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('Não foi possível atualizar o item.');
      return;
    }
    await load();
    router.refresh();
  }

  async function handleAvancarFase() {
    if (!processo) return;
    const currentRaw = String(processo.etapa_painel ?? '');
    const current = currentRaw as PainelColumnKey;
    const colExists = PAINEL_COLUMNS.some((c) => c.key === current);
    if (!colExists) {
      alert('Etapa do processo não reconhecida para avanço.');
      return;
    }

    const ordered = getOrderedKeysForPainelCardModal(board);
    const idx = ordered.indexOf(current);
    if (idx === -1) {
      if (board === 'credito') {
        alert('Este processo não está em uma fase do Kanban Crédito.');
      } else if (board === 'contabilidade') {
        alert('Este processo não está em uma fase do Kanban Contabilidade.');
      } else {
        alert('Este processo não está em uma fase deste fluxo (Portfolio + Operações).');
      }
      return;
    }
    if (idx >= ordered.length - 1) {
      alert('Esta é a última fase deste painel para avanço sequencial.');
      return;
    }

    const next = ordered[idx + 1]!;
    if (isPainelKanbanDropBlocked(current, next)) {
      alert(
        'Esta transição não é permitida pelo Kanban (ex.: Step 1 → Step 2 ou Step 2 → Step 3/Crédito Terreno). Conclua o fluxo indicado ou arraste quando permitido.',
      );
      return;
    }

    if (!confirm(`Avançar para “${nomeFasePainel(next)}”?`)) return;
    const res = await atualizarEtapaPainel(processo.id, next);
    if (!res.ok) {
      alert(res.error ?? 'Erro ao avançar.');
      return;
    }
    await load();
    router.refresh();
  }

  function toggleAbaEtapa(etapa: string) {
    setAbasOutrasEtapas((prev) => {
      const n = new Set(prev);
      if (n.has(etapa)) n.delete(etapa);
      else n.add(etapa);
      return n;
    });
  }

  if (loading || !processo) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="rounded-xl bg-white px-8 py-6 shadow-lg"
          style={{ border: '0.5px solid var(--moni-border-default)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ color: 'var(--moni-text-secondary)' }}>Carregando…</p>
        </div>
      </div>
    );
  }

  const legacyEtapa: PainelColumnKey = etapaAtualKey ?? defaultLegacyEtapa(board);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="moni-card-modal-split relative flex h-[90vh] w-full flex-col overflow-hidden bg-white sm:flex-row"
          style={{
            maxWidth: 'var(--moni-card-modal-max)',
            borderRadius: 'var(--moni-radius-xl)',
            border: '0.5px solid var(--moni-border-default)',
            boxShadow: 'var(--moni-shadow-lg)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4"
            style={{
              borderColor: 'var(--moni-border-default)',
              borderTopLeftRadius: 'var(--moni-radius-xl)',
              borderTopRightRadius: 'var(--moni-radius-xl)',
            }}
          >
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold sm:text-lg" style={{ color: 'var(--moni-text-primary)' }}>
                {tituloHeader}
              </h2>
              <span
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold"
                style={{
                  background: 'var(--moni-gold-50)',
                  color: 'var(--moni-gold-800)',
                  border: '0.5px solid var(--moni-gold-400)',
                  borderRadius: 'var(--moni-radius-pill)',
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {nomeFasePainel(etapaAtual)}
              </span>
              {sla.label && sla.status !== 'ok' ? <span className={sla.classe}>{sla.label}</span> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex h-full w-full flex-col sm:flex-row" style={{ paddingTop: '70px' }}>
            <div
              className="moni-card-modal-right order-2 flex h-full flex-1 flex-col overflow-y-auto p-6 sm:w-[58%]"
              style={{ background: 'var(--moni-surface-0)' }}
            >
              <h3 className="mb-4 text-lg font-bold" style={{ color: 'var(--moni-text-primary)' }}>
                Fase atual: {nomeFasePainel(etapaAtual)}
              </h3>

              <div className="mb-6">
                <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                  Checklist
                </h4>
                <div
                  className="rounded-lg p-4"
                  style={{
                    background: 'var(--moni-surface-50)',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                >
                  {checklistAnexoItensFase.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
                      Nenhum item de checklist nesta fase.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {checklistAnexoItensFase.map((it) => (
                        <li key={it.id} className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border bg-white"
                            style={{ borderColor: 'var(--moni-border-default)' }}
                            checked={it.concluido}
                            onChange={() => void toggleItem(it.id, it.concluido)}
                          />
                          <div className="min-w-0 flex-1">
                            <span style={{ color: 'var(--moni-text-primary)' }}>{it.titulo}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Itens estruturais e anexos da fase (equivalente ao antigo Checklist/Anexos).
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                  Atividades vinculadas ({atividadesVincBase.length})
                </h4>
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  <select
                    value={listaAtividadesModo}
                    onChange={(e) => setListaAtividadesModo(e.target.value as ListaAtividadesCard)}
                    className="rounded-lg border px-2 py-2 text-xs sm:text-sm"
                    style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                  >
                    <option value="abertas">Lista: em aberto (padrão)</option>
                    <option value="concluidas">Lista: somente concluídas</option>
                    <option value="todas">Lista: todas (concluídas no fim)</option>
                  </select>
                  <select
                    value={listaAtividadesModo === 'concluidas' ? 'qualquer' : filtroAtSituacao}
                    disabled={listaAtividadesModo === 'concluidas'}
                    onChange={(e) => setFiltroAtSituacao(e.target.value as FiltroSituacaoChecklist)}
                    className="rounded-lg border px-2 py-2 text-xs sm:text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                    title={
                      listaAtividadesModo === 'concluidas'
                        ? 'Ao filtrar só concluídas, a situação é sempre concluída.'
                        : undefined
                    }
                  >
                    <option value="qualquer">Situação: qualquer</option>
                    <option value="nao_iniciada">Situação: não iniciada</option>
                    <option value="em_andamento">Situação: em andamento</option>
                    {listaAtividadesModo !== 'abertas' ? (
                      <option value="concluido">Situação: concluída</option>
                    ) : null}
                  </select>
                  <select
                    value={filtroAtTime}
                    onChange={(e) => setFiltroAtTime(e.target.value)}
                    className="rounded-lg border px-2 py-2 text-xs sm:text-sm"
                    style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                  >
                    <option value="todos">Time: todos</option>
                    {ATIVIDADE_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filtroAtResp}
                    onChange={(e) => setFiltroAtResp(e.target.value)}
                    className="rounded-lg border px-2 py-2 text-xs sm:text-sm"
                    style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                  >
                    <option value="todos">Responsável: todos</option>
                    {responsaveisOpcoesFiltro.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ordemAt}
                    onChange={(e) => setOrdemAt(e.target.value as 'prazo' | 'responsavel')}
                    className="rounded-lg border px-2 py-2 text-xs sm:text-sm"
                    style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                  >
                    <option value="prazo">Ordenar por prazo</option>
                    <option value="responsavel">Ordenar por responsável</option>
                  </select>
                </div>

                {atividadesVincFiltradas.length === 0 ? (
                  <div
                    className="rounded-lg px-3 py-4 text-center text-sm"
                    style={{
                      background: 'var(--moni-surface-50)',
                      border: '0.5px solid var(--moni-border-default)',
                      color: 'var(--moni-text-tertiary)',
                    }}
                  >
                    Nenhuma atividade encontrada para os filtros selecionados.
                  </div>
                ) : (
                  <ul className="mb-4 list-none space-y-2">
                    {atividadesVincFiltradas.map((item) => {
                      const statusVal = item.concluido
                        ? 'concluido'
                        : ((item.status ?? 'nao_iniciada') as 'nao_iniciada' | 'em_andamento' | 'concluido');
                      const avKind = resolveAtividadeVinculadaKind({
                        concluido: item.concluido,
                        status: statusVal,
                        prazo: item.prazo,
                      });
                      return (
                        <AtividadeVinculadaCard key={item.id} kind={avKind} as="li" className="list-none">
                          <div className="flex flex-wrap items-start gap-2">
                            <span className="mt-0.5 shrink-0" title="Indicador de status / prazo">
                              <AtividadeVinculadaIcon kind={avKind} size="md" />
                            </span>
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 rounded border"
                              style={{ borderColor: 'var(--moni-border-default)' }}
                              checked={item.concluido}
                              onChange={() => void toggleItem(item.id, item.concluido)}
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-sm font-medium"
                                style={{
                                  color: item.concluido
                                    ? 'var(--moni-text-tertiary)'
                                    : 'var(--moni-text-primary)',
                                  textDecoration: item.concluido ? 'line-through' : undefined,
                                }}
                              >
                                {item.titulo}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                                <AtividadeVinculadaStatusPill kind={avKind}>
                                  {labelChecklistStatusParaPill(statusVal)}
                                </AtividadeVinculadaStatusPill>
                                <span>Prazo: {item.prazo ?? '—'}</span>
                                <span>•</span>
                                <span>Times: {item.time_nome?.trim() || '—'}</span>
                                <span>•</span>
                                <span>Resp.: {item.responsavel_nome?.trim() || '—'}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-col gap-1 sm:items-end">
                              <select
                                value={statusVal}
                                disabled={updatingStatusId === item.id}
                                onChange={(e) =>
                                  void handleChangeAtividadeStatus(
                                    item.id,
                                    e.target.value as 'nao_iniciada' | 'em_andamento' | 'concluido',
                                  )
                                }
                                className="min-w-[160px] rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                              >
                                <option value="nao_iniciada">Não iniciada</option>
                                <option value="em_andamento">Em andamento</option>
                                <option value="concluido">Concluída</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => void handleRemoveAtividade(item.id)}
                                className="text-right text-xs text-red-600 hover:underline"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        </AtividadeVinculadaCard>
                      );
                    })}
                  </ul>
                )}

                <div
                  className="rounded-lg p-3"
                  style={{
                    background: 'var(--moni-surface-50)',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                >
                  <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                    Nova atividade
                  </p>
                  <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
                    <input
                      type="text"
                      value={novaAtTitulo}
                      onChange={(e) => setNovaAtTitulo(e.target.value)}
                      placeholder="Atividade (o que fazer)"
                      className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                    />
                    <input
                      type="date"
                      value={novaAtPrazo}
                      onChange={(e) => setNovaAtPrazo(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm lg:w-[160px]"
                      style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                    />
                    <select
                      value={novaAtTime}
                      onChange={(e) => setNovaAtTime(e.target.value)}
                      className="w-full rounded-lg border px-2 py-2 text-sm lg:w-[140px]"
                      style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                    >
                      <option value="">Time</option>
                      {ATIVIDADE_TIMES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <select
                      value={novaAtResp}
                      onChange={(e) => setNovaAtResp(e.target.value)}
                      className="w-full rounded-lg border px-2 py-2 text-sm lg:w-[160px]"
                      style={{ borderColor: 'var(--moni-border-default)', background: '#fff' }}
                    >
                      <option value="">Responsável</option>
                      {responsaveisNovaAtividade.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={addingAtividade || !novaAtTitulo.trim()}
                      onClick={() => void handleAddAtividade()}
                      className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                      style={{
                        background: 'var(--moni-surface-0)',
                        color: 'var(--moni-text-secondary)',
                        border: '0.5px solid var(--moni-border-default)',
                      }}
                    >
                      {addingAtividade ? '…' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="mt-auto flex flex-col gap-3 border-t pt-4 sm:flex-row"
                style={{ borderColor: 'var(--moni-border-default)' }}
              >
                <button
                  type="button"
                  disabled={Boolean(processo.trava_painel)}
                  onClick={() => void handleAvancarFase()}
                  className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50"
                  style={{
                    background: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-primary)',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                >
                  Avançar para próxima fase
                </button>
                <button
                  type="button"
                  onClick={() => setLegacyModalOpen(true)}
                  className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition"
                  style={{
                    background: 'var(--moni-surface-50)',
                    color: 'var(--moni-text-secondary)',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                >
                  Painel completo (legado)
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition"
                  style={{
                    background: 'transparent',
                    color: '#b91c1c',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                >
                  Fechar
                </button>
              </div>
              {processo.trava_painel ? (
                <p className="mt-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Card travado — não é possível avançar de fase pelo painel.
                </p>
              ) : null}
            </div>

            <div
              className="moni-card-modal-left order-1 flex h-full flex-col overflow-y-auto border-t p-6 sm:w-[42%] sm:border-r sm:border-t-0"
              style={{
                background: 'var(--moni-surface-50)',
                borderColor: 'var(--moni-border-default)',
              }}
            >
              <h3
                className="mb-4 text-sm font-bold uppercase tracking-wide"
                style={{ color: 'var(--moni-text-secondary)' }}
              >
                Dados
              </h3>

              <div
                className="mb-4 rounded-lg p-4 text-sm"
                style={{
                  background: 'var(--moni-surface-0)',
                  border: '0.5px solid var(--moni-border-default)',
                  color: 'var(--moni-text-primary)',
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Responsável
                </p>
                <p className="mt-1 font-medium">—</p>
                <p className="mt-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Defina no painel completo (legado) quando o campo estiver disponível no fluxo.
                </p>
              </div>

              <div className="mb-4">
                <ProcessoQuatroSecoesDados
                  resumo={dadosResumo}
                  relacionados={dadosRelacionados}
                  dadosPreObraForm={dadosPreObraFormCard}
                  setDadosPreObraForm={setDadosPreObraFormCard}
                  onSalvarPreObra={() => void handleSalvarDadosPreObraCard()}
                  savingDadosPreObra={savingDadosPreObraCard}
                />
              </div>

              <div className="mb-4">
                <h4 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Campos desta fase
                </h4>
                <textarea
                  readOnly
                  rows={5}
                  value={processo.observacoes ?? ''}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-primary)',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                  placeholder="Em desenvolvimento — campos personalizados por fase. Observações gerais do card aparecem aqui."
                />
              </div>

              <div className="mb-4">
                <h4 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Comentários desta fase
                </h4>
                <textarea
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: '#fff',
                    color: 'var(--moni-text-primary)',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                  placeholder="Adicione um comentário…"
                />
              </div>

              <h4 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--moni-text-tertiary)' }}>
                Itens de outras etapas
              </h4>
              <div className="space-y-2">
                {Array.from(checklistOutrasFases.entries()).map(([etapa, itens]) => {
                  const minimizado = abasOutrasEtapas.has(etapa);
                  return (
                    <div
                      key={etapa}
                      className="overflow-hidden rounded-lg"
                      style={{ border: '0.5px solid var(--moni-border-default)', background: '#fff' }}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
                        style={{ color: 'var(--moni-text-primary)' }}
                        onClick={() => toggleAbaEtapa(etapa)}
                      >
                        <span>{nomeFasePainel(etapa)}</span>
                        {minimizado ? (
                          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
                        ) : (
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                        )}
                      </button>
                      {!minimizado && (
                        <ul className="border-t px-3 py-2 text-sm" style={{ borderColor: 'var(--moni-border-default)' }}>
                          {itens.map((it) => (
                            <li key={it.id} className="flex items-center gap-2 py-1">
                              <input type="checkbox" checked={it.concluido} readOnly className="h-3.5 w-3.5" />
                              <span style={{ color: 'var(--moni-text-secondary)' }}>{it.titulo}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {checklistOutrasFases.size === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Sem itens de outras etapas vinculados a este processo.
                  </p>
                ) : null}
              </div>

              <div className="mt-6">
                <h4 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Comentários gerais
                </h4>
                <textarea
                  readOnly
                  rows={4}
                  className="w-full rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-tertiary)',
                    border: '0.5px solid var(--moni-border-default)',
                  }}
                  value="Em desenvolvimento — comentários gerais do card. Use o painel completo (legado) para menções e histórico detalhado."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {legacyModalOpen && processo ? (
        <CardDetalheModal
          processoId={processo.id}
          etapaKey={legacyEtapa}
          processoLabel={`${processo.cidade ?? 'Sem cidade'}${processo.estado ? `, ${processo.estado}` : ''}`}
          tipoAquisicaoTerreno={processo.tipo_aquisicao_terreno ?? null}
          status={processo.status ?? 'rascunho'}
          onClose={() => setLegacyModalOpen(false)}
        />
      ) : null}
    </>
  );
}
