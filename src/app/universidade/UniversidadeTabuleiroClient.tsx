'use client';

import Link from 'next/link';
import type { CasaComProgresso } from '@/lib/universidade/types';
import { CasaCard } from '@/components/universidade/CasaCard';
import { ProgressBar } from '@/components/universidade/ProgressBar';
import { calcularProgressoGeral, nivelMaximoCertificado } from '@/lib/universidade/queries';
import type { UniCertificado } from '@/lib/universidade/types';

const PROXIMO_CERT: Record<number, string> = {
  0: 'Nível 1 — Fundamentos',
  1: 'Nível 2 — Step One',
  2: 'Nível 3 — BCA e hipótese',
  3: 'Nível 4 — Negociação',
  4: 'Nível 5 — Operação completa',
  5: 'Todos os níveis emitidos',
};

export function UniversidadeTabuleiroClient({
  casas,
  certificados,
}: {
  casas: CasaComProgresso[];
  certificados: UniCertificado[];
}) {
  const geral = calcularProgressoGeral(casas);
  const nivel = nivelMaximoCertificado(certificados);
  const casasConcl = casas.filter((c) => c.status === 'concluida').length;
  const modulosFeitos = casas.reduce((a, c) => a + c.modulos_concluidos, 0);
  const proximo = PROXIMO_CERT[nivel] ?? PROXIMO_CERT[0];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Jornada da incorporação</h1>
        <p className="mt-1 text-sm text-stone-600">
          Nível {nivel} · Progresso geral {geral}%
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Casas concluídas" value={String(casasConcl)} />
        <Metric label="Módulos feitos" value={String(modulosFeitos)} />
        <Metric label="Nível atual" value={String(nivel)} />
        <Metric label="Próximo certificado" value={proximo} smallValue />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-stone-500">Progresso geral</p>
        <ProgressBar percentual={geral} height={8} cor="green" transitionMs={600} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {casas.map((casa) => (
          <UniversidadeCasaLink key={casa.id} casa={casa} />
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, smallValue }: { label: string; value: string; smallValue?: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-1 font-semibold text-stone-900 ${smallValue ? 'text-xs leading-snug' : 'text-lg'}`}>{value}</p>
    </div>
  );
}

/** Casa 0 no tabuleiro abre o hub de onboarding (Casa0Hub), não a jornada por módulos. */
const CASA0_SLUG = 'boas-vindas';

function UniversidadeCasaLink({ casa }: { casa: CasaComProgresso }) {
  const href =
    casa.slug === CASA0_SLUG || casa.numero === 0 ? '/casa0' : `/universidade/jornada/${encodeURIComponent(casa.slug)}`;

  return (
    <Link href={href} className="block">
      <CasaCard casa={casa} />
    </Link>
  );
}
