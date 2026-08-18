'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek, isoWeekYear } from '@/utils/periodos';
import { statusSemaforoPorValor } from '@/utils/semaforoFaixas';

const FAROL_COR: Record<string, string> = {
  ve: '#1e7a3a', vc: '#52b36f', am: '#f2c94c', vm: '#d24141',
};
const FAROL_SCORE: Record<string, number> = { ve: 100, vc: 75, am: 50, vm: 0 };

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
      let objQuery = supabase
        .from('objetivos')
        .select('id, descricao, tipo, is_chave, meta_valor, meta_unidade, criado_em, status, ordem, objetivo_pai_id, profile_id')
        .eq('area_id', areaId)
        .eq('status', 'ativo');
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
        // indicador_lancamentos não tem profile_id — um valor por indicador/semana
        const { data: lancs } = await supabase
          .from('indicador_lancamentos')
          .select('indicador_id, valor, semana')
          .in('indicador_id', indIds)
          .in('semana', [semAnterior, semRel])
          .or(`semana_ano.eq.${anoISO},semana_ano.is.null`);

        for (const l of (lancs ?? []) as { indicador_id: string; valor: unknown; semana: number }[]) {
          const val = String(l.valor ?? '');
          if (l.semana === semRel && !lancMap.has(l.indicador_id)) {
            lancMap.set(l.indicador_id, val);
          } else if (l.semana === semAnterior && !lancMapAnterior.has(l.indicador_id)) {
            lancMapAnterior.set(l.indicador_id, val);
          }
        }
      }

      setSemanaAnterior(semAnterior);
      setAnoRelativo(anoISO);
      setSemanaRelativa(semRel);

      const indicadoresArr: IndicadorItemMeta[] = indArr
        .map(ind => {
          const valorAtual    = lancMap.get(ind.id) ?? null;
          const valorAnterior = lancMapAnterior.get(ind.id) ?? null;
          const farol = valorAtual != null
            ? (statusSemaforoPorValor(ind, valorAtual) as string | null)
            : null;
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

      // Buscar objetivo_responsaveis com concluido para TODOS os objetivos da área
      const allObjIds = (objRes.data ?? []).map((o: { id: string }) => o.id);
      if (allObjIds.length > 0) {
        const { data: orData } = await supabase
          .from('objetivo_responsaveis')
          .select('objetivo_id, profile_id, concluido, concluido_em, data_inicio, data_fim, dias_uteis')
          .in('objetivo_id', allObjIds);
        type ORRow = {
          objetivo_id: string; profile_id: string;
          concluido: boolean | null; concluido_em: string | null;
          data_inicio: string | null; data_fim: string | null; dias_uteis: number | null;
        };
        setObjetivoResponsaveis(
          ((orData ?? []) as ORRow[]).map(r => ({
            objetivo_id: r.objetivo_id,
            profile_id:  r.profile_id,
            concluido:   Boolean(r.concluido),
            concluido_em: r.concluido_em ?? null,
            data_inicio: r.data_inicio ?? null,
            data_fim:    r.data_fim ?? null,
            dias_uteis:  r.dias_uteis ?? null,
          }))
        );
      } else {
        setObjetivoResponsaveis([]);
      }

      setMetas(metasArr);
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
    metas, subMetas, indicadores, responsaveis, objetivoResponsaveis,
    semanaRelativa, semanaAnterior, anoRelativo, isLoading, error, recarregar: carregar,
  };
}
