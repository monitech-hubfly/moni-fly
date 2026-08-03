import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import CarometroScorecard from './CarometroScorecard';

export default async function CarometroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user?.email?.endsWith('@moni.casa')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const role = normalizeAccessRole((profile?.role as string) ?? 'pending');
    if (role === 'admin' || role === 'team') {
      redirect('/carometro/todo-planning');
    }
  }

  return <CarometroScorecard />;
}
