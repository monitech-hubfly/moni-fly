'use client';

import { listarUsuariosParaMencao } from '@/lib/actions/kanban-comentarios';

type UsuarioMencao = { id: string; nome: string };

let cachePadrao: UsuarioMencao[] | null = null;
let inflightPadrao: Promise<UsuarioMencao[]> | null = null;

export function peekUsuariosMencaoPadrao(): UsuarioMencao[] | null {
  return cachePadrao;
}

export function obterUsuariosMencaoPadrao(): Promise<UsuarioMencao[]> {
  if (cachePadrao) return Promise.resolve(cachePadrao);
  if (!inflightPadrao) {
    inflightPadrao = listarUsuariosParaMencao()
      .then((list) => {
        cachePadrao = list;
        inflightPadrao = null;
        return list;
      })
      .catch((err) => {
        inflightPadrao = null;
        throw err;
      });
  }
  return inflightPadrao;
}
