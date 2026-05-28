import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Legado: redireciona para `/projetos-locais`. */
export default function FunilProjetosLocaisRedirectPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val != null && String(val).trim() !== '') p.set(k, String(val));
  }
  const qs = p.toString();
  redirect(qs ? `/projetos-locais?${qs}` : '/projetos-locais');
}
