'use client';

import { JornadaTabuleiro } from './JornadaTabuleiro';
import { OnboardingAcoplamentoLegalCredito } from './OnboardingAcoplamentoLegalCredito';
import { OnboardingAcessosLinks } from './OnboardingAcessosLinks';
import { OnboardingCustosSlasDrive } from './OnboardingCustosSlasDrive';
import { OnboardingDiligenciaContrato } from './OnboardingDiligenciaContrato';
import { OnboardingEsteiraNegociacaoComite } from './OnboardingEsteiraNegociacaoComite';
import { OnboardingEstruturaJuridica } from './OnboardingEstruturaJuridica';
import { OnboardingFunilStepOneGuia } from './OnboardingFunilStepOneGuia';
import { OnboardingFunisKanbanGuia } from './OnboardingFunisKanbanGuia';
import { OnboardingGadgetsConfigurador } from './OnboardingGadgetsConfigurador';
import { OnboardingGlossarioCompleto } from './OnboardingGlossarioCompleto';
import { OnboardingIntroducao } from './OnboardingIntroducao';
import { OnboardingMetaFrank } from './OnboardingMetaFrank';
import { OnboardingModeloNegocio } from './OnboardingModeloNegocio';
import { OnboardingOQueEMoni } from './OnboardingOQueEMoni';
import { OnboardingOperacoesPreObra } from './OnboardingOperacoesPreObra';
import { OnboardingPortalFrame } from './OnboardingPortalFrame';
import { OnboardingSpeMapaBatalhaBca } from './OnboardingSpeMapaBatalhaBca';
import { OnboardingStepOneOperacional } from './OnboardingStepOneOperacional';
import { OnboardingStepOneViabilidadeHub } from './OnboardingStepOneViabilidadeHub';

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
  if (section === 'estrutura-juridica') {
    return <OnboardingEstruturaJuridica />;
  }
  if (section === 'acessos-e-links') {
    return <OnboardingAcessosLinks />;
  }
  if (section === 'meta-frank') {
    return <OnboardingMetaFrank />;
  }
  if (section === 'glossario-completo') {
    return <OnboardingGlossarioCompleto />;
  }
  if (section === 'funis-kanban-guia') {
    return <OnboardingFunisKanbanGuia />;
  }
  if (section === 'funil-step-one-guia') {
    return <OnboardingFunilStepOneGuia />;
  }
  if (section === 'step-one-viabilidade-hub') {
    return <OnboardingStepOneViabilidadeHub />;
  }
  if (section === 'step-one-operacional') {
    return <OnboardingStepOneOperacional />;
  }
  if (section === 'mapa-batalha-bca-spe') {
    return <OnboardingSpeMapaBatalhaBca />;
  }
  if (section === 'esteira-negociacao-comite') {
    return <OnboardingEsteiraNegociacaoComite />;
  }
  if (section === 'acoplamento-legal-credito') {
    return <OnboardingAcoplamentoLegalCredito />;
  }
  if (section === 'diligencia-contrato') {
    return <OnboardingDiligenciaContrato />;
  }
  if (section === 'custos-slas-drive') {
    return <OnboardingCustosSlasDrive />;
  }
  if (section === 'operacoes-pre-obra') {
    return <OnboardingOperacoesPreObra />;
  }
  if (section === 'gadgets-configurador') {
    return <OnboardingGadgetsConfigurador />;
  }

  return <OnboardingPortalFrame anchor={section} />;
}
