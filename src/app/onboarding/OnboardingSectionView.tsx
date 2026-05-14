'use client';

import { JornadaTabuleiro } from './JornadaTabuleiro';
import { OnboardingIntroducao } from './OnboardingIntroducao';
import { OnboardingModeloNegocio } from './OnboardingModeloNegocio';
import { OnboardingOQueEMoni } from './OnboardingOQueEMoni';
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
  if (section === 'o-que-e-moni') {
    return <OnboardingOQueEMoni />;
  }
  if (section === 'modelo-de-negocio') {
    return <OnboardingModeloNegocio />;
  }
  return <OnboardingPortalFrame anchor={section} />;
}
