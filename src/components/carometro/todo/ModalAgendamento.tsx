'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Tipo central exportado ────────────────────────────────────────────────────
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
  recorrencia_config: object | null;
  observacoes: string | null;
  tempo_estimado_horas: number | null;
};

const EMPTY: DadosAgendamento = {
  acao_id: null, objetivo_id: null, data: null, hora_inicio: null, hora_fim: null,
  casa_id: null, franqueado_id: null, rede_loteador_id: null, condominio_id: null,
  adm_cnpj_id: null, sirene_chamado_id: null, card_id: null,
  recorrente: false, recorrencia_config: null, observacoes: null, tempo_estimado_horas: null,
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

// ── Cabeçalho de seção colapsável ─────────────────────────────────────────────
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

// ── Modal ─────────────────────────────────────────────────────────────────────
export function ModalAgendamento({
  aberto, onFechar, onSalvar, preenchido, modo, profileId, areaId, isSaving, origemInfo,
}: ModalAgendamentoProps) {
  const supabase = useMemo(() => createClient(), []);

  // Form state
  const [form, setForm] = useState<DadosAgendamento>({ ...EMPTY });

  // Seções abertas: [acao, meta, datahora, vinculo, recorrencia, obs, tempo]
  const [abertas, setAbertas] = useState([true, true, true, false, false, false, false]);

  // Erros de validação
  const [erros, setErros] = useState({ acao: false, meta: false, data: false });

  // Select options
  const [acoes,       setAcoes]       = useState<{ id: string; tipo_atividade: string }[]>([]);
  const [objetivos,   setObjetivos]   = useState<{ id: string; descricao: string; tipo: string | null }[]>([]);
  const [casas,       setCasas]       = useState<{ id: string; nome: string }[]>([]);
  const [franqueados, setFranqueados] = useState<{ id: string; nome: string }[]>([]);
  const [loteadores,  setLoteadores]  = useState<{ id: string; nome: string }[]>([]);
  const [condominios, setCondominios] = useState<{ id: string; nome: string }[]>([]);
  const [cnpjs,       setCnpjs]       = useState<{ id: string; cnpj: string; descritivo: string | null }[]>([]);

  // Usar ref para preenchido e evitar re-run ao mesmo aberto
  const preenchidoRef = useRef(preenchido);
  preenchidoRef.current = preenchido;

  // Resetar form quando modal abre
  useEffect(() => {
    if (!aberto) return;
    const base: DadosAgendamento = { ...EMPTY, ...preenchidoRef.current };
    // Auto-fill hora_fim se hora_inicio presente e hora_fim ausente
    if (base.hora_inicio && !base.hora_fim) {
      const [h, m] = base.hora_inicio.split(':').map(Number);
      base.hora_fim = `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;
    }
    setForm(base);
    setAbertas([true, true, true, false, false, false, false]);
    setErros({ acao: false, meta: false, data: false });
  }, [aberto]);

  // Carregar opções dos selects
  useEffect(() => {
    if (!aberto) return;
    void (async () => {
      const fetchOpcoes = async () => {
        if (areaId) {
          const [acoesRes, objRes] = await Promise.all([
            supabase.from('acoes').select('id, tipo_atividade').eq('area_id', areaId).order('tipo_atividade'),
            supabase.from('objetivos').select('id, descricao, tipo').eq('area_id', areaId).eq('status', 'ativo').order('descricao'),
          ]);
          setAcoes((acoesRes.data ?? []) as { id: string; tipo_atividade: string }[]);
          setObjetivos((objRes.data ?? []) as { id: string; descricao: string; tipo: string | null }[]);
        }
        const [casasRes, frankRes, loteadoresRes, condRes, cnpjsRes] = await Promise.all([
          supabase.from('casas').select('id, nome').order('nome').limit(100),
          supabase.from('rede_franqueados').select('id, nome').order('nome').limit(100),
          supabase.from('rede_loteadores').select('id, nome').order('nome').limit(100),
          supabase.from('condominios').select('id, nome').order('nome').limit(100),
          supabase.from('adm_cnpjs').select('id, cnpj, descritivo').order('cnpj').limit(100),
        ]);
        setCasas((casasRes.data ?? []) as { id: string; nome: string }[]);
        setFranqueados((frankRes.data ?? []) as { id: string; nome: string }[]);
        setLoteadores((loteadoresRes.data ?? []) as { id: string; nome: string }[]);
        setCondominios((condRes.data ?? []) as { id: string; nome: string }[]);
        setCnpjs((cnpjsRes.data ?? []) as { id: string; cnpj: string; descritivo: string | null }[]);
      };
      await fetchOpcoes().catch(console.error);
    })();
  }, [aberto, areaId, supabase]);

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

  // Progresso: 0–3 obrigatórios
  const progresso = [!!form.acao_id, !!form.objetivo_id, !!(form.data && form.hora_inicio)].filter(Boolean).length;

  const handleSalvar = () => {
    const novosErros = {
      acao: !form.acao_id,
      meta: !form.objetivo_id,
      data: !(form.data && form.hora_inicio),
    };
    setErros(novosErros);
    if (novosErros.acao || novosErros.meta || novosErros.data) {
      setAbertas(prev => [
        prev[0] || novosErros.acao,
        prev[1] || novosErros.meta,
        prev[2] || novosErros.data,
        prev[3], prev[4], prev[5], prev[6],
      ]);
      return;
    }
    onSalvar(form);
  };

  if (!aberto) return null;

  // Supress unused profileId lint — disponível para uso futuro (permissões, etc.)
  void profileId;

  const recConfig = (form.recorrencia_config ?? {}) as Record<string, string>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onFechar} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-800">
              {modo === 'criar' ? 'Nova atividade' : 'Editar atividade'}
            </h2>
            <button type="button" onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
              ✕
            </button>
          </div>
          {/* Barra de progresso */}
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

        {/* Body scrollável */}
        <div className="overflow-y-auto flex-1">

          {/* Banner de origem (drag do backlog) */}
          {origemInfo && (
            <div className="flex items-start gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-blue-500 mt-0.5">
                {origemInfo.tipo === 'sirene' ? 'Sirene' : origemInfo.tipo === 'pastelaria' ? 'Pastelaria' : 'Kanban'}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-blue-800 font-medium leading-snug truncate">{origemInfo.titulo}</p>
                {origemInfo.subtitulo && (
                  <p className="text-[10px] text-blue-500 leading-snug">{origemInfo.subtitulo}</p>
                )}
              </div>
            </div>
          )}

          {/* Seção 1 — Comportamento */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="1. Comportamento / Atividade" obrigatorio aberta={abertas[0]} onToggle={() => toggleSecao(0)} erro={erros.acao} />
            {abertas[0] && (
              <div className="px-4 pb-4 pt-1">
                <select
                  className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 ${erros.acao ? 'border-red-400' : 'border-gray-300'}`}
                  value={form.acao_id ?? ''}
                  onChange={e => { set('acao_id', e.target.value || null); setErros(p => ({ ...p, acao: false })); }}
                >
                  <option value="">— Selecionar comportamento —</option>
                  {acoes.map(a => <option key={a.id} value={a.id}>{a.tipo_atividade}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Seção 2 — Meta */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="2. Meta vinculada" obrigatorio aberta={abertas[1]} onToggle={() => toggleSecao(1)} erro={erros.meta} />
            {abertas[1] && (
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

          {/* Seção 3 — Data e Horário */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="3. Data e Horário" obrigatorio aberta={abertas[2]} onToggle={() => toggleSecao(2)} erro={erros.data} />
            {abertas[2] && (
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

          {/* Seção 4 — Vínculo */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="4. Vínculo" aberta={abertas[3]} onToggle={() => toggleSecao(3)} />
            {abertas[3] && (
              <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-3">
                {([
                  { label: 'Casa', key: 'casa_id' as const, opts: casas },
                  { label: 'Franqueado', key: 'franqueado_id' as const, opts: franqueados },
                  { label: 'Loteador', key: 'rede_loteador_id' as const, opts: loteadores },
                  { label: 'Condomínio', key: 'condominio_id' as const, opts: condominios },
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
                    value={form.adm_cnpj_id ?? ''}
                    onChange={e => set('adm_cnpj_id', e.target.value || null)}>
                    <option value="">—</option>
                    {cnpjs.map(c => <option key={c.id} value={c.id}>{c.cnpj}{c.descritivo ? ` — ${c.descritivo}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Nº Chamado Sirene</label>
                  <input type="number" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                    value={form.sirene_chamado_id ?? ''}
                    onChange={e => set('sirene_chamado_id', e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Card (Kanban) — ID</label>
                  <input type="text" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="ID do card"
                    value={form.card_id ?? ''}
                    onChange={e => set('card_id', e.target.value || null)} />
                </div>
              </div>
            )}
          </div>

          {/* Seção 5 — Recorrência */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="5. Recorrência" aberta={abertas[4]} onToggle={() => toggleSecao(4)} />
            {abertas[4] && (
              <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={form.recorrente}
                    onChange={e => set('recorrente', e.target.checked)} />
                  <span className="text-sm text-gray-700">Atividade recorrente</span>
                </label>
                {form.recorrente && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Tipo</label>
                      <select className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                        value={recConfig.tipo ?? ''}
                        onChange={e => set('recorrencia_config', { ...recConfig, tipo: e.target.value })}>
                        <option value="">—</option>
                        <option value="diario">Diário</option>
                        <option value="semanal">Semanal</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="mensal">Mensal</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Até quando</label>
                      <input type="date" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                        value={recConfig.ate ?? ''}
                        onChange={e => set('recorrencia_config', { ...recConfig, ate: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seção 6 — Observações */}
          <div className="border-b border-gray-100">
            <SecaoHeader titulo="6. Observações" aberta={abertas[5]} onToggle={() => toggleSecao(5)} />
            {abertas[5] && (
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

          {/* Seção 7 — Tempo estimado */}
          <div>
            <SecaoHeader titulo="7. Tempo estimado" aberta={abertas[6]} onToggle={() => toggleSecao(6)} />
            {abertas[6] && (
              <div className="px-4 pb-4 pt-1 flex items-center gap-2">
                <input
                  type="number" min={0.5} step={0.5}
                  className="w-28 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={form.tempo_estimado_horas ?? ''}
                  onChange={e => set('tempo_estimado_horas', e.target.value ? Number(e.target.value) : null)}
                />
                <span className="text-sm text-gray-500">horas</span>
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
            {isSaving ? 'Salvando...' : modo === 'criar' ? 'Criar atividade' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
