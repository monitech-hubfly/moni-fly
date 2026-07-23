'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useBacklog }        from '@/hooks/useBacklog';
import { useBacklogKanban }  from '@/hooks/useBacklogKanban';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type OrigemTipo = 'sirene' | 'pastelaria' | 'kanban' | 'atividades';

export type RecorrenciaConfig = {
  frequencia: 'diario' | 'semanal' | 'mensal';
  intervalo: number;
  diasSemana?: number[];
  ate: string;
};

export type DadosAgendamento = {
  acao_id: string | null;
  objetivo_id: string | null;
  data: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  casa_id: string | null;
  franqueado_id: string | null;
  rede_loteador_id: string | null;
  condominio_id: string | null;
  adm_cnpj_id: string | null;
  sirene_chamado_id: number | null;
  card_id: string | null;
  recorrente: boolean;
  recorrencia_config: RecorrenciaConfig | null;
  observacoes: string | null;
  link_reuniao: string | null;
  titulo: string | null;
  participantes: string[];
  origem_tipo: OrigemTipo | null;
};

const EMPTY: DadosAgendamento = {
  acao_id: null, objetivo_id: null, data: null, hora_inicio: null, hora_fim: null,
  casa_id: null, franqueado_id: null, rede_loteador_id: null, condominio_id: null,
  adm_cnpj_id: null, sirene_chamado_id: null, card_id: null,
  recorrente: false, recorrencia_config: null, observacoes: null,
  link_reuniao: null, titulo: null, participantes: [], origem_tipo: null,
};

export type OrigemInfo = {
  titulo: string;
  tipo: 'sirene' | 'pastelaria' | 'kanban';
  subtitulo?: string;
};

export type ModalAgendamentoProps = {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (dados: DadosAgendamento) => void;
  preenchido?: Partial<DadosAgendamento>;
  modo: 'criar' | 'editar';
  profileId: string;
  areaId: string | null;
  isSaving?: boolean;
  origemInfo?: OrigemInfo;
};

// ── Utilidades ────────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function gerarOcorrencias(dataInicio: string, cfg: RecorrenciaConfig): string[] {
  const datas: string[] = [];
  const ate = new Date(cfg.ate + 'T00:00:00');
  let cur = new Date(dataInicio + 'T00:00:00');
  const max = 365;
  while (cur <= ate && datas.length < max) {
    if (cfg.frequencia === 'semanal' && cfg.diasSemana?.length) {
      if (cfg.diasSemana.includes(cur.getDay())) datas.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    } else {
      datas.push(cur.toISOString().slice(0, 10));
      if (cfg.frequencia === 'diario')  cur.setDate(cur.getDate() + cfg.intervalo);
      if (cfg.frequencia === 'semanal') cur.setDate(cur.getDate() + cfg.intervalo * 7);
      if (cfg.frequencia === 'mensal')  cur.setMonth(cur.getMonth() + cfg.intervalo);
    }
  }
  return datas;
}

// ── Badge de status ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  nao_iniciado: { bg: '#f3f4f6', text: '#374151', label: 'não iniciado' },
  em_andamento: { bg: '#dbeafe', text: '#1e40af', label: 'em andamento' },
  atrasado:     { bg: '#fee2e2', text: '#991b1b', label: 'atrasado'     },
};

const PRIO_BADGE: Record<string, { bg: string; text: string }> = {
  P1: { bg: '#fee2e2', text: '#991b1b' },
  P2: { bg: '#ffedd5', text: '#c2410c' },
  P3: { bg: '#fef9c3', text: '#92400e' },
  P4: { bg: '#dbeafe', text: '#1e40af' },
  P5: { bg: '#f3f4f6', text: '#374151' },
  P6: { bg: '#f3f4f6', text: '#6b7280' },
};

// ── Seção colapsável ──────────────────────────────────────────────────────────

function Secao({
  titulo, aberta, onToggle, children, erro,
}: {
  titulo: string; aberta: boolean; onToggle: () => void;
  children: React.ReactNode; erro?: boolean;
}) {
  return (
    <div className="border-b border-gray-100">
      <button type="button"
        className={`w-full flex items-center justify-between px-4 py-3 text-left ${erro ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}
        onClick={onToggle}>
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-2">
          {titulo}
          {erro && <span className="text-[10px] text-red-500 normal-case font-normal tracking-normal">• obrigatório</span>}
        </span>
        <span className="text-gray-400 text-xs">{aberta ? '▲' : '▼'}</span>
      </button>
      {aberta && <div className="px-4 pb-4 pt-0">{children}</div>}
    </div>
  );
}

// ── Tipos internos ────────────────────────────────────────────────────────────

type AbaAtiva = 'sirene' | 'atividades' | 'kanban';

type BacklogItem = {
  id: string;
  label: string;
  sub: string;
  status?: string;
  badge?: string;
  badgeBg?: string;
  badgeText?: string;
  extra?: string;
  objetivoId?: string | null;
  acoId?: string | null;       // acao_id real (gantt_planejamento.acao_id) para atividades
};

// ── Modal ─────────────────────────────────────────────────────────────────────

export function ModalAgendamento({
  aberto, onFechar, onSalvar, preenchido, modo, profileId, areaId, isSaving, origemInfo,
}: ModalAgendamentoProps) {
  const supabase = useMemo(() => createClient(), []);

  // ── Hooks do backlog (mesma fonte que os blocos da página) ────────────────
  const backlog    = useBacklog();
  const kanbanData = useBacklogKanban();

  const [form, setForm] = useState<DadosAgendamento>({ ...EMPTY });

  // Abas e seleção de item
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva | null>(null);
  const [query, setQuery]       = useState('');
  const [selItem, setSelItem]   = useState<BacklogItem | null>(null);

  // Objetivo para aba Atividades (picker separado após seleção de acao)
  const [objetivos, setObjetivos] = useState<{ id: string; descricao: string; tipo: string | null }[]>([]);

  // Vínculos
  const [casas,       setCasas]       = useState<{ id: string; nome: string }[]>([]);
  const [franqueados, setFranqueados] = useState<{ id: string; nome: string }[]>([]);
  const [loteadores,  setLoteadores]  = useState<{ id: string; nome: string }[]>([]);
  const [condominios, setCondominios] = useState<{ id: string; nome: string }[]>([]);
  const [cnpjs,       setCnpjs]       = useState<{ id: string; cnpj: string; descritivo: string | null }[]>([]);

  // Participantes
  const [pessoas,   setPessoas]   = useState<{ profile_id: string; nome: string; email: string | null }[]>([]);
  const [ocupados,  setOcupados]  = useState<Set<string>>(new Set());

  // Seções colapsáveis (data, participantes, link, recorrência, vínculo, obs)
  const [abertas, setAbertas] = useState([true, false, false, false, false, false]);
  const [erros,   setErros]   = useState({ origem: false, data: false });

  const preenchidoRef = useRef(preenchido);
  preenchidoRef.current = preenchido;

  // ── Listas derivadas dos hooks (mesma ordenação e dados do backlog) ───────
  const sireneItems = useMemo<BacklogItem[]>(() => [
    ...backlog.sirene.map(t => {
      const s = STATUS_BADGE[t.status] ?? STATUS_BADGE.nao_iniciado;
      return {
        id:       t.id,
        label:    t.descricao ?? '(sem título)',
        sub:      t.frank_nome
          ? `${t.frank_nome}${t.chamado_numero ? ` #${t.chamado_numero}` : ''}`
          : t.tipo ?? '—',
        status:   t.status,
        badge:    s.label,
        badgeBg:  s.bg,
        badgeText: s.text,
      };
    }),
    ...backlog.pastelaria.map(p => ({
      id:       p.id,
      label:    p.nome,
      sub:      p.coluna,
      badge:    'pastelaria',
      badgeBg:  '#ede9fe',
      badgeText: '#5b21b6',
    })),
  ], [backlog.sirene, backlog.pastelaria]);

  const atividItems = useMemo<BacklogItem[]>(() =>
    backlog.atividades.map(a => {
      const chave = a.comportamento_chave;
      return {
        id:         a.id,
        label:      a.nome_acao ?? '(sem nome)',
        sub:        a.semana_ano_fim ? `Até S${a.semana_ano_fim}` : '—',
        badge:      chave ? '⭐ chave' : 'atividade',
        badgeBg:    chave ? '#fef9c3' : '#f3f4f6',
        badgeText:  chave ? '#92400e' : '#374151',
        objetivoId: a.objetivo_id,
        acoId:      a.acao_id,
      };
    }),
  [backlog.atividades]);

  const kanbanItems = useMemo<BacklogItem[]>(() =>
    [...kanbanData.cards, ...kanbanData.sndCards].map(c => {
      const parts = [c.kanban_nome, c.fase_nome].filter(Boolean);
      const prio  = c.prioridade ?? null;
      const pb    = prio ? (PRIO_BADGE[prio] ?? PRIO_BADGE.P6) : { bg: '#f3f4f6', text: '#6b7280' };
      return {
        id:        c.id,
        label:     c.titulo ?? '(sem título)',
        sub:       parts.join(' · '),
        extra:     c.proxima_atividade ?? undefined,
        badge:     prio ?? undefined,
        badgeBg:   pb.bg,
        badgeText: pb.text,
      };
    }),
  [kanbanData.cards, kanbanData.sndCards]);

  const listLoading =
    (abaAtiva === 'sirene'     && backlog.isLoading) ||
    (abaAtiva === 'atividades' && backlog.isLoading) ||
    (abaAtiva === 'kanban'     && kanbanData.isLoading);

  // ── FIX Issue 2: carrega dados assim que areaId resolve ──────────────────
  useEffect(() => {
    if (!areaId) return;
    void (async () => {
      try {
        const [objRes, pessoasRes] = await Promise.all([
          supabase.from('objetivos').select('id, descricao, tipo').eq('area_id', areaId).eq('status', 'ativo').order('descricao'),
          supabase.from('area_pessoas').select('profile_id, nome, profiles(email)').not('profile_id', 'is', null).order('nome'),
        ]);
        setObjetivos((objRes.data ?? []) as { id: string; descricao: string; tipo: string | null }[]);
        type PessoaRaw = { profile_id: string; nome: string; profiles: { email: string } | { email: string }[] | null };
        const raw = (pessoasRes.data ?? []) as PessoaRaw[];
        const seen = new Set<string>();
        setPessoas(raw.filter(p => {
          if (p.profile_id === profileId || seen.has(p.profile_id)) return false;
          seen.add(p.profile_id);
          return true;
        }).map(p => {
          const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          return { profile_id: p.profile_id, nome: p.nome, email: prof?.email ?? null };
        }));
      } catch (e) { console.error('[Modal] objetivos/pessoas:', e); }
    })();
  }, [areaId, profileId, supabase]);

  // ── Carrega vínculos uma vez ──────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const [c, f, l, co, cn] = await Promise.all([
          supabase.from('casas').select('id, nome').order('nome').limit(100),
          supabase.from('rede_franqueados').select('id, nome_completo').order('nome_completo').limit(100),
          supabase.from('rede_loteadores').select('id, nome').order('nome').limit(100),
          supabase.from('condominios').select('id, nome').order('nome').limit(100),
          supabase.from('adm_cnpjs').select('id, cnpj, descritivo').order('cnpj').limit(100),
        ]);
        // Deduplica casas por nome (mantém primeiro ID encontrado)
        const casasRaw = (c.data ?? []) as { id: string; nome: string }[];
        const casasVistas = new Set<string>();
        setCasas(casasRaw.filter(x => { if (casasVistas.has(x.nome)) return false; casasVistas.add(x.nome); return true; }));
        setFranqueados(((f.data ?? []) as { id: string; nome_completo?: string | null }[])
          .map(x => ({ id: x.id, nome: String(x.nome_completo ?? '').trim() || '—' })));
        setLoteadores((l.data ?? []) as { id: string; nome: string }[]);
        setCondominios((co.data ?? []) as { id: string; nome: string }[]);
        setCnpjs((cn.data ?? []) as { id: string; cnpj: string; descritivo: string | null }[]);
      } catch (e) { console.error('[Modal] vínculos:', e); }
    })();
  }, [supabase]);

  // ── Reset ao abrir ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!aberto) return;
    const base: DadosAgendamento = { ...EMPTY, ...preenchidoRef.current };
    if (base.hora_inicio && !base.hora_fim) {
      const [h, m] = base.hora_inicio.split(':').map(Number);
      base.hora_fim = `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
    }
    setForm(base);
    setSelItem(null);
    setQuery('');
    setErros({ origem: false, data: false });
    setAbertas([true, false, false, false, false, false]);

    // Aba inicial
    const origemInicial: AbaAtiva | null =
      base.origem_tipo === 'sirene' || base.origem_tipo === 'pastelaria' ? 'sirene'
      : base.origem_tipo === 'kanban' ? 'kanban'
      : base.origem_tipo === 'atividades' ? 'atividades'
      : origemInfo
        ? (origemInfo.tipo === 'kanban' ? 'kanban' : 'sirene')
        : null;
    setAbaAtiva(origemInicial);
  }, [aberto, origemInfo]);

  // ── Disponibilidade ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!form.data || !form.hora_inicio || form.participantes.length === 0) {
      setOcupados(new Set()); return;
    }
    void (async () => {
      const { data } = await supabase
        .from('gantt_planejamento')
        .select('profile_id, hora_inicio, hora_fim')
        .in('profile_id', form.participantes)
        .eq('data', form.data)
        .not('hora_inicio', 'is', null);
      if (!data) return;
      const [hI] = form.hora_inicio!.split(':').map(Number);
      const [hF] = (form.hora_fim ?? `${Math.min(23, hI + 1)}:00`).split(':').map(Number);
      const set = new Set<string>();
      for (const row of data as { profile_id: string; hora_inicio: string; hora_fim: string | null }[]) {
        const [rI] = row.hora_inicio.split(':').map(Number);
        const [rF] = (row.hora_fim ?? `${Math.min(23, rI + 1)}:00`).split(':').map(Number);
        if (rI < hF && rF > hI) set.add(row.profile_id);
      }
      setOcupados(set);
    })();
  }, [form.data, form.hora_inicio, form.hora_fim, form.participantes, supabase]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const set = <K extends keyof DadosAgendamento>(key: K, value: DadosAgendamento[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleSecao = (i: number) =>
    setAbertas(prev => prev.map((v, idx) => idx === i ? !v : v));

  const toggleParticipante = (pid: string) =>
    setForm(prev => ({
      ...prev,
      participantes: prev.participantes.includes(pid)
        ? prev.participantes.filter(x => x !== pid)
        : [...prev.participantes, pid],
    }));

  const handleAba = (aba: AbaAtiva) => {
    setAbaAtiva(aba);
    setSelItem(null);
    setQuery('');
    setForm(prev => ({
      ...prev, acao_id: null, titulo: null, card_id: null, objetivo_id: null,
      origem_tipo: aba === 'sirene' ? 'sirene' : aba === 'kanban' ? 'kanban' : 'atividades',
    }));
    setErros(p => ({ ...p, origem: false }));
  };

  const handleSelItem = (item: BacklogItem) => {
    setSelItem(item);
    if (abaAtiva === 'atividades') {
      set('acao_id', item.acoId ?? null);          // acao_id real do gantt
      set('objetivo_id', item.objetivoId ?? null); // pré-preenche meta vinculada
      set('titulo', null);
      set('card_id', null);
    } else if (abaAtiva === 'kanban') {
      set('card_id', item.id);
      set('titulo', item.label);
      set('acao_id', null);
    } else {
      set('titulo', item.label);
      set('acao_id', null);
      set('card_id', null);
    }
    setErros(p => ({ ...p, origem: false }));
  };

  const handleHoraInicio = (v: string) => {
    set('hora_inicio', v || null);
    if (v && !form.hora_fim) {
      const [h, m] = v.split(':').map(Number);
      set('hora_fim', `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`);
    }
  };

  const recCfg = (form.recorrencia_config ?? {}) as Partial<RecorrenciaConfig>;
  const setRecCfg = (patch: Partial<RecorrenciaConfig>) =>
    set('recorrencia_config', { ...recCfg, ...patch } as RecorrenciaConfig);

  let ocorrenciasPreview = 0;
  if (form.recorrente && recCfg.frequencia && recCfg.ate && form.data) {
    try { ocorrenciasPreview = gerarOcorrencias(form.data, recCfg as RecorrenciaConfig).length; } catch { /**/ }
  }

  const handleSalvar = () => {
    const semOrigem = !abaAtiva || !selItem;
    const novosErros = {
      origem: semOrigem,
      data: !(form.data && form.hora_inicio),
    };
    setErros(novosErros);
    if (Object.values(novosErros).some(Boolean)) {
      if (novosErros.data) setAbertas(prev => { const n = [...prev]; n[0] = true; return n; });
      return;
    }
    onSalvar({ ...form, origem_tipo: abaAtiva === 'sirene' ? 'sirene' : abaAtiva === 'kanban' ? 'kanban' : 'atividades' });
  };

  if (!aberto) return null;

  const itensAba = abaAtiva === 'sirene' ? sireneItems
    : abaAtiva === 'atividades' ? atividItems
    : abaAtiva === 'kanban' ? kanbanItems : [];

  const itensFiltrados = query
    ? itensAba.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : itensAba;

  const progresso = [!!abaAtiva && !!selItem, !!(form.data && form.hora_inicio)].filter(Boolean).length;

  // ── Tab button ────────────────────────────────────────────────────────────
  const TabBtn = ({ aba, icon, label }: { aba: AbaAtiva; icon: string; label: string }) => {
    const ativo = abaAtiva === aba;
    return (
      <button type="button"
        className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-[11px] font-medium transition-colors leading-tight cursor-pointer ${
          ativo ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-white'
        }`}
        onClick={() => handleAba(aba)}>
        <span className="text-sm" aria-hidden="true">{icon}</span>
        {label}
      </button>
    );
  };

  // ── Card de item do backlog ───────────────────────────────────────────────
  const ItemCard = ({ item }: { item: BacklogItem }) => {
    const selecionado = selItem?.id === item.id;
    return (
      <button type="button"
        className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
          selecionado ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
        }`}
        onClick={() => handleSelItem(item)}>
        {item.badgeBg && (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: item.badgeBg, color: item.badgeText, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {item.badge ?? item.sub}
          </span>
        )}
        <div className="min-w-0">
          <p className={`text-xs font-medium truncate ${selecionado ? 'text-blue-800' : 'text-gray-800'}`}>
            {item.label}
          </p>
          {item.sub && !item.badgeBg && (
            <p className="text-[10px] text-gray-400 truncate">{item.sub}</p>
          )}
          {item.sub && item.badgeBg && (
            <p className={`text-[10px] truncate ${selecionado ? 'text-blue-500' : 'text-gray-400'}`}>{item.sub}</p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onFechar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">
              {modo === 'criar' ? 'Nova atividade' : 'Editar atividade'}
            </h2>
            <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-base leading-none">✕</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(progresso / 2) * 100}%`, backgroundColor: progresso === 2 ? '#22c55e' : '#3b82f6' }} />
            </div>
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{progresso}/2 obrigatórios</span>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">

          {/* Banner drag */}
          {origemInfo && (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-blue-500 mt-0.5">
                {origemInfo.tipo === 'kanban' ? 'Kanban' : origemInfo.tipo === 'pastelaria' ? 'Pastelaria' : 'Sirene'}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-blue-800 font-medium truncate">{origemInfo.titulo}</p>
                {origemInfo.subtitulo && <p className="text-[10px] text-blue-500">{origemInfo.subtitulo}</p>}
              </div>
            </div>
          )}

          {/* ── BLOCO UNIFICADO: Origem + Item ── */}
          <div className={`border-b border-gray-100 px-4 pt-4 pb-4 ${erros.origem ? 'bg-red-50' : ''}`}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Origem e atividade
              {erros.origem && <span className="text-red-500 ml-2 normal-case">• selecione um item</span>}
            </p>

            {/* 3 abas */}
            {!origemInfo && (
              <div className="flex gap-2 mb-3">
                <TabBtn aba="sirene"     icon="🔔" label="Sirene / Pastelaria" />
                <TabBtn aba="atividades" icon="📋" label="Atividades planejadas" />
                <TabBtn aba="kanban"     icon="🗂" label="Cards / Kanban" />
              </div>
            )}

            {/* Conteúdo da aba */}
            {abaAtiva ? (
              <div>
                <input type="text"
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder={
                    abaAtiva === 'sirene' ? 'Buscar tópico Sirene...'
                    : abaAtiva === 'atividades' ? 'Buscar comportamento ou atividade...'
                    : 'Buscar card...'
                  }
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />

                {/* Lista */}
                {listLoading ? (
                  <p className="text-xs text-gray-400 py-2">Carregando...</p>
                ) : itensFiltrados.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">Nenhum item encontrado.</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
                    {itensFiltrados.slice(0, 50).map(item => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </div>
                )}

                {/* Item selecionado — abaixo da lista */}
                {selItem && (
                  <div className="mt-3 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-blue-800 truncate">{selItem.label}</p>
                        {selItem.sub && <p className="text-[10px] text-blue-500 mt-0.5">{selItem.sub}</p>}
                        {selItem.extra && (
                          <p className="text-[10px] text-blue-600 mt-1">
                            <span className="text-blue-400">Próxima atividade: </span>{selItem.extra}
                          </p>
                        )}
                      </div>
                      <button type="button" className="text-blue-300 hover:text-blue-500 text-xs shrink-0"
                        onClick={() => { setSelItem(null); set('acao_id', null); set('titulo', null); set('card_id', null); }}>
                        ✕
                      </button>
                    </div>

                    {/* Meta vinculada — somente para Atividades Planejadas */}
                    {abaAtiva === 'atividades' && (
                      <div className="mt-2 pt-2 border-t border-blue-100">
                        <label className="text-[10px] text-blue-500 mb-1 block">Meta vinculada</label>
                        <select
                          className="w-full text-xs border border-blue-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          value={form.objetivo_id ?? ''}
                          onChange={e => set('objetivo_id', e.target.value || null)}>
                          <option value="">— Selecionar meta —</option>
                          {objetivos.map(o => (
                            <option key={o.id} value={o.id}>
                              {o.descricao}{o.tipo ? ` (${o.tipo})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 py-1">Selecione uma categoria acima.</p>
            )}
          </div>

          {/* ── Data e Horário ── */}
          <Secao titulo="Data e horário" aberta={abertas[0]} onToggle={() => toggleSecao(0)} erro={erros.data}>
            <div className="grid grid-cols-3 gap-3 mt-1">
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">Data</label>
                <input type="date"
                  className={`w-full text-xs border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 ${erros.data && !form.data ? 'border-red-400' : 'border-gray-300'}`}
                  value={form.data ?? ''}
                  onChange={e => { set('data', e.target.value || null); setErros(p => ({ ...p, data: false })); }} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">Início</label>
                <input type="time"
                  className={`w-full text-xs border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 ${erros.data && !form.hora_inicio ? 'border-red-400' : 'border-gray-300'}`}
                  value={form.hora_inicio ?? ''}
                  onChange={e => handleHoraInicio(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">Fim</label>
                <input type="time"
                  className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={form.hora_fim ?? ''}
                  onChange={e => set('hora_fim', e.target.value || null)} />
              </div>
            </div>
          </Secao>

          {/* ── Participantes ── */}
          <Secao titulo={`Participantes${form.participantes.length > 0 ? ` (${form.participantes.length})` : ''}`} aberta={abertas[1]} onToggle={() => toggleSecao(1)}>
            {pessoas.length === 0 ? (
              <p className="text-xs text-gray-400 mt-1">Nenhum usuário encontrado.</p>
            ) : (
              <div className="flex flex-col gap-1 mt-1 max-h-48 overflow-y-auto">
                {[
                  ...pessoas.filter(p => form.participantes.includes(p.profile_id)),
                  ...pessoas.filter(p => !form.participantes.includes(p.profile_id)),
                ].map(p => {
                  const sel = form.participantes.includes(p.profile_id);
                  const ocupado = sel && ocupados.has(p.profile_id);
                  return (
                    <label key={p.profile_id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${sel ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="checkbox" className="w-3.5 h-3.5 rounded accent-blue-500"
                        checked={sel}
                        onChange={() => toggleParticipante(p.profile_id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 font-medium truncate">{p.nome}</p>
                        {p.email && <p className="text-[10px] text-gray-400 truncate">{p.email}</p>}
                      </div>
                      {ocupado && <span className="text-[10px] text-orange-500 shrink-0">ocupado</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </Secao>

          {/* ── Link da reunião ── */}
          <Secao titulo="Link da reunião" aberta={abertas[2]} onToggle={() => toggleSecao(2)}>
            <input type="url" className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="https://meet.google.com/..."
              value={form.link_reuniao ?? ''}
              onChange={e => set('link_reuniao', e.target.value || null)} />
          </Secao>

          {/* ── Recorrência ── */}
          <Secao titulo="Recorrência" aberta={abertas[3]} onToggle={() => toggleSecao(3)}>
            <label className="flex items-center gap-2 mt-1 cursor-pointer">
              <input type="checkbox" className="rounded accent-blue-500" checked={form.recorrente}
                onChange={e => set('recorrente', e.target.checked)} />
              <span className="text-xs text-gray-700">Atividade recorrente</span>
            </label>
            {form.recorrente && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1 block">Frequência</label>
                    <select className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-2"
                      value={recCfg.frequencia ?? ''}
                      onChange={e => setRecCfg({ frequencia: e.target.value as RecorrenciaConfig['frequencia'], intervalo: 1, diasSemana: [] })}>
                      <option value="">—</option>
                      <option value="diario">Diariamente</option>
                      <option value="semanal">Semanalmente</option>
                      <option value="mensal">Mensalmente</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1 block">
                      A cada {recCfg.frequencia === 'diario' ? 'dia(s)' : recCfg.frequencia === 'semanal' ? 'semana(s)' : 'mês(es)'}
                    </label>
                    <input type="number" min={1} max={30}
                      className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-2"
                      value={recCfg.intervalo ?? 1}
                      onChange={e => setRecCfg({ intervalo: Math.max(1, Number(e.target.value)) })} />
                  </div>
                </div>
                {recCfg.frequencia === 'semanal' && (
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1.5 block">Dias da semana</label>
                    <div className="flex gap-1.5">
                      {DIAS_SEMANA.map((d, i) => {
                        const sel = (recCfg.diasSemana ?? []).includes(i);
                        return (
                          <button key={i} type="button"
                            className={`w-7 h-7 rounded-full text-[10px] font-medium transition-colors ${sel ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            onClick={() => {
                              const cur = recCfg.diasSemana ?? [];
                              setRecCfg({ diasSemana: sel ? cur.filter(x => x !== i) : [...cur, i].sort() });
                            }}>{d}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-gray-400 mb-1 block">Termina em</label>
                  <input type="date" className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-2"
                    value={recCfg.ate ?? ''}
                    onChange={e => setRecCfg({ ate: e.target.value })} />
                </div>
                {ocorrenciasPreview > 0 && (
                  <p className="text-xs text-blue-600 font-medium">
                    → {ocorrenciasPreview} ocorrência{ocorrenciasPreview !== 1 ? 's' : ''} serão criadas
                  </p>
                )}
              </div>
            )}
          </Secao>

          {/* ── Vínculo ── */}
          <Secao titulo="Informações adicionais" aberta={abertas[4]} onToggle={() => toggleSecao(4)}>
            <div className="grid grid-cols-2 gap-3 mt-1">
              {([
                { label: 'Casa',       key: 'casa_id'          as const, opts: casas.map(x => ({ id: x.id, nome: x.nome })) },
                { label: 'Franqueado', key: 'franqueado_id'    as const, opts: franqueados },
                { label: 'Loteador',   key: 'rede_loteador_id' as const, opts: loteadores },
                { label: 'Condomínio', key: 'condominio_id'    as const, opts: condominios },
              ] as const).map(({ label, key, opts }) => (
                <div key={key}>
                  <label className="text-[10px] text-gray-400 mb-1 block">{label}</label>
                  <select className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-2"
                    value={(form[key] as string | null) ?? ''}
                    onChange={e => set(key, e.target.value || null)}>
                    <option value="">—</option>
                    {opts.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-[10px] text-gray-400 mb-1 block">CNPJ Administrativo</label>
                <select className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-2"
                  value={form.adm_cnpj_id ?? ''} onChange={e => set('adm_cnpj_id', e.target.value || null)}>
                  <option value="">—</option>
                  {cnpjs.map(c => <option key={c.id} value={c.id}>{c.cnpj}{c.descritivo ? ` — ${c.descritivo}` : ''}</option>)}
                </select>
              </div>
            </div>
          </Secao>

          {/* ── Observações ── */}
          <Secao titulo="Observações" aberta={abertas[5]} onToggle={() => toggleSecao(5)}>
            <textarea className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 mt-1 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              rows={3} placeholder="Notas livres..."
              value={form.observacoes ?? ''}
              onChange={e => set('observacoes', e.target.value || null)} />
          </Secao>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button type="button" onClick={onFechar}
            className="px-4 py-2 text-xs text-gray-600 hover:text-gray-800 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSalvar} disabled={isSaving}
            className="px-5 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors font-medium">
            {isSaving ? 'Salvando...' : modo === 'criar'
              ? (ocorrenciasPreview > 1 ? `Criar ${ocorrenciasPreview} ocorrências` : 'Criar atividade')
              : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
