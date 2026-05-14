'use client';

export function OnboardingGadgetsConfigurador() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Gadgets e configurador
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            A <strong>lista oficial completa de gadgets com preços</strong> ainda não foi anexada — esta página
            mantém a estrutura e os nomes genéricos já citados no configurador.
          </p>
        </header>

        <section className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Gadgets (placeholder até lista oficial)</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>Piscina</li>
            <li>Rooftop</li>
            <li>Área gourmet</li>
            <li>SPA</li>
          </ul>
          <p className="mt-4 text-sm text-stone-600">
            Quando a tabela de preços e regras de composição chegar, substituir esta lista por tabela completa e
            cruzar com o glossário de produto (Incorporadora vs Moní).
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-5 md:p-6">
          <h2 className="text-lg font-bold text-emerald-950">Configurador</h2>
          <p className="text-sm text-emerald-900/90">
            Acesso externo listado em{' '}
            <a className="font-semibold underline" href="/onboarding/acessos-e-links">
              Acessos e links
            </a>
            . Conteúdo estendido no{' '}
            <a className="font-semibold underline" href="/onboarding/configurador">
              iframe do portal
            </a>{' '}
            quando houver texto lá — credencial apenas pelo time Moní, sem senha no código-fonte.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/70 p-5 md:p-6">
          <h2 className="text-lg font-bold text-amber-950">Pendências de dados (aguardar)</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950/90">
            <li>Valores assertivos de lotes por região / perfil de condomínio / casa.</li>
            <li>Percentual necessário entre preço de venda e preço de custo da casa (tabela geral).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
