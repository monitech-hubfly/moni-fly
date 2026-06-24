'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';

const ADMIN_EMAIL = 'danilo.n@moni.casa';

export type EffectiveUser = {
  effectiveProfileId: string | null;
  nomeUsuario: string | null;
  areaId: string | null;
  isLoading: boolean;
};

export function useEffectiveUser(): EffectiveUser {
  const supabase = useMemo(() => createClient(), []);
  const [effectiveProfileId, setEffectiveProfileId] = useState<string | null>(null);
  const [nomeUsuario, setNomeUsuario]               = useState<string | null>(null);
  const [areaId, setAreaId]                         = useState<string | null>(null);
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
          }
        } else {
          const { data: ap } = await supabase
            .from('area_pessoas')
            .select('nome, area_id')
            .eq('profile_id', user.id)
            .maybeSingle();
          if (!cancelled) {
            setEffectiveProfileId(user.id);
            setNomeUsuario((ap?.nome as string | null) ?? null);
            setAreaId((ap?.area_id as string | null) ?? null);
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, simulacao]);

  return { effectiveProfileId, nomeUsuario, areaId, isLoading };
}
