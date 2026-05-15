import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BCA_TREINAMENTO_SECOES, isBcaTreinamentoSecao } from '@/lib/treinamento-bca-secoes';
import { TreinamentoBcaSecaoClient } from '@/components/treinamento-bca/TreinamentoBcaSecaoClient';

export function generateStaticParams() {
  return BCA_TREINAMENTO_SECOES.map((s) => ({ secao: s.id }));
}

export default function TreinamentoBcaSecaoPage({ params }: { params: { secao: string } }) {
  if (!isBcaTreinamentoSecao(params.secao)) notFound();
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-stone-600">Carregando treinamento…</div>}>
      <TreinamentoBcaSecaoClient secao={params.secao} />
    </Suspense>
  );
}
