'use client';

import { GOOGLE_DRIVE_ONBOARDING_MATERIAIS } from '@/lib/onboarding-external-links';

const LINKS: { label: string; href: string; nota?: string }[] = [
  {
    label: 'Google Drive — materiais e temas do onboarding',
    href: GOOGLE_DRIVE_ONBOARDING_MATERIAIS,
    nota:
      'Pasta oficial para ver todo o material por tema, alinhar versões e melhorar conteúdos. Acesso com conta Google que tenha permissão na pasta.',
  },
  {
    label: 'Planilha (gid 546303218)',
    href: 'https://docs.google.com/spreadsheets/d/1A055PBQzdeM0y8CqwpPVca0lLEhvqScW-qCQB1eCJyE/edit?gid=546303218#gid=546303218',
    nota: 'Acesso depende da conta Google com permissão no arquivo.',
  },
  {
    label: 'Planilha — modelo de referência (1)',
    href: 'https://docs.google.com/spreadsheets/d/1wmTkzKV9UmbKDJCKikRMLr8Y8Q7q0bk-/edit?rtpof=true',
  },
  {
    label: 'Planilha — modelo de referência (2)',
    href: 'https://docs.google.com/spreadsheets/d/1SPxWhpJyU9s4XyiDCikQC2DAPFFVpe9l/edit?rtpof=true',
  },
  {
    label: 'Planilha — modelo de referência (3)',
    href: 'https://docs.google.com/spreadsheets/d/1hTf62I22EedOpfXYnDbQZcwhA5LnDKE2/edit?rtpof=true',
  },
  {
    label: 'Apresentação Google',
    href: 'https://docs.google.com/presentation/d/1NVxTQld6Ak9tCs8lQiuUbxutf1yxMg5k/edit?rtpof=true',
  },
  {
    label: 'Canal YouTube Moní',
    href: 'https://www.youtube.com/channel/UCx2ZWg4OfWlSrzNwNjcz76w',
  },
  {
    label: 'Configurador (ambiente externo)',
    href: 'https://moni-configurador.vercel.app/',
    nota: 'Credencial de acesso: solicitar ao time Moní — não publicar senhas neste portal.',
  },
];

export function OnboardingAcessosLinks() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-50">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
        <header className="border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-moni-primary md:text-3xl">
            Acessos, links e planilhas
          </h1>
          <p className="mt-2 text-sm text-stone-600 md:text-base">
            Lista dos materiais que hoje são enviados ao franqueado. Links do Google só abrem para quem tiver
            permissão na conta correta; exportar PDF/CSV ou anexar cópias no repositório interno quando precisar
            de versão offline.
          </p>
        </header>

        <p className="mt-8 text-sm text-stone-600 md:text-base">
          <strong>Portal HTML completo (design Moní):</strong>{' '}
          <a className="font-semibold text-moni-primary underline" href="/onboarding/portal-html-moni">
            abrir em ecrã inteiro no Hub
          </a>{' '}
          — glossário, steps, Kanban, Drive, lição de casa e checklists interativos (ficheiro estático em{' '}
          <code className="text-xs">public/onboarding/onboarding_moni_1.html</code>).
        </p>

        <ul className="mt-8 list-none space-y-4 p-0">
          {LINKS.map((l) => (
            <li key={l.href} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm md:p-5">
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-moni-primary underline-offset-2 hover:underline md:text-base"
              >
                {l.label}
              </a>
              <p className="mt-1 break-all font-mono text-xs text-stone-500 md:text-sm">{l.href}</p>
              {l.nota && <p className="mt-2 text-xs text-stone-600 md:text-sm">{l.nota}</p>}
            </li>
          ))}
        </ul>

        <p className="mt-8 rounded-lg border border-stone-200 bg-stone-100/80 px-4 py-3 text-xs text-stone-700 md:text-sm">
          <strong>Hub Fly:</strong> ferramentas operacionais (Step One de viabilidade, Funil Step One Kanban,
          painéis de crédito e legal) continuam nas rotas do aplicativo — use o menu lateral ou os atalhos da
          jornada tabuleiro.
        </p>
      </div>
    </div>
  );
}
