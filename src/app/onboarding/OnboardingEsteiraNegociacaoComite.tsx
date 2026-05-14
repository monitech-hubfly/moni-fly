'use client';

const TEXTO = `Pitch de vendas com o terrenistas

iniciar com permuta 100% e depois ir para permuta parcial
Assinar a Opção de Compra

caso haja dúvidas do advogado do terreneiro, compartilhar com o nosso jurídico até fechar e assinar
assinamos na nossa plataforma online (nós subimos)

FORMALIZAR O MATERIAL PARA O COMITÊ
Fazer o estudo completo
Usar o mapa de competidores para fazer uma batalha completa, segue abaixo as regras que já tenho e usar para orientar no onboarding, passo a passo, material de ensino,...

FAZER ACOPLAMENTO
EM PARALELO CHECK LEGAL + CHECK JURÍDICO

COMITÊ
PARECERES DO COMITÊ, PODE VOLTAR PARA REFAÇÃO OU SEGUIR PARA DILIGÊNCIA`;

export function OnboardingEsteiraNegociacaoComite() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Negociação, opção e comitê
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Sequência operacional enviada pelo time — após o comitê, o fluxo continua na página de diligência e
            contrato. Rotas Hub: Step 3 (negociação), Step 5 (comitê), painéis de legal/crédito.
          </p>
        </header>

        <pre className="mt-8 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 shadow-inner md:text-sm">
          {TEXTO}
        </pre>

        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-stone-700">
          <li>
            <a className="font-medium text-moni-primary underline" href="/step-3">
              Step 3 — Negociação
            </a>
          </li>
          <li>
            <a className="font-medium text-moni-primary underline" href="/step-5">
              Step 5 — Comitê
            </a>
          </li>
          <li>
            <a className="font-medium text-moni-primary underline" href="/acoplamento-pl">
              Acoplamento
            </a>
          </li>
          <li>
            <a className="font-medium text-moni-primary underline" href="/painel">
              Painel crédito / legal
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
