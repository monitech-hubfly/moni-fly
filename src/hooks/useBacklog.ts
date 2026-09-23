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
  /** ID interno (inteiro) do sirene_chamados — usado para abrir o modal inline. */
  chamado_interno_id: number | null;
  chamado_numero: string | null;
  /** UUID de kanban_atividades quando o tópico chega via interacao_id (sem chamado_id direto). */
  interacao_id: string | null;
  prioridade: string | null;
  frank_id: string | null;
  frank_nome: string | null;
  trava: boolean;
  te_trata: boolean;
  /** Nome da pessoa que abriu o tópico (preenchido quando disponível). */
  aberto_por_nome?: string | null;
};

export type AtividadeItem = {
  id: string;
  acao_id: string | null;
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
  /** Força recarga completa do backlog (útil após exclusões). */
  recarregar: () => void;
  /** IDs de atividades ativas (para filtrar no Modal de Agendamento). */
  ativoIds?: Set<string>;
  /** Atividades já agendadas (incluídas no Modal de Agendamento). */
  atividadesAgendadas?: { id: string; nome: string | null; prazo: string | null }[];
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
  const simProfileId  = simulacao?.profileId ?? null;

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

      if (isAdmin && simProfileId) {
        effectiveProfileId = simProfileId;
      }

      // Busca Sirene, Atividades, Pastelaria e Atividades Atrasadas fora da janela em paralelo
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
            sirene_chamados(id, numero, frank_id, frank_nome, te_trata),
            kanban_atividades!sirene_topicos_interacao_id_fkey(
              sirene_chamados(id, numero, frank_id, frank_nome, te_trata)
            )
          `)
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .in('status', ['nao_iniciado', 'em_andamento'])
          .eq('arquivado', false),

        // Janela: semana atual ±4 semanas. Atividades atrasadas além da janela são buscadas separadamente.
        // Filtra apenas atividades vinculadas ao catálogo (acao_id IS NOT NULL) e sem horário (hora_inicio IS NULL).
        // Itens com hora_inicio são eventos de agenda (criados via modal de calendário) — ficam apenas no calendário.
        // Usa somente profile_id (UUID) para garantir que apenas atividades criadas pelo próprio usuário apareçam.
        // O filtro por responsavel.ilike foi removido pois puxava indevidamente atividades do Gantt de toda a equipe.
        supabase
          .from('gantt_planejamento')
          .select('id, acao_id, titulo, comportamento_chave, semana_ano_inicio, semana_ano_fim, semanas_selecionadas, origem, objetivo_id, hora_inicio, hora_fim, acoes(nome)')
          .eq('profile_id', effectiveProfileId)
          .is('data_conclusao_real', null)
          .not('acao_id', 'is', null)
          .is('hora_inicio', null)
          .overlaps('semanas_selecionadas', [
            semanaAtual - 4, semanaAtual - 3, semanaAtual - 2,
            semanaAtual - 1, semanaAtual, semanaAtual + 1, semanaAtual + 2,
          ]),

        // Pastelaria removida do Backlog (set/2026): itens da pastelaria
        // não são mais exibidos nesta coluna para evitar duplicação com Sirene.
        Promise.resolve({ data: [], error: null }),

        // Atividades atrasadas além da janela de ±4 semanas (garante cobertura total).
        // Mesmo critério: acao_id IS NOT NULL e hora_inicio IS NULL (não são eventos de agenda).
        // Usa somente profile_id (UUID) — mesmo motivo da query principal acima.
        supabase
          .from('gantt_planejamento')
          .select('id, acao_id, titulo, comportamento_chave, semana_ano_inicio, semana_ano_fim, semanas_selecionadas, origem, objetivo_id, hora_inicio, hora_fim, acoes(nome)')
          .eq('profile_id', effectiveProfileId)
          .is('data_conclusao_real', null)
          .not('acao_id', 'is', null)
          .is('hora_inicio', null)
          .lt('semana_ano_fim', semanaAtual - 4),
      ]);

      if (sireneRes.error) throw sireneRes.error;

      type ChamadoRaw = { id: number; numero: string; frank_id: string | null; frank_nome: string | null; te_trata: boolean | null } | { id: number; numero: string; frank_id: string | null; frank_nome: string | null; te_trata: boolean | null }[] | null;
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
          id:                 row.id,
          tipo:               row.tipo,
          descricao:          row.descricao,
          chamado_titulo:     null,
          data_fim:           row.data_fim,
          prazo_proposto:     row.prazo_proposto,
          status:             row.status,
          chamado_id:         row.chamado_id,
          chamado_interno_id: chamado?.id ?? null,
          chamado_numero:     chamado?.numero ?? null,
          interacao_id:       row.interacao_id,
          prioridade:         prioridade_label,
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
        titulo: string | null;
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
          acao_id:               row.acao_id,
          nome_acao:             acaoObj?.nome ?? row.titulo ?? null,
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

      const atividadesMap = new Map<string, AtividadeItem>();
      ((atividadesRes.data ?? []) as AtivRaw[]).forEach(row => {
        atividadesMap.set(row.id, mapAtivRaw(row));
      });
      // Merge das atrasadas fora da janela (deduplicando por ID)
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
  }, [supabase, simProfileId]);

  useEffect(() => { carregar(); }, [carregar]);

  // Recarrega o backlog quando qualquer parte do sistema sinaliza mudança
  // (ex: atividade concluída na Agenda, agendamento salvo, chamado Sirene concluído)
  useEffect(() => {
    const handler = () => void carregar();
    window.addEventListener('backlog-reload', handler);
    return () => window.removeEventListener('backlog-reload', handler);
  }, [carregar]);

  return { sirene, pastelaria, atividades, isLoading, error, recarregar: carregar };
}
