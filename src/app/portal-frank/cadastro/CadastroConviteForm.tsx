'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { confirmarCadastroPortalFrank } from '@/app/portal-frank/actions';
import type { RedeFrankPrefill } from '@/lib/portal-frank/rede-cadastro-types';
import { redePrefillParaPayload } from '@/lib/portal-frank/rede-cadastro-types';
import { RedeFrankDadosCampos } from '@/app/portal-frank/RedeFrankDadosCampos';

type Props = {
  token: string;
  emailConvite: string;
  redePrefill: RedeFrankPrefill | null;
};

export function CadastroConviteForm({ token, emailConvite, redePrefill }: Props) {
  const router = useRouter();
  const email = emailConvite.trim().toLowerCase();
  const [nome, setNome] = useState(() => String(redePrefill?.nome_completo ?? '').trim());
  const [dadosRede, setDadosRede] = useState(() => redePrefillParaPayload(redePrefill));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      setError('Informe o nome completo.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Senha e confirmação não conferem.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: nomeTrim, nome_completo: nomeTrim } },
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setError(
          signInErr.message +
            ' Se o projeto exige confirmação de e-mail, confirme antes de continuar.',
        );
        return;
      }
      const conf = await confirmarCadastroPortalFrank(token, nomeTrim, dadosRede);
      if (!conf.ok) {
        setError(conf.error);
        return;
      }
      router.replace('/portal-frank');
      router.refresh();
    } catch {
      setError('Erro ao cadastrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-6 space-y-8" onSubmit={(ev) => void handleSubmit(ev)}>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Seus dados</h2>
        <label className="block text-sm font-medium text-stone-700">
          Nome completo
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          E-mail
          <input
            type="email"
            required
            readOnly
            value={email}
            className="mt-1 w-full rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Senha
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Confirmar senha
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </label>
      </section>

      <section className="space-y-4 border-t border-stone-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Dados do franqueado</h2>
        <p className="text-xs text-stone-500">
          Confira ou complete as informações da sua unidade na rede. Elas serão salvas no seu cadastro.
        </p>
        <RedeFrankDadosCampos value={dadosRede} onChange={setDadosRede} />
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--moni-navy-800)' }}
      >
        {loading ? 'Criando conta…' : 'Criar conta e entrar'}
      </button>
      <p className="text-center text-xs">
        <Link href="/portal-frank/login" className="text-moni-primary hover:underline">
          Já tenho conta
        </Link>
      </p>
    </form>
  );
}
