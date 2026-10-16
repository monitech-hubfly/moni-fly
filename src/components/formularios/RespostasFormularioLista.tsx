import Link from 'next/link';
import { labelDoStatus } from '@/lib/formularios/apresentacao';
import type { FormularioRespostaListaItem } from '@/types/formularios';

function quando(iso: string | null): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR');
}

export function RespostasFormularioLista({
  respostas,
  compacto = false,
  vazio = 'Nenhuma resposta ainda.',
}: {
  respostas: FormularioRespostaListaItem[];
  compacto?: boolean;
  vazio?: string;
}) {
  if (respostas.length === 0) {
    return (
      <p className={compacto ? 'text-[10px]' : 'text-sm'} style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
        {vazio}
      </p>
    );
  }
  return (
    <ul className={compacto ? 'space-y-2' : 'space-y-3'}>
      {respostas.map((resposta) => {
        const vinculo = [
          resposta.nome_franqueado,
          resposta.numero_franquia ? `FK ${resposta.numero_franquia}` : null,
          resposta.card_id ? 'Card' : null,
          resposta.rede_franqueado_id ? 'Franqueado' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <li
            key={resposta.id}
            className="p-3"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-md)',
              background: 'var(--moni-surface-0)',
            }}
          >
            <p className={compacto ? 'text-[11px] font-medium' : 'text-sm font-medium'} style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
              {resposta.formulario_nome}
            </p>
            <p className={compacto ? 'text-[10px]' : 'text-xs'} style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              {labelDoStatus(resposta.status)} · {quando(resposta.enviado_em ?? resposta.criado_em)}
            </p>
            {vinculo ? (
              <p className={compacto ? 'text-[10px]' : 'text-xs'} style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
                {vinculo}
              </p>
            ) : null}
            <Link
              href={`/formularios/${resposta.formulario_id}/${resposta.id}`}
              className={compacto ? 'mt-1 inline-block text-[10px] underline' : 'mt-2 inline-block text-sm underline'}
              style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
            >
              Ver detalhe
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default RespostasFormularioLista;
