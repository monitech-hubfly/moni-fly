'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function isFrankRole(role: string | null | undefined) {
  const r = String(role ?? '').toLowerCase();
  return r === 'frank' || r === 'franqueado';
}

export default function PortalFrankLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Sessão não iniciada.');
        return;
      }
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const role = (prof as { role?: string | null } | null)?.role;
      if (!isFrankRole(role)) {
        await supabase.auth.signOut();
        setError('Este acesso é exclusivo para franqueados. Use o login principal do Hub.');
        return;
      }
      router.replace('/portal-frank');
      router.refresh();
    } catch {
      setError('Erro ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--moni-surface-50)] px-4 py-12">
      <div
        className="w-full max-w-md rounded-xl border bg-white p-8 shadow-sm"
        style={{ borderColor: 'var(--moni-border-default)' }}
      >
        <h1 className="text-xl font-semibold text-stone-900">Portal do Franqueado</h1>
        <p className="mt-1 text-sm text-stone-500">Entre com e-mail e senha.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-stone-700">
            E-mail
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </label>
          <label className="block text-sm font-medium text-stone-700">
            Senha
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--moni-navy-800)' }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-stone-500">
          Primeiro acesso?{' '}
          <span className="text-stone-600">Use o link de convite enviado pela Moní.</span>
        </p>
        <p className="mt-2 text-center text-xs">
          <Link href="/login" className="text-moni-primary hover:underline">
            Acesso equipe Moní (login principal)
          </Link>
        </p>
      </div>
    </div>
  );
}
