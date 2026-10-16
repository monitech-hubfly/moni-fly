'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { useMetasIndicadores, type ResponsavelItem } from '@/hooks/useMetasIndicadores';
import { isoWeek } from '@/utils/periodos';
import { semanasDoMes } from '@/hooks/usePlanoBoneDay';
import { registrarLog } from '@/hooks/useAuditLog';

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 bg-gray-900 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
      <span className="text-green-400 text-sm">✓</span>
      {message}
    </div>
  );
}

// ── isoWeekToDates ────────────────────────────────────────────────────────────
function isoWeekToDates(week: number, year: number): { label: string; range: string } {
  const jan4 = new Date(year, 0, 4);
  const dow = (jan4.getDay() + 6) % 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - dow + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { label: `S${week}`, range: `${fmt(weekStart)}-${fmt(weekEnd)}` };
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type IndAreaRow = {
  id: string; nome: string; indicador_chave: boolean | null;
  semaforo_faixas: unknown; tipo: string | null; grupo: string | null;
};
type IndRespAreaRow = { indicador_id: string; profile_id: string };
type LancRow = { indicador_id: string; valor: string; semana: number };

// Larguras fixas apenas para nome/unit/avatar; semanas usam flex-1
const COL_NOME = 'w-[160px]';
const COL_UNIT = 'w-[28px]';
const COL_AVT  = 'w-[36px]';

// ── Cabeçalho de semanas (renderizado acima das linhas de cada grupo) ──────────
function SemanasHeader({
  semanas,
  anoRelativo,
  semanaAtual,
}: {
  semanas: number[];
  anoRelativo: number;
  semanaAtual: number;
}) {
  return (
    <div className="flex items-end pb-1 border-b border-gray-200">
      <div className={`${COL_NOME} flex-shrink-0`} />
      <div className={`${COL_UNIT} flex-shrink-0`} />
      {/* semanas ocupam todo o espaço restante */}
      <div className="flex-1 flex">
        {semanas.map(s => {
          const info = isoWeekToDates(s, anoRelativo);
          const isAtual = s === semanaAtual;
          return (
            <div key={s} className="flex-1 flex flex-col items-center px-0.5">
              <span className={`text-[8px] font-bold whitespace-nowrap ${isAtual ? 'text-blue-500' : 'text-gray-400'}`}>
                {info.label}{isAtual ? ' ★' : ''}
              </span>
              <span className={`text-[7px] whitespace-nowrap ${isAtual ? 'text-blue-300' : 'text-gray-300'}`}>
                {info.range}
              </span>
            </div>
          );
        })}
      </div>
      <div className={`${COL_AVT} flex-shrink-0`} />
    </div>
  );
}

// ── Linha de indicador ────────────────────────────────────────────────────────
function IndicadorLinhaOtimizada({
  ind,
  responsaveisIds,
  responsaveis,
  valores,
  semanas,
  anoRelativo,
  semanaAtual,
  onLancar,
  onToast,
}: {
  ind: IndAreaRow;
  responsaveisIds: string[];
  responsaveis: ResponsavelItem[];
  valores: Record<number, string>;
  semanas: number[];
  anoRelativo: number;
  semanaAtual: number;
  onLancar: (indId: string, valor: string, semana: number) => Promise<boolean>;
  onToast?: (msg: string) => void;
}) {
  const [edits,    setEdits]    = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const s of semanas) init[s] = valores[s] ?? '';
    return init;
  });
  const [salvando, setSalvando] = useState<Record<number, boolean>>({});

  // Sincroniza valores externos (ao recarregar dados)
  useEffect(() => {
    setEdits(prev => {
      const next = { ...prev };
      for (const s of semanas) {
        if (valores[s] !== undefined) next[s] = valores[s];
      }
      return next;
    });
  }, [valores, semanas]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSalvar = async (semana: number) => {
    const v = (edits[semana] ?? '').trim();
    if (!v) return;
    setSalvando(prev => ({ ...prev, [semana]: true }));
    const ok = await onLancar(ind.id, v, semana);
    setSalvando(prev => ({ ...prev, [semana]: false }));
    onToast?.(ok ? 'Valor salvo!' : 'Erro ao salvar');
  };

  const unidade = (() => {
    const t = (ind.tipo ?? '').toLowerCase();
    if (t === 'booleano' || t === 'boolean') return 'S/N';
    if (t === 'percentual' || t.includes('pct') || t.includes('%')) return '%';
    return 'qtd';
  })();

  return (
    <div className="flex items-center py-1.5 border-b border-gray-50 last:border-b-0">
      {/* Nome */}
      <div className={`${COL_NOME} flex-shrink-0 flex items-center gap-1 min-w-0 pr-1`}>
        {ind.indicador_chave && <span className="text-[9px] flex-shrink-0">⭐</span>}
        <span className="text-xs text-gray-800 truncate leading-tight" title={ind.nome}>
          {ind.nome}
        </span>
      </div>

      {/* Unidade */}
      <div className={`${COL_UNIT} flex-shrink-0 text-center`}>
        <span className="text-[8px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded font-medium">
          {unidade}
        </span>
      </div>

      {/* Colunas de semana — flex-1 distribuindo igualmente */}
      <div className="flex-1 flex gap-1">
        {semanas.map(s => {
          const isAtual = s === semanaAtual;
          return (
            <input
              key={s}
              type="text"
              value={edits[s] ?? ''}
              onChange={e => setEdits(prev => ({ ...prev, [s]: e.target.value }))}
              onBlur={() => { void handleSalvar(s); }}
              onKeyDown={e => { if (e.key === 'Enter') void handleSalvar(s); }}
              disabled={salvando[s]}
              placeholder="—"
              className={`flex-1 min-w-0 text-xs text-center rounded px-1 py-1.5 focus:outline-none focus:ring-1 disabled:opacity-50 transition-colors ${
                isAtual
                  ? 'border border-blue-300 bg-blue-50 focus:ring-blue-400'
                  : 'border border-gray-200 bg-white focus:ring-gray-300'
              }`}
            />
          );
        })}
      </div>

      {/* Avatares responsáveis */}
      <div className={`${COL_AVT} flex-shrink-0 flex items-center justify-end gap-0.5 pl-1`}>
        {responsaveisIds.slice(0, 1).map(pid => {
          const nome = responsaveis.find(r => r.profile_id === pid)?.nome ?? '?';
          return (
            <span
              key={pid}
              title={nome}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold border border-blue-200 flex-shrink-0 cursor-default"
            >
              {nome.charAt(0).toUpperCase()}
            </span>
          );
        })}
        {responsaveisIds.length > 1 && (
          <span className="text-[8px] text-gray-400">+{responsaveisIds.length - 1}</span>
        )}
      </div>
    </div>
  );
}

// ── Bloco principal ───────────────────────────────────────────────────────────
export function IndicadoresAreaBloco({
  onSummaryChange,
}: {
  onSummaryChange?: (totalMeus: number, total: number) => void;
} = {}) {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveProfileId, areaId } = useEffectiveUser();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [indsArea,      setIndsArea]      = useState<IndAreaRow[]>([]);
  const [indsAreaResp,  setIndsAreaResp]  = useState<Record<string, string[]>>({});
  // valoresLanc: "indId-semana" -> valor
  const [valoresLanc,   setValoresLanc]   = useState<Record<string, string>>({});
  const [isLoading,     setIsLoading]     = useState(true);
  const [toastMsg,      setToastMsg]      = useState<string | null>(null);

  // Semana atual e semanas do mês atual
  const hoje         = new Date();
  const semanaAtual  = isoWeek(hoje);
  const anoRelativo  = hoje.getFullYear();
  const mesAtual     = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const semanas      = useMemo(() => semanasDoMes(mesAtual), [mesAtual]);

  // Responsáveis da área (para exibir nomes/avatares)
  const { responsaveis } = useMetasIndicadores(effectiveProfileId, areaId, null);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, [supabase]);

  const carregarInds = useCallback(async () => {
    if (!areaId) { setIsLoading(false); return; }
    setIsLoading(true);

    const { data: inds } = await supabase
      .from('indicadores')
      .select('id, nome, indicador_chave, semaforo_faixas, tipo, grupo')
      .eq('area_id', areaId)
      .is('objetivo_id', null)
      .neq('ativo', false)
      .order('grupo', { ascending: true })
      .order('nome',  { ascending: true });
    const indsArr = (inds ?? []) as IndAreaRow[];
    setIndsArea(indsArr);

    if (indsArr.length > 0) {
      const ids = indsArr.map(i => i.id);

      // Carregar responsáveis e lançamentos de todas as semanas do mês em paralelo
      const [pivotRes, lancRes] = await Promise.all([
        supabase
          .from('indicadores_responsaveis')
          .select('indicador_id, profile_id')
          .in('indicador_id', ids),
        (supabase.from('indicador_lancamentos') as any)
          .select('indicador_id, valor, semana')
          .in('indicador_id', ids)
          .in('semana', semanas),
      ]);

      const respMap: Record<string, string[]> = {};
      for (const r of ((pivotRes.data ?? []) as IndRespAreaRow[])) {
        if (!respMap[r.indicador_id]) respMap[r.indicador_id] = [];
        respMap[r.indicador_id].push(r.profile_id);
      }
      setIndsAreaResp(respMap);

      const lancMap: Record<string, string> = {};
      for (const l of ((lancRes.data ?? []) as LancRow[])) {
        lancMap[`${l.indicador_id}-${l.semana}`] = l.valor;
      }
      setValoresLanc(lancMap);
    }

    setIsLoading(false);
  }, [supabase, areaId, semanas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void carregarInds(); }, [carregarInds]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const log = (args: Record<string, unknown>) =>
    void (registrarLog as unknown as (a: Record<string, unknown>) => Promise<void>)(args);

  // ── Lançar valor ─────────────────────────────────────────────────────────
  const handleLancarIndicador = useCallback(async (indId: string, valor: string, semana: number): Promise<boolean> => {
    const profileId = effectiveProfileId ?? currentUserId;
    if (!profileId || !semana) return false;
    try {
      const { data: rows } = await (supabase.from('indicador_lancamentos') as any)
        .select('id, valor, profile_id')
        .eq('indicador_id', indId)
        .eq('semana', semana)
        .or(`profile_id.eq.${profileId},profile_id.is.null`);
      const existingRows = (rows ?? []) as { id: string; valor: string; profile_id: string | null }[];
      const existing = existingRows.find(r => r.profile_id === profileId) ?? existingRows[0] ?? null;
      let saveErr: unknown = null;
      if (existing?.id) {
        const { error } = await (supabase.from('indicador_lancamentos') as any)
          .update({ valor, profile_id: profileId }).eq('id', existing.id);
        saveErr = error;
      } else {
        const { error } = await (supabase.from('indicador_lancamentos') as any)
          .insert({ indicador_id: indId, semana, semana_ano: anoRelativo, valor, profile_id: profileId });
        saveErr = error;
      }
      if (saveErr) { console.error('[IndicadoresArea] lancamento', saveErr); return false; }
      const op = existing?.id ? 'UPDATE' : 'INSERT';
      log({ modulo: 'Planejamento', entidade: 'indicador_lancamentos', entidade_id: indId, operacao: op, descricao: `Valor: "${valor}" — semana ${semana}` });
      setValoresLanc(prev => ({ ...prev, [`${indId}-${semana}`]: valor }));
      return true;
    } catch (e) { console.error('[IndicadoresArea]', e); return false; }
  }, [supabase, effectiveProfileId, currentUserId, anoRelativo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Summary callback ──────────────────────────────────────────────────────
  const uid = effectiveProfileId ?? currentUserId;
  const totalMeus = indsArea.filter(i => uid && (indsAreaResp[i.id] ?? []).includes(uid)).length;

  useEffect(() => {
    onSummaryChange?.(totalMeus, indsArea.length);
  }, [totalMeus, indsArea.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="p-4 flex flex-col gap-2">
        {[0, 1, 2].map(i => <div key={i} className="h-10 bg-gray-100 animate-pulse rounded-lg" />)}
      </div>
    );
  }

  if (indsArea.length === 0) {
    return (
      <div className="p-4">
        <p className="text-xs text-gray-400">Nenhum indicador da área cadastrado ainda.</p>
      </div>
    );
  }

  const grupos = Array.from(new Set(indsArea.map(i => i.grupo ?? 'SEM GRUPO')));

  return (
    <>
      <div className="p-4 overflow-x-auto">
        {grupos.map(grupo => {
          const indsGrupo = indsArea.filter(i => (i.grupo ?? 'SEM GRUPO') === grupo);
          return (
            <div key={grupo} className="mb-4 last:mb-0">
              {/* Título do grupo */}
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                {grupo}
                <span className="ml-1.5 font-normal text-gray-400 normal-case tracking-normal">
                  ({indsGrupo.length})
                </span>
              </p>

              {/* Cabeçalho das semanas */}
              <SemanasHeader
                semanas={semanas}
                anoRelativo={anoRelativo}
                semanaAtual={semanaAtual}
              />

              {/* Linhas de indicadores */}
              <div className="flex flex-col">
                {indsGrupo.map(ind => {
                  // Montar mapa semana->valor para este indicador
                  const valores: Record<number, string> = {};
                  for (const s of semanas) {
                    const v = valoresLanc[`${ind.id}-${s}`];
                    if (v !== undefined) valores[s] = v;
                  }
                  return (
                    <IndicadorLinhaOtimizada
                      key={ind.id}
                      ind={ind}
                      responsaveisIds={indsAreaResp[ind.id] ?? []}
                      responsaveis={responsaveis as ResponsavelItem[]}
                      valores={valores}
                      semanas={semanas}
                      anoRelativo={anoRelativo}
                      semanaAtual={semanaAtual}
                      onLancar={handleLancarIndicador}
                      onToast={showToast}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {toastMsg && <Toast message={toastMsg} />}
    </>
  );
}
