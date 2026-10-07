'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { atualizarClassificacaoFormulario } from '@/lib/actions/formulario-actions';
import { ClassificacaoHubBarra } from '@/components/shared/ClassificacaoHubBarra';
import type { CategoriaHub } from '@/lib/constants/categorias-hub';

export function FormularioClassificacaoBarra({
  formularioId,
  categoria,
  visivelFranqueado,
}: {
  formularioId: string;
  categoria: CategoriaHub | null;
  visivelFranqueado: boolean;
}) {
  const router = useRouter();
  const [categoriaLocal, setCategoriaLocal] = useState(categoria ?? '');
  const [visivel, setVisivel] = useState(visivelFranqueado);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(proximaCategoria: string, proximaVisivel: boolean) {
    setErro(null);
    const res = await atualizarClassificacaoFormulario(formularioId, proximaCategoria, proximaVisivel);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <ClassificacaoHubBarra
        categoria={categoriaLocal}
        visivelFranqueado={visivel}
        onCategoria={(valor) => {
          setCategoriaLocal(valor);
          void salvar(valor, visivel);
        }}
        onVisivel={(valor) => {
          setVisivel(valor);
          void salvar(categoriaLocal, valor);
        }}
      />
      {erro ? (
        <p className="text-xs" style={{ color: 'var(--moni-status-overdue-text)', fontFamily: 'var(--moni-font-sans)' }}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}
