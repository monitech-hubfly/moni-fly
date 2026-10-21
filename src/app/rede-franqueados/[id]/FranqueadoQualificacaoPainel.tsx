import type { ReactNode } from 'react';
import Link from 'next/link';
import type { FormularioQualificacaoRow } from '@/lib/actions/formulario-qualificacao';
import {
  formatarDataQualificacao,
  rotuloRespostaQualificacao,
} from '@/lib/formulario-qualificacao-labels';

type Props = {
  redeId: string;
  historico: FormularioQualificacaoRow[];
  loadError?: boolean;
  podeAbrirFormulario?: boolean;
};

const cardStyle = {
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-lg)',
  background: 'var(--moni-surface-0)',
  boxShadow: 'var(--moni-shadow-card)',
} as const;

function texto(valor: string | null | undefined): string {
  const v = String(valor ?? '').trim();
  return v || '—';
}

function classeResultado(tipo: string | null | undefined): string | null {
  if (tipo === 'qualificado') return 'moni-tag-concluido';
  if (tipo === 'parcial') return 'moni-tag-atencao';
  if (tipo === 'nao_qualificado') return 'moni-tag-atrasado';
  return null;
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt
        className="text-[11px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        {label}
      </dt>
      <dd
        className="mt-1 text-sm leading-snug"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        {valor}
      </dd>
    </div>
  );
}

function Grupo({
  titulo,
  children,
  largo,
}: {
  titulo: string;
  children: ReactNode;
  largo?: boolean;
}) {
  return (
    <section className={`p-5 ${largo ? 'sm:col-span-2' : ''}`} style={cardStyle}>
      <h2
        className="mb-4 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        {titulo}
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function BotaoFormulario({ redeId }: { redeId: string }) {
  return (
    <Link
      href={`/rede-franqueados/${redeId}/formulario-qualificacao`}
      className="inline-flex items-center justify-center rounded-lg px-4 text-sm font-medium text-white"
      style={{
        minHeight: 44,
        background: 'var(--moni-navy-800)',
        borderRadius: 'var(--moni-radius-md)',
        fontFamily: 'var(--moni-font-sans)',
      }}
    >
      Abrir formulário
    </Link>
  );
}

export function FranqueadoQualificacaoPainel({
  redeId,
  historico,
  loadError = false,
  podeAbrirFormulario = false,
}: Props) {
  if (loadError) {
    return (
      <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        Não foi possível carregar a qualificação deste franqueado.
      </p>
    );
  }

  const atual = historico[0] ?? null;
  const anteriores = historico.slice(1);

  if (!atual) {
    return (
      <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between" style={cardStyle}>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          Este franqueado ainda não enviou o formulário de qualificação.
        </p>
        {podeAbrirFormulario ? <BotaoFormulario redeId={redeId} /> : null}
      </div>
    );
  }

  const resultado = rotuloRespostaQualificacao('resultado_tipo', atual.resultado_tipo);
  const tagResultado = classeResultado(atual.resultado_tipo);
  const respondidoEm = formatarDataQualificacao(atual.criado_em);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
            Envio mais recente{respondidoEm ? ` em ${respondidoEm}` : ''}
          </p>
          {resultado && tagResultado ? <span className={tagResultado}>{resultado}</span> : null}
        </div>
        {podeAbrirFormulario ? <BotaoFormulario redeId={redeId} /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Grupo titulo="Atuação">
          <Campo label="Cidade" valor={texto(atual.cidade_atuacao)} />
          <Campo label="Estado" valor={texto(atual.estado_atuacao)} />
        </Grupo>

        <Grupo titulo="Capital">
          <Campo label="Faixa de capital" valor={texto(rotuloRespostaQualificacao('capital_faixa', atual.capital_faixa))} />
          <Campo label="Valor declarado" valor={texto(atual.capital_valor_declarado)} />
        </Grupo>

        <Grupo titulo="Conhecimento" largo>
          <Campo
            label="Mercado"
            valor={texto(rotuloRespostaQualificacao('conhecimento_mercado', atual.conhecimento_mercado))}
          />
          <Campo
            label="Experiência"
            valor={texto(rotuloRespostaQualificacao('conhecimento_imob', atual.conhecimento_imob))}
          />
          <Campo
            label="Processo Moní"
            valor={texto(rotuloRespostaQualificacao('conhecimento_moni', atual.conhecimento_moni))}
          />
        </Grupo>

        <Grupo titulo="Disponibilidade" largo>
          <Campo label="Horas por semana" valor={texto(rotuloRespostaQualificacao('tempo_horas', atual.tempo_horas))} />
          <Campo
            label="Tempo de resposta"
            valor={texto(rotuloRespostaQualificacao('tempo_resposta', atual.tempo_resposta))}
          />
          <Campo label="Agenda" valor={texto(rotuloRespostaQualificacao('tempo_agenda', atual.tempo_agenda))} />
          <Campo label="Workshops" valor={texto(rotuloRespostaQualificacao('workshops', atual.workshops))} />
        </Grupo>

        <Grupo titulo="Contexto" largo>
          <div className="sm:col-span-2">
            <Campo label="Comentário" valor={texto(atual.motivacao)} />
          </div>
        </Grupo>
      </div>

      {anteriores.length > 0 ? (
        <section className="p-5" style={cardStyle}>
          <h2
            className="mb-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
          >
            Envios anteriores
          </h2>
          <ul className="space-y-1">
            {anteriores.map((item) => (
              <li
                key={item.id}
                className="text-sm"
                style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
              >
                {formatarDataQualificacao(item.criado_em) || '—'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
