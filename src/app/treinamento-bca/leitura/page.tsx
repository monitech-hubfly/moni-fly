import { Suspense } from 'react';
import { TreinamentoBcaSecaoClient } from '@/components/treinamento-bca/TreinamentoBcaSecaoClient';

/** Link público fixo: manual BCA inteiro em modo leitura (rolagem; sem sidebar Hub). */
export default function TreinamentoBcaLeituraPublicaPage() {
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-stone-600">Carregando treinamento…</div>}>
      <TreinamentoBcaSecaoClient secao="introducao" modoPublico />
    </Suspense>
  );
}
