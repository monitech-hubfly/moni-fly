import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { isValidOnboardingSection } from '@/lib/onboarding-nav';
import { OnboardingSectionView } from '../OnboardingSectionView';

function initialsFromProfile(fullName: string | null | undefined, email: string) {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0][0] ?? '?').toUpperCase();
  }
  const local = email.split('@')[0] ?? '?';
  return local.slice(0, 2).toUpperCase();
}

export default async function OnboardingCatchAllPage({
  params,
}: {
  params: { slug?: string[] };
}) {
  const section = params.slug?.[0];
  if (!section) {
    redirect('/onboarding/introducao');
  }
  if (!isValidOnboardingSection(section)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/onboarding/${section}`)}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  const displayName =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() || user.email || 'Franqueado';
  const initials = initialsFromProfile(
    (profile as { full_name?: string | null } | null)?.full_name,
    user.email ?? '',
  );

  return (
    <OnboardingSectionView section={section} userInitials={initials} userDisplayName={displayName} />
  );
}
