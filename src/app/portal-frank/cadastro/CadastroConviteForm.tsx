'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { confirmarCadastroPortalFrank } from '@/app/portal-frank/actions';
import type { RedeFrankPrefill } from '@/lib/portal-frank/rede-cadastro-types';
import {
  redePrefillParaFranquiaSomenteLeitura,
  redePrefillParaPayload,
} from '@/lib/portal-frank/rede-cadastro-types';
import { RedeFrankDadosCampos } from '@/app/portal-frank/RedeFrankDadosCampos';

type Props = {
  token: string;
  emailConvite: string;
  redePrefill: RedeFrankPrefill | null;
};

function dadosIniciaisRede(emailConvite: string, redePrefill: RedeFrankPrefill | null) {
  const p = redePrefillParaPayload(redePrefill);
  const ec = emailConvite.trim().toLowerCase();
  if (!p.email_frank.trim()) return { ...p, email_frank: ec };
  return p;
}

export function CadastroConviteForm({ token, emailConvite, redePrefill }: Props) {
  const router = useRouter();
  const email = emailConvite.trim().toLowerCase();
  const franquiaRo = useMemo(() => redePrefillParaFranquiaSomenteLeitura(redePrefill), [redePrefill]);
  const nomeCompletoRede = String(franquiaRo.nome_completo ?? '').trim();
  const nomeRedeBloqueado = Boolean(nomeCompletoRede);

  const [nomeLivre, setNomeLivre] = useState('');
  const [dadosRede, setDadosRede] = useState(() => dadosIniciaisRede(emailConvite, redePrefill));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const nomeTrim = nomeRedeBloqueado ? nomeCompletoRede : nomeLivre.trim();
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
        {nomeRedeBloqueado ? (
          <div>
            <span className="block text-sm font-medium text-stone-700">Nome completo</span>
            <p className="mt-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800">
              {nomeCompletoRede}
            </p>
            <p className="mt-1 text-xs text-stone-500">Nome conforme cadastro da franquia na rede (somente leitura).</p>
          </div>
        ) : (
          <label className="block text-sm font-medium text-stone-700">
            Nome completo
            <input
              type="text"
              required
              value={nomeLivre}
              onChange={(e) => setNomeLivre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </label>
        )}
        <label className="block text-sm font-medium text-stone-700">
          E-mail de acesso
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
          Informações da franquia são definidas pela Moní. Atualize apenas seus dados de contato e endereço quando
          aplicável.
        </p>
        <RedeFrankDadosCampos franquiaSomenteLeitura={franquiaRo} value={dadosRede} onChange={setDadosRede} />
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
