'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MoniFooter } from '@/components/MoniFooter';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      router.push('/step-one');
      router.refresh();
    } catch {
      setError('Erro ao cadastrar. Tente de novo.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-stone-50 to-moni-light/20">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="card w-full max-w-md">
          <h1 className="text-xl font-bold text-moni-dark">Cadastrar</h1>
          <p className="mt-2 text-sm text-stone-600">
            Crie sua conta para acessar o processo Step One.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-stone-700">
                Nome completo
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                required
              />
            </div>
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
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-moni-accent focus:outline-none focus:ring-1 focus:ring-moni-accent"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700">
                Senha (mín. 6 caracteres)
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Cadastrando…' : 'Cadastrar'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-stone-600">
            Já tem conta?{' '}
            <Link href="/login" className="font-medium text-moni-accent hover:underline">
              Entrar
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
