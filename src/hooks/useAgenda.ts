'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';

export type AtividadeAgenda = {
  id: string;
  comportamento_chave: string | null;
  hora_inicio: string;
  hora_fim: string | null;
  data: string; // ISO YYYY-MM-DD
  cor: string;
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
};

const DIAS  = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ADMIN_EMAIL = 'danilo.n@moni.casa';
const COR_PADRAO  = '#378ADD';

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

export function useAgenda(refreshKey = 0): UseAgendaResult {
  const supabase = useMemo(() => createClient(), []);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [atividades, setAtividades]     = useState<AtividadeAgenda[]>([]);

  const { simulacao } = useSimulacaoUsuario();
  const simProfileId  = simulacao?.profileId   ?? null;
  const simNome       = simulacao?.nomeUsuario ?? null;

  const diasDaSemana = useMemo(() => calcDias(semanaOffset), [semanaOffset]);
  const semanaLabel  = useMemo(() => calcLabel(diasDaSemana), [diasDaSemana]);

  const navegar    = useCallback((delta: number) => setSemanaOffset(o => o + delta), []);
  const irParaHoje = useCallback(() => setSemanaOffset(0), []);

  const carregar = useCallback(async () => {
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

      const { data, error: qErr } = await supabase
        .from('gantt_planejamento')
        .select('id, comportamento_chave, hora_inicio, hora_fim, data')
        .or(orFilter)
        .not('hora_inicio', 'is', null)
        .not('data', 'is', null)
        .gte('data', inicioStr)
        .lte('data', fimStr);

      if (qErr) throw qErr;

      type GanttRow = {
        id: string;
        comportamento_chave: string | null;
        hora_inicio: string;
        hora_fim: string | null;
        data: string;
      };

      setAtividades(
        ((data ?? []) as GanttRow[]).map(row => ({
          id:                  row.id,
          comportamento_chave: row.comportamento_chave,
          hora_inicio:         row.hora_inicio,
          hora_fim:            row.hora_fim,
          data:                row.data,
          cor:                 COR_PADRAO,
        })),
      );
    } catch (e) {
      console.error('[useAgenda]', e);
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      // Coluna `data` ainda não existe → agenda vazia sem erro visível
      if (!msg.includes('does not exist') && !msg.includes('42703')) {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [supabase, simProfileId, simNome, diasDaSemana, refreshKey]);

  useEffect(() => { carregar(); }, [carregar]);

  return { atividades, diasDaSemana, semanaLabel, semanaOffset, isLoading, error, navegar, irParaHoje };
}
