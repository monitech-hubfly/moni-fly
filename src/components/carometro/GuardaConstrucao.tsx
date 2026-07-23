'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ADMIN_EMAIL = 'danilo.n@moni.casa';

export function GuardaConstrucao({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'admin' | 'bloqueado'>('loading');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user?.email === ADMIN_EMAIL ? 'admin' : 'bloqueado');
    });
  }, []);

  if (status === 'loading') return null;

  if (status === 'bloqueado') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
        <span className="text-5xl">🚧</span>
        <h2 className="text-lg font-semibold text-gray-700">Página em construção</h2>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          Esta funcionalidade ainda está sendo desenvolvida e em breve estará disponível para você.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
