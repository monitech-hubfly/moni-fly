'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { atualizarClassificacaoFormulario } from '@/lib/actions/formulario-actions';
import { VisualizacaoFranqueadoToggle } from '@/components/shared/VisualizacaoFranqueadoToggle';
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
  const [visivel, setVisivel] = useState(visivelFranqueado);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(proximaVisivel: boolean) {
    setErro(null);
    const res = await atualizarClassificacaoFormulario(formularioId, categoria ?? '', proximaVisivel);
    if (!res.ok) {
      setErro(res.error);
      setVisivel(visivelFranqueado);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <VisualizacaoFranqueadoToggle
        size="xs"
        value={visivel}
        onChange={(valor) => {
          setVisivel(valor);
          void salvar(valor);
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
