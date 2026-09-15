'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { semanasIsoNoIntervalo, isoWeek } from '@/utils/periodos';

export type MetaBone = {
  id: string;
  descricao: string;
  status: string;
  tipo: string | null;
  meta_unidade: string | null;
  is_chave: boolean;
};

export type ComportamentoHoras = {
  tarefaId: string;
  nome: string;
  horas: number;
};

export type IndicadorMedio = {
  sirene: number | null;
  engajamento: number | null;
  indicadores: number | null;
};

export type BlockerTodo = {
  id: string;
  descricao: string;
  metaDescricao: string | null;
};

// Dados editáveis armazenados em bone_day_fechamento.comentario como JSON
export type RegistroFechamento = {
  id: string | null;
  blockersFechamento: string[];
  comentariosProximo: string;
  blockersProximo: string[];
};

export type UseFechamentoBoneDayResult = {
  metasMes: MetaBone[];
  metasProximo: MetaBone[];
  comportamentos: ComportamentoHoras[];
  indicadores: IndicadorMedio;
  indicadoresNota: string | null;
  blockersDoTodo: BlockerTodo[];
  registro: RegistroFechamento;
  mes: string;
  setMes: (m: string) => void;
  isLoading: boolean;
  error: string | null;
  recarregar: () => void;
  salvarRegistro: (dados: Partial<Omit<RegistroFechamento, 'id'>>) => Promise<void>;
};

function mesAtualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function proximoMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m, 1); // month m (1-indexed) → next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthLabel(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const raw = new Date(y, m - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const raw = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    return { value, label: raw.charAt(0).toUpperCase() + raw.slice(1) };
  });
}

function parseRegistro(comentario: string | null): Omit<RegistroFechamento, 'id'> {
  try {
    const parsed = comentario ? JSON.parse(comentario) : {};
    return {
      blockersFechamento: Array.isArray(parsed.blockers_fechamento) ? parsed.blockers_fechamento : [],
      comentariosProximo: typeof parsed.comentarios_proximo === 'string' ? parsed.comentarios_proximo : '',
      blockersProximo: Array.isArray(parsed.blockers_proximo) ? parsed.blockers_proximo : [],
    };
  } catch {
    return { blockersFechamento: [], comentariosProximo: '', blockersProximo: [] };
  }
}

function serializeRegistro(r: Omit<RegistroFechamento, 'id'>): string {
  return JSON.stringify({
    blockers_fechamento: r.blockersFechamento,
    comentarios_proximo: r.comentariosProximo,
    blockers_proximo: r.blockersProximo,
  });
}

export function useFechamentoBoneDay(
  areaId: string | null,
  effectiveProfileId: string | null,
): UseFechamentoBoneDayResult {
  const supabase = useMemo(() => createClient(), []);
  const [mes, setMes] = useState(mesAtualStr);
  const [metasMes, setMetasMes] = useState<MetaBone[]>([]);
  const [metasProximo, setMetasProximo] = useState<MetaBone[]>([]);
  const [comportamentos, setComportamentos] = useState<ComportamentoHoras[]>([]);
  const [indicadores, setIndicadores] = useState<IndicadorMedio>({ sirene: null, engajamento: null, indicadores: null });
  const [indicadoresNota, setIndicadoresNota] = useState<string | null>(null);
  const [blockersDoTodo, setBlockersDoTodo] = useState<BlockerTodo[]>([]);
  const [registro, setRegistro] = useState<RegistroFechamento>({ id: null, blockersFechamento: [], comentariosProximo: '', blockersProximo: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ref para evitar stale closure em salvarRegistro
  const registroRef = useRef(registro);
  registroRef.current = registro;

  const carregar = useCallback(async () => {
    if (!areaId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const proximo = proximoMes(mes);
      const [y, m] = mes.split('-').map(Number);
      const primeiroDia = `${mes}-01`;
      const ultimoDia = new Date(y, m, 0).toISOString().slice(0, 10);
      // Usado como limite exclusivo para filtros de timestamp (blockers)
      const proxMesInicio = `${proximo}-01`;

      const { data: pessoasData } = await supabase
        .from('area_pessoas').select('profile_id').eq('area_id', areaId).eq('ativo', true);
      const profileIds = ((pessoasData ?? []) as { profile_id: string }[])
        .map(p => p.profile_id).filter(Boolean);

      const semanas = (semanasIsoNoIntervalo(primeiroDia, ultimoDia) as number[]);
      const semanaInicio = semanas.length > 0 ? Math.min(...semanas) : 0;
      const semanaFim    = semanas.length > 0 ? Math.max(...semanas) : 0;

      const [objMesRes, objProxRes, ganttRes, statusRes, fechRes, blockersRes] = await Promise.all([
        // Bug 1 fix: filtrar por mês específico (campo objetivos.mes)
        supabase.from('objetivos')
          .select('id, descricao, tipo, is_chave, meta_unidade, status')
          .eq('area_id', areaId)
          .eq('mes', mes)
          .in('status', ['ativo', 'concluido', 'relancada'])
          .is('objetivo_pai_id', null)
          .order('is_chave', { ascending: false })
          .order('ordem', { ascending: true }),

        // Bug 2 fix: filtrar próximo mês pelo campo mes
        supabase.from('objetivos')
          .select('id, descricao, tipo, is_chave, meta_unidade, status')
          .eq('area_id', areaId)
          .eq('mes', proximo)
          .eq('status', 'ativo')
          .is('objetivo_pai_id', null)
          .order('is_chave', { ascending: false })
          .order('ordem', { ascending: true }),

        profileIds.length > 0 && semanas.length > 0
          ? supabase.from('gantt_planejamento')
              .select('acao_id, tempo_estimado_horas')
              .eq('origem', 'planejamento')
              .in('profile_id', profileIds)
              .gte('semana_ano_inicio', semanaInicio)
              .lte('semana_ano_inicio', semanaFim)
          : Promise.resolve({ data: [], error: null }),

        // Bug 4 fix: incluir profile_id e data para agrupar por pessoa × semana
        supabase.from('carometro_status_diario')
          .select('profile_id, data, sirene, engajamento, indicadores')
          .eq('area_id', areaId)
          .gte('data', primeiroDia)
          .lte('data', ultimoDia),

        // bone_day_fechamento usa coluna "mes" (text), não "data"
        supabase.from('bone_day_fechamento')
          .select('id, comentario')
          .eq('area_id', areaId)
          .eq('mes', mes)
          .maybeSingle(),

        // Bug 3 fix: puxar blockers do TO DO registrados no mês
        supabase.from('blockers')
          .select('id, descricao, objetivo_id')
          .eq('area_id', areaId)
          .eq('resolvido', false)
          .gte('criado_em', primeiroDia)
          .lt('criado_em', proxMesInicio),
      ]);

      type ObjRow = { id: string; descricao: string; tipo: string | null; is_chave: boolean | null; meta_unidade: string | null; status: string };
      const toMeta = (o: ObjRow): MetaBone => ({
        id: o.id, descricao: o.descricao, tipo: o.tipo,
        is_chave: Boolean(o.is_chave), meta_unidade: o.meta_unidade, status: o.status,
      });
      setMetasMes(((objMesRes.data ?? []) as ObjRow[]).map(toMeta));
      setMetasProximo(((objProxRes.data ?? []) as ObjRow[]).map(toMeta));

      // Comportamentos: acao_id → tarefa_id → nome, agrupado por tarefa
      type GanttRow = { acao_id: string; tempo_estimado_horas: number | null };
      const ganttArr = (ganttRes.data ?? []) as GanttRow[];
      if (ganttArr.length > 0) {
        const acoIds = [...new Set(ganttArr.map(g => g.acao_id).filter(Boolean))];
        const { data: acoesData } = await supabase
          .from('acoes').select('id, tarefa_id').in('id', acoIds);
        type AcaoRow = { id: string; tarefa_id: string | null };
        const acoRows = (acoesData ?? []) as AcaoRow[];

        const tarefaIds = [...new Set(acoRows.map(a => a.tarefa_id).filter((t): t is string => t !== null))];
        let tarefaNomes = new Map<string, string>();
        if (tarefaIds.length > 0) {
          const { data: tarefasData } = await supabase
            .from('tarefas').select('id, nome').in('id', tarefaIds);
          tarefaNomes = new Map(((tarefasData ?? []) as { id: string; nome: string }[]).map(t => [t.id, t.nome]));
        }
        const acoTarefa = new Map(acoRows.map(a => [a.id, a.tarefa_id]));

        const byTarefa = new Map<string, { nome: string; horas: number }>();
        ganttArr.forEach(g => {
          const tid = acoTarefa.get(g.acao_id);
          if (!tid) return;
          const nome = tarefaNomes.get(tid) ?? tid;
          const prev = byTarefa.get(tid) ?? { nome, horas: 0 };
          byTarefa.set(tid, { nome, horas: prev.horas + (g.tempo_estimado_horas ?? 0) });
        });
        setComportamentos(Array.from(byTarefa.entries()).map(([tarefaId, v]) => ({ tarefaId, nome: v.nome, horas: v.horas })));
      } else {
        setComportamentos([]);
      }

      // Carômetro acumulado — último snapshot por pessoa por semana, depois soma todos.
      // Fórmulas sincronizadas com carometro-status-snapshot.ts (fonte da verdade).
      type StatusRow = { profile_id: string; data: string; sirene: unknown; engajamento: unknown; indicadores: unknown };
      const statusArr = (statusRes.data ?? []) as StatusRow[];

      if (statusArr.length > 0) {
        // Agrupar: semana ISO → profile_id → snapshot mais recente daquela semana para aquela pessoa
        const porSemanaProfile = new Map<number, Map<string, StatusRow>>();
        for (const r of statusArr) {
          const semana = isoWeek(new Date(`${r.data}T12:00:00`));
          if (!porSemanaProfile.has(semana)) porSemanaProfile.set(semana, new Map());
          const profMap = porSemanaProfile.get(semana)!;
          const existing = profMap.get(r.profile_id);
          if (!existing || r.data > existing.data) profMap.set(r.profile_id, r);
        }
        // Achatar: 1 snapshot por pessoa por semana → somar contadores de todas as pessoas
        const snapshots: StatusRow[] = [];
        for (const profMap of porSemanaProfile.values()) {
          for (const snap of profMap.values()) snapshots.push(snap);
        }

        // Sirene — acumulado: ΣConcluidos / ΣRelevantes
        let sireneConcluidos = 0;
        let sireneRelevantes = 0;
        for (const r of snapshots) {
          const s = r.sirene as Record<string, unknown> | null;
          if (s && typeof s === 'object') {
            sireneConcluidos += typeof s.concluidos === 'number' ? s.concluidos : 0;
            sireneRelevantes += typeof s.relevantes === 'number' ? s.relevantes : 0;
          }
        }
        const sireneScore = sireneRelevantes > 0
          ? Math.max(0, Math.round((sireneConcluidos / sireneRelevantes) * 100))
          : null;

        // Engajamento — acumulado dos 3 sub-scores (atividades, cards SLA, próximas)
        let engAtivReal = 0, engAtivAgend = 0;
        let engCardsEmDia = 0, engCardsComSLA = 0;
        let engProxConc = 0, engProxRel = 0;
        for (const r of snapshots) {
          const e = r.engajamento as Record<string, unknown> | null;
          if (!e || typeof e !== 'object') continue;
          const at = e.atividades as Record<string, unknown> | null;
          if (at) {
            engAtivReal  += typeof at.realizadas === 'number' ? at.realizadas : 0;
            engAtivAgend += typeof at.agendadas  === 'number' ? at.agendadas  : 0;
          }
          const ca = e.cards as Record<string, unknown> | null;
          if (ca) {
            engCardsEmDia  += typeof ca.emDia  === 'number' ? ca.emDia  : 0;
            engCardsComSLA += typeof ca.comSLA === 'number' ? ca.comSLA : 0;
          }
          const pr = e.proximas as Record<string, unknown> | null;
          if (pr) {
            engProxConc += typeof pr.concluidos === 'number' ? pr.concluidos : 0;
            engProxRel  += typeof pr.relevantes === 'number' ? pr.relevantes : 0;
          }
        }
        const scoreAtiv  = engAtivAgend   > 0 ? Math.max(0, Math.round((engAtivReal   / engAtivAgend)   * 100)) : 0;
        const scoreCards = engCardsComSLA > 0  ? Math.max(0, Math.round((engCardsEmDia / engCardsComSLA) * 100))
                         : snapshots.length > 0 ? 100 : null;
        const scoreProx  = engProxRel    > 0  ? Math.max(0, Math.round((engProxConc   / engProxRel)    * 100)) : 100;
        const engSubs = [scoreAtiv, scoreCards, scoreProx].filter((s): s is number => s !== null);
        const engScore = engSubs.length > 0
          ? Math.round(engSubs.reduce((a, b) => a + b, 0) / engSubs.length)
          : null;

        // Indicadores — média das medias semanais (semáforo não é cumulativo).
        // Filtro por mês: meses com dados incompletos no início usam semana mínima.
        const INDICADORES_SEMANA_MIN: Record<string, number> = { '2026-08': 34 };
        const indSemanaMin = INDICADORES_SEMANA_MIN[mes] ?? null;
        const snapshotsInd = indSemanaMin !== null
          ? snapshots.filter(r => isoWeek(new Date(`${r.data}T12:00:00`)) >= indSemanaMin)
          : snapshots;

        const indMedias = snapshotsInd
          .map(r => {
            const ind = r.indicadores as Record<string, unknown> | null;
            if (!ind || typeof ind !== 'object') return null;
            const v = ind.media;
            return typeof v === 'number' ? Math.round(v) : null;
          })
          .filter((v): v is number => v !== null);
        const indScore = indMedias.length > 0
          ? Math.round(indMedias.reduce((a, b) => a + b, 0) / indMedias.length)
          : null;

        const nota = indSemanaMin !== null
          ? `Indicadores iniciaram na S${indSemanaMin - 1}, considerado apenas S${indSemanaMin} em diante para a métrica`
          : null;

        setIndicadoresNota(nota);
        setIndicadores({ sirene: sireneScore, engajamento: engScore, indicadores: indScore });
      } else {
        setIndicadores({ sirene: null, engajamento: null, indicadores: null });
        setIndicadoresNota(null);
      }

      // Bug 3 fix: enriquecer blockers com descrição da meta
      type BlockerRow = { id: string; descricao: string; objetivo_id: string | null };
      const blockersArr = (blockersRes.data ?? []) as BlockerRow[];
      if (blockersArr.length > 0) {
        const objIds = [...new Set(blockersArr.map(b => b.objetivo_id).filter((id): id is string => id !== null))];
        const objNomes = new Map<string, string>();
        if (objIds.length > 0) {
          const { data: objData } = await supabase
            .from('objetivos').select('id, descricao').in('id', objIds);
          for (const o of (objData ?? []) as { id: string; descricao: string }[]) {
            objNomes.set(o.id, o.descricao);
          }
        }
        setBlockersDoTodo(blockersArr.map(b => ({
          id: b.id,
          descricao: b.descricao,
          metaDescricao: b.objetivo_id ? (objNomes.get(b.objetivo_id) ?? null) : null,
        })));
      } else {
        setBlockersDoTodo([]);
      }

      // Registro editável (comentario como JSON)
      type FechRec = { id: string; comentario: string | null } | null;
      const fech = fechRes.data as FechRec;
      const parsed = parseRegistro(fech?.comentario ?? null);
      setRegistro({ id: fech?.id ?? null, ...parsed });

    } catch (e) {
      console.error('[useFechamentoBoneDay]', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, areaId, effectiveProfileId, mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvarRegistro = useCallback(async (dados: Partial<Omit<RegistroFechamento, 'id'>>) => {
    if (!areaId) return;
    const current = registroRef.current;
    const updated: Omit<RegistroFechamento, 'id'> = {
      blockersFechamento: dados.blockersFechamento ?? current.blockersFechamento,
      comentariosProximo: dados.comentariosProximo ?? current.comentariosProximo,
      blockersProximo: dados.blockersProximo ?? current.blockersProximo,
    };
    const json = serializeRegistro(updated);

    if (current.id) {
      await supabase.from('bone_day_fechamento')
        .update({ comentario: json, atualizado_em: new Date().toISOString() })
        .eq('id', current.id);
      const next = { ...current, ...updated };
      setRegistro(next);
      registroRef.current = next;
    } else {
      const { data, error: err } = await supabase.from('bone_day_fechamento')
        .insert({ area_id: areaId, mes, comentario: json, criado_por: effectiveProfileId })
        .select('id').single();
      if (!err && data) {
        const next = { id: (data as { id: string }).id, ...updated };
        setRegistro(next);
        registroRef.current = next;
      }
    }
  }, [supabase, areaId, mes, effectiveProfileId]);

  return {
    metasMes, metasProximo, comportamentos, indicadores, indicadoresNota, blockersDoTodo, registro,
    mes, setMes, isLoading, error, recarregar: carregar, salvarRegistro,
  };
}
