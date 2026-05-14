import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingShell } from './OnboardingShell';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/onboarding');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const userName =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() || user.email || 'Franqueado';

  return <OnboardingShell userName={userName}>{children}</OnboardingShell>;
}
