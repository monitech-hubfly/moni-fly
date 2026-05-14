'use client';

const TEXTO = `DILIGÊNCIA
Envio dos documentos do terreno para um escritório homologado analisar
Em paralelo abrir SPE e inc se for o primeiro projeto
Em paralelo, submeter para parceiros de crédito
Se precisar de alavancagem - permuta parcial - deve-se aplicar a calculadora para verificar se fica elegível e se precisa de recursos de outros parceiros / moní capital

Seguir para contrato final
Assinar`;

export function OnboardingDiligenciaContrato() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Diligência e contrato final
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Texto operacional enviado — após assinatura, o franqueado segue para o módulo de Operações pré-obra
            (secção dedicada em construção).
          </p>
        </header>

        <pre className="mt-8 whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800 shadow-inner md:text-sm">
          {TEXTO}
        </pre>

        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-stone-700">
          <li>
            <a className="font-medium text-moni-primary underline" href="/step-6">
              Step 6 — Diligência
            </a>
          </li>
          <li>
            <a className="font-medium text-moni-primary underline" href="/step-7">
              Step 7 — Contrato
            </a>
          </li>
          <li>
            <a className="font-medium text-moni-primary underline" href="/painel-credito">
              Painel crédito
            </a>{' '}
            (quando disponível na sua unidade)
          </li>
        </ul>
      </div>
    </div>
  );
}
