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

export type ChamadoPendenteItem = {
  id: number;
  numero: number;
  incendio: string;
  criado_em: string;
};

export type AgendaInfo = {
  data: string;
  hora_inicio: string | null;
  count: number; // quantas sessões agendadas para este item
};

export type AtividadeItemAgendada = AtividadeItem & { agendaInfo: AgendaInfo };
export type SireneItemAgendada    = SireneItem    & { agendaInfo: AgendaInfo };

export type UseBacklogResult = {
  sirene: SireneItem[];
  chamadosPendentes: ChamadoPendenteItem[];
  atividades: AtividadeItem[];
  ativoIds: Set<string>;
  atividadesAgendadas: AtividadeItemAgendada[];
  sireneAgendadas: SireneItemAgendada[];
  isLoading: boolean;
  error: string | null;
  recarregar: () => void;
  ativar: (id: string) => Promise<void>;
  desativar: (id: string) => Promise<void>;
};

const ADMIN_EMAIL = 'danilo.n@moni.casa';

export function useBacklog(): UseBacklogResult {
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sirene, setSirene] = useState<SireneItem[]>([]);
  const [chamadosPendentes, setChamadosPendentes] = useState<ChamadoPendenteItem[]>([]);
  const [atividades, setAtividades] = useState<AtividadeItem[]>([]);
  const [ativoIds, setAtivoIds] = useState<Set<string>>(new Set());
  const [atividadesAgendadas, setAtividadesAgendadas] = useState<AtividadeItemAgendada[]>([]);
  const [sireneAgendadas, setSireneAgendadas] = useState<SireneItemAgendada[]>([]);
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

      // Busca Sirene e Atividades em paralelo
      const [sireneRes, tarefasRes] = await Promise.all([
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
            sirene_chamados(numero, incendio, frank_id, frank_nome, te_trata, aberto_por_nome, arquivado)
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
      ]);

      if (sireneRes.error) throw sireneRes.error;

      type ChamadoRaw = { numero: string; incendio: string | null; frank_id: string | null; frank_nome: string | null; te_trata: boolean | null; aberto_por_nome: string | null; arquivado: boolean | null } | { numero: string; incendio: string | null; frank_id: string | null; frank_nome: string | null; te_trata: boolean | null; aberto_por_nome: string | null; arquivado: boolean | null }[] | null;
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
          chamado_titulo: chamado?.incendio ?? null,
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

      // Chamados abertos pelo usuário onde todos tópicos ativos estão concluídos/aprovados
      const chamadosPendentesRes = await supabase
        .from('sirene_chamados')
        .select('id, numero, incendio, criado_em, sirene_topicos!chamado_id(status, arquivado)')
        .eq('aberto_por', effectiveProfileId)
        .in('status', ['em_andamento', 'aguardando_aprovacao_criador', 'nao_iniciado'])
        .eq('arquivado', false)
        .order('criado_em', { ascending: false })
        .limit(30);

      type ChamadoComTopicosRaw = {
        id: number;
        numero: number;
        incendio: string | null;
        criado_em: string;
        sirene_topicos: { status: string; arquivado: boolean }[];
      };

      const pendentesArr: ChamadoPendenteItem[] = ((chamadosPendentesRes.data ?? []) as ChamadoComTopicosRaw[])
        .filter(c => {
          const tops = Array.isArray(c.sirene_topicos) ? c.sirene_topicos : [];
          const ativos = tops.filter(t => !t.arquivado);
          return ativos.length > 0 && ativos.every(t => t.status === 'concluido' || t.status === 'aprovado');
        })
        .map(c => ({
          id:        Number(c.id),
          numero:    Number(c.numero),
          incendio:  c.incendio ?? `Chamado #${c.numero}`,
          criado_em: c.criado_em,
        }));

      const { data: ativoData } = await supabase
        .from('backlog_atividades_usuario')
        .select('acao_id')
        .eq('profile_id', effectiveProfileId);
      const ativoSet = new Set<string>(
        ((ativoData ?? []) as { acao_id: string }[]).map(r => r.acao_id)
      );

      // Busca TODOS os itens agendados não concluídos (passado + futuro) — nunca devem voltar ao backlog principal
      const hoje = new Date();
      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      const { data: agendados } = await supabase
        .from('gantt_planejamento')
        .select('acao_id, sirene_chamado_id, data, hora_inicio')
        .eq('profile_id', effectiveProfileId)
        .is('data_conclusao_real', null)
        .order('data', { ascending: true });

      type AgendadoRow = { acao_id: string | null; sirene_chamado_id: number | null; data: string; hora_inicio: string | null };
      const agendadosRows = (agendados ?? []) as AgendadoRow[];

      // Para cada item: preferir a próxima data futura (badge azul); se nenhuma, usar a última data passada (badge laranja)
      const acoFuturoMap    = new Map<string, { data: string; hora_inicio: string | null }>();
      const acoPastMap      = new Map<string, { data: string; hora_inicio: string | null }>();
      const acoCountMap     = new Map<string, number>();
      const chamadoFuturoMap = new Map<number, { data: string; hora_inicio: string | null }>();
      const chamadoPastMap   = new Map<number, { data: string; hora_inicio: string | null }>();
      const chamadoCountMap  = new Map<number, number>();

      for (const r of agendadosRows) {
        const isFuture = r.data >= hojeStr;
        if (r.acao_id) {
          acoCountMap.set(r.acao_id, (acoCountMap.get(r.acao_id) ?? 0) + 1);
          if (isFuture) {
            if (!acoFuturoMap.has(r.acao_id)) acoFuturoMap.set(r.acao_id, { data: r.data, hora_inicio: r.hora_inicio });
          } else {
            acoPastMap.set(r.acao_id, { data: r.data, hora_inicio: r.hora_inicio }); // sobrescreve → última data passada
          }
        }
        if (r.sirene_chamado_id != null) {
          chamadoCountMap.set(r.sirene_chamado_id, (chamadoCountMap.get(r.sirene_chamado_id) ?? 0) + 1);
          if (isFuture) {
            if (!chamadoFuturoMap.has(r.sirene_chamado_id)) chamadoFuturoMap.set(r.sirene_chamado_id, { data: r.data, hora_inicio: r.hora_inicio });
          } else {
            chamadoPastMap.set(r.sirene_chamado_id, { data: r.data, hora_inicio: r.hora_inicio });
          }
        }
      }

      // Mapas finais: data exibida = futura (se existir) ou última passada
      const acoAgendaMap = new Map<string, AgendaInfo>();
      for (const id of new Set([...acoFuturoMap.keys(), ...acoPastMap.keys()])) {
        const display = acoFuturoMap.get(id) ?? acoPastMap.get(id)!;
        acoAgendaMap.set(id, { data: display.data, hora_inicio: display.hora_inicio, count: acoCountMap.get(id) ?? 1 });
      }
      const chamadoAgendaMap = new Map<number, AgendaInfo>();
      for (const id of new Set([...chamadoFuturoMap.keys(), ...chamadoPastMap.keys()])) {
        const display = chamadoFuturoMap.get(id) ?? chamadoPastMap.get(id)!;
        chamadoAgendaMap.set(id, { data: display.data, hora_inicio: display.hora_inicio, count: chamadoCountMap.get(id) ?? 1 });
      }

      const scheduledAcoIds = new Set<string>(acoAgendaMap.keys());
      const scheduledChamadoIds = new Set<number>(chamadoAgendaMap.keys());

      // Lista visível (não agendados) e lista agendada (separada)
      const sireneVisivel = sireneArrFiltrado.filter(s =>
        !s.chamado_id || !scheduledChamadoIds.has(Number(s.chamado_id))
      );
      const sireneAgendadasArr: SireneItemAgendada[] = sireneArrFiltrado
        .filter(s => s.chamado_id && scheduledChamadoIds.has(Number(s.chamado_id)))
        .map(s => ({ ...s, agendaInfo: chamadoAgendaMap.get(Number(s.chamado_id))! }));

      const atividadesVisiveis = atividadesArr.filter(a => !scheduledAcoIds.has(a.id));
      const atividadesAgendadasArr: AtividadeItemAgendada[] = atividadesArr
        .filter(a => scheduledAcoIds.has(a.id) && ativoSet.has(a.id))
        .map(a => ({ ...a, agendaInfo: acoAgendaMap.get(a.id)! }));

      if (callId !== callIdRef.current) return;
      setSirene(sireneVisivel);
      setChamadosPendentes(pendentesArr);
      setAtividades(atividadesVisiveis);
      setAtivoIds(ativoSet);
      setAtividadesAgendadas(atividadesAgendadasArr);
      setSireneAgendadas(sireneAgendadasArr);
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

  useEffect(() => { carregar(); }, [carregar]);

  // Recarrega quando outro hook sinaliza mudança no gantt (agendamento, exclusão, conclusão)
  useEffect(() => {
    const handler = () => { void carregar(); };
    window.addEventListener('backlog-reload', handler);
    return () => window.removeEventListener('backlog-reload', handler);
  }, [carregar]);

  return { sirene, chamadosPendentes, atividades, ativoIds, atividadesAgendadas, sireneAgendadas, isLoading, error, recarregar: carregar, ativar, desativar };
}
