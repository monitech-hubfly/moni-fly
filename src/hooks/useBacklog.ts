'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { rankChamadoPainelUnificado, compareChamadosPainelRank } from '@/lib/sirene-painel-chamados-rank';

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
  frank_id: string | null;
  frank_nome: string | null;
  trava: boolean;
  te_trata: boolean;
};

export type AtividadeItem = {
  id: string;
  nome_acao: string | null;
  comportamento_chave: boolean;
  semana_ano_inicio: number | null;
  semana_ano_fim: number | null;
  semanas_selecionadas: number[];
  origem: string | null;
  objetivo_id: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
};

export type PastelariaItem = {
  id: string;
  nome: string;
  coluna: string;
  semana_origem: string;
};

export type UseBacklogResult = {
  sirene: SireneItem[];
  pastelaria: PastelariaItem[];
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
  const [pastelaria, setPastelaria] = useState<PastelariaItem[]>([]);
  const [atividades, setAtividades] = useState<AtividadeItem[]>([]);
  const callIdRef = useRef(0);

  const { simulacao } = useSimulacaoUsuario();
  const simProfileId  = simulacao?.profileId   ?? null;
  const simAreaId     = simulacao?.areaId      ?? null;
  const simNome       = simulacao?.nomeUsuario ?? null;

  const carregar = useCallback(async () => {
    const callId = ++callIdRef.current;
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
      let areaPessoaId: string | null = null;

      if (isAdmin && simProfileId) {
        effectiveProfileId = simProfileId;
        nomeUsuario = simNome;
        const { data: simAP } = await supabase
          .from('area_pessoas')
          .select('id')
          .eq('profile_id', simProfileId)
          .maybeSingle();
        areaPessoaId = (simAP as { id?: string } | null)?.id ?? null;
      } else {
        const { data: areaPessoa } = await supabase
          .from('area_pessoas')
          .select('id, nome')
          .eq('profile_id', user.id)
          .maybeSingle();
        nomeUsuario = (areaPessoa?.nome as string | null) ?? null;
        areaPessoaId = (areaPessoa?.id as string | null) ?? null;
      }

      // Busca Sirene, Atividades, Pastelaria e Atrasadas fora da janela em paralelo
      const [sireneRes, atividadesRes, pastelariaRes, atividadesAtrasadasRes] = await Promise.all([
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
            interacao_id,
            trava,
            sirene_chamados(numero, frank_id, frank_nome, te_trata),
            kanban_atividades!sirene_topicos_interacao_id_fkey(
              sirene_chamados(numero, frank_id, frank_nome, te_trata)
            )
          `)
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .in('status', ['nao_iniciado', 'em_andamento'])
          .eq('arquivado', false),

        supabase
          .from('gantt_planejamento')
          .select('id, acao_id, comportamento_chave, semana_ano_inicio, semana_ano_fim, semanas_selecionadas, origem, objetivo_id, hora_inicio, hora_fim, acoes(nome)')
          .or(`profile_id.eq.${effectiveProfileId}${nomeUsuario ? `,responsavel.ilike.%${nomeUsuario}%` : ''}`)
          .is('data_conclusao_real', null)
          .overlaps('semanas_selecionadas', [
            semanaAtual - 4, semanaAtual - 3, semanaAtual - 2,
            semanaAtual - 1, semanaAtual, semanaAtual + 1, semanaAtual + 2,
          ]),

        areaPessoaId
          ? supabase
              .from('pastelaria_cards')
              .select('id, nome, coluna, semana_origem')
              .eq('responsavel_id', areaPessoaId)
              .in('coluna', ['inbox', 'mapped', 'doing'])
              .eq('reclassificado', false)
          : Promise.resolve({ data: [], error: null }),

        // Atividades atrasadas além da janela ±4 semanas (garante cobertura total)
        supabase
          .from('gantt_planejamento')
          .select('id, acao_id, comportamento_chave, semana_ano_inicio, semana_ano_fim, semanas_selecionadas, origem, objetivo_id, hora_inicio, hora_fim, acoes(nome)')
          .or(`profile_id.eq.${effectiveProfileId}${nomeUsuario ? `,responsavel.ilike.%${nomeUsuario}%` : ''}`)
          .is('data_conclusao_real', null)
          .lt('semana_ano_fim', semanaAtual - 4),
      ]);

      if (sireneRes.error) throw sireneRes.error;

      type ChamadoRaw = { numero: string; frank_id: string | null; frank_nome: string | null; te_trata: boolean | null } | { numero: string; frank_id: string | null; frank_nome: string | null; te_trata: boolean | null }[] | null;
      type SireneRaw = {
        id: string;
        tipo: string;
        descricao: string | null;
        data_fim: string | null;
        prazo_proposto: string | null;
        status: string;
        chamado_id: string | null;
        interacao_id: string | null;
        trava: boolean | null;
        sirene_chamados: ChamadoRaw;
        kanban_atividades: { sirene_chamados: ChamadoRaw } | { sirene_chamados: ChamadoRaw }[] | null;
      };

      const sireneArr: SireneItem[] = ((sireneRes.data ?? []) as unknown as SireneRaw[]).map(row => {
        const chamadoDireto = Array.isArray(row.sirene_chamados)
          ? row.sirene_chamados[0] ?? null
          : row.sirene_chamados;
        const interacaoRaw = Array.isArray(row.kanban_atividades)
          ? row.kanban_atividades[0] ?? null
          : row.kanban_atividades;
        const chamadoViaInteracao = interacaoRaw
          ? (Array.isArray(interacaoRaw.sirene_chamados)
              ? interacaoRaw.sirene_chamados[0] ?? null
              : interacaoRaw.sirene_chamados)
          : null;
        const chamado = chamadoDireto ?? chamadoViaInteracao;
        const trava    = Boolean(row.trava);
        const te_trata = Boolean(chamado?.te_trata);
        const frank_id   = chamado?.frank_id   ?? null;
        const frank_nome = chamado?.frank_nome ?? null;
        const { prioridade_label } = rankChamadoPainelUnificado({
          frank_id,
          franqueado_nome:  frank_nome,
          trava,
          te_trata,
          data_vencimento:  row.data_fim ?? row.prazo_proposto,
          atividade_status: row.status,
        });
        return {
          id:             row.id,
          tipo:           row.tipo,
          descricao:      row.descricao,
          chamado_titulo: null,
          data_fim:       row.data_fim,
          prazo_proposto: row.prazo_proposto,
          status:         row.status,
          chamado_id:     row.chamado_id,
          chamado_numero: chamado?.numero ?? null,
          prioridade:     prioridade_label,
          frank_id,
          frank_nome,
          trava,
          te_trata,
        };
      });

      // Ordenação: grupo P1-P6 → prazo → criação (via compareChamadosPainelRank)
      sireneArr.sort((a, b) => compareChamadosPainelRank(
        { frank_id: a.frank_id, franqueado_nome: a.frank_nome, trava: a.trava, te_trata: a.te_trata, data_vencimento: a.data_fim ?? a.prazo_proposto, atividade_status: a.status },
        { frank_id: b.frank_id, franqueado_nome: b.frank_nome, trava: b.trava, te_trata: b.te_trata, data_vencimento: b.data_fim ?? b.prazo_proposto, atividade_status: b.status },
      ));

      type AtivRaw = {
        id: string;
        acao_id: string | null;
        comportamento_chave: boolean;
        semana_ano_inicio: number | null;
        semana_ano_fim: number | null;
        semanas_selecionadas: number[] | null;
        origem: string | null;
        objetivo_id: string | null;
        hora_inicio: string | null;
        hora_fim: string | null;
        acoes: { nome: string } | { nome: string }[] | null;
      };

      const mapAtivRaw = (row: AtivRaw): AtividadeItem => {
        const acaoObj = Array.isArray(row.acoes) ? row.acoes[0] : row.acoes;
        return {
          id:                    row.id,
          nome_acao:             acaoObj?.nome ?? null,
          comportamento_chave:   row.comportamento_chave ?? false,
          semana_ano_inicio:     row.semana_ano_inicio,
          semana_ano_fim:        row.semana_ano_fim,
          semanas_selecionadas:  Array.isArray(row.semanas_selecionadas) ? row.semanas_selecionadas : [],
          origem:                row.origem,
          objetivo_id:           row.objetivo_id,
          hora_inicio:           row.hora_inicio,
          hora_fim:              row.hora_fim,
        };
      };

      // Merge com deduplicação: janela principal + atrasadas fora da janela
      const atividadesMap = new Map<string, AtividadeItem>();
      ((atividadesRes.data ?? []) as AtivRaw[]).forEach(row => atividadesMap.set(row.id, mapAtivRaw(row)));
      ((atividadesAtrasadasRes.data ?? []) as AtivRaw[]).forEach(row => {
        if (!atividadesMap.has(row.id)) atividadesMap.set(row.id, mapAtivRaw(row));
      });
      const atividadesArr: AtividadeItem[] = Array.from(atividadesMap.values());

      // Ordenação: semana_ano_fim ASC, com fallback para MAX(semanas_selecionadas)
      atividadesArr.sort((a, b) => {
        const fa = a.semana_ano_fim ?? (a.semanas_selecionadas.length ? Math.max(...a.semanas_selecionadas) : Infinity);
        const fb = b.semana_ano_fim ?? (b.semanas_selecionadas.length ? Math.max(...b.semanas_selecionadas) : Infinity);
        return fa - fb;
      });

      type PastelariaRaw = { id: string; nome: string; coluna: string; semana_origem: string };
      const pastelariaArr: PastelariaItem[] = ((pastelariaRes.data ?? []) as PastelariaRaw[]).map(row => ({
        id:            row.id,
        nome:          row.nome,
        coluna:        row.coluna,
        semana_origem: row.semana_origem,
      }));

      if (callId !== callIdRef.current) return;
      setSirene(sireneArr);
      setPastelaria(pastelariaArr);
      setAtividades(atividadesArr);
    } catch (e) {
      if (callId !== callIdRef.current) return;
      console.error('[useBacklog] erro:', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      if (callId === callIdRef.current) setIsLoading(false);
    }
  }, [supabase, simProfileId, simAreaId, simNome]);

  useEffect(() => { carregar(); }, [carregar]);

  return { sirene, pastelaria, atividades, isLoading, error };
}
