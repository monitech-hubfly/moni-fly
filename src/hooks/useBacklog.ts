'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';

export type SireneItem = {
  id: string;
  tipo: string;
  descricao: string | null;
  chamado_titulo: string | null;
  data_fim: string | null;
  prazo_proposto: string | null;
  status: string;
  chamado_id: string | null;
  chamado_numero: string | null;
  prioridade: string | null;
};

export type AtividadeItem = {
  id: string;
  comportamento_chave: string | null;
  semana_ano_inicio: number | null;
  semana_ano_fim: number | null;
  origem: string | null;
  objetivo_id: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
};

export type UseBacklogResult = {
  sirene: SireneItem[];
  atividades: AtividadeItem[];
  isLoading: boolean;
  error: string | null;
};

const ADMIN_EMAIL = 'danilo.n@moni.casa';

export function useBacklog(): UseBacklogResult {
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sirene, setSirene] = useState<SireneItem[]>([]);
  const [atividades, setAtividades] = useState<AtividadeItem[]>([]);

  const { simulacao } = useSimulacaoUsuario();
  const simProfileId  = simulacao?.profileId   ?? null;
  const simAreaId     = simulacao?.areaId      ?? null;
  const simNome       = simulacao?.nomeUsuario ?? null;

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const isAdmin = user.email === ADMIN_EMAIL;
      const hoje = new Date();
      const semanaAtual = isoWeek(hoje);

      let effectiveProfileId = user.id;
      let nomeUsuario: string | null = null;

      if (isAdmin && simProfileId) {
        effectiveProfileId = simProfileId;
        nomeUsuario = simNome;
      } else {
        const { data: areaPessoa } = await supabase
          .from('area_pessoas')
          .select('nome')
          .eq('profile_id', user.id)
          .maybeSingle();
        nomeUsuario = (areaPessoa?.nome as string | null) ?? null;
      }

      // Busca Sirene e Atividades em paralelo
      const [sireneRes, atividadesRes] = await Promise.all([
        supabase
          .from('sirene_topicos')
          .select(`
            id,
            tipo,
            descricao,
            data_fim,
            prazo_proposto,
            status,
            chamado_id,
            prioridade,
            sirene_chamados!left(numero)
          `)
          .eq('responsavel_id', effectiveProfileId)
          .in('status', ['nao_iniciado', 'em_andamento'])
          .eq('arquivado', false),

        nomeUsuario
          ? supabase
              .from('gantt_planejamento')
              .select('id, comportamento_chave, semana_ano_inicio, semana_ano_fim, origem, objetivo_id, hora_inicio, hora_fim')
              .or(`profile_id.eq.${effectiveProfileId},responsavel.ilike.%${nomeUsuario}%`)
              .gte('semana_ano_fim', semanaAtual - 4)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (sireneRes.error) throw sireneRes.error;

      type SireneRaw = {
        id: string;
        tipo: string;
        descricao: string | null;
        data_fim: string | null;
        prazo_proposto: string | null;
        status: string;
        chamado_id: string | null;
        prioridade: string | null;
        sirene_chamados: { numero: string } | { numero: string }[] | null;
      };

      const sireneArr: SireneItem[] = ((sireneRes.data ?? []) as unknown as SireneRaw[]).map(row => {
        const chamado = Array.isArray(row.sirene_chamados)
          ? row.sirene_chamados[0] ?? null
          : row.sirene_chamados;
        return {
          id:              row.id,
          tipo:            row.tipo,
          descricao:       row.descricao,
          chamado_titulo:  null,
          data_fim:        row.data_fim,
          prazo_proposto:  row.prazo_proposto,
          status:          row.status,
          chamado_id:      row.chamado_id,
          chamado_numero:  chamado?.numero ?? null,
          prioridade:      row.prioridade,
        };
      });

      // Ordenação: atrasados primeiro, depois sem prazo, depois futuros ASC
      const hojeStr = hoje.toISOString().slice(0, 10);
      sireneArr.sort((a, b) => {
        const prazoA = a.data_fim ?? a.prazo_proposto;
        const prazoB = b.data_fim ?? b.prazo_proposto;
        const atrasadoA = prazoA ? prazoA < hojeStr : false;
        const atrasadoB = prazoB ? prazoB < hojeStr : false;
        if (atrasadoA !== atrasadoB) return atrasadoA ? -1 : 1;
        if (!prazoA && prazoB) return -1;
        if (prazoA && !prazoB) return 1;
        if (!prazoA && !prazoB) return 0;
        return prazoA! < prazoB! ? -1 : prazoA! > prazoB! ? 1 : 0;
      });

      type AtivRaw = {
        id: string;
        comportamento_chave: string | null;
        semana_ano_inicio: number | null;
        semana_ano_fim: number | null;
        origem: string | null;
        objetivo_id: string | null;
        hora_inicio: string | null;
        hora_fim: string | null;
      };

      const atividadesArr: AtividadeItem[] = ((atividadesRes.data ?? []) as AtivRaw[]).map(row => ({
        id:                  row.id,
        comportamento_chave: row.comportamento_chave,
        semana_ano_inicio:   row.semana_ano_inicio,
        semana_ano_fim:      row.semana_ano_fim,
        origem:              row.origem,
        objetivo_id:         row.objetivo_id,
        hora_inicio:         row.hora_inicio,
        hora_fim:            row.hora_fim,
      }));

      // Ordenação: semana_ano_fim ASC (mais antigas primeiro)
      atividadesArr.sort((a, b) => {
        const fa = a.semana_ano_fim ?? Infinity;
        const fb = b.semana_ano_fim ?? Infinity;
        return fa - fb;
      });

      setSirene(sireneArr);
      setAtividades(atividadesArr);
    } catch (e) {
      console.error('[useBacklog] erro:', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, simProfileId, simAreaId, simNome]);

  useEffect(() => { carregar(); }, [carregar]);

  return { sirene, atividades, isLoading, error };
}
