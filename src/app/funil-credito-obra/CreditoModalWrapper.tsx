'use client';

import { PainelCardQueryModalWrapper } from '@/app/steps-viabilidade/PainelCardQueryModalWrapper';

/**
 * Exibe o modal estilo Funil Step One quando a URL contém ?card=UUID.
 * Fechar remove o query param e mantém /funil-credito-obra.
 */
export function CreditoModalWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PainelCardQueryModalWrapper basePath="/funil-credito-obra" board="credito">
      {children}
    </PainelCardQueryModalWrapper>
  );
}
