import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Legado: redireciona para `/painel-contabilidade`. */
export default function ContabilidadeRedirectPage({
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
  redirect(qs ? `/painel-contabilidade?${qs}` : '/painel-contabilidade');
}
