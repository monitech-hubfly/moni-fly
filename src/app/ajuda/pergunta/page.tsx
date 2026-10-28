import { createClient } from '@/lib/supabase/server';
import { PerguntaPublicaForm } from './PerguntaPublicaForm';

export const dynamic = 'force-dynamic';

function partirNome(completo: string): { nome: string; sobrenome: string } {
  const partes = completo.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nome: '', sobrenome: '' };
  if (partes.length === 1) return { nome: partes[0], sobrenome: '' };
  return { nome: partes[0], sobrenome: partes.slice(1).join(' ') };
}

export default async function PerguntaPublicaPage() {
  let remetenteInicial = { nome: '', sobrenome: '', email: '' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, nome_completo, email')
        .eq('id', user.id)
        .maybeSingle();
      const linha = profile as { full_name?: string | null; nome_completo?: string | null; email?: string | null } | null;
      const completo = String(linha?.nome_completo ?? linha?.full_name ?? '').trim();
      const partes = partirNome(completo);
      remetenteInicial = {
        nome: partes.nome,
        sobrenome: partes.sobrenome,
        email: String(linha?.email ?? user.email ?? '').trim(),
      };
    }
  } catch {
    remetenteInicial = { nome: '', sobrenome: '', email: '' };
  }

  return <PerguntaPublicaForm remetenteInicial={remetenteInicial} />;
}
