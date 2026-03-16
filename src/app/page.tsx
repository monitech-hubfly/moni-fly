import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AuthHeader } from '@/components/AuthHeader';
import { MoniFooter } from '@/components/MoniFooter';
import { getStatusLabel } from '@/app/juridico/constants';

export default async function HomePage() {
  let user: { id: string; email?: string } | null = null;
  let processos: {
    id: string;
    cidade: string;
    estado: string | null;
    status: string;
    created_at: string;
  }[] = [];
  let ticketsAbertos: { id: string; titulo: string; status: string; created_at: string }[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user?.id) {
      const [processosRes, ticketsRes] = await Promise.all([
        supabase
          .from('processo_step_one')
          .select('id, cidade, estado, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('juridico_tickets')
          .select('id, titulo, status, created_at')
          .eq('user_id', user.id)
          .neq('status', 'finalizado')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);
      processos = processosRes.data ?? [];
      ticketsAbertos = ticketsRes.data ?? [];
    }
  } catch {
    // Supabase não configurado ou indisponível
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-moni-light/20">
      {!user && (
        <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
            <Link
              href="/"
              className="text-xl font-semibold tracking-tight text-moni-primary hover:text-moni-secondary"
            >
              Viabilidade Moní
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <AuthHeader user={user} />
            </nav>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        {user ? (
          <>
            <section>
              <p className="text-sm font-medium uppercase tracking-wider text-moni-accent">
                Portal de Viabilidade
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-moni-dark sm:text-3xl">
                Visão geral
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Seus processos em construção e tickets jurídicos em aberto.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="moni-heading text-lg">Processos</h2>
              <p className="mt-1 text-sm text-stone-600">
                Acesse um processo existente ou inicie um novo.
              </p>
              {processos.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-stone-200/80 bg-white p-5 text-stone-600 shadow-sm">
                  Nenhum processo ainda. Use{' '}
                  <strong>Step One em construção → Iniciar Step One</strong> no menu para começar.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {processos.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/step-one/${p.id}`}
                        className="step-card flex items-center justify-between"
                      >
                        <span className="font-medium text-stone-900">
                          {p.cidade}
                          {p.estado ? `, ${p.estado}` : ''}
                        </span>
                        <span className="text-sm text-stone-500">
                          {p.status === 'em_andamento'
                            ? 'Em andamento'
                            : p.status === 'concluido'
                              ? 'Concluído'
                              : 'Rascunho'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {processos.length > 0 && (
                <Link
                  href="/step-2"
                  className="mt-3 inline-block text-sm font-medium text-moni-accent hover:underline"
                >
                  Ver todos os processos →
                </Link>
              )}
            </section>

            <section className="mt-8">
              <h2 className="moni-heading text-lg">Tickets em aberto (Jurídico)</h2>
              <p className="mt-1 text-sm text-stone-600">
                Dúvidas jurídicas ainda não finalizadas.
              </p>
              {ticketsAbertos.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-stone-200/80 bg-white p-5 text-stone-600 shadow-sm">
                  Nenhum ticket em aberto. Use <strong>Jurídico</strong> no menu para abrir uma nova
                  dúvida.
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {ticketsAbertos.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/juridico/${t.id}`}
                        className="step-card flex items-center justify-between"
                      >
                        <span className="line-clamp-1 font-medium text-stone-900">{t.titulo}</span>
                        <span className="shrink-0 text-sm text-stone-500">
                          {getStatusLabel(t.status)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/juridico"
                className="mt-3 inline-block text-sm font-medium text-moni-accent hover:underline"
              >
                Ir para Jurídico →
              </Link>
            </section>
          </>
        ) : (
          <section className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-moni-accent">
              Ferramenta para franqueados
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-moni-dark sm:text-4xl md:text-5xl">
              Viabilidade com o padrão Moní
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-stone-600">
              Solução completa para validar sua praça e formatar a hipótese com dados — da análise
              ao PDF para aprovação.
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-stone-500">
              Condomínios, catálogo, batalhas e BCA em um só fluxo.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center rounded-xl bg-moni-primary px-8 py-4 text-base font-medium text-white shadow-md transition hover:bg-moni-secondary hover:shadow-lg"
            >
              Entrar para começar
            </Link>
            <p className="mt-6 text-sm text-stone-500">
              <a
                href="https://moni.casa/franquia/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-moni-accent hover:underline"
              >
                Conheça a franquia Casa Moní →
              </a>
            </p>
          </section>
        )}
        <section className="mt-20">
          <h2 className="moni-heading text-center text-lg">Por que usar a Viabilidade Moní?</h2>
          <p className="mt-2 text-center text-sm text-stone-600">
            Estruture sua análise e chegue à hipótese com o padrão Casa Moní.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 text-center shadow-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-moni-light font-semibold text-moni-accent">
                1
              </span>
              <h3 className="mt-3 font-semibold text-moni-dark">Análise estruturada</h3>
              <p className="mt-1.5 text-sm text-stone-600">
                Praça, condomínios &gt;5MM, checklist e tabela resumo. Dados IBGE e espaço para
                Atlas e Google em breve.
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 text-center shadow-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-moni-light font-semibold text-moni-accent">
                2
              </span>
              <h3 className="mt-3 font-semibold text-moni-dark">Batalhas e ranking</h3>
              <p className="mt-1.5 text-sm text-stone-600">
                Listagens de casas e lotes, catálogo Moní, lote escolhido. Batalhas
                preço/produto/localização e ranking.
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200/80 bg-white p-6 text-center shadow-sm">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-moni-light font-semibold text-moni-accent">
                3
              </span>
              <h3 className="mt-3 font-semibold text-moni-dark">BCA e PDF para aprovação</h3>
              <p className="mt-1.5 text-sm text-stone-600">
                Três opções de BCA e PDF de hipóteses consolidado. Registro e hash para auditoria.
              </p>
            </div>
          </div>
        </section>
        <section className="mt-16">
          <h2 className="moni-heading text-lg">Step One em 3 blocos</h2>
          <p className="mt-1 text-sm text-stone-600">
            Praça, listagens, lote, batalhas e conclusão.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Link href={user ? '/step-one' : '/login'} className="step-card group block">
              <span className="text-xs font-semibold uppercase tracking-wider text-moni-accent">
                Etapas 1–3
              </span>
              <h3 className="mt-2 font-semibold text-stone-900">Praça e condomínios</h3>
              <p className="mt-1.5 text-sm text-stone-500">
                Análise da cidade, checklist condomínios &gt;5MM, tabela resumo e conclusão.
              </p>
            </Link>
            <Link href={user ? '/step-one' : '/login'} className="step-card group block">
              <span className="text-xs font-semibold uppercase tracking-wider text-moni-accent">
                Etapas 4–7
              </span>
              <h3 className="mt-2 font-semibold text-stone-900">Listagens e lote</h3>
              <p className="mt-1.5 text-sm text-stone-500">
                Casas e lotes (ZAP), catálogo Moní, lote escolhido pelo franqueado.
              </p>
            </Link>
            <Link href={user ? '/step-one' : '/login'} className="step-card group block">
              <span className="text-xs font-semibold uppercase tracking-wider text-moni-accent">
                Etapas 8–11
              </span>
              <h3 className="mt-2 font-semibold text-stone-900">Batalhas e BCA</h3>
              <p className="mt-1.5 text-sm text-stone-500">
                Batalhas, ranking, 3 BCAs e PDF de hipóteses para aprovação.
              </p>
            </Link>
          </div>
        </section>
        <MoniFooter />
      </main>
    </div>
  );
}
