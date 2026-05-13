'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { carregarPermissoesMap } from '@/lib/permissoes-load';
import type { Permissao, PermissoesPode } from '@/lib/permissoes-types';

export type { Permissao };

/**
 * Permissões do usuário logado (`profiles.role` + `profiles.cargo` → `permissoes_perfil`).
 */
export function usePermissoes(): PermissoesPode {
  const [map, setMap] = useState<Map<string, boolean>>(() => new Map());

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancel) setMap(new Map());
        return;
      }
      const next = await carregarPermissoesMap(supabase, user.id);
      if (!cancel) setMap(next);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const pode = useCallback((p: Permissao) => map.get(p) ?? false, [map]);
  return useMemo(() => ({ pode }), [pode]);
}
