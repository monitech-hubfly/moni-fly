import Link from 'next/link';
import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { listarFormulariosAtivos } from '@/lib/actions/formulario-actions';
import { CATEGORIAS_HUB, type CategoriaHub } from '@/lib/constants/categorias-hub';
import { createClient } from '@/lib/supabase/server';
import { GerarLinkFormularioButton } from '@/components/formularios/GerarLinkFormularioButton';
import { FormularioClassificacaoBarra } from '@/components/formularios/FormularioClassificacaoBarra';
import type { Formulario } from '@/types/formularios';

export const dynamic = 'force-dynamic';

function gruposPorCategoria(formularios: Formulario[]): { nome: string; itens: Formulario[] }[] {
  const porCategoria = new Map<CategoriaHub, Formulario[]>();
  for (const categoria of CATEGORIAS_HUB) porCategoria.set(categoria, []);
  const semCategoria: Formulario[] = [];
  for (const formulario of formularios) {
    if (formulario.categoria) porCategoria.get(formulario.categoria)?.push(formulario);
    else semCategoria.push(formulario);
  }
  const grupos: { nome: string; itens: Formulario[] }[] = CATEGORIAS_HUB.map((nome) => ({
    nome,
    itens: porCategoria.get(nome) ?? [],
  }));
  if (semCategoria.length > 0) grupos.push({ nome: 'Sem categoria', itens: semCategoria });
  return grupos;
}

export default async function FormulariosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (role === 'frank') redirect('/portal-frank');
  if (!isAdminRole(role) && role !== 'team') redirect('/rede-franqueados');

  const grupos = gruposPorCategoria(await listarFormulariosAtivos());

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full max-w-3xl px-4 py-8" style={{ fontFamily: 'var(--moni-font-sans)' }}>
        <h1 className="text-2xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
          Formulários
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Cada formulário tem um link público fixo. Quem recebe pode responder mais de uma vez, e cada envio fica registrado.
        </p>
        <div className="mt-6 space-y-4">
          {grupos.map((grupo) => (
            <section
              key={grupo.nome}
              className="p-4"
              style={{
                background: 'var(--moni-surface-0)',
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-lg)',
              }}
            >
              <h2 className="text-base font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                {grupo.nome}
              </h2>
              {grupo.itens.length === 0 ? (
                <p className="mt-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Nenhum formulário nesta categoria.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {grupo.itens.map((formulario) => (
                    <li
                      key={formulario.id}
                      className="space-y-2 px-3 py-3"
                      style={{
                        border: 'var(--moni-border-width) solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                      }}
                    >
                      <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                        {formulario.nome}
                      </p>
                      {formulario.descricao ? (
                        <p className="text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                          {formulario.descricao}
                        </p>
                      ) : null}
                      <FormularioClassificacaoBarra
                        formularioId={formulario.id}
                        categoria={formulario.categoria}
                        visivelFranqueado={formulario.visivel_franqueado}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/formularios/${formulario.id}`}
                          className="inline-flex min-h-[44px] items-center px-3 text-xs font-semibold"
                          style={{
                            borderRadius: 'var(--moni-radius-md)',
                            border: 'var(--moni-border-width) solid var(--moni-border-default)',
                            color: 'var(--moni-text-primary)',
                          }}
                        >
                          Ver respostas
                        </Link>
                        <GerarLinkFormularioButton formularioId={formulario.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
