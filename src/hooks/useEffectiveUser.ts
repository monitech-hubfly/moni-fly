'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';

const ADMIN_EMAIL = 'danilo.n@moni.casa';

export type EffectiveUser = {
  effectiveProfileId: string | null;
  nomeUsuario: string | null;
  areaId: string | null;   // primeira área (backward compat)
  areaIds: string[];       // todas as áreas distintas do usuário
  isLoading: boolean;
};

export function useEffectiveUser(): EffectiveUser {
  const supabase = useMemo(() => createClient(), []);
  const [effectiveProfileId, setEffectiveProfileId] = useState<string | null>(null);
  const [nomeUsuario, setNomeUsuario]               = useState<string | null>(null);
  const [areaId, setAreaId]                         = useState<string | null>(null);
  const [areaIds, setAreaIds]                       = useState<string[]>([]);
  const [isLoading, setIsLoading]                   = useState(true);
  const { simulacao } = useSimulacaoUsuario();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const isAdmin = user.email === ADMIN_EMAIL;
        if (isAdmin && simulacao?.profileId) {
          if (!cancelled) {
            setEffectiveProfileId(simulacao.profileId);
            setNomeUsuario(simulacao.nomeUsuario ?? null);
            setAreaId(simulacao.areaId ?? null);
            setAreaIds(simulacao.areaId ? [simulacao.areaId] : []);
          }
        } else {
          const { data: apRows } = await supabase
            .from('area_pessoas')
            .select('nome, area_id')
            .eq('profile_id', user.id)
            .eq('ativo', true)
            .order('criado_em', { ascending: true });
          const rows = (apRows ?? []) as { nome: string; area_id: string }[];
          const uniqueIds = [...new Set(rows.map(r => r.area_id))];
          if (!cancelled) {
            setEffectiveProfileId(user.id);
            setNomeUsuario((rows[0]?.nome as string | null) ?? null);
            setAreaId(uniqueIds[0] ?? null);
            setAreaIds(uniqueIds);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, simulacao]);

  return { effectiveProfileId, nomeUsuario, areaId, areaIds, isLoading };
}
