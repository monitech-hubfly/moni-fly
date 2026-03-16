import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Step1Form from './Step1Form';

export default async function IniciarStepOnePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: processos } = await supabase
    .from('processo_step_one')
    .select('id, cidade, estado, status, etapa_atual, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  const emAndamento = (processos ?? []).filter(
    (p) => p.status === 'em_andamento' || p.status === 'rascunho',
  );
  const finalizados = (processos ?? []).filter((p) => p.status === 'concluido');

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-moni-light/20">
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
          <Link href="/" className="font-medium text-moni-primary hover:text-moni-secondary">
            ← Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-12">
        <div className="card">
          <Step1Form />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-stone-800">
            Processos em andamento e finalizados
          </h2>
          <p className="mb-3 text-sm text-stone-500">
            Clique em um processo para continuar ou visualizar as etapas.
          </p>
          {!processos?.length ? (
            <p className="text-sm italic text-stone-500">Nenhum processo ainda.</p>
          ) : (
            <ul className="space-y-2">
              {emAndamento.length > 0 && (
                <>
                  <li className="mt-4 text-xs font-medium uppercase tracking-wide text-stone-500 first:mt-0">
                    Em andamento
                  </li>
                  {emAndamento.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/step-one/${p.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 transition hover:border-moni-accent/40 hover:shadow-sm"
                      >
                        <span className="font-medium text-stone-900">
                          {p.cidade ?? 'Sem cidade'}
                          {p.estado ? `, ${p.estado}` : ''}
                        </span>
                        <span className="text-xs text-stone-500">
                          {p.status === 'em_andamento' ? 'Em andamento' : 'Rascunho'}
                          {p.updated_at &&
                            ` · ${new Date(p.updated_at).toLocaleDateString('pt-BR')}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </>
              )}
              {finalizados.length > 0 && (
                <>
                  <li className="mt-4 text-xs font-medium uppercase tracking-wide text-stone-500">
                    Finalizados
                  </li>
                  {finalizados.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/step-one/${p.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 transition hover:border-moni-accent/40 hover:shadow-sm"
                      >
                        <span className="font-medium text-stone-900">
                          {p.cidade ?? 'Sem cidade'}
                          {p.estado ? `, ${p.estado}` : ''}
                        </span>
                        <span className="text-xs text-stone-500">
                          Finalizado
                          {p.updated_at &&
                            ` · ${new Date(p.updated_at).toLocaleDateString('pt-BR')}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
        </section>

        <div className="mt-8 rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <strong>O que vem a seguir:</strong> Etapa 1 usará a cidade para analisar a praça (área de
          atuação, parques, eixo de expansão) com bases como IBGE, Atlas Brasil e Prefeitura. Na
          etapa 2 serão listados os condomínios que vendem casa acima de 5MM e o checklist completo.
        </div>
      </main>
    </div>
  );
}
