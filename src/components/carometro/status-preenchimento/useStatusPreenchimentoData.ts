'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { listarAreas } from '@/utils/areasOrder';
import {
  expandGanttSemanasParaGradeIso,
  normalizarSemanasSelecionadasGantt,
  semanasIsoAnoCalendario,
} from '@/utils/periodos';
import {
  colunasSemanasBoard,
  ganttRowNaSemanaIso,
  parseResponsaveisGantt,
  type RegistroStatusPreenchimento,
  type SemanaColuna,
} from '@/utils/statusPreenchimento';

export type ResponsavelArea = {
  usuarioId: string;
  nome: string;
  email?: string | null;
};

export type AreaComResponsaveis = {
  id: string;
  nome: string;
  responsaveis: ResponsavelArea[];
};

const GANTT_SEL =
  'id, acao_id, responsavel, semanas_selecionadas, semana_inicio, semana_fim, acoes(tarefas(area_id))';

function nomePerfil(p: { full_name?: string | null; nome_completo?: string | null; email?: string | null }) {
  return (p.full_name || p.nome_completo || p.email || 'Usuário').trim();
}

function mapNomeParaProfile(
  nome: string,
  profiles: { id: string; full_name?: string | null; nome_completo?: string | null; email?: string | null }[],
) {
  const n = nome.toLowerCase();
  return profiles.find((p) => {
    const fn = String(p.full_name ?? '').trim().toLowerCase();
    const nc = String(p.nome_completo ?? '').trim().toLowerCase();
    return fn === n || nc === n;
  });
}

export function useStatusPreenchimentoData() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaComResponsaveis[]>([]);
  const [registros, setRegistros] = useState<RegistroStatusPreenchimento[]>([]);
  const [ganttRows, setGanttRows] = useState<
    {
      id: string;
      acao_id: string;
      responsavel: string | null;
      semanas_selecionadas?: unknown;
      semana_inicio?: number | null;
      semana_fim?: number | null;
      acoes?: { tarefas?: { area_id?: string } | { area_id?: string }[] };
    }[]
  >([]);
  const [indicadorIdsPorArea, setIndicadorIdsPorArea] = useState<Record<string, string[]>>({});
  const [lancamentosInd, setLancamentosInd] = useState<
    { indicador_id: string; semana: number; semana_ano?: number | null; valor?: unknown }[]
  >([]);
  const [cronogramaRows, setCronogramaRows] = useState<
    { acao_id: string; semana: number; status?: string | null }[]
  >([]);

  const semanasColunas = useMemo(() => colunasSemanasBoard(), []);

  const semanasParaBusca = useMemo(() => {
    const set = new Set<string>();
    for (const c of semanasColunas) set.add(`${c.ano}-${c.semanaIso}`);
    return semanasColunas;
  }, [semanasColunas]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data: areasData, error: errAreas } = await listarAreas(supabase, 'id, nome, ativo');
      if (errAreas) throw errAreas;
      const areasAtivas = (areasData || []).filter((a: { id: string; nome: string; ativo: boolean | null }) => a.ativo !== false);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, nome_completo, email, role, invite_accepted_at, aprovado_em')
        .in('role', ['admin', 'team', 'supervisor']);

      const profilesList = (profiles || []).filter(
        (p) => p.invite_accepted_at || p.aprovado_em || p.role === 'admin',
      ) as {
        id: string;
        full_name?: string | null;
        nome_completo?: string | null;
        email?: string | null;
      }[];

      const { data: ganttData, error: errGantt } = await supabase.from('gantt_planejamento').select(GANTT_SEL);
      if (errGantt) throw errGantt;
      const gantt = ganttData || [];
      setGanttRows(gantt as Parameters<typeof setGanttRows>[0]);

      const responsaveisPorArea = new Map<string, Map<string, ResponsavelArea>>();

      for (const row of gantt) {
        const acoes = row.acoes;
        const tarefa = Array.isArray(acoes?.tarefas) ? acoes.tarefas[0] : acoes?.tarefas;
        const areaId = tarefa?.area_id;
        if (!areaId) continue;
        const nomes = parseResponsaveisGantt(row.responsavel);
        if (!responsaveisPorArea.has(areaId)) responsaveisPorArea.set(areaId, new Map());
        const map = responsaveisPorArea.get(areaId)!;
        for (const nome of nomes) {
          const prof = mapNomeParaProfile(nome, profilesList);
          if (prof) {
            map.set(prof.id, {
              usuarioId: prof.id,
              nome: nomePerfil(prof),
              email: prof.email,
            });
          } else {
            const slug = `nome:${nome.toLowerCase()}`;
            if (!map.has(slug)) {
              map.set(slug, { usuarioId: slug, nome, email: null });
            }
          }
        }
      }

      const areasMontadas: AreaComResponsaveis[] = areasAtivas.map((a) => ({
        id: a.id,
        nome: a.nome,
        responsaveis: Array.from(responsaveisPorArea.get(a.id)?.values() ?? []).sort((x, y) =>
          x.nome.localeCompare(y.nome, 'pt-BR'),
        ),
      }));

      setAreas(areasMontadas);

      const anos = [...new Set(semanasParaBusca.map((s) => s.ano))];
      const semanasNums = [...new Set(semanasParaBusca.map((s) => s.semanaIso))];

      const { data: regData, error: errReg } = await supabase
        .from('status_preenchimento_registros')
        .select('id, area_id, usuario_id, semana_iso, ano, registrado_em, status')
        .in('semana_iso', semanasNums)
        .in('ano', anos);
      if (errReg) {
        if (/does not exist|schema cache|PGRST205/i.test(errReg.message)) {
          setErro(
            'Tabela status_preenchimento_registros não encontrada. Execute a migração 185_status_preenchimento.sql no Supabase DEV.',
          );
        } else {
          throw errReg;
        }
      } else {
        setRegistros((regData || []) as RegistroStatusPreenchimento[]);
      }

      const areaIds = areasAtivas.map((a) => a.id);
      const { data: inds } = await supabase.from('indicadores').select('id, area_id').in('area_id', areaIds);
      const porArea: Record<string, string[]> = {};
      for (const ind of inds || []) {
        if (!ind.area_id) continue;
        if (!porArea[ind.area_id]) porArea[ind.area_id] = [];
        porArea[ind.area_id].push(ind.id);
      }
      setIndicadorIdsPorArea(porArea);

      const allIndIds = (inds || []).map((i) => i.id);
      if (allIndIds.length > 0) {
        const { data: lanc } = await supabase
          .from('indicador_lancamentos')
          .select('indicador_id, semana, semana_ano, valor')
          .in('indicador_id', allIndIds)
          .in('semana', semanasNums);
        setLancamentosInd(lanc || []);
      } else {
        setLancamentosInd([]);
      }

      const acaoIds = [...new Set(gantt.map((g) => g.acao_id).filter(Boolean))];
      if (acaoIds.length > 0) {
        const { data: crono } = await supabase
          .from('cronograma')
          .select('acao_id, semana, status')
          .in('acao_id', acaoIds)
          .in('semana', semanasNums);
        setCronogramaRows(crono || []);
      } else {
        setCronogramaRows([]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase, semanasParaBusca]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const temDadosGanttAreaSemana = useCallback(
    (areaId: string, col: SemanaColuna, usuarioId?: string) => {
      const rowsArea = ganttRows.filter((g) => {
        const acoes = g.acoes;
        const tarefa = Array.isArray(acoes?.tarefas) ? acoes.tarefas[0] : acoes?.tarefas;
        return tarefa?.area_id === areaId;
      });
      for (const g of rowsArea) {
        if (!ganttRowNaSemanaIso(g, col.semanaIso)) continue;
        if (usuarioId) {
          const resp = parseResponsaveisGantt(g.responsavel);
          const profIds = resp.map((n) => n.toLowerCase());
          const rowUser = areas
            .find((a) => a.id === areaId)
            ?.responsaveis.find((r) => r.usuarioId === usuarioId);
          if (rowUser && !profIds.includes(rowUser.nome.toLowerCase())) continue;
        }
        const temCrono = cronogramaRows.some(
          (c) =>
            c.acao_id === g.acao_id &&
            Number(c.semana) === col.semanaIso &&
            c.status &&
            String(c.status).toLowerCase() !== 'pendente',
        );
        const ss = normalizarSemanasSelecionadasGantt(g.semanas_selecionadas);
        const planejado =
          ss.includes(col.semanaIso) ||
          expandGanttSemanasParaGradeIso(g, semanasIsoAnoCalendario(col.ano)).includes(col.semanaIso);
        if (planejado || temCrono) return true;
      }
      return false;
    },
    [ganttRows, cronogramaRows, areas],
  );

  const temDadosIndicadoresAreaSemana = useCallback(
    (areaId: string, col: SemanaColuna) => {
      const ids = indicadorIdsPorArea[areaId] || [];
      if (!ids.length) return false;
      return lancamentosInd.some((l) => {
        if (!ids.includes(l.indicador_id)) return false;
        const sem = Number(l.semana);
        const anoL = l.semana_ano != null ? Number(l.semana_ano) : col.ano;
        if (sem !== col.semanaIso || anoL !== col.ano) return false;
        return l.valor != null && String(l.valor).trim() !== '';
      });
    },
    [indicadorIdsPorArea, lancamentosInd],
  );

  return {
    supabase,
    loading,
    erro,
    areas,
    registros,
    ganttRows,
    indicadorIdsPorArea,
    lancamentosInd,
    semanasColunas,
    temDadosGanttAreaSemana,
    temDadosIndicadoresAreaSemana,
    recarregar: carregar,
  };
}
