import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { listarEntregasPendentesAdmin, listarProgressoFranqueadosAdmin } from '@/lib/universidade/actions';
import { AdminUniversidadeClient } from './AdminUniversidadeClient';

export const dynamic = 'force-dynamic';

export default async function AdminUniversidadePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/universidade');

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((prof as { role?: string } | null)?.role);
  if (role !== 'admin' && role !== 'team') redirect('/');

  const a = await listarProgressoFranqueadosAdmin();
  const e = await listarEntregasPendentesAdmin();
  if (!a.ok || !e.ok) {
    return (
      <div className="p-8 text-sm text-red-700">
        {a.ok ? '' : a.error} {e.ok ? '' : e.error}
      </div>
    );
  }

  return <AdminUniversidadeClient rows={a.rows} entregas={e.rows} />;
}
