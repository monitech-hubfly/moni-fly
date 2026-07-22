'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type OrigemTipo = 'sirene' | 'pastelaria' | 'kanban' | 'atividades';

export type RecorrenciaConfig = {
  frequencia: 'diario' | 'semanal' | 'mensal';
  intervalo: number;        // a cada N dias/semanas/meses
  diasSemana?: number[];    // [0..6], 0=Dom  (semanal)
  ate: string;              // YYYY-MM-DD
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
  participantes: string[];    // profile IDs
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

// ── Cabeçalho de seção ────────────────────────────────────────────────────────
function SecaoHeader({
  titulo, obrigatorio, aberta, onToggle, erro,
}: {
  titulo: string; obrigatorio?: boolean; aberta: boolean; onToggle: () => void; erro?: boolean;
}) {
  return (
    <button
      type="button"
      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
        erro ? 'bg-red-50' : 'hover:bg-gray-50'
      }`}
      onClick={onToggle}
    >
      <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
        {titulo}
        {obrigatorio && <span className="text-[10px] text-gray-400 font-normal">obrigatório</span>}
        {erro && <span className="text-[10px] text-red-500 font-normal">• campo obrigatório</span>}
      </span>
      <span className="text-gray-400 text-xs">{aberta ? '▲' : '▼'}</span>
    </button>
  );
}

// ── Dias da semana (recorrência semanal) ──────────────────────────────────────
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// ── Gera datas de ocorrências ─────────────────────────────────────────────────
export function gerarOcorrencias(dataInicio: string, cfg: RecorrenciaConfig): string[] {
  const datas: string[] = [];
  const ate = new Date(cfg.ate + 'T00:00:00');
  let cur = new Date(dataInicio + 'T00:00:00');
  const max = 365; // segurança

  while (cur <= ate && datas.length < max) {
    if (cfg.frequencia === 'semanal' && cfg.diasSemana?.length) {
      // No modo semanal com dias específicos, avança dia a dia
      if (cfg.diasSemana.includes(cur.getDay())) {
        datas.push(cur.toISOString().slice(0, 10));
      }
      cur.setDate(cur.getDate() + 1);
    } else {
      datas.push(cur.toISOString().slice(0, 10));
      if (cfg.frequencia === 'diario')   cur.setDate(cur.getDate() + cfg.intervalo);
      if (cfg.frequencia === 'semanal')  cur.setDate(cur.getDate() + cfg.intervalo * 7);
      if (cfg.frequencia === 'mensal')   cur.setMonth(cur.getMonth() + cfg.intervalo);
    }
  }
  return datas;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function ModalAgendamento({
  aberto, onFechar, onSalvar, preenchido, modo, profileId, areaId, isSaving, origemInfo,
}: ModalAgendamentoProps) {
  const supabase = useMemo(() => createClient(), []);

  const [form, setForm] = useState<DadosAgendamento>({ ...EMPTY });

  // Índices: [origem, comportamento, meta, datahora, participantes, link, recorrencia, vinculo, obs]
  const [abertas, setAbertas] = useState([true, true, true, true, false, false, false, false, false]);
  const [erros, setErros] = useState({ comportamento: false, meta: false, data: false, titulo: false });

  // Select options
  const [acoes,       setAcoes]       = useState<{ id: string; tipo_atividade: string }[]>([]);
  const [objetivos,   setObjetivos]   = useState<{ id: string; descricao: string; tipo: string | null }[]>([]);
  const [casas,       setCasas]       = useState<{ id: string; nome: string }[]>([]);
  const [franqueados, setFranqueados] = useState<{ id: string; nome: string }[]>([]);
  const [loteadores,  setLoteadores]  = useState<{ id: string; nome: string }[]>([]);
  const [condominios, setCondominios] = useState<{ id: string; nome: string }[]>([]);
  const [cnpjs,       setCnpjs]       = useState<{ id: string; cnpj: string; descritivo: string | null }[]>([]);

  // Pessoas da área para participantes
  const [pessoas, setPessoas] = useState<{ profile_id: string; nome: string }[]>([]);
  // Disponibilidade: profile_id → bool (tem evento no mesmo horário)
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());

  const preenchidoRef = useRef(preenchido);
  preenchidoRef.current = preenchido;

  // ── Reset ao abrir ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!aberto) return;
    const base: DadosAgendamento = { ...EMPTY, ...preenchidoRef.current };
    if (base.hora_inicio && !base.hora_fim) {
      const [h, m] = base.hora_inicio.split(':').map(Number);
      base.hora_fim = `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
    }
    // Inferir origem_tipo do origemInfo se não tiver
    if (!base.origem_tipo && origemInfo) {
      base.origem_tipo = origemInfo.tipo === 'pastelaria' ? 'pastelaria'
        : origemInfo.tipo === 'sirene' ? 'sirene'
        : origemInfo.tipo === 'kanban' ? 'kanban'
        : null;
    }
    setForm(base);
    setAbertas([true, true, true, true, false, false, false, false, false]);
    setErros({ comportamento: false, meta: false, data: false, titulo: false });
  }, [aberto, origemInfo]);

  // ── Carregar opções ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!aberto) return;
    void (async () => {
      try {
        if (areaId) {
          const [acoesRes, objRes, pessoasRes] = await Promise.all([
            supabase.from('acoes').select('id, tipo_atividade').eq('area_id', areaId).order('tipo_atividade'),
            supabase.from('objetivos').select('id, descricao, tipo').eq('area_id', areaId).eq('status', 'ativo').order('descricao'),
            supabase.from('area_pessoas').select('profile_id, nome').eq('area_id', areaId).not('profile_id', 'is', null),
          ]);
          setAcoes((acoesRes.data ?? []) as { id: string; tipo_atividade: string }[]);
          setObjetivos((objRes.data ?? []) as { id: string; descricao: string; tipo: string | null }[]);
          setPessoas(((pessoasRes.data ?? []) as { profile_id: string; nome: string }[]).filter(p => p.profile_id !== profileId));
        }
        const [casasRes, frankRes, loteadoresRes, condRes, cnpjsRes] = await Promise.all([
          supabase.from('casas').select('id, nome').order('nome').limit(100),
          supabase.from('rede_franqueados').select('id, nome_completo').order('nome_completo').limit(100),
          supabase.from('rede_loteadores').select('id, nome').order('nome').limit(100),
          supabase.from('condominios').select('id, nome').order('nome').limit(100),
          supabase.from('adm_cnpjs').select('id, cnpj, descritivo').order('cnpj').limit(100),
        ]);
        setCasas((casasRes.data ?? []) as { id: string; nome: string }[]);
        setFranqueados(((frankRes.data ?? []) as { id: string; nome_completo?: string | null }[]).map(x => ({ id: x.id, nome: String(x.nome_completo ?? '').trim() || '—' })));
        setLoteadores((loteadoresRes.data ?? []) as { id: string; nome: string }[]);
        setCondominios((condRes.data ?? []) as { id: string; nome: string }[]);
        setCnpjs((cnpjsRes.data ?? []) as { id: string; cnpj: string; descritivo: string | null }[]);
      } catch (e) { console.error(e); }
    })();
  }, [aberto, areaId, supabase, profileId]);

  // ── Verificar disponibilidade dos participantes ─────────────────────────────
  useEffect(() => {
    if (!form.data || !form.hora_inicio || form.participantes.length === 0) {
      setOcupados(new Set());
      return;
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
        // Overlap check
        if (rI < hF && rF > hI) set.add(row.profile_id);
      }
      setOcupados(set);
    })();
  }, [form.data, form.hora_inicio, form.hora_fim, form.participantes, supabase]);

  const toggleSecao = (i: number) => setAbertas(prev => prev.map((v, idx) => idx === i ? !v : v));
  const set = <K extends keyof DadosAgendamento>(key: K, value: DadosAgendamento[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleHoraInicio = (v: string) => {
    set('hora_inicio', v || null);
    if (v && !form.hora_fim) {
      const [h, m] = v.split(':').map(Number);
      set('hora_fim', `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`);
    }
  };

  const toggleParticipante = (pid: string) => {
    setForm(prev => ({
      ...prev,
      participantes: prev.participantes.includes(pid)
        ? prev.participantes.filter(x => x !== pid)
        : [...prev.participantes, pid],
    }));
  };

  const recCfg = (form.recorrencia_config ?? {}) as Partial<RecorrenciaConfig>;
  const setRecCfg = (patch: Partial<RecorrenciaConfig>) =>
    set('recorrencia_config', { ...recCfg, ...patch } as RecorrenciaConfig);

  // Origem efetiva (drag info ou selecionada no modal)
  const origemEfetiva: OrigemTipo | null = form.origem_tipo
    ?? (origemInfo ? (origemInfo.tipo === 'pastelaria' ? 'pastelaria' : origemInfo.tipo) as OrigemTipo : null);
  const isKanban = origemEfetiva === 'kanban';

  // Progresso — obrigatórios variam por origem
  const camposOk = [
    isKanban ? !!form.titulo : !!form.acao_id,
    isKanban ? true : !!form.objetivo_id,
    !!(form.data && form.hora_inicio),
  ];
  const progresso = camposOk.filter(Boolean).length;

  const handleSalvar = () => {
    const novosErros = {
      comportamento: !isKanban && !form.acao_id,
      titulo:        isKanban && !form.titulo,
      meta:          !isKanban && !form.objetivo_id,
      data:          !(form.data && form.hora_inicio),
    };
    setErros(novosErros);
    if (Object.values(novosErros).some(Boolean)) {
      setAbertas(prev => {
        const n = [...prev];
        if (novosErros.comportamento || novosErros.titulo) n[1] = true;
        if (novosErros.meta)  n[2] = true;
        if (novosErros.data)  n[3] = true;
        return n;
      });
      return;
    }
    onSalvar({ ...form, origem_tipo: origemEfetiva });
  };

  if (!aberto) return null;

  // Ocorrências preview para recorrência
  let ocorrenciasPreview = 0;
  if (form.recorrente && recCfg.frequencia && recCfg.ate && form.data) {
    try {
      ocorrenciasPreview = gerarOcorrencias(form.data, recCfg as RecorrenciaConfig).length;
    } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onFechar} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">
              {modo === 'criar' ? 'Nova atividade' : 'Editar atividade'}
            </h2>
            <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(progresso / 3) * 100}%`, backgroundColor: progresso === 3 ? '#22c55e' : '#3b82f6' }}
              />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{progresso}/3 obrigatórios</span>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">

          {/* Banner de origem (drag do backlog) */}
          {origemInfo && (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-blue-500 mt-0.5">
                {origemInfo.tipo === 'sirene' ? 'Sirene' : origemInfo.tipo === 'pastelaria' ? 'Pastelaria' : 'Kanban'}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-blue-800 font-medium leading-snug truncate">{origemInfo.titulo}</p>
                {origemInfo.subtitulo && <p className="text-[10px] text-blue-500 leading-snug">{origemInfo.subtitulo}</p>}
              </div>
            </div>
          )}

          {/* Seção 0 — Origem (apenas quando não veio de drag e está criando) */}
          {!origemInfo && modo === 'criar' && (
            <div className="border-b border-gray-100">
              <SecaoHeader titulo="0. Origem da atividade" aberta={abertas[0]} onToggle={() => toggleSecao(0)} />
              {abertas[0] && (
                <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
                  {([
                    { tipo: 'atividades' as OrigemTipo, label: 'Atividades Planejadas', desc: 'Comportamento do Carômetro' },
                    { tipo: 'sirene'     as OrigemTipo, label: 'Sirene',                desc: 'Chamado ou atendimento' },
                    { tipo: 'pastelaria' as OrigemTipo, label: 'Pastelaria',            desc: 'Tarefa da Pastelaria' },
                    { tipo: 'kanban'     as OrigemTipo, label: 'Cards / Kanban',        desc: 'Próxima atividade de um card' },
                  ] as const).map(({ tipo, label, desc }) => (
                    <button
                      key={tipo}
                      type="button"
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                        origemEfetiva === tipo
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      onClick={() => set('origem_tipo', tipo)}
                    >
                      <div className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                        origemEfetiva === tipo ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        <p className="text-[11px] text-gray-500">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Seção 1 — Comportamento / Título */}
          <div className="border-b border-gray-100">
            <SecaoHeader
              titulo={isKanban ? '1. Próxima atividade' : '1. Comportamento / Atividade'}
              obrigatorio
              aberta={abertas[1]}
              onToggle={() => toggleSecao(1)}
              erro={erros.comportamento || erros.titulo}
            />
            {abertas[1] && (
              <div className="px-4 pb-4 pt-1">
                {isKanban ? (
                  <>
                    <input
                      type="text"
                      placeholder="Descreva a próxima atividade do card..."
                      className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 ${erros.titulo ? 'border-red-400' : 'border-gray-300'}`}
                      value={form.titulo ?? ''}
                      onChange={e => { set('titulo', e.target.value || null); setErros(p => ({ ...p, titulo: false })); }}
                    />
                    <div className="mt-2">
                      <label className="text-xs text-gray-500 mb-1 block">Card (Kanban) — ID</label>
                      <input
                        type="text"
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="ID do card"
                        value={form.card_id ?? ''}
                        onChange={e => set('card_id', e.target.value || null)}
                      />
                    </div>
                  </>
                ) : (
                  <select
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 ${erros.comportamento ? 'border-red-400' : 'border-gray-300'}`}
                    value={form.acao_id ?? ''}
                    onChange={e => { set('acao_id', e.target.value || null); setErros(p => ({ ...p, comportamento: false })); }}
                  >
                    <option value="">— Selecionar comportamento —</option>
                    {acoes.map(a => <option key={a.id} value={a.id}>{a.tipo_atividade}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Seção 2 — Meta (oculta para kanban) */}
          {!isKanban && (
            <div className="border-b border-gray-100">
              <SecaoHeader titulo="2. Meta vinculada" obrigatorio aberta={abertas[2]} onToggle={() => toggleSecao(2)} erro={erros.meta} />
              {abertas[2] && (
                <div className="px-4 pb-4 pt-1">
                  <select
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 ${erros.meta ? 'border-red-400' : 'border-gray-300'}`}
                    value={form.objetivo_id ?? ''}
                    onChange={e => { set('objetivo_id', e.target.value || null); setErros(p => ({ ...p, meta: false })); }}
                  >
                    <option value="">— Selecionar meta —</option>
                    {objetivos.map(o => (
                      <option key={o.id} value={o.id}>{o.descricao}{o.tipo ? ` (${o.tipo})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Seção 3 — Data e Horário */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="3. Data e Horário" obrigatorio aberta={abertas[3]} onToggle={() => toggleSecao(3)} erro={erros.data} />
            {abertas[3] && (
              <div className="px-4 pb-4 pt-1 grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data</label>
                  <input
                    type="date"
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 ${erros.data && !form.data ? 'border-red-400' : 'border-gray-300'}`}
                    value={form.data ?? ''}
                    onChange={e => { set('data', e.target.value || null); setErros(p => ({ ...p, data: false })); }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Início</label>
                  <input
                    type="time"
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 ${erros.data && !form.hora_inicio ? 'border-red-400' : 'border-gray-300'}`}
                    value={form.hora_inicio ?? ''}
                    onChange={e => handleHoraInicio(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fim</label>
                  <input
                    type="time"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={form.hora_fim ?? ''}
                    onChange={e => set('hora_fim', e.target.value || null)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Seção 4 — Participantes */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo={`4. Participantes${form.participantes.length > 0 ? ` (${form.participantes.length})` : ''}`} aberta={abertas[4]} onToggle={() => toggleSecao(4)} />
            {abertas[4] && (
              <div className="px-4 pb-4 pt-1">
                {pessoas.length === 0 ? (
                  <p className="text-xs text-gray-400">Nenhuma pessoa encontrada na área.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {pessoas.map(p => {
                      const selecionado = form.participantes.includes(p.profile_id);
                      const ocupado = selecionado && ocupados.has(p.profile_id);
                      return (
                        <button
                          key={p.profile_id}
                          type="button"
                          onClick={() => toggleParticipante(p.profile_id)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
                            selecionado ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center text-white text-[10px] ${
                            selecionado ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {selecionado && '✓'}
                          </div>
                          <span className="text-sm text-gray-700 flex-1">{p.nome}</span>
                          {ocupado && (
                            <span className="text-[10px] text-orange-500 font-medium">ocupado</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seção 5 — Link da reunião */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="5. Link da reunião" aberta={abertas[5]} onToggle={() => toggleSecao(5)} />
            {abertas[5] && (
              <div className="px-4 pb-4 pt-1">
                <input
                  type="url"
                  placeholder="https://meet.google.com/... ou https://zoom.us/..."
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={form.link_reuniao ?? ''}
                  onChange={e => set('link_reuniao', e.target.value || null)}
                />
              </div>
            )}
          </div>

          {/* Seção 6 — Recorrência */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="6. Recorrência" aberta={abertas[6]} onToggle={() => toggleSecao(6)} />
            {abertas[6] && (
              <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={form.recorrente}
                    onChange={e => set('recorrente', e.target.checked)} />
                  <span className="text-sm text-gray-700">Atividade recorrente</span>
                </label>
                {form.recorrente && (
                  <div className="flex flex-col gap-3 pl-1">
                    {/* Frequência */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Frequência</label>
                        <select
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                          value={recCfg.frequencia ?? ''}
                          onChange={e => setRecCfg({ frequencia: e.target.value as RecorrenciaConfig['frequencia'], intervalo: 1, diasSemana: [] })}
                        >
                          <option value="">—</option>
                          <option value="diario">Diariamente</option>
                          <option value="semanal">Semanalmente</option>
                          <option value="mensal">Mensalmente</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">
                          Repetir a cada {recCfg.frequencia === 'diario' ? 'dia(s)' : recCfg.frequencia === 'semanal' ? 'semana(s)' : 'mês(es)'}
                        </label>
                        <input
                          type="number" min={1} max={30}
                          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                          value={recCfg.intervalo ?? 1}
                          onChange={e => setRecCfg({ intervalo: Math.max(1, Number(e.target.value)) })}
                        />
                      </div>
                    </div>

                    {/* Dias da semana (apenas semanal) */}
                    {recCfg.frequencia === 'semanal' && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">Dias da semana</label>
                        <div className="flex gap-1.5">
                          {DIAS_SEMANA.map((d, i) => {
                            const sel = (recCfg.diasSemana ?? []).includes(i);
                            return (
                              <button
                                key={i}
                                type="button"
                                className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                                  sel ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                                onClick={() => {
                                  const cur = recCfg.diasSemana ?? [];
                                  setRecCfg({ diasSemana: sel ? cur.filter(x => x !== i) : [...cur, i].sort() });
                                }}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Termina em */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Termina em</label>
                      <input
                        type="date"
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                        value={recCfg.ate ?? ''}
                        onChange={e => setRecCfg({ ate: e.target.value })}
                      />
                    </div>

                    {/* Preview */}
                    {ocorrenciasPreview > 0 && (
                      <p className="text-xs text-blue-600 font-medium">
                        → {ocorrenciasPreview} ocorrência{ocorrenciasPreview !== 1 ? 's' : ''} serão criadas
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seção 7 — Vínculo */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="7. Vínculo" aberta={abertas[7]} onToggle={() => toggleSecao(7)} />
            {abertas[7] && (
              <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-3">
                {([
                  { label: 'Casa',       key: 'casa_id'          as const, opts: casas },
                  { label: 'Franqueado', key: 'franqueado_id'    as const, opts: franqueados },
                  { label: 'Loteador',   key: 'rede_loteador_id' as const, opts: loteadores },
                  { label: 'Condomínio', key: 'condominio_id'    as const, opts: condominios },
                ] as const).map(({ label, key, opts }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                    <select className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                      value={(form[key] as string | null) ?? ''}
                      onChange={e => set(key, e.target.value || null)}>
                      <option value="">—</option>
                      {opts.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">CNPJ Administrativo</label>
                  <select className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                    value={form.adm_cnpj_id ?? ''} onChange={e => set('adm_cnpj_id', e.target.value || null)}>
                    <option value="">—</option>
                    {cnpjs.map(c => <option key={c.id} value={c.id}>{c.cnpj}{c.descritivo ? ` — ${c.descritivo}` : ''}</option>)}
                  </select>
                </div>
                {!isKanban && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Nº Chamado Sirene</label>
                    <input type="number" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                      value={form.sirene_chamado_id ?? ''}
                      onChange={e => set('sirene_chamado_id', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seção 8 — Observações */}
          <div>
            <SecaoHeader titulo="8. Observações" aberta={abertas[8]} onToggle={() => toggleSecao(8)} />
            {abertas[8] && (
              <div className="px-4 pb-4 pt-1">
                <textarea
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={3} placeholder="Notas livres..."
                  value={form.observacoes ?? ''}
                  onChange={e => set('observacoes', e.target.value || null)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button type="button" onClick={onFechar}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSalvar} disabled={isSaving}
            className="px-5 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors">
            {isSaving ? 'Salvando...' : modo === 'criar'
              ? (ocorrenciasPreview > 1 ? `Criar ${ocorrenciasPreview} ocorrências` : 'Criar atividade')
              : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
