'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { semanasIsoNoIntervalo } from '@/utils/periodos';

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

      const { data: pessoasData } = await supabase
        .from('area_pessoas').select('profile_id').eq('area_id', areaId).eq('ativo', true);
      const profileIds = ((pessoasData ?? []) as { profile_id: string }[])
        .map(p => p.profile_id).filter(Boolean);

      const semanas = (semanasIsoNoIntervalo(primeiroDia, ultimoDia) as number[]);
      const semanaInicio = semanas.length > 0 ? Math.min(...semanas) : 0;
      const semanaFim    = semanas.length > 0 ? Math.max(...semanas) : 0;

      const [objMesRes, objProxRes, ganttRes, statusRes, fechRes] = await Promise.all([
        supabase.from('objetivos')
          .select('id, descricao, tipo, is_chave, meta_unidade, status')
          .eq('area_id', areaId)
          .in('status', ['ativo', 'concluido'])
          .is('objetivo_pai_id', null)
          .order('is_chave', { ascending: false })
          .order('ordem', { ascending: true }),

        supabase.from('objetivos')
          .select('id, descricao, tipo, is_chave, meta_unidade, status')
          .eq('area_id', areaId)
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

        supabase.from('carometro_status_diario')
          .select('sirene, engajamento, indicadores')
          .eq('area_id', areaId)
          .gte('data', primeiroDia)
          .lte('data', ultimoDia),

        // bone_day_fechamento usa coluna "mes" (text), não "data"
        supabase.from('bone_day_fechamento')
          .select('id, comentario')
          .eq('area_id', areaId)
          .eq('mes', mes)
          .maybeSingle(),
      ]);

      type ObjRow = { id: string; descricao: string; tipo: string | null; is_chave: boolean | null; meta_unidade: string | null; status: string };
      const toMeta = (o: ObjRow): MetaBone => ({
        id: o.id, descricao: o.descricao, tipo: o.tipo,
        is_chave: Boolean(o.is_chave), meta_unidade: o.meta_unidade, status: o.status,
      });
      setMetasMes(((objMesRes.data ?? []) as ObjRow[]).map(toMeta));

      // Próximo mês — só ativas (sem filtro de prazo pois meta_unidade pode ser 'S27')
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

      // Indicadores: média do mês (tabela vazia no DEV → null)
      type StatusRow = { sirene: unknown; engajamento: unknown; indicadores: unknown };
      const statusArr = (statusRes.data ?? []) as StatusRow[];
      const extractScore = (v: unknown): number | null => {
        if (v === null || v === undefined) return null;
        if (typeof v === 'number') return Math.round(v);
        if (typeof v === 'object') {
          const o = v as Record<string, unknown>;
          const val = o.score ?? o.percentual ?? o.valor ?? o.media;
          return typeof val === 'number' ? Math.round(val) : null;
        }
        return null;
      };
      if (statusArr.length > 0) {
        const avg = (field: keyof StatusRow): number | null => {
          const vals = statusArr.map(r => extractScore(r[field])).filter((v): v is number => v !== null);
          return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        };
        setIndicadores({ sirene: avg('sirene'), engajamento: avg('engajamento'), indicadores: avg('indicadores') });
      } else {
        setIndicadores({ sirene: null, engajamento: null, indicadores: null });
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
    metasMes, metasProximo, comportamentos, indicadores, registro,
    mes, setMes, isLoading, error, recarregar: carregar, salvarRegistro,
  };
}
