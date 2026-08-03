'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
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
  aberto_por_nome: string | null;
  card_id: string | null;
  card_kanban_nome: string | null;
  interacao_id: string | null;
};

export type AtividadeItem = {
  id: string;          // acoes.id
  tarefa_id: string;
  nome: string;
  caneta_verde: string | null;
  prazo: string | null; // date ISO (acoes.prazo)
  criado_em: string | null;
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
  ativoIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  recarregar: () => void;
  ativar: (id: string) => Promise<void>;
  desativar: (id: string) => Promise<void>;
  arquivarPastelaria: (id: string) => Promise<void>;
};

const ADMIN_EMAIL = 'danilo.n@moni.casa';

export function useBacklog(): UseBacklogResult {
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sirene, setSirene] = useState<SireneItem[]>([]);
  const [pastelaria, setPastelaria] = useState<PastelariaItem[]>([]);
  const [atividades, setAtividades] = useState<AtividadeItem[]>([]);
  const [ativoIds, setAtivoIds] = useState<Set<string>>(new Set());
  const callIdRef = useRef(0);

  const { simulacao } = useSimulacaoUsuario();
  const simProfileId  = simulacao?.profileId   ?? null;
  const simAreaId     = simulacao?.areaId      ?? null;

  const carregar = useCallback(async () => {
    const callId = ++callIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const isAdmin = user.email === ADMIN_EMAIL;

      let effectiveProfileId = user.id;
      let areaPessoaId: string | null = null;
      let effectiveAreaId: string | null = null;
      let allAreaPessoaIds: string[] = [];
      let allAreaIds: string[] = [];

      if (isAdmin && simProfileId) {
        effectiveProfileId = simProfileId;
        effectiveAreaId    = simAreaId;
        if (simAreaId) {
          const { data: simAP } = await supabase
            .from('area_pessoas')
            .select('id')
            .eq('profile_id', simProfileId)
            .eq('area_id', simAreaId)
            .limit(1)
            .maybeSingle();
          areaPessoaId = (simAP as { id?: string } | null)?.id ?? null;
        }
        allAreaPessoaIds = areaPessoaId ? [areaPessoaId] : [];
        allAreaIds       = simAreaId    ? [simAreaId]    : [];
      } else {
        const { data: apRowsRaw } = await supabase
          .from('area_pessoas')
          .select('id, area_id')
          .eq('profile_id', user.id)
          .eq('ativo', true)
          .order('criado_em', { ascending: true });
        const apRows = (apRowsRaw ?? []) as { id: string; area_id: string }[];
        areaPessoaId     = apRows[0]?.id      ?? null;
        effectiveAreaId  = apRows[0]?.area_id ?? null;
        allAreaPessoaIds = apRows.map(r => r.id);
        allAreaIds       = [...new Set(apRows.map(r => r.area_id))];
      }

      // Busca Sirene, Atividades (via tarefas/acoes), Pastelaria em paralelo
      // Atividades Planejadas não depende mais de gantt_planejamento
      const [sireneRes, tarefasRes, pastelariaRes] = await Promise.all([
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
            sirene_chamados(numero, frank_id, frank_nome, te_trata, aberto_por_nome, arquivado)
          `)
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .in('status', ['nao_iniciado', 'em_andamento'])
          .eq('arquivado', false),

        allAreaIds.length > 0
          ? supabase
              .from('tarefas')
              .select('id, acoes(id, nome, caneta_verde, prazo, criado_em)')
              .in('area_id', allAreaIds)
          : Promise.resolve({ data: [], error: null }),

        allAreaPessoaIds.length > 0
          ? supabase
              .from('pastelaria_cards')
              .select('id, nome, coluna, semana_origem')
              .in('responsavel_id', allAreaPessoaIds)
              .in('coluna', ['inbox', 'mapped', 'doing'])
              .eq('reclassificado', false)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (sireneRes.error) throw sireneRes.error;

      type ChamadoRaw = { numero: string; frank_id: string | null; frank_nome: string | null; te_trata: boolean | null; aberto_por_nome: string | null; arquivado: boolean | null } | { numero: string; frank_id: string | null; frank_nome: string | null; te_trata: boolean | null; aberto_por_nome: string | null; arquivado: boolean | null }[] | null;
      type KanbanAtivRaw = {
        id: string;
        card_id: string | null;
        sirene_chamado_id: number | null;
        sirene_chamados: ChamadoRaw | (ChamadoRaw & { arquivado?: boolean | null });
      };
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
      };

      // Round 2: buscar kanban_atividades apenas para os tópicos com interacao_id
      // (evita join duplo aninhado que causava timeout)
      const interacaoIds = ((sireneRes.data ?? []) as SireneRaw[])
        .map(r => r.interacao_id)
        .filter((id): id is string => !!id);

      const kanbanAtivRes = interacaoIds.length > 0
        ? await supabase
            .from('kanban_atividades')
            .select('id, card_id, sirene_chamado_id, sirene_chamados(numero, frank_id, frank_nome, te_trata, aberto_por_nome, arquivado)')
            .in('id', interacaoIds)
        : { data: [] as KanbanAtivRaw[], error: null };

      // Mapa interacao_id → kanban_atividade (com chamado aninhado já resolvido)
      const kanbanAtivMap = new Map<string, KanbanAtivRaw>(
        ((kanbanAtivRes.data ?? []) as KanbanAtivRaw[]).map(r => [r.id, r]),
      );

      const sireneArr: SireneItem[] = ((sireneRes.data ?? []) as unknown as SireneRaw[]).map(row => {
        const chamadoDireto = Array.isArray(row.sirene_chamados)
          ? row.sirene_chamados[0] ?? null
          : row.sirene_chamados;
        const interacaoRaw = row.interacao_id ? kanbanAtivMap.get(row.interacao_id) ?? null : null;
        const chamadoViaInteracao = interacaoRaw
          ? (Array.isArray(interacaoRaw.sirene_chamados)
              ? interacaoRaw.sirene_chamados[0] ?? null
              : interacaoRaw.sirene_chamados)
          : null;
        const chamado = chamadoDireto ?? chamadoViaInteracao;
        // card via kanban_atividade (para link de origem)
        const cardId = interacaoRaw?.card_id ?? null;
        const cardKanbanNome = null; // FK aninhada não disponível via PostgREST nesse contexto
        // chamado_id via interação: sirene_chamado_id é a FK real de kanban_atividades→sirene_chamados
        // sirene_chamado_id é BIGINT → converter para string para manter tipo de chamado_id
        const chamadoIdViaInteracao = interacaoRaw?.sirene_chamado_id != null
          ? String(interacaoRaw.sirene_chamado_id)
          : null;
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
          chamado_id:     row.chamado_id ?? chamadoIdViaInteracao,
          chamado_numero: chamado?.numero ?? null,
          prioridade:      prioridade_label,
          frank_id,
          frank_nome,
          trava,
          te_trata,
          aberto_por_nome: chamado?.aberto_por_nome ?? null,
          card_id:         cardId,
          card_kanban_nome: cardKanbanNome,
          interacao_id:    row.interacao_id ?? null,
        };
      });

      // Remove tópicos cujo chamado (direto ou via interacao_id) está arquivado
      // (sirene_chamados.arquivado=true → chamado concluído/arquivado no painel Sirene)
      const sireneArrFiltrado = sireneArr.filter(item => {
        const row = ((sireneRes.data ?? []) as unknown as SireneRaw[]).find(r => r.id === item.id);
        if (!row) return true;
        const chamadoD = Array.isArray(row.sirene_chamados)
          ? row.sirene_chamados[0] ?? null
          : row.sirene_chamados;
        if (chamadoD?.arquivado === true) return false;
        // Verifica também chamado via interacao_id (chamado_id=null nesse caso)
        if (!chamadoD && row.interacao_id) {
          const interacaoRaw = kanbanAtivMap.get(row.interacao_id);
          const chamadoVI = interacaoRaw
            ? (Array.isArray(interacaoRaw.sirene_chamados)
                ? interacaoRaw.sirene_chamados[0] ?? null
                : interacaoRaw.sirene_chamados)
            : null;
          if ((chamadoVI as { arquivado?: boolean | null } | null)?.arquivado === true) return false;
        }
        return true;
      });

      // Ordenação: grupo P1-P6 → prazo → criação (via compareChamadosPainelRank)
      sireneArrFiltrado.sort((a, b) => compareChamadosPainelRank(
        { frank_id: a.frank_id, franqueado_nome: a.frank_nome, trava: a.trava, te_trata: a.te_trata, data_vencimento: a.data_fim ?? a.prazo_proposto, atividade_status: a.status },
        { frank_id: b.frank_id, franqueado_nome: b.frank_nome, trava: b.trava, te_trata: b.te_trata, data_vencimento: b.data_fim ?? b.prazo_proposto, atividade_status: b.status },
      ));

      type TarefaComAcoesRaw = {
        id: string;
        acoes: { id: string; nome: string; caneta_verde: string | null; prazo: string | null; criado_em: string | null }[]
              | { id: string; nome: string; caneta_verde: string | null; prazo: string | null; criado_em: string | null }
              | null;
      };

      const atividadesArr: AtividadeItem[] = ((tarefasRes.data ?? []) as TarefaComAcoesRaw[])
        .flatMap(t => {
          const acoesArr = Array.isArray(t.acoes) ? t.acoes : t.acoes ? [t.acoes] : [];
          return acoesArr.map(a => ({
            id:           a.id,
            tarefa_id:    t.id,
            nome:         a.nome,
            caneta_verde: a.caneta_verde,
            prazo:        a.prazo,
            criado_em:    a.criado_em,
          }));
        })
        .sort((a, b) => {
          // prazo ASC; sem prazo por nome
          if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
          if (a.prazo) return -1;
          if (b.prazo) return 1;
          return a.nome.localeCompare(b.nome, 'pt-BR');
        });

      type PastelariaRaw = { id: string; nome: string; coluna: string; semana_origem: string };
      const pastelariaArr: PastelariaItem[] = ((pastelariaRes.data ?? []) as PastelariaRaw[]).map(row => ({
        id:            row.id,
        nome:          row.nome,
        coluna:        row.coluna,
        semana_origem: row.semana_origem,
      }));

      const { data: ativoData } = await supabase
        .from('backlog_atividades_usuario')
        .select('acao_id')
        .eq('profile_id', effectiveProfileId);
      const ativoSet = new Set<string>(
        ((ativoData ?? []) as { acao_id: string }[]).map(r => r.acao_id)
      );

      // Busca itens agendados hoje em diante ainda não concluídos — para suprimir do backlog
      const hoje = new Date();
      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      const { data: agendados } = await supabase
        .from('gantt_planejamento')
        .select('acao_id, sirene_chamado_id')
        .eq('profile_id', effectiveProfileId)
        .gte('data', hojeStr)
        .is('data_conclusao_real', null);

      type AgendadoRow = { acao_id: string | null; sirene_chamado_id: number | null };
      const agendadosRows = (agendados ?? []) as AgendadoRow[];

      const scheduledAcoIds = new Set<string>(
        agendadosRows.map(r => r.acao_id).filter((id): id is string => !!id)
      );
      const scheduledChamadoIds = new Set<number>(
        agendadosRows.map(r => r.sirene_chamado_id).filter((id): id is number => id != null)
      );

      // Filtra do backlog os itens agendados e pendentes
      const sireneVisivel = sireneArrFiltrado.filter(s =>
        !s.chamado_id || !scheduledChamadoIds.has(Number(s.chamado_id))
      );
      const atividadesVisiveis = atividadesArr.filter(a => !scheduledAcoIds.has(a.id));

      if (callId !== callIdRef.current) return;
      setSirene(sireneVisivel);
      setPastelaria(pastelariaArr);
      setAtividades(atividadesVisiveis);
      setAtivoIds(ativoSet);
    } catch (e) {
      if (callId !== callIdRef.current) return;
      console.error('[useBacklog] erro:', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      if (callId === callIdRef.current) setIsLoading(false);
    }
  }, [supabase, simProfileId, simAreaId]);

  const ativar = useCallback(async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('backlog_atividades_usuario').upsert(
      { profile_id: user.id, acao_id: id },
      { onConflict: 'profile_id,acao_id' }
    );
    setAtivoIds(prev => new Set([...prev, id]));
    window.dispatchEvent(new CustomEvent('backlog-reload'));
  }, [supabase]);

  const desativar = useCallback(async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('backlog_atividades_usuario')
      .delete().eq('profile_id', user.id).eq('acao_id', id);
    setAtivoIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  }, [supabase]);

  const arquivarPastelaria = useCallback(async (id: string) => {
    await supabase.from('pastelaria_cards').update({ reclassificado: true }).eq('id', id);
    setPastelaria(prev => prev.filter(p => p.id !== id));
  }, [supabase]);

  useEffect(() => { carregar(); }, [carregar]);

  // Recarrega quando outro hook sinaliza mudança no gantt (agendamento, exclusão, conclusão)
  useEffect(() => {
    const handler = () => { void carregar(); };
    window.addEventListener('backlog-reload', handler);
    return () => window.removeEventListener('backlog-reload', handler);
  }, [carregar]);

  return { sirene, pastelaria, atividades, ativoIds, isLoading, error, recarregar: carregar, ativar, desativar, arquivarPastelaria };
}
