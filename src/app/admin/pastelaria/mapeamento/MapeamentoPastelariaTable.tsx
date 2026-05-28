'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  desvincularAreaPessoaFormAction,
  vincularAreaPessoaFormAction,
} from './actions';

export type MapeamentoPessoaRow = {
  areaPessoaId: string;
  nome: string;
  areaNome: string;
  vinculoUserId: string | null;
  vinculoEmail: string | null;
  vinculoFullName: string | null;
};

export type MapeamentoUsuarioOption = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string;
  linkedAreaPessoaId: string | null;
};

function labelUsuario(u: MapeamentoUsuarioOption): string {
  const nome = u.fullName?.trim() || u.email?.trim() || u.id.slice(0, 8);
  const email = u.email?.trim();
  return email && email !== nome ? `${nome} (${email})` : nome;
}

export function MapeamentoPastelariaTable({
  rows,
  usuarios,
}: {
  rows: MapeamentoPessoaRow[];
  usuarios: MapeamentoUsuarioOption[];
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [selectedUserByPessoa, setSelectedUserByPessoa] = useState<Record<string, string>>({});

  const usuariosPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMessage({ type: 'ok', text: 'Salvo.' });
      } else {
        setMessage({ type: 'err', text: res.error ?? 'Erro ao salvar.' });
      }
    });
  };

  return (
    <div>
      {message ? (
        <p
          className={`mb-3 text-sm ${message.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <div className="overflow-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Área</th>
              <th className="px-3 py-2">Usuário vinculado</th>
              <th className="px-3 py-2 w-64">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-stone-500">
                  Nenhuma pessoa ativa em area_pessoas.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const selectValue =
                  selectedUserByPessoa[row.areaPessoaId] ??
                  row.vinculoUserId ??
                  '';
                const vinculado =
                  row.vinculoUserId != null
                    ? usuariosPorId.get(row.vinculoUserId)
                    : null;

                return (
                  <tr key={row.areaPessoaId} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-medium text-stone-900">{row.nome}</td>
                    <td className="px-3 py-2 text-stone-700">{row.areaNome}</td>
                    <td className="px-3 py-2 text-stone-700">
                      {row.vinculoUserId ? (
                        <span>
                          {row.vinculoEmail ?? '—'}
                          {row.vinculoFullName ? (
                            <span className="block text-xs text-stone-500">{row.vinculoFullName}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="min-w-[12rem] max-w-full rounded border border-stone-200 px-2 py-1 text-xs"
                          disabled={pending}
                          value={selectValue}
                          onChange={(e) =>
                            setSelectedUserByPessoa((prev) => ({
                              ...prev,
                              [row.areaPessoaId]: e.target.value,
                            }))
                          }
                          aria-label={`Usuário para ${row.nome}`}
                        >
                          <option value="">Selecionar usuário…</option>
                          {usuarios.map((u) => {
                            const ocupado =
                              u.linkedAreaPessoaId != null &&
                              u.linkedAreaPessoaId !== row.areaPessoaId;
                            return (
                              <option key={u.id} value={u.id} disabled={ocupado}>
                                {labelUsuario(u)}
                                {ocupado ? ' (já vinculado)' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          type="button"
                          className="rounded bg-moni-primary px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                          disabled={pending || !selectValue}
                          onClick={() => {
                            const fd = new FormData();
                            fd.set('areaPessoaId', row.areaPessoaId);
                            fd.set('userId', selectValue);
                            run(() => vincularAreaPessoaFormAction(null, fd));
                          }}
                        >
                          Vincular
                        </button>
                        {row.vinculoUserId ? (
                          <button
                            type="button"
                            className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 disabled:opacity-50"
                            disabled={pending}
                            onClick={() => {
                              const fd = new FormData();
                              fd.set('areaPessoaId', row.areaPessoaId);
                              run(() => desvincularAreaPessoaFormAction(null, fd));
                            }}
                          >
                            Desvincular
                          </button>
                        ) : null}
                      </div>
                      {vinculado && vinculado.linkedAreaPessoaId === row.areaPessoaId ? (
                        <p className="mt-1 text-[10px] text-stone-400">
                          Papel: {vinculado.role}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
