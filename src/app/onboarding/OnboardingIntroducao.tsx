'use client';

/**
 * Diagramação tipo “checklist em 5 passos”: coluna esquerda (# + círculo + número),
 * coluna direita (título em caixa arredondada + lista). Cores do design system Moní / stone.
 */

const STEPS: { title: string; bullets: string[] }[] = [
  {
    title: 'Conta, acesso e primeiro login',
    bullets: [
      'Confirme o convite e defina uma senha forte.',
      'Aceda ao Hub Fly e identifique o menu lateral (Rede, Empreendimentos, Onboarding).',
      'Complete o perfil e mantenha o e-mail atualizado para comunicações da Moní.',
    ],
  },
  {
    title: 'Leitura da base de conhecimento',
    bullets: [
      'Percorra “O que é a Moní”, modelos de negócio, glossário completo e estrutura jurídica no menu de Onboarding.',
      'Use “Acessos, links e planilhas” para Google Sheets, YouTube e configurador (credencial pelo time Moní).',
      'Anote dúvidas para trazer à equipa ou ao franqueado responsável.',
    ],
  },
  {
    title: 'Esteira de viabilidade (visão geral)',
    bullets: [
      'Siga a “Jornada — tabuleiro” e as secções Negociação → Comitê → Diligência e contrato no onboarding.',
      'No Hub, use Step One, Step 2–7, Funil Step One, acoplamento e painéis de legal/crédito conforme o teu papel.',
      'Relacione os funis de Empreendimentos com as etapas que acompanhas no dia a dia.',
    ],
  },
  {
    title: 'Ferramentas, BCA e materiais',
    bullets: [
      'Funil Step One: guia do Kanban (SLAs em dias úteis) e “Step One — demanda e campo” para checklist de praça.',
      'Configurador, BCA e batalha: secções no menu ou iframe do portal; mapa/batalha/BCA também em texto em React.',
      'Pasta Drive da equipa: em “Custos, SLAs, Drive e lição de casa” — para rever temas e alinhar conteúdos.',
    ],
  },
  {
    title: 'Acompanhamento e próximos passos',
    bullets: [
      'Explore a Jornada — Tabuleiro para ver o percurso em formato de “jogo da vida”.',
      'Agende com a equipa Moní um alinhamento após concluir esta introdução.',
    ],
  },
];

export function OnboardingIntroducao() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-12 md:px-6 md:py-8">
        <header className="relative mb-10 overflow-hidden rounded-xl border border-stone-200 bg-white p-5 shadow-sm md:p-6">
          {/* Padrão diagonal discreto (estrutura visual, sem cores fortes) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `repeating-linear-gradient(
                -45deg,
                #78716c 0px,
                #78716c 1px,
                transparent 1px,
                transparent 10px
              )`,
            }}
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">Introdução</h1>
              <p className="mt-2 text-sm font-semibold text-stone-700 md:text-base">
                Checklist de onboarding em 5 passos
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
                Use esta página como roteiro inicial. Cada passo resume o que esperamos que explore no portal
                antes de mergulhar nas restantes secções.
              </p>
            </div>
            <div
              className="shrink-0 self-start rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-center"
              aria-label="Moní"
            >
              <span className="text-lg font-bold tracking-tight text-moni-primary">Moní</span>
              <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">Onboarding</p>
            </div>
          </div>
        </header>

        <ol className="list-none space-y-10 p-0">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3 md:gap-6">
              {/* Indicador: # + círculo + número */}
              <div className="flex shrink-0 items-start gap-0.5 pt-0.5 md:gap-1">
                <span
                  className="select-none text-2xl font-light leading-none text-stone-300 md:text-3xl"
                  aria-hidden
                >
                  #
                </span>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-moni-primary bg-moni-light text-base font-bold text-moni-primary shadow-sm md:h-14 md:w-14 md:text-lg"
                  aria-label={`Passo ${index + 1}`}
                >
                  {index + 1}
                </div>
              </div>

              {/* Conteúdo: caixa de título + bullets */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm md:px-5 md:py-3.5">
                  <h2 className="text-sm font-semibold text-stone-900 md:text-base">{step.title}</h2>
                </div>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-stone-600 md:text-[0.9375rem]">
                  {step.bullets.map((b) => (
                    <li key={b} className="marker:text-stone-400">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
