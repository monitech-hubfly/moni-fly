'use client';

export function OnboardingFunilStepOneGuia() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">Funil Step One no Hub</h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Guia rápido do que a ferramenta pede em cada fase e como as respostas são gravadas. Para fases, SLAs
            e papéis, veja também{' '}
            <a className="font-medium text-moni-primary underline" href="/onboarding/funis-kanban-guia">
              Kanban Moní e Frank
            </a>
            .
          </p>
        </header>

        <section className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Tipos de campo do checklist (UI)</h2>
          <p className="mt-2 text-sm text-stone-700">
            Tipos suportados na interface: <code>texto_curto</code>, <code>texto_longo</code>, <code>email</code>,{' '}
            <code>telefone</code>, <code>numero</code>, <code>anexo</code>, <code>anexo_template</code>,{' '}
            <code>checkbox</code>, <code>data</code>, <code>hora</code>, <code>tabela</code>.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-stone-700">
            <li>
              Textos: em geral salvam em <strong>blur</strong> (ao sair do campo); checkbox no toggle.
            </li>
            <li>
              Anexo: upload para bucket de documentos; path típico{' '}
              <code className="text-xs">respostas/&#123;cardId&#125;/&#123;itemId&#125;/…</code>.
            </li>
            <li>
              <code>anexo_template</code>: baixar modelo pela API, assinar, enviar de volta; pode acionar fluxo de
              comparação de documentos quando configurado.
            </li>
            <li>
              <code>tabela</code>: grid JSON (ex.: listagem de condomínios em outras fases).
            </li>
          </ul>
          <p className="mt-4 text-sm text-stone-600">
            Gravação server-side: ação de upsert de resposta por item/card (ver <code>card-actions.ts</code> no
            código).
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-5 md:p-6">
          <h2 className="text-lg font-bold text-emerald-950">Abrir o board</h2>
          <p className="mt-2 text-sm text-emerald-900/90">
            <a className="font-semibold underline" href="/funil-stepone">
              /funil-stepone
            </a>{' '}
            — menu Novos Negócios → Funil Step One, antes de Portfolio + Operações quando esse for o roteiro da
            unidade.
          </p>
        </section>
      </div>
    </div>
  );
}
