'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MetaItem, ResponsavelItem } from '@/hooks/useMetasIndicadores';
import { isoWeek } from '@/utils/periodos';

export type IndicadorBone = {
  id: string;
  nome: string;
  indicador_chave: boolean;
  semaforo_faixas: unknown;
  objetivo_id: string | null;
  profile_id: string | null;
  tipo: string | null;
  meta_valor: number | null;
  meta_unidade: string | null;
};

export type ComportamentoItem = {
  id: string;
  nome: string;
};

export type AgendaMacroItem = {
  id: string;
  acao_id: string | null;
  tarefa_id: string | null;
  profile_id: string | null;
  semana_ano_inicio: number | null;
  semana_ano_fim: number | null;
  tempo_estimado_horas: number | null;
  objetivo_id: string | null;
  descricao_livre: string | null;
};

export type ObjetivoResponsavel = {
  objetivo_id: string;
  profile_id: string;
};

function mesAtualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const LS_MES_KEY = 'bone_day_ultimo_mes';

function mesInicial(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(LS_MES_KEY);
    if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
  }
  return mesAtualStr();
}

export type UsePlanoBoneDayResult = {
  metas: MetaItem[];
  metasNaoConcluidas: MetaItem[];
  indicadores: IndicadorBone[];
  responsaveis: ResponsavelItem[];
  comportamentos: ComportamentoItem[];
  agendaMacro: AgendaMacroItem[];
  objetivoResponsaveis: ObjetivoResponsavel[];
  mes: string;
  setMes: (m: string) => void;
  isLoading: boolean;
  error: string | null;
  recarregar: () => void;
};

export function usePlanoBoneDay(
  areaId: string | null,
  effectiveProfileId: string | null,
): UsePlanoBoneDayResult {
  const supabase = useMemo(() => createClient(), []);
  const [metas,              setMetas]              = useState<MetaItem[]>([]);
  const [metasNaoConcluidas, setMetasNaoConcluidas] = useState<MetaItem[]>([]);
  const [indicadores,        setIndicadores]        = useState<IndicadorBone[]>([]);
  const [responsaveis,       setResponsaveis]       = useState<ResponsavelItem[]>([]);
  const [comportamentos,     setComportamentos]     = useState<ComportamentoItem[]>([]);
  const [agendaMacro,        setAgendaMacro]        = useState<AgendaMacroItem[]>([]);
  const [objetivoResponsaveis, setObjetivoResponsaveis] = useState<ObjetivoResponsavel[]>([]);
  const [mes, setMesState] = useState(mesInicial);
  const setMes = useCallback((m: string) => {
    localStorage.setItem(LS_MES_KEY, m);
    setMesState(m);
  }, []);
  const [isLoading,          setIsLoading]          = useState(true);
  const [error,              setError]              = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!areaId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      // 1. Queries paralelas: objetivos, indicadores, responsáveis
      const [objAtivRes, objNaoConclRes, indRes, respRes] = await Promise.all([
        supabase
          .from('objetivos')
          .select('id, descricao, tipo, is_chave, meta_valor, meta_unidade, criado_em, status, ordem, profile_id')
          .eq('area_id', areaId)
          .eq('status', 'ativo')
          .eq('mes', mes)
          .is('objetivo_pai_id', null)
          .order('is_chave', { ascending: false })
          .order('ordem', { ascending: true }),

        supabase
          .from('objetivos')
          .select('id, descricao, tipo, is_chave, meta_valor, meta_unidade, criado_em, status, ordem, profile_id')
          .eq('area_id', areaId)
          .neq('status', 'concluido')
          .neq('status', 'arquivado')
          .lt('mes', mes)
          .not('mes', 'is', null)
          .is('objetivo_pai_id', null)
          .order('is_chave', { ascending: false })
          .order('ordem', { ascending: true }),

        supabase
          .from('indicadores')
          .select('id, nome, indicador_chave, semaforo_faixas, objetivo_id, profile_id, tipo, meta_valor, meta_unidade')
          .eq('area_id', areaId)
          .order('indicador_chave', { ascending: false })
          .order('nome', { ascending: true }),

        supabase
          .from('area_pessoas')
          .select('profile_id, nome')
          .eq('area_id', areaId)
          .eq('ativo', true)
          .not('profile_id', 'is', null)
          .order('nome'),
      ]);

      if (objAtivRes.error) throw objAtivRes.error;
      if (indRes.error)     throw indRes.error;

      type ObjRow = {
        id: string; descricao: string; tipo: string | null; is_chave: boolean | null;
        meta_valor: string | null; meta_unidade: string | null; criado_em: string | null;
        status: string; ordem: number | null; profile_id: string | null;
      };

      // Enriquecer com full_name do profiles e deduplicar por profile_id
      type AreaPessoaRow = { profile_id: string; nome: string };
      const areaPessoasRaw = (respRes.data ?? []) as AreaPessoaRow[];
      const profileIds = [...new Set(areaPessoasRaw.map(r => r.profile_id))];
      let respArr: ResponsavelItem[] = [];
      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', profileIds);
        const profilesMap = new Map(
          ((profilesData ?? []) as { id: string; full_name: string | null }[])
            .map(p => [p.id, p.full_name])
        );
        // Deduplica por profile_id, prefere full_name do profiles
        const seen = new Set<string>();
        respArr = areaPessoasRaw.reduce<ResponsavelItem[]>((acc, r) => {
          if (!seen.has(r.profile_id)) {
            seen.add(r.profile_id);
            acc.push({
              profile_id: r.profile_id,
              nome: profilesMap.get(r.profile_id) ?? r.nome,
            });
          }
          return acc;
        }, []);
        respArr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      }
      setResponsaveis(respArr);
      const respMap = new Map(respArr.map(r => [r.profile_id, r.nome]));

      const toMeta = (o: ObjRow): MetaItem => ({
        id: o.id, descricao: o.descricao, tipo: o.tipo,
        is_chave: Boolean(o.is_chave), meta_valor: o.meta_valor,
        meta_unidade: o.meta_unidade, criado_em: o.criado_em ?? null,
        status: o.status, ordem: o.ordem,
        profile_id: o.profile_id,
        responsavel_nome: o.profile_id ? (respMap.get(o.profile_id) ?? null) : null,
        comentariosCount: 0,
      });

      // Bloco 2: todas as metas ativas (sem filtro de prazo)
      const metasArr = ((objAtivRes.data ?? []) as ObjRow[]).map(toMeta);
      // Bloco 1: não concluídas que ainda NÃO estão no Bloco 2 (evita duplicata)
      const metasAtivasIds = new Set(metasArr.map(m => m.id));
      const metasNaoConclArr = ((objNaoConclRes.data ?? []) as ObjRow[])
        .map(toMeta)
        .filter(m => !metasAtivasIds.has(m.id));

      setMetas(metasArr);
      setMetasNaoConcluidas(metasNaoConclArr);

      const objIds = metasArr.map(m => m.id);
      if (objIds.length > 0) {
        const { data: orData } = await supabase
          .from('objetivo_responsaveis')
          .select('objetivo_id, profile_id')
          .in('objetivo_id', objIds);
        setObjetivoResponsaveis((orData ?? []) as ObjetivoResponsavel[]);
      } else {
        setObjetivoResponsaveis([]);
      }

      type IndRow = {
        id: string; nome: string; indicador_chave: boolean | null;
        semaforo_faixas: unknown; objetivo_id: string | null; profile_id: string | null;
        tipo: string | null; meta_valor: number | null; meta_unidade: string | null;
      };
      setIndicadores(((indRes.data ?? []) as IndRow[]).map(i => ({
        id: i.id, nome: i.nome, indicador_chave: Boolean(i.indicador_chave),
        semaforo_faixas: i.semaforo_faixas, objetivo_id: i.objetivo_id,
        profile_id: i.profile_id, tipo: i.tipo, meta_valor: i.meta_valor, meta_unidade: i.meta_unidade,
      })));

      // 2. Queries sequenciais usando dados já buscados
      const metaIds         = metasArr.map(m => m.id);
      const ganttProfileIds = respArr.map(r => r.profile_id);

      const [comportamentosRes, ganttRes] = await Promise.all([
        supabase
          .from('tarefas')
          .select('id, nome')
          .eq('area_id', areaId)
          .eq('ativo', true)
          .order('ordem', { ascending: true }),

        // gantt do Boné Day (sem area_id na tabela — filtra por profiles da área)
        ganttProfileIds.length > 0
          ? supabase.from('gantt_planejamento')
              .select('id, acao_id, profile_id, semana_ano_inicio, semana_ano_fim, tempo_estimado_horas, objetivo_id, descricao_livre')
              .in('profile_id', ganttProfileIds)
              .eq('origem', 'pre_bone_day')
              .eq('pre_bone_day_mes', mes)
          : Promise.resolve({ data: [], error: null }),
      ]);

      type TarefaRow = { id: string; nome: string; };
      setComportamentos(((comportamentosRes.data ?? []) as TarefaRow[]).map(t => ({
        id: t.id, nome: t.nome,
      })));

      type GanttRow = {
        id: string; acao_id: string | null; profile_id: string | null;
        semana_ano_inicio: number | null; semana_ano_fim: number | null;
        tempo_estimado_horas: number | null; objetivo_id: string | null;
        descricao_livre: string | null;
      };
      const ganttArr = ((ganttRes.data ?? []) as GanttRow[]).map(g => ({
        id: g.id, acao_id: g.acao_id ?? null, tarefa_id: null as string | null, profile_id: g.profile_id,
        semana_ano_inicio: g.semana_ano_inicio, semana_ano_fim: g.semana_ano_fim,
        tempo_estimado_horas: g.tempo_estimado_horas, objetivo_id: g.objetivo_id ?? null,
        descricao_livre: g.descricao_livre ?? null,
      }));
      const acoIds = ganttArr.map(g => g.acao_id).filter((id): id is string => Boolean(id));
      if (acoIds.length > 0) {
        const { data: acoesData } = await supabase
          .from('acoes').select('id, tarefa_id').in('id', acoIds);
        const acoTarefaMap = new Map(
          (acoesData ?? []).map((a: { id: string; tarefa_id: string | null }) => [a.id, a.tarefa_id])
        );
        ganttArr.forEach(g => { g.tarefa_id = g.acao_id ? (acoTarefaMap.get(g.acao_id) ?? null) : null; });
      }
      setAgendaMacro(ganttArr);
    } catch (e) {
      console.error('[usePlanoBoneDay]', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, areaId, effectiveProfileId, mes]);

  useEffect(() => { carregar(); }, [carregar]);

  return {
    metas, metasNaoConcluidas, indicadores, responsaveis,
    comportamentos, agendaMacro, objetivoResponsaveis, mes, setMes,
    isLoading, error, recarregar: carregar,
  };
}

// ── Helpers exportados para uso na page ───────────────────────────────────────
export function semanasDoMes(mesStr: string): number[] {
  const parts = mesStr.split('-');
  if (parts.length !== 2) return [];
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (!year || !month) return [];
  const semanas: number[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    // Encontra a segunda-feira (ISO) da semana de d
    const dow = d.getDay(); // 0=Dom
    const monday = new Date(d);
    monday.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    // Só inclui a semana se sua segunda-feira cair no mês alvo
    if (monday.getFullYear() === year && monday.getMonth() === month - 1) {
      const w = isoWeek(d);
      if (!semanas.includes(w)) semanas.push(w);
    }
    d.setDate(d.getDate() + 7);
  }
  return semanas;
}

export function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const raw   = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    return { value, label: raw.charAt(0).toUpperCase() + raw.slice(1) };
  });
}
