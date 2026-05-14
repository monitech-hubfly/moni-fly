'use client';

export function OnboardingMetaFrank() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">Meta Frank</h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Ritmo de trabalho combinado para mapeamento e fecho — alinhar com o consultor e registrar no Funil
            Step One.
          </p>
        </header>

        <section className="mt-8 space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-bold text-stone-900">Metas mensais (referência)</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-stone-700 md:text-base">
            <li>
              <strong>Cinco hipóteses por mês</strong> — hipóteses estruturadas (praça, condomínio, lote, produto,
              risco) documentadas e movidas no Kanban até a fase correspondente.
            </li>
            <li>
              <strong>Um contrato final assinado</strong> — após comitê, diligência e crédito, fechar a linha do
              negócio com assinatura do pacote contratual aprovado.
            </li>
          </ul>
          <p className="text-sm text-stone-600">
            Os SLAs das colunas do Funil Step One (7, 10, 14 dias por fase no seed inicial) ajudam a medir atraso;
            a meta comercial acima é independente e deve ser acompanhada em reunião de ritmo com a Moní.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-5 md:p-6">
          <h2 className="text-lg font-bold text-emerald-950">Onde registrar</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900/90">
            <li>
              <a className="font-medium underline" href="/funil-stepone">
                Funil Step One
              </a>{' '}
              — board por fases, card por franqueado, checklist estrutural por fase.
            </li>
            <li>
              <a className="font-medium underline" href="/step-one">
                Step One (viabilidade)
              </a>{' '}
              — motor de mapa, batalha e estudos quando o fluxo exigir fora do checklist do Kanban.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
