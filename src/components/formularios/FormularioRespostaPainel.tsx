'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { carregarLeituraResposta, type LeituraFormularioResposta } from '@/lib/actions/formulario-leitura';
import { labelDoStatus } from '@/lib/formularios/apresentacao';
import { FormularioRespostaCorpo } from './FormularioRespostaCorpo';

function classeDoStatus(status: string): string {
  if (status === 'enviado') return 'moni-tag-concluido';
  if (status === 'em_preenchimento') return 'moni-tag-atencao';
  return 'moni-tag-arquivado';
}

export function FormularioRespostaPainel({
  respostaId,
  onVoltar,
}: {
  respostaId: string;
  onVoltar: () => void;
}) {
  const [leitura, setLeitura] = useState<LeituraFormularioResposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setLeitura(null);
    setErro(null);
    void carregarLeituraResposta(respostaId)
      .then((res) => {
        if (!ativo) return;
        if (!res) setErro('Não foi possível abrir esta resposta.');
        else setLeitura(res);
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível abrir esta resposta.');
      });
    return () => {
      ativo = false;
    };
  }, [respostaId]);

  const quando = leitura?.resposta.enviado_em
    ? new Date(leitura.resposta.enviado_em).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onVoltar}
        className="mb-4 inline-flex min-h-11 w-fit items-center gap-1.5 px-3 text-xs font-semibold"
        style={{
          borderRadius: 'var(--moni-radius-md)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
          color: 'var(--moni-text-primary)',
          fontFamily: 'var(--moni-font-sans)',
          boxShadow: 'var(--moni-shadow-sm)',
        }}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Voltar
      </button>
      {erro ? (
        <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {erro}
        </p>
      ) : !leitura ? (
        <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
          Carregando respostas…
        </p>
      ) : (
        <div className="min-h-0 flex-1">
          <header className="mb-3">
            {leitura.categoria ? (
              <p
                className="text-[11px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
              >
                {leitura.categoria}
              </p>
            ) : null}
            <h3
              className="mt-1 text-sm font-semibold leading-tight"
              style={{ fontFamily: 'var(--moni-font-sans)', color: 'var(--moni-text-secondary)' }}
            >
              {leitura.formularioNome || 'Formulário'}
            </h3>
            <div
              className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
              style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
            >
              <span className={classeDoStatus(leitura.resposta.status)}>{labelDoStatus(leitura.resposta.status)}</span>
              {leitura.resposta.nome_franqueado ? <span>{leitura.resposta.nome_franqueado}</span> : null}
              {quando ? <span>Enviado em {quando}</span> : null}
            </div>
          </header>
          <FormularioRespostaCorpo secoes={leitura.secoes} dados={leitura.resposta.dados} compacto />
        </div>
      )}
    </div>
  );
}
