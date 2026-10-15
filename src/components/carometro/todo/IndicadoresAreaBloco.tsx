'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useEffectiveUser } from '@/hooks/useEffectiveUser';
import { useMetasIndicadores, type ResponsavelItem } from '@/hooks/useMetasIndicadores';
import { isoWeek } from '@/utils/periodos';
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

// ── IndicadorLinhaOtimizada ───────────────────────────────────────────────────
function IndicadorLinhaOtimizada({
  ind,
  responsaveisIds,
  responsaveis,
  valorAtual,
  valorAnterior,
  semanaAtual,
  semanaAnterior,
  anoRelativo,
  onLancar,
  onToast,
}: {
  ind: IndAreaRow;
  responsaveisIds: string[];
  responsaveis: ResponsavelItem[];
  valorAtual: string;
  valorAnterior: string;
  semanaAtual: number;
  semanaAnterior: number;
  anoRelativo: number;
  onLancar: (indId: string, valor: string, semana: number) => Promise<boolean>;
  onToast?: (msg: string) => void;
}) {
  const [editAtual,         setEditAtual]         = useState(valorAtual);
  const [editAnterior,      setEditAnterior]      = useState(valorAnterior);
  const [salvandoAtual,     setSalvandoAtual]     = useState(false);
  const [salvandoAnterior,  setSalvandoAnterior]  = useState(false);

  useEffect(() => { setEditAtual(valorAtual); },     [valorAtual]);
  useEffect(() => { setEditAnterior(valorAnterior); }, [valorAnterior]);

  const infoAtual    = anoRelativo > 0
    ? isoWeekToDates(semanaAtual,    anoRelativo)
    : { label: `S${semanaAtual}`,    range: '' };
  const infoAnterior = anoRelativo > 0
    ? isoWeekToDates(semanaAnterior, anoRelativo)
    : { label: `S${semanaAnterior}`, range: '' };

  // Badge de unidade
  const unidade = (() => {
    const t = (ind.tipo ?? '').toLowerCase();
    if (t === 'booleano' || t === 'boolean') return 'S/N';
    if (t === 'percentual' || t.includes('pct') || t.includes('%')) return '%';
    return 'qtd';
  })();

  const handleSalvarAtual = async () => {
    const v = editAtual.trim();
    if (!v) return;
    setSalvandoAtual(true);
    const ok = await onLancar(ind.id, v, semanaAtual);
    setSalvandoAtual(false);
    onToast?.(ok ? 'Valor salvo!' : 'Erro ao salvar');
  };

  const handleSalvarAnterior = async () => {
    const v = editAnterior.trim();
    if (!v) return;
    setSalvandoAnterior(true);
    const ok = await onLancar(ind.id, v, semanaAnterior);
    setSalvandoAnterior(false);
    onToast?.(ok ? 'Valor salvo!' : 'Erro ao salvar');
  };

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-b-0">
      {/* Chave */}
      <span className="w-3 flex-shrink-0 text-center text-[10px]">
        {ind.indicador_chave ? '⭐' : ''}
      </span>

      {/* Nome */}
      <span className="flex-1 min-w-0 text-xs text-gray-800 truncate" title={ind.nome}>
        {ind.nome}
      </span>

      {/* Unidade */}
      <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
        {unidade}
      </span>

      {/* S anterior — neutro */}
      <div className="flex flex-col items-center gap-0.5 w-[88px] flex-shrink-0">
        <span className="text-[8px] text-gray-400 whitespace-nowrap">
          {infoAnterior.label} · {infoAnterior.range}
        </span>
        <input
          type="text"
          value={editAnterior}
          onChange={e => setEditAnterior(e.target.value)}
          onBlur={() => { void handleSalvarAnterior(); }}
          onKeyDown={e => { if (e.key === 'Enter') void handleSalvarAnterior(); }}
          disabled={salvandoAnterior}
          placeholder="—"
          className="w-full text-xs text-center border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white disabled:opacity-50 transition-colors"
        />
      </div>

      {/* S atual — accent */}
      <div className="flex flex-col items-center gap-0.5 w-[88px] flex-shrink-0">
        <span className="text-[8px] text-blue-500 font-semibold whitespace-nowrap">
          {infoAtual.label} · {infoAtual.range} ★
        </span>
        <input
          type="text"
          value={editAtual}
          onChange={e => setEditAtual(e.target.value)}
          onBlur={() => { void handleSalvarAtual(); }}
          onKeyDown={e => { if (e.key === 'Enter') void handleSalvarAtual(); }}
          disabled={salvandoAtual}
          placeholder="—"
          className="w-full text-xs text-center border border-blue-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50 disabled:opacity-50 transition-colors"
        />
      </div>

      {/* Avatares responsáveis */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {responsaveisIds.length === 0 ? (
          <span className="text-[9px] text-gray-300">—</span>
        ) : (
          responsaveisIds.slice(0, 3).map(pid => {
            const nome = responsaveis.find(r => r.profile_id === pid)?.nome ?? '?';
            const inicial = nome.charAt(0).toUpperCase();
            return (
              <span
                key={pid}
                title={nome}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold border border-blue-200 flex-shrink-0 cursor-default"
              >
                {inicial}
              </span>
            );
          })
        )}
        {responsaveisIds.length > 3 && (
          <span className="text-[9px] text-gray-400 ml-0.5">+{responsaveisIds.length - 3}</span>
        )}
      </div>
    </div>
  );
}

// ── Bloco principal ───────────────────────────────────────────────────────────
export function IndicadoresAreaBloco() {
  const supabase = useMemo(() => createClient(), []);
  const { effectiveProfileId, areaId } = useEffectiveUser();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [indsArea,      setIndsArea]      = useState<IndAreaRow[]>([]);
  const [indsAreaResp,  setIndsAreaResp]  = useState<Record<string, string[]>>({});
  const [valoresLanc,   setValoresLanc]   = useState<Record<string, string>>({});
  const [isLoading,     setIsLoading]     = useState(true);
  const [toastMsg,      setToastMsg]      = useState<string | null>(null);

  // Semanas para lançamentos
  const hoje           = new Date();
  const semanaAtual    = isoWeek(hoje);
  const semanaAnterior = semanaAtual > 1 ? semanaAtual - 1 : 52;
  const anoRelativo    = hoje.getFullYear();

  // Responsáveis da área (nomes para exibir avatar)
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

      // Carregar responsáveis e lançamentos em paralelo
      const [pivotRes, lancRes] = await Promise.all([
        supabase
          .from('indicadores_responsaveis')
          .select('indicador_id, profile_id')
          .in('indicador_id', ids),
        (supabase.from('indicador_lancamentos') as any)
          .select('indicador_id, valor, semana')
          .in('indicador_id', ids)
          .in('semana', [semanaAtual, semanaAnterior]),
      ]);

      // Mapa de responsáveis
      const respMap: Record<string, string[]> = {};
      for (const r of ((pivotRes.data ?? []) as IndRespAreaRow[])) {
        if (!respMap[r.indicador_id]) respMap[r.indicador_id] = [];
        respMap[r.indicador_id].push(r.profile_id);
      }
      setIndsAreaResp(respMap);

      // Mapa de lançamentos: chave = "indId-semana"
      const lancMap: Record<string, string> = {};
      for (const l of ((lancRes.data ?? []) as LancRow[])) {
        lancMap[`${l.indicador_id}-${l.semana}`] = l.valor;
      }
      setValoresLanc(lancMap);
    }

    setIsLoading(false);
  }, [supabase, areaId, semanaAtual, semanaAnterior]);

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
      // Atualizar estado local para refletir imediatamente
      setValoresLanc(prev => ({ ...prev, [`${indId}-${semana}`]: valor }));
      return true;
    } catch (e) { console.error('[IndicadoresArea]', e); return false; }
  }, [supabase, effectiveProfileId, currentUserId, anoRelativo]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const uid = effectiveProfileId ?? currentUserId;
  const grupos = Array.from(new Set(indsArea.map(i => i.grupo ?? 'SEM GRUPO')));
  const totalMeus = indsArea.filter(i => uid && (indsAreaResp[i.id] ?? []).includes(uid)).length;

  return (
    <>
      <div className="p-4 flex flex-col gap-4">
        {/* Badge resumo */}
        <div className="flex items-center gap-2">
          {totalMeus > 0 && (
            <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
              {totalMeus} meu{totalMeus !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[10px] text-gray-400">
            {indsArea.length} indicador{indsArea.length !== 1 ? 'es' : ''} no total
          </span>
        </div>

        {/* Grupos */}
        {grupos.map(grupo => {
          const indsGrupo = indsArea.filter(i => (i.grupo ?? 'SEM GRUPO') === grupo);
          return (
            <div key={grupo} className="flex flex-col gap-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-1">
                {grupo}
                <span className="ml-1.5 font-normal text-gray-400 normal-case tracking-normal">
                  ({indsGrupo.length})
                </span>
              </p>
              <div className="flex flex-col">
                {indsGrupo.map(ind => (
                  <IndicadorLinhaOtimizada
                    key={ind.id}
                    ind={ind}
                    responsaveisIds={indsAreaResp[ind.id] ?? []}
                    responsaveis={responsaveis as ResponsavelItem[]}
                    valorAtual={valoresLanc[`${ind.id}-${semanaAtual}`] ?? ''}
                    valorAnterior={valoresLanc[`${ind.id}-${semanaAnterior}`] ?? ''}
                    semanaAtual={semanaAtual}
                    semanaAnterior={semanaAnterior}
                    anoRelativo={anoRelativo}
                    onLancar={handleLancarIndicador}
                    onToast={showToast}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {toastMsg && <Toast message={toastMsg} />}
    </>
  );
}
