'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateUserCargoFormAction, updateUserRoleFormAction, type UpdatableRole } from './actions';
import type { InviteCargo } from '@/lib/admin-convite-grupos';
import { CARGO_OPCOES, GRUPO_CONVITE_OPCOES, labelGrupoPorRole } from '@/lib/admin-convite-grupos';

function isInviteGrupoRole(r: string): r is Exclude<UpdatableRole, 'pending' | 'blocked'> {
  return GRUPO_CONVITE_OPCOES.some((o) => o.value === r);
}

export function UsuarioGrupoEcargoCells({
  profileId,
  role,
  cargo,
}: {
  profileId: string;
  role: string;
  cargo: string | null;
}) {
  const [pending, start] = useTransition();
  const [r, setR] = useState(role);
  const [c, setC] = useState<InviteCargo>(
    cargo === 'adm' || cargo === 'analista' || cargo === 'estagiario' ? cargo : 'analista',
  );

  useEffect(() => {
    setR(role);
  }, [role]);

  useEffect(() => {
    setC(cargo === 'adm' || cargo === 'analista' || cargo === 'estagiario' ? cargo : 'analista');
  }, [cargo]);

  const grupoSelectValue: UpdatableRole | string =
    r === 'blocked' ? 'blocked' : isInviteGrupoRole(r) ? r : r;

  return (
    <>
      <td className="px-3 py-2">
        <select
          className="max-w-[11rem] rounded border border-stone-200 px-2 py-1 text-xs"
          disabled={pending}
          value={grupoSelectValue}
          onChange={(e) => {
            const next = e.target.value as UpdatableRole;
            start(async () => {
              await updateUserRoleFormAction(profileId, next, new FormData());
              setR(next);
            });
          }}
        >
          {!isInviteGrupoRole(r) && r !== 'blocked' ? (
            <option value={r}>{labelGrupoPorRole(r)}</option>
          ) : null}
          {GRUPO_CONVITE_OPCOES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
          <option value="blocked">Bloqueado</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          className="rounded border border-stone-200 px-2 py-1 text-xs"
          disabled={pending}
          value={c}
          onChange={(e) => {
            const next = e.target.value as InviteCargo;
            setC(next);
            start(async () => {
              await updateUserCargoFormAction(profileId, next, new FormData());
            });
          }}
        >
          {CARGO_OPCOES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
    </>
  );
}
