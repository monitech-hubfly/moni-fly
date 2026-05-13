'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setReady(true);
      } else {
        setError('Link inválido ou expirado. Solicite um novo link em Esqueci minha senha.');
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 2000);
    } catch {
      setError('Erro ao alterar senha. Tente de novo.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="card w-full max-w-md">
          <h1 className="text-xl font-bold text-moni-dark">Senha alterada</h1>
          <p className="mt-2 text-stone-600">
            Sua senha foi redefinida. Redirecionando para o login…
          </p>
          <Link href="/login" className="mt-6 inline-block text-moni-accent hover:underline">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  if (!ready && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="card w-full max-w-md">
          <p className="text-stone-600">Carregando…</p>
        </div>
      </div>
    );
  }

  if (error && !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="card w-full max-w-md">
          <h1 className="text-xl font-bold text-moni-dark">Link inválido</h1>
          <p className="mt-2 text-red-600">{error}</p>
          <Link
            href="/esqueci-senha"
            className="mt-6 inline-block text-moni-accent hover:underline"
          >
            Solicitar novo link
          </Link>
          <Link href="/login" className="ml-4 mt-4 inline-block text-moni-accent hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-xl font-bold text-moni-dark">Nova senha</h1>
        <p className="mt-2 text-sm text-stone-600">
          Digite e confirme sua nova senha (mínimo 6 caracteres).
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-stone-700">
              Nova senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              required
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-stone-700">
              Confirmar senha
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Salvando…' : 'Definir nova senha'}
          </button>
        </form>
        <Link href="/login" className="mt-4 inline-block text-sm text-moni-accent hover:underline">
          ← Voltar ao login
        </Link>
      </div>
    </div>
  );
}
