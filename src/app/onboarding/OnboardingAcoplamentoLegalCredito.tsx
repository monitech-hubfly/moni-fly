'use client';

export function OnboardingAcoplamentoLegalCredito() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Acoplamento + legal e crédito
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Conforme roteiro enviado: <strong>em paralelo</strong> com o acoplamento, executar check legal e
            check jurídico; em paralelo também a documentação e fluxos de <strong>crédito</strong> (pacote para
            parceiros, termos de autorização quando aplicável). O checklist interativo de crédito e o termo de
            autorização, quando existirem no produto, devem ser preenchidos nesta faixa do cronograma — não apenas
            na diligência.
          </p>
        </header>

        <section className="mt-8 space-y-3 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">O que fazer</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>Subir e organizar documentos no fluxo de acoplamento homologado pela Moní.</li>
            <li>Abrir/atualizar itens de check legal e crédito no painel correspondente.</li>
            <li>
              Manter comunicação com Jurídico quando houver dúvidas do advogado do terrenista (espelha o passo da
              opção de compra).
            </li>
            <li>
              Registrar no Funil Step One / Steps qualquer pendência que bloqueie o comitê ou a diligência.
            </li>
          </ul>
        </section>

        <p className="mt-6 text-sm text-stone-600">
          Integração futura: checklist legal e formulários de crédito embutidos nesta rota do onboarding quando o
          conteúdo for exportado dos Google Forms / PDFs oficiais para HTML no repositório.
        </p>
      </div>
    </div>
  );
}
