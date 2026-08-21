import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { getFaqArtigosAdmin, getFaqCategoriasAdmin } from '@/lib/faq/queries';
import { AdminFaqClient } from './AdminFaqClient';

export const dynamic = 'force-dynamic';

export default async function AdminFaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin/universidade/faq');

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((prof as { role?: string } | null)?.role);
  if (role !== 'admin' && role !== 'team') redirect('/');

  const [artigos, categorias] = await Promise.all([
    getFaqArtigosAdmin(supabase),
    getFaqCategoriasAdmin(supabase),
  ]);

  return <AdminFaqClient artigos={artigos} categorias={categorias} />;
}
