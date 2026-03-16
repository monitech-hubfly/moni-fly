'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MoniFooter } from '@/components/MoniFooter';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/step-one';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(
          err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : err.message,
        );
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Erro ao entrar. Tente de novo.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-stone-50 to-moni-light/20">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md">
          <h1 className="text-xl font-bold text-moni-dark">Entrar</h1>
          <p className="mt-2 text-sm text-stone-600">
            Use seu e-mail e senha para acessar o sistema.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 focus:border-moni-accent focus:outline-none focus:ring-2 focus:ring-moni-accent/20"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                  Senha
                </label>
                <Link href="/esqueci-senha" className="text-sm text-moni-accent hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 focus:border-moni-accent focus:outline-none focus:ring-2 focus:ring-moni-accent/20"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-stone-600">
            Não tem conta?{' '}
            <Link href="/signup" className="font-medium text-moni-accent hover:underline">
              Cadastrar
            </Link>
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-moni-accent hover:underline">
            ← Voltar ao início
          </Link>
        </div>
      </div>
      <MoniFooter />
    </div>
  );
}
