'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function AuthHeader({ user }: { user: { email?: string } | null }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (user) {
    return (
      <>
        <Link href="/step-one" className="text-stone-600 hover:text-moni-primary">
          Step 1
        </Link>
        <Link href="/step-2" className="text-stone-600 hover:text-moni-primary">
          Step 2
        </Link>
        <Link href="/rede" className="text-stone-600 hover:text-moni-primary">
          Rede de contatos
        </Link>
        <Link href="/juridico" className="text-stone-600 hover:text-moni-primary">
          Dúvidas jurídicas
        </Link>
        <Link href="/alertas" className="text-stone-600 hover:text-moni-primary">
          Alertas
        </Link>
        <Link href="/painel" className="text-stone-600 hover:text-moni-primary">
          Painel
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-stone-600 hover:text-moni-primary"
        >
          Sair
        </button>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="text-stone-600 hover:text-moni-primary">
        Entrar
      </Link>
      <Link href="/signup" className="btn-primary">
        Cadastrar
      </Link>
    </>
  );
}
