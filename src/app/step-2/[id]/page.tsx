import Link from 'next/link';
import { ETAPAS } from '@/types/domain';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

/** Ordem do Step 2 (crescente 6→9): etapa id e número exibido (6=Escolha lote, 7=Listagem, 8=BCA, 9=PDF) */
const STEP2_ORDER: { etapaId: number; displayNum: number }[] = [
  { etapaId: 7, displayNum: 6 },
  { etapaId: 6, displayNum: 7 },
  { etapaId: 10, displayNum: 8 },
  { etapaId: 11, displayNum: 9 },
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Step2ProcessoPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: processo, error } = await supabase
    .from('processo_step_one')
    .select('id, cidade, estado, status, step_atual, cancelado_em')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !processo) notFound();
  if (processo.status !== 'concluido') redirect('/step-2');
  const proc = processo as { cancelado_em?: string | null; step_atual?: number };
  if (processo.status === 'cancelado' || proc.cancelado_em) redirect('/step-2');

  const stepAtual = proc.step_atual ?? 1;
  if (stepAtual === 1) {
    await supabase
      .from('processo_step_one')
      .update({ step_atual: 2, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);
  }

  const cidade = processo.cidade ?? '';
  const estado = processo.estado ?? '';
  const etapasStep2 = STEP2_ORDER.map(({ etapaId }) => ETAPAS.find((e) => e.id === etapaId)).filter(
    Boolean,
  );

  const { CancelarProcessoButton } = await import('../CancelarProcessoButton');

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl flex-wrap items-center gap-4 px-4">
          <Link href="/step-2" className="text-moni-primary hover:underline">
            ← Step 2
          </Link>
          <span className="font-medium text-stone-700">
            Estudo de viabilidade — {cidade || 'Processo'}
            {estado ? `, ${estado}` : ''}
          </span>
          <div className="ml-auto">
            <CancelarProcessoButton processoId={id} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 rounded-xl border border-moni-primary/30 bg-moni-light/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-moni-primary">
            Step 1 em uso
          </p>
          <p className="mt-1 font-medium text-stone-900">
            {cidade || 'Processo'}
            {estado ? `, ${estado}` : ''}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            As listagens de lotes e de casas deste Step 1 já estão disponíveis. No Step 2 você só
            faz: escolha do lote, escolha dos 3 modelos e batalha, BCA e PDF. As etapas 1 a 5 do
            Step 1 não aparecem aqui.
          </p>
        </div>

        <h1 className="text-2xl font-bold text-moni-dark">Etapas do estudo de viabilidade</h1>
        <p className="mt-1 text-stone-600">
          Primeira etapa: puxar o Step 1 (já feito acima). Agora: selecione o lote, depois use a
          listagem de casas existente com modelo e batalha, BCA e PDF.
        </p>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">Step 2</h2>
          <p className="mb-3 text-sm text-stone-500">
            A partir do Step 1 escolhido: escolha do lote, listagem (modelo + batalha), BCA e PDF
          </p>
          <ul className="space-y-3">
            {etapasStep2.map(
              (etapa, idx) =>
                etapa && (
                  <li key={etapa.id}>
                    <Link
                      href={`/step-one/${id}/etapa/${etapa.id}`}
                      className="step-card flex items-start gap-4"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moni-primary/10 text-sm font-semibold text-moni-primary">
                        {STEP2_ORDER[idx].displayNum}
                      </span>
                      <div>
                        <h3 className="font-semibold text-stone-900">{etapa.nome}</h3>
                        <p className="mt-0.5 text-sm text-stone-500">{etapa.descricao}</p>
                      </div>
                    </Link>
                  </li>
                ),
            )}
          </ul>
        </section>

        <div className="mt-8 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <strong>Resumo:</strong> Você puxou um Step 1 — os dados de análise, condomínios, resumo,
          listagem de lotes e listagem de casas já estão disponíveis. Aqui no Step 2 você só
          executa: escolha do lote (tabela de lotes), uso da listagem de casas já existente +
          escolha dos 3 modelos e batalha, BCA e PDF de hipóteses.
        </div>
      </main>
    </div>
  );
}
