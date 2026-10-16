'use client';

import { useEffect, useState } from 'react';
import { listarFormulariosVisivelFranqueado, listarRespostasDoFranqueado } from '@/lib/actions/formulario-actions';
import { FORMULARIO_IDS } from '@/lib/constants/formularios-ids';
import type { Formulario, FormularioRespostaListaItem } from '@/types/formularios';
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
  const [formularios, setFormularios] = useState<Formulario[]>([]);

  useEffect(() => {
    let ativo = true;
    void listarRespostasDoFranqueado(redeFranqueadoId).then((res) => {
      if (!ativo) return;
      setRespostas(res);
    });
    if (!podeGerar) {
      void listarFormulariosVisivelFranqueado().then((lista) => {
        if (!ativo) return;
        setFormularios(lista);
      });
    }
    return () => {
      ativo = false;
    };
  }, [redeFranqueadoId, podeGerar]);

  return (
    <div className="space-y-4">
      {!podeGerar && formularios.length > 0 ? (
        <ul className="space-y-2">
          {formularios.map((formulario) => (
            <li key={formulario.id} className="text-sm" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
              <span className="font-medium">{formulario.nome}</span>
              {formulario.categoria ? (
                <span className="ml-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {formulario.categoria}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
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
