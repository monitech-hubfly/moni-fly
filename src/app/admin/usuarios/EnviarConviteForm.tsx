'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteLinkIsLocalhost } from '@/lib/invite-link-utils';
import {
  CARGO_OPCOES,
  FUNIS_KANBAN_NOMES,
  GRUPO_CONVITE_OPCOES,
  type InviteCargo,
  type InviteGrupoRole,
  exibirFunisNoConvite,
} from '@/lib/admin-convite-grupos';

export function EnviarConviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [grupo, setGrupo] = useState<InviteGrupoRole>('team');
  const [cargo, setCargo] = useState<InviteCargo>('analista');
  const [funisMarcados, setFunisMarcados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([...FUNIS_KANBAN_NOMES].map((n) => [n, true])),
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mostrarFunis = useMemo(() => exibirFunisNoConvite(grupo, cargo), [grupo, cargo]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const em = email.trim().toLowerCase();
    if (!em || !em.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    setLoading(true);
    try {
      const funis_acesso = mostrarFunis
        ? FUNIS_KANBAN_NOMES.filter((n) => funisMarcados[n] !== false)
        : undefined;
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: em,
          grupo,
          cargo,
          funis_acesso,
          departamento: departamento.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const base = String(json?.error ?? 'Falha ao enviar convite.');
        const link =
          typeof json?.inviteLink === 'string' && json.inviteLink
            ? ` O convite foi guardado; podes copiar o link: ${json.inviteLink}`
            : '';
        setError(base + link);
        if (json?.inviteLink) router.refresh();
        return;
      }
      const link = typeof json?.inviteLink === 'string' ? json.inviteLink : '';
      const localLink = link && inviteLinkIsLocalhost(link);

      if (json?.emailSkipped) {
        let msg = `${String(json?.warning ?? 'E-mail não enviado pelo Resend.')} Link para enviar manualmente: ${link}`;
        if (localLink) {
          msg +=
            ' ATENÇÃO: este link usa localhost — o convidado não abre fora do teu PC. Na Vercel define NEXT_PUBLIC_APP_URL com o URL público (ex. https://teu-projeto.vercel.app), faz deploy e volta a enviar.';
        }
        setMessage(msg);
      } else {
        let msg = `Convite processado para ${em}. O convidado deve receber o e-mail com o link.`;
        if (json?.resendEmailId) {
          msg += ` ID no Resend: ${json.resendEmailId} — em resend.com/emails podes confirmar entrega ou falhas.`;
        }
        if (localLink) {
          msg += ` ATENÇÃO: o link no e-mail é localhost — não funciona para o convidado. Define NEXT_PUBLIC_APP_URL na Vercel com o domínio real, faz deploy e reenvia. Link gerado: ${link}`;
        } else if (link) {
          msg += ` Link: ${link}`;
        }
        setMessage(msg);
      }
      setEmail('');
      setDepartamento('');
      setGrupo('team');
      setCargo('analista');
      setFunisMarcados(Object.fromEntries([...FUNIS_KANBAN_NOMES].map((n) => [n, true])));
      router.refresh();
    } catch {
      setError('Erro de rede. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-moni-dark">Enviar convite (uma pessoa)</h2>
      <p className="mt-1 text-xs text-stone-600">
        E-mail no domínio permitido (ex.: @moni.casa). O convidado recebe o link para definir nome e senha. O grupo e o
        cargo ficam gravados no perfil (mesmo fluxo de <code className="rounded bg-stone-100 px-1">invite_token</code>
        ).
      </p>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 sm:col-span-2 lg:col-span-1">
            <label htmlFor="invite-email" className="block text-xs font-medium text-stone-600">
              E-mail
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@moni.casa"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              required
              autoComplete="off"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="invite-dept" className="block text-xs font-medium text-stone-600">
              Departamento
            </label>
            <input
              id="invite-dept"
              type="text"
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              placeholder="Opcional"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="invite-grupo" className="block text-xs font-medium text-stone-600">
              Grupo
            </label>
            <select
              id="invite-grupo"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value as InviteGrupoRole)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            >
              {GRUPO_CONVITE_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="invite-cargo" className="block text-xs font-medium text-stone-600">
              Cargo
            </label>
            <select
              id="invite-cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value as InviteCargo)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            >
              {CARGO_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mostrarFunis ? (
          <div className="rounded-md border border-stone-200 bg-stone-50/80 p-3">
            <p className="text-xs font-semibold text-stone-700">Funis com acesso (Time + Estagiário)</p>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Por agora todos aparecem marcados; ajuste conforme necessário antes de enviar.
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {[...FUNIS_KANBAN_NOMES].map((nome) => (
                <li key={nome}>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-800">
                    <input
                      type="checkbox"
                      checked={funisMarcados[nome] !== false}
                      onChange={(e) => setFunisMarcados((m) => ({ ...m, [nome]: e.target.checked }))}
                      className="h-4 w-4 rounded border-stone-400"
                    />
                    {nome}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <button type="submit" disabled={loading} className="btn-primary text-sm disabled:opacity-60">
            {loading ? 'Enviando…' : 'Enviar convite'}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-2 text-sm text-green-800">{message}</p>}
    </div>
  );
}
