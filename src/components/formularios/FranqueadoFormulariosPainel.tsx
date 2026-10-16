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
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void listarRespostasDoFranqueado(redeFranqueadoId).then((res) => {
      if (!ativo) return;
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setRespostas(res.respostas);
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
      {erro ? (
        <p className="text-sm" style={{ color: 'var(--moni-status-overdue-text)', fontFamily: 'var(--moni-font-sans)' }}>
          {erro}
        </p>
      ) : (
        <RespostasFormularioLista respostas={respostas} />
      )}
    </div>
  );
}
