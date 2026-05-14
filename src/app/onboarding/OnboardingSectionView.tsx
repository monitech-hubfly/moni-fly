'use client';

import { JornadaTabuleiro } from './JornadaTabuleiro';
import { OnboardingIntroducao } from './OnboardingIntroducao';
import { OnboardingPortalFrame } from './OnboardingPortalFrame';

type Props = {
  section: string;
  userInitials: string;
  userDisplayName: string;
};

export function OnboardingSectionView({ section, userInitials, userDisplayName }: Props) {
  if (section === 'jornada-tabuleiro') {
    return <JornadaTabuleiro userInitials={userInitials} userDisplayName={userDisplayName} />;
  }
  if (section === 'introducao') {
    return <OnboardingIntroducao />;
  }
  return <OnboardingPortalFrame anchor={section} />;
}
