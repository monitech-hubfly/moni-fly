'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek, isoWeekYear } from '@/utils/periodos';
import { statusSemaforoPorValor } from '@/utils/semaforoFaixas';

const FAROL_COR: Record<string, string> = {
  ve: '#1e7a3a', vc: '#52b36f', am: '#f2c94c', vm: '#d24141',
};
const FAROL_SCORE: Record<string, number> = { ve: 100, vc: 75, am: 50, vm: 0 };

/** Conta dias úteis de dataInicio até refDate (inclusive) */
function calcEsperadoPctHook(
  dataInicio: string | null | undefined,
  dataFim: string | null | undefined,
  diasUteis: number | null | undefined,
  refDate: Date,
): number | null {
  if (!dataInicio || !dataFim) return null;
  const ref    = new Date(refDate); ref.setHours(0, 0, 0, 0);
  const inicio = new Date(dataInicio + 'T00:00:00');
  const fim    = new Date(dataFim    + 'T00:00:00');
  if (ref < inicio) return 0;
  if (ref > fim)    return 100;
  // Bug 3 fix: se dias_uteis não foi salvo no banco (null), calcula do range de datas
  let total = (diasUteis && diasUteis > 0) ? diasUteis : 0;
  if (!total) {
    const d = new Date(inicio);
    while (d <= fim) { if (d.getDay() !== 0 && d.getDay() !== 6) total++; d.setDate(d.getDate() + 1); }
  }
  if (total <= 0) return null;
  let count = 0;
  const d = new Date(inicio);
  while (d <= ref) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.min(100, Math.round((count / total) * 100));
}

function farolProjetoRelativo(valor: string, esperado: number | null): string | null {
  if (esperado === null || esperado <= 0) return null;
  const ratio = (parseFloat(valor) / esperado) * 100;
  if (isNaN(ratio)) return null;
  if (ratio >= 75) return 've';
  if (ratio >= 60) return 'vc';
  if (ratio >= 30) return 'am';
  return 'vm';
}

export type MetaItem = {
  id: string;
  descricao: string;
  tipo: string | null;
  is_chave: boolean;
  meta_valor: string | null;
  meta_unidade: string | null;
  criado_em: string | null;
  status: string;
  ordem: number | null;
  profile_id: string | null;
  responsavel_nome: string | null;
  comentariosCount: number;
};

export type SubMetaItem = {
  id: string;
  descricao: string;
  tipo: string | null;
  is_chave: boolean;
  objetivo_pai_id: string;
  profile_id: string | null;
  is_minha: boolean;
};

export type IndicadorItemMeta = {
  id: string;
  nome: string;
  indicador_chave: boolean;
  semaforo_faixas: unknown;
  tipo: string | null;
  objetivo_id: string | null;
  profile_id: string | null;
  valorAtual: string | null;
  valorAnterior: string | null;
  corSemaforo: string | null;
  corHex: string;
  percentual: number | null;
};

export type ResponsavelItem = {
  profile_id: string;
  nome: string;
};

export type ObjetivoResponsavel = {
  objetivo_id: string;
  profile_id: string;
  concluido: boolean;
  concluido_em: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  dias_uteis: number | null;
};

export type UseMetasIndicadoresResult = {
  metas: MetaItem[];
  metasConcluidas: MetaItem[];
  subMetas: SubMetaItem[];
  indicadores: IndicadorItemMeta[];
  responsaveis: ResponsavelItem[];
  objetivoResponsaveis: ObjetivoResponsavel[];
  semanaRelativa: number;
  semanaAnterior: number;
  anoRelativo: number;
  isLoading: boolean;
  error: string | null;
  recarregar: () => void;
};

export function useMetasIndicadores(
  effectiveProfileId: string | null,
  areaId: string | null,
  mes?: string | null,
): UseMetasIndicadoresResult {
  const supabase = useMemo(() => createClient(), []);
  const [metas,                setMetas]                = useState<MetaItem[]>([]);
  const [metasConcluidas,      setMetasConcluidas]      = useState<MetaItem[]>([]);
  const [subMetas,             setSubMetas]             = useState<SubMetaItem[]>([]);
  const [indicadores,          setIndicadores]          = useState<IndicadorItemMeta[]>([]);
  const [responsaveis,         setResponsaveis]         = useState<ResponsavelItem[]>([]);
  const [objetivoResponsaveis, setObjetivoResponsaveis] = useState<ObjetivoResponsavel[]>([]);
  const [semanaRelativa,       setSemanaRelativa]       = useState(0);
  const [semanaAnterior,       setSemanaAnterior]       = useState(0);
  const [anoRelativo,          setAnoRelativo]          = useState(0);
  const [isLoading,            setIsLoading]            = useState(true);
  const [error,                setError]                = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!areaId) { setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);
    try {
      const hoje    = new Date();
      const semana  = isoWeek(hoje);
      const anoISO  = isoWeekYear(hoje);

      // Busca o usuário autenticado para usar como fallback quando effectiveProfileId é null
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const lookupProfileId = effectiveProfileId ?? authUser?.id ?? null;
      let objQuery = supabase
        .from('objetivos')
        .select('id, descricao, tipo, is_chave, meta_valor, meta_unidade, criado_em, status, ordem, objetivo_pai_id, profile_id')
        .eq('area_id', areaId)
        .in('status', ['ativo', 'concluido']);
      if (mes) objQuery = objQuery.eq('mes', mes);

      const [objRes, indRes, respRes] = await Promise.all([
        objQuery,
        supabase
          .from('indicadores')
          .select('id, nome, indicador_chave, semaforo_faixas, tipo, objetivo_id, profile_id')
          .eq('area_id', areaId)
          .order('nome'),
        supabase
          .from('area_pessoas')
          .select('profile_id, nome')
          .eq('area_id', areaId)
          .eq('ativo', true)
          .order('nome'),
      ]);

      const respArr = (respRes.data ?? []) as ResponsavelItem[];
      setResponsaveis(respArr);
      const respByProfileId = new Map(respArr.map(r => [r.profile_id, r.nome]));

      if (objRes.error) throw objRes.error;
      if (indRes.error) throw indRes.error;

      type ObjRow = {
        id: string; descricao: string; tipo: string | null;
        is_chave: boolean | null; meta_valor: string | null;
        meta_unidade: string | null; criado_em: string | null;
        status: string;
        ordem: number | null; objetivo_pai_id: string | null;
        profile_id: string | null;
      };
      const objArr = (objRes.data ?? []) as ObjRow[];

      // Buscar contagem de comentários para as metas principais
      const metaIds = objArr.filter(o => !o.objetivo_pai_id).map(o => o.id);
      const comCountMap = new Map<string, number>();
      if (metaIds.length > 0) {
        const { data: comData } = await supabase
          .from('audit_log')
          .select('entidade_id')
          .eq('entidade', 'objetivos')
          .eq('operacao', 'COMMENT')
          .in('entidade_id', metaIds);
        ((comData ?? []) as { entidade_id: string }[]).forEach(r => {
          comCountMap.set(r.entidade_id, (comCountMap.get(r.entidade_id) ?? 0) + 1);
        });
      }

      const metasArr: MetaItem[] = objArr
        .filter(o => !o.objetivo_pai_id)
        .map(o => ({
          id: o.id, descricao: o.descricao, tipo: o.tipo,
          is_chave: Boolean(o.is_chave), meta_valor: o.meta_valor,
          meta_unidade: o.meta_unidade, criado_em: o.criado_em ?? null,
          status: o.status, ordem: o.ordem,
          profile_id: o.profile_id,
          responsavel_nome: o.profile_id ? (respByProfileId.get(o.profile_id) ?? null) : null,
          comentariosCount: comCountMap.get(o.id) ?? 0,
        }))
        .sort((a, b) => {
          if (a.is_chave !== b.is_chave) return a.is_chave ? -1 : 1;
          return (a.ordem ?? 999) - (b.ordem ?? 999);
        });

      const subMetasArr: SubMetaItem[] = objArr
        .filter(o => !!o.objetivo_pai_id)
        .map(o => ({
          id: o.id, descricao: o.descricao, tipo: o.tipo,
          is_chave: Boolean(o.is_chave),
          objetivo_pai_id: o.objetivo_pai_id!,
          profile_id: o.profile_id,
          is_minha: o.profile_id === effectiveProfileId,
        }));

      // Indicadores + lançamentos
      type IndRow = {
        id: string; nome: string; indicador_chave: boolean | null;
        semaforo_faixas: unknown; tipo: string | null;
        objetivo_id: string | null; profile_id: string | null;
      };
      const indArr = (indRes.data ?? []) as IndRow[];
      const indIds = indArr.map(i => i.id);

      const lancMap         = new Map<string, string>();
      const lancMapAnterior = new Map<string, string>();
      // Sempre usa a semana ISO atual e a anterior (ignora tabela periodos,
      // que pode ter períodos longos com data_inicio no passado).
      const semRel      = semana;
      const semAnterior = semana > 1 ? semana - 1 : 52;
      if (indIds.length > 0) {
        // Filtra lançamentos do usuário efetivo OU sem profile_id (legado)
        let lancsQuery: any = supabase
          .from('indicador_lancamentos')
          .select('indicador_id, valor, semana, profile_id')
          .in('indicador_id', indIds)
          .in('semana', [semAnterior, semRel]);
        // Usa lookupProfileId (já inclui fallback authUser) para o filtro
        if (lookupProfileId) {
          lancsQuery = lancsQuery.or(`profile_id.eq.${lookupProfileId},profile_id.is.null`);
        }
        const { data: lancs } = await lancsQuery;

        // Prioriza a linha com profile_id do usuário sobre linhas legadas (profile_id null)
        for (const l of (lancs ?? []) as { indicador_id: string; valor: unknown; semana: number; profile_id: string | null }[]) {
          const val = String(l.valor ?? '');
          const isOwn = l.profile_id === lookupProfileId;
          if (l.semana === semRel) {
            if (isOwn || !lancMap.has(l.indicador_id)) lancMap.set(l.indicador_id, val);
          } else if (l.semana === semAnterior) {
            if (isOwn || !lancMapAnterior.has(l.indicador_id)) lancMapAnterior.set(l.indicador_id, val);
          }
        }
      }

      setSemanaAnterior(semAnterior);
      setAnoRelativo(anoISO);
      setSemanaRelativa(semRel);

      // Buscar objetivo_responsaveis com concluido para TODOS os objetivos da área
      // (precisa estar antes do mapeamento de indicadores para calcular corHex de is_projeto_relativo)
      const allObjIds = (objRes.data ?? []).map((o: { id: string }) => o.id);
      type ORRow = {
        objetivo_id: string; profile_id: string;
        concluido: boolean | null; concluido_em: string | null;
        data_inicio: string | null; data_fim: string | null; dias_uteis: number | null;
      };
      let orRows: ORRow[] = [];
      if (allObjIds.length > 0) {
        const { data: orData } = await supabase
          .from('objetivo_responsaveis')
          .select('objetivo_id, profile_id, concluido, concluido_em, data_inicio, data_fim, dias_uteis')
          .in('objetivo_id', allObjIds);
        orRows = (orData ?? []) as ORRow[];
      }

      // Índice: objetivo_id → datas do usuário efetivo (para is_projeto_relativo)
      const orByObjForUser = new Map<string, { data_inicio: string | null; data_fim: string | null; dias_uteis: number | null }>();
      for (const r of orRows) {
        if (lookupProfileId && r.profile_id === lookupProfileId) {
          orByObjForUser.set(r.objetivo_id, { data_inicio: r.data_inicio, data_fim: r.data_fim, dias_uteis: r.dias_uteis });
        }
      }

      const indicadoresArr: IndicadorItemMeta[] = indArr
        .map(ind => {
          const valorAtual    = lancMap.get(ind.id) ?? null;
          const valorAnterior = lancMapAnterior.get(ind.id) ?? null;

          type RawSf = { is_projeto_relativo?: boolean; data_inicio?: string; data_fim?: string; dias_uteis?: number };
          const rawSf = ind.semaforo_faixas as RawSf | null;
          const isProjetoRelativo = Boolean(rawSf?.is_projeto_relativo);

          let farol: string | null = null;
          if (valorAtual != null) {
            if (isProjetoRelativo) {
              const orRow = ind.objetivo_id ? orByObjForUser.get(ind.objetivo_id) : null;
              const prjInicio = rawSf?.data_inicio ?? orRow?.data_inicio ?? null;
              const prjFim    = rawSf?.data_fim    ?? orRow?.data_fim    ?? null;
              const prjUteis  = rawSf?.dias_uteis  ?? orRow?.dias_uteis  ?? null;
              const esperado  = calcEsperadoPctHook(prjInicio, prjFim, prjUteis, hoje);
              farol = farolProjetoRelativo(valorAtual, esperado);
            } else {
              farol = statusSemaforoPorValor(ind, valorAtual) as string | null;
            }
          }

          return {
            id:              ind.id,
            nome:            ind.nome,
            indicador_chave: Boolean(ind.indicador_chave),
            semaforo_faixas: ind.semaforo_faixas,
            tipo:            ind.tipo,
            objetivo_id:     ind.objetivo_id,
            profile_id:      ind.profile_id,
            valorAtual,
            valorAnterior,
            corSemaforo:     farol,
            corHex:          farol ? (FAROL_COR[farol] ?? '#d1d5db') : '#d1d5db',
            percentual:      farol != null ? (FAROL_SCORE[farol] ?? null) : null,
          };
        })
        .sort((a, b) => {
          if (a.indicador_chave !== b.indicador_chave) return a.indicador_chave ? -1 : 1;
          return a.nome.localeCompare(b.nome, 'pt-BR');
        });

      setObjetivoResponsaveis(
        orRows.map(r => ({
          objetivo_id: r.objetivo_id,
          profile_id:  r.profile_id,
          concluido:   Boolean(r.concluido),
          concluido_em: r.concluido_em ?? null,
          data_inicio: r.data_inicio ?? null,
          data_fim:    r.data_fim ?? null,
          dias_uteis:  r.dias_uteis ?? null,
        }))
      );

      setMetas(metasArr.filter(m => m.status === 'ativo'));
      setMetasConcluidas(metasArr.filter(m => m.status === 'concluido'));
      setSubMetas(subMetasArr);
      setIndicadores(indicadoresArr);
    } catch (e) {
      console.error('[useMetasIndicadores]', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, areaId, effectiveProfileId, mes]);

  useEffect(() => { carregar(); }, [carregar]);

  return {
    metas, metasConcluidas, subMetas, indicadores, responsaveis, objetivoResponsaveis,
    semanaRelativa, semanaAnterior, anoRelativo, isLoading, error, recarregar: carregar,
  };
}
