'use client';

/**
 * Secção "O que é a Moní" — fundo integralmente branco (área de conteúdo).
 */
export function OnboardingOQueEMoni() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
      <article className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">O que é a Moní</h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Visão geral da marca e do ecossistema para quem entra na rede.
          </p>
        </header>

        <div className="prose prose-stone mt-8 max-w-none prose-p:text-stone-700 prose-p:leading-relaxed prose-headings:text-stone-900">
          <p>
            A <strong>Moní</strong> é uma rede de franquias focada em empreendimentos residenciais de alto padrão,
            com processos próprios de viabilidade, produto, obra e operação — apoiados por ferramentas digitais
            (Hub Fly, funis, checklists e materiais de onboarding).
          </p>
          <p>
            O franqueado atua na interface entre terreno, condomínio, modelo de casa e mercado local, com o suporte
            da matriz em jurídico, crédito, engenharia e expansão, conforme a etapa do negócio.
          </p>
          <p>
            Esta base de conhecimento organiza conceitos, esteira de steps e referências para você navegar com
            autonomia e alinhar expectativas com a equipa Moní.
          </p>
        </div>
      </article>
    </div>
  );
}
