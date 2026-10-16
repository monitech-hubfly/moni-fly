'use client';

import { useState } from 'react';
import { CategoriaHubSelect } from '@/components/shared/CategoriaHubSelect';
import { VisualizacaoFranqueadoToggle } from '@/components/shared/VisualizacaoFranqueadoToggle';

export function ClassificacaoHubBarra({
  categoria,
  visivelFranqueado,
  onCategoria,
  onVisivel,
  disabled,
  comInputs = false,
}: {
  categoria: string;
  visivelFranqueado: boolean;
  onCategoria: (valor: string) => void;
  onVisivel: (valor: boolean) => void;
  disabled?: boolean;
  comInputs?: boolean;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <CategoriaHubSelect
        name={comInputs ? 'categoria' : undefined}
        value={categoria || null}
        onChange={(valor) => onCategoria(valor ?? '')}
        disabled={disabled}
        className="min-w-0 flex-1"
      />
      {comInputs ? <input type="hidden" name="visivel_franqueado" value={visivelFranqueado ? '1' : '0'} /> : null}
      <VisualizacaoFranqueadoToggle value={visivelFranqueado} onChange={onVisivel} disabled={disabled} />
    </div>
  );
}

export function ClassificacaoHubFormFields({
  categoriaInicial = '',
  visivelInicial = true,
}: {
  categoriaInicial?: string;
  visivelInicial?: boolean;
}) {
  const [categoria, setCategoria] = useState<string | null>(categoriaInicial || null);
  const [visivelFranqueado, setVisivelFranqueado] = useState(visivelInicial);
  return (
    <ClassificacaoHubBarra
      categoria={categoria ?? ''}
      visivelFranqueado={visivelFranqueado}
      onCategoria={(valor) => setCategoria(valor || null)}
      onVisivel={setVisivelFranqueado}
      comInputs
    />
  );
}
