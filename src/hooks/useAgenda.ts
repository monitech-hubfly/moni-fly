'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';

export type AtividadeAgenda = {
  id: string;
  titulo: string;           // acao.tipo_atividade ou gantt.titulo
  hora_inicio: string;
  hora_fim: string | null;
  data: string;             // ISO YYYY-MM-DD
  cor: string;
  card_id: string | null;
  sirene_chamado_id: number | null;
  link_reuniao: string | null;
  origem_tipo: string | null;
  concluido: boolean;
};

export type DiaAgenda = {
  date: Date;
  label: string;    // "DOM 22"
  dateStr: string;  // ISO YYYY-MM-DD
  isHoje: boolean;
};

export type UseAgendaResult = {
  atividades: AtividadeAgenda[];
  diasDaSemana: DiaAgenda[];
  semanaLabel: string;
  semanaOffset: number;
  isLoading: boolean;
  error: string | null;
  navegar: (delta: number) => void;
  irParaHoje: () => void;
  concluir: (id: string) => Promise<void>;
};

const DIAS  = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ADMIN_EMAIL = 'danilo.n@moni.casa';
const COR_PADRAO  = '#378ADD';
const COR_CONCLUIDA = '#6b7280';

function toDateStr(d: Date): string {
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dd}`;
}

function getDomingo(offsetSemanas: number): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(hoje);
  d.setDate(hoje.getDate() - hoje.getDay() + offsetSemanas * 7);
  return d;
}

function calcDias(offset: number): DiaAgenda[] {
  const dom     = getDomingo(offset);
  const hojeStr = toDateStr(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(dom);
    d.setDate(dom.getDate() + i);
    const dateStr = toDateStr(d);
    return { date: d, label: `${DIAS[i]} ${d.getDate()}`, dateStr, isHoje: dateStr === hojeStr };
  });
}

function calcLabel(dias: DiaAgenda[]): string {
  const d1 = dias[0].date;
  const d2 = dias[6].date;
  if (d1.getMonth() === d2.getMonth()) {
    return `${d1.getDate()} – ${d2.getDate()} ${MESES[d1.getMonth()]} ${d1.getFullYear()}`;
  }
  return `${d1.getDate()} ${MESES[d1.getMonth()]} – ${d2.getDate()} ${MESES[d2.getMonth()]} ${d2.getFullYear()}`;
}

type GanttRow = {
  id: string;
  titulo: string | null;
  hora_inicio: string;
  hora_fim: string | null;
  data: string;
  card_id: string | null;
  sirene_chamado_id: number | null;
  link_reuniao: string | null;
  origem_tipo: string | null;
  data_conclusao_real: string | null;
  acoes: { tipo_atividade: string } | { tipo_atividade: string }[] | null;
};

function rowToAtividade(row: GanttRow): AtividadeAgenda {
  const acao = Array.isArray(row.acoes) ? row.acoes[0] : row.acoes;
  const titulo = acao?.tipo_atividade ?? row.titulo ?? '(sem título)';
  const concluido = !!row.data_conclusao_real;
  return {
    id:                row.id,
    titulo,
    hora_inicio:       row.hora_inicio,
    hora_fim:          row.hora_fim,
    data:              row.data,
    cor:               concluido ? COR_CONCLUIDA : COR_PADRAO,
    card_id:           row.card_id,
    sirene_chamado_id: row.sirene_chamado_id,
    link_reuniao:      row.link_reuniao,
    origem_tipo:       row.origem_tipo,
    concluido,
  };
}

const SELECT_FIELDS = 'id, titulo, hora_inicio, hora_fim, data, card_id, sirene_chamado_id, link_reuniao, origem_tipo, data_conclusao_real, acoes(tipo_atividade)';

export function useAgenda(refreshKey = 0): UseAgendaResult {
  const supabase = useMemo(() => createClient(), []);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [atividades, setAtividades]     = useState<AtividadeAgenda[]>([]);
  const callIdRef = useRef(0);

  const { simulacao } = useSimulacaoUsuario();
  const simProfileId  = simulacao?.profileId   ?? null;
  const simNome       = simulacao?.nomeUsuario ?? null;

  const diasDaSemana = useMemo(() => calcDias(semanaOffset), [semanaOffset]);
  const semanaLabel  = useMemo(() => calcLabel(diasDaSemana), [diasDaSemana]);

  const navegar    = useCallback((delta: number) => setSemanaOffset(o => o + delta), []);
  const irParaHoje = useCallback(() => setSemanaOffset(0), []);

  const carregar = useCallback(async () => {
    const callId = ++callIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const isAdmin = user.email === ADMIN_EMAIL;
      let effectiveProfileId = user.id;
      let nomeUsuario: string | null = null;

      if (isAdmin && simProfileId) {
        effectiveProfileId = simProfileId;
        nomeUsuario        = simNome;
      } else {
        const { data: areaPessoa } = await supabase
          .from('area_pessoas')
          .select('nome')
          .eq('profile_id', user.id)
          .maybeSingle();
        nomeUsuario = (areaPessoa?.nome as string | null) ?? null;
      }

      const inicioStr = diasDaSemana[0].dateStr;
      const fimStr    = diasDaSemana[6].dateStr;

      const orFilter = nomeUsuario
        ? `profile_id.eq.${effectiveProfileId},responsavel.ilike.%${nomeUsuario}%`
        : `profile_id.eq.${effectiveProfileId}`;

      // Busca 1: eventos do próprio usuário
      const q1 = supabase
        .from('gantt_planejamento')
        .select(SELECT_FIELDS)
        .or(orFilter)
        .not('hora_inicio', 'is', null)
        .not('data', 'is', null)
        .gte('data', inicioStr)
        .lte('data', fimStr);

      // Busca 2: eventos onde é participante
      const q2 = supabase
        .from('gantt_agenda_participantes')
        .select(`gantt_id, gantt_planejamento!inner(${SELECT_FIELDS})`)
        .eq('profile_id', effectiveProfileId)
        .not('gantt_planejamento.hora_inicio', 'is', null)
        .not('gantt_planejamento.data', 'is', null)
        .gte('gantt_planejamento.data', inicioStr)
        .lte('gantt_planejamento.data', fimStr);

      const [r1, r2] = await Promise.all([q1, q2]);
      if (r1.error) throw r1.error;

      if (callId !== callIdRef.current) return;

      const rows1 = (r1.data ?? []) as GanttRow[];
      const rows2 = ((r2.data ?? []) as { gantt_id: string; gantt_planejamento: GanttRow }[])
        .map(x => x.gantt_planejamento);

      // Deduplicar por id
      const seen = new Set(rows1.map(r => r.id));
      const allRows = [...rows1, ...rows2.filter(r => !seen.has(r.id))];

      setAtividades(allRows.map(rowToAtividade));
    } catch (e) {
      if (callId !== callIdRef.current) return;
      console.error('[useAgenda]', e);
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      if (!msg.includes('does not exist') && !msg.includes('42703')) {
        setError(msg);
      }
    } finally {
      if (callId === callIdRef.current) setIsLoading(false);
    }
  }, [supabase, simProfileId, simNome, diasDaSemana, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // ── Concluir atividade ──────────────────────────────────────────────────────
  const concluir = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('gantt_planejamento')
      .update({ data_conclusao_real: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    // Atualiza local sem re-fetch
    setAtividades(prev => prev.map(a =>
      a.id === id ? { ...a, concluido: true, cor: COR_CONCLUIDA } : a
    ));
  }, [supabase]);

  return { atividades, diasDaSemana, semanaLabel, semanaOffset, isLoading, error, navegar, irParaHoje, concluir };
}
