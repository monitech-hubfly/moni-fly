'use client';

import { useEffect, useState } from 'react';
import { listarRespostasDoFranqueado } from '@/lib/actions/formulario-actions';
import { FORMULARIO_IDS } from '@/lib/constants/formularios-ids';
import type { FormularioRespostaListaItem } from '@/types/formularios';
import { GerarLinkFormularioButton } from './GerarLinkFormularioButton';
import { RespostasFormularioLista } from './RespostasFormularioLista';

export function FranqueadoFormulariosPainel({
  redeFranqueadoId,
  podeGerar,
}: {
  redeFranqueadoId: string;
  podeGerar: boolean;
}) {
  const [respostas, setRespostas] = useState<FormularioRespostaListaItem[]>([]);

  useEffect(() => {
    let ativo = true;
    void listarRespostasDoFranqueado(redeFranqueadoId).then((res) => {
      if (!ativo) return;
      setRespostas(res);
    });
    return () => {
      ativo = false;
    };
  }, [redeFranqueadoId]);

  return (
    <div className="space-y-4">
      {podeGerar ? (
        <GerarLinkFormularioButton
          formularioId={FORMULARIO_IDS.CHECKLIST_CREDITO_PRELIMINAR}
          redeFranqueadoId={redeFranqueadoId}
          rotulo="Gerar link do formulário de crédito"
        />
      ) : null}
      <RespostasFormularioLista respostas={respostas} />
    </div>
  );
}
