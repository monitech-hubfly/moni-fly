import { useEffect, useState } from 'react';

/** Paginação client-side: mantém a página após refresh/save; reseta só quando `resetKey` muda (ex.: busca). */
export function usePaginaTabela(totalItens: number, perPage: number, resetKey = '') {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalItens / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  return { page: safePage, setPage, totalPages, start };
}
