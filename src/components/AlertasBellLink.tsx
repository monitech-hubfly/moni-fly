'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Props = {
  userId: string | null | undefined;
};

export function AlertasBellLink({ userId }: Props) {
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    if (!userId) {
      setNaoLidas(0);
      return;
    }

    const supabase = createClient();

    const refresh = async () => {
      const TIPOS_CRITICOS = [
        'kanban_atividade_criada',
        'atribuicao_recusada',
        'sla_atividade_atrasado',
        'mencao_sirene',
        'mencao_kanban_card',
        'mencao_card',
        'aprovacao_fase',
        'acoplamento_novo_projeto',
      ];
      const { count } = await supabase
        .from('alertas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('lido', false)
        .in('tipo', TIPOS_CRITICOS);
      setNaoLidas(count ?? 0);
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [userId]);

  if (!userId) return null;

  return (
    <Link
      href="/alertas"
      className="relative flex items-center justify-center rounded-full p-1.5 text-amber-500 hover:bg-amber-50 hover:text-amber-600"
      title="Alertas e menções"
      aria-label={naoLidas > 0 ? `${naoLidas} alertas não lidos` : 'Alertas'}
    >
      <Bell className="h-5 w-5" />
      {naoLidas > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {naoLidas > 99 ? '99+' : naoLidas}
        </span>
      ) : null}
    </Link>
  );
}
