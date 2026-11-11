import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';
import { PresentationChartBarIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const APRESENTACOES = [
  {
    id: 'book-empreendimento',
    nome: 'Book do Empreendimento',
    descricao: 'Gera automaticamente o Book do Empreendimento personalizado com base no modelo de casa selecionado.',
    href: '/apresentacoes/book-empreendimento',
    icone: '📖',
    disponivel: true,
  },
];

export default async function ApresentacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (role === 'frank') redirect('/portal-frank');
  if (!isAdminRole(role) && role !== 'team') redirect('/rede-franqueados');

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--moni-navy-800)]">
            <PresentationChartBarIcon className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--moni-navy-800)]">Apresentações</h1>
            <p className="text-sm text-stone-500">Materiais comerciais e apresentações para clientes</p>
          </div>
        </div>

        {/* Grid de automações */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {APRESENTACOES.map((item) =>
            item.disponivel ? (
              <Link
                key={item.id}
                href={item.href}
                className="group flex flex-col gap-3 rounded-xl border border-[var(--moni-border)] bg-white p-5 shadow-sm transition hover:border-[var(--moni-navy-800)] hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{item.icone}</span>
                  <span className="rounded-full bg-[var(--moni-green-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--moni-green-800)]">
                    Disponível
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--moni-navy-800)] group-hover:text-[var(--moni-secondary)]">
                    {item.nome}
                  </h2>
                  <p className="mt-1 text-xs text-stone-500 leading-relaxed">{item.descricao}</p>
                </div>
              </Link>
            ) : (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-dashed border-stone-200 bg-stone-50 p-5 opacity-60"
              >
                <span className="text-2xl">{item.icone}</span>
                <div>
                  <h2 className="text-sm font-semibold text-stone-500">{item.nome}</h2>
                  <p className="mt-1 text-xs text-stone-400 leading-relaxed">{item.descricao}</p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
