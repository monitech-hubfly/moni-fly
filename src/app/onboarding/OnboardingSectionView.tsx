'use client';

import { JornadaTabuleiro } from './JornadaTabuleiro';
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
  return <OnboardingPortalFrame anchor={section} />;
}
