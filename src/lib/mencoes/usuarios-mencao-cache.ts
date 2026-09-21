'use client';

import { listarUsuariosParaMencao } from '@/lib/actions/kanban-comentarios';

type UsuarioMencao = { id: string; nome: string };

let cachePadrao: UsuarioMencao[] | null = null;
let inflightPadrao: Promise<UsuarioMencao[]> | null = null;

export function peekUsuariosMencaoPadrao(): UsuarioMencao[] | null {
  return cachePadrao;
}

export function obterUsuariosMencaoPadrao(): Promise<UsuarioMencao[]> {
  // Usa !== null para diferenciar "ainda não carregado" (null) de "carregado mas vazio" ([]).
  // Listas vazias são cacheadas normalmente — se o servidor retornar [] é resultado válido.
  if (cachePadrao !== null) return Promise.resolve(cachePadrao);
  if (!inflightPadrao) {
    inflightPadrao = listarUsuariosParaMencao()
      .then((list) => {
        cachePadrao = list;
        inflightPadrao = null;
        return list;
      })
      .catch((err) => {
        // Em caso de erro não cacheia: próxima chamada tenta de novo
        inflightPadrao = null;
        throw err;
      });
  }
  return inflightPadrao;
}

/** Invalida o cache (use quando o usuário precisar recarregar a lista). */
export function invalidarCacheUsuariosMencao(): void {
  cachePadrao = null;
  inflightPadrao = null;
}
