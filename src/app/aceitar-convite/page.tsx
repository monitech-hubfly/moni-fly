'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AceitarConvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) return setError('Token ausente.');
    if (password.length < 8) return setError('Senha mínima de 8 caracteres.');
    if (password !== confirm) return setError('Senha e confirmação não conferem.');
    setLoading(true);
    try {
      const res = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? 'Erro ao aceitar convite.');
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const email = (json?.email as string | null) ?? null;
      if (!email) {
        router.push('/login');
        router.refresh();
        return;
      }
      await supabase.auth.signInWithPassword({ email, password });
      router.push(json?.role === 'admin' ? '/dashboard-novos-negocios' : '/rede-franqueados');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-bold text-moni-dark">Aceitar convite</h1>
      <p className="mt-1 text-sm text-stone-600">Defina seu nome e senha para ativar o acesso.</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className="w-full rounded border px-3 py-2" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className="w-full rounded border px-3 py-2" required />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirmar senha" className="w-full rounded border px-3 py-2" required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Ativar conta'}</button>
      </form>
    </div>
  );
}

