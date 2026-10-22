import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { listarFormulariosAtivos } from '@/lib/actions/formulario-actions';
import { CATEGORIAS_HUB, type CategoriaHub } from '@/lib/constants/categorias-hub';
import { createClient } from '@/lib/supabase/server';
import { FormulariosCatalogo, type FormularioCatalogoGrupo } from '@/components/formularios/FormulariosCatalogo';
import type { Formulario } from '@/types/formularios';

export const dynamic = 'force-dynamic';

function gruposPorCategoria(formularios: Formulario[]): FormularioCatalogoGrupo[] {
  const porCategoria = new Map<CategoriaHub, Formulario[]>();
  for (const categoria of CATEGORIAS_HUB) porCategoria.set(categoria, []);
  const semCategoria: Formulario[] = [];
  for (const formulario of formularios) {
    if (formulario.categoria) porCategoria.get(formulario.categoria)?.push(formulario);
    else semCategoria.push(formulario);
  }
  const grupos: FormularioCatalogoGrupo[] = CATEGORIAS_HUB.map((nome) => ({
    nome,
    itens: (porCategoria.get(nome) ?? []).map(paraCatalogo),
  }));
  if (semCategoria.length > 0) grupos.push({ nome: 'Sem categoria', itens: semCategoria.map(paraCatalogo) });
  return grupos;
}

function paraCatalogo(formulario: Formulario): FormularioCatalogoGrupo['itens'][number] {
  return {
    id: formulario.id,
    nome: formulario.nome,
    descricao: formulario.descricao,
    categoria: formulario.categoria,
    visivel_franqueado: formulario.visivel_franqueado,
  };
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
      <FormulariosCatalogo grupos={grupos} />
    </div>
  );
}
