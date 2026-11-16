import { Fragment } from 'react';
import { camposVisiveis, formatarValorCampo, linhasDoGrupo } from '@/lib/formularios/apresentacao';
import type { FormularioCampo, FormularioCampoTipo, FormularioResposta, FormularioSecao } from '@/types/formularios';

function campoEhLongo(tipo: FormularioCampoTipo): boolean {
  return tipo === 'texto_longo' || tipo === 'grupo_repetivel' || tipo === 'arquivo_multiplo' || tipo === 'link_ou_arquivo';
}

function GrupoRepetivelLeitura({ campo, valor }: { campo: FormularioCampo; valor: string | string[] | null | undefined }) {
  const linhas = linhasDoGrupo(campo, valor);
  if (!linhas) {
    return (
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
        {String(valor)}
      </p>
    );
  }
  if (linhas.length === 0) {
    return <p style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>—</p>;
  }
  return (
    <div className="space-y-3">
      {linhas.map((linha, index) => (
        <article
          key={`${linha.titulo}-${index}`}
          className="px-4 py-4"
          style={{
            background: 'var(--moni-surface-100)',
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-md)',
          }}
        >
          <p className="text-xs uppercase tracking-[0.12em]" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
            Condomínio {index + 1}
          </p>
          <h3 className="mt-1 text-xl leading-tight" style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}>
            {linha.titulo}
          </h3>
          <div className="mt-4 space-y-4">
            {linha.blocos.map((bloco, blocoIndex) => (
              <div
                key={`${bloco.titulo ?? 'campos'}-${blocoIndex}`}
                className={blocoIndex > 0 ? 'pt-4' : undefined}
                style={blocoIndex > 0 ? { borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' } : undefined}
              >
                {bloco.titulo ? (
                  <p className={bloco.subtitulo ? 'text-base' : 'mb-3 text-base'} style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}>
                    {bloco.titulo}
                  </p>
                ) : null}
                {bloco.subtitulo ? (
                  <p className="mb-3 mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                    {bloco.subtitulo}
                  </p>
                ) : null}
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {bloco.itens.map((item) => (
                    <div key={item.label} className={item.largo ? 'sm:col-span-2' : ''}>
                      <dt className="text-xs leading-snug" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
                        {item.label}
                      </dt>
                      <dd className="mt-1 text-[15px] leading-relaxed" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}>
                        {item.valor}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function partesDeAnexo(valor: string | string[] | null | undefined): { links: string[]; texto: string } {
  const bruto = Array.isArray(valor) ? valor.filter(Boolean).join('\n') : String(valor ?? '');
  const links = bruto.match(/https?:\/\/[^\s<>"]+/g) ?? [];
  const texto = bruto
    .replace(/https?:\/\/[^\s<>"]+/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { links, texto };
}

function RespostaCampo({ campo, dados }: { campo: FormularioCampo; dados: FormularioResposta['dados'] }) {
  const rv = dados[campo.id];
  if (campo.tipo === 'grupo_repetivel') {
    return (
      <div className="space-y-4">
        <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {campo.label}
        </p>
        <GrupoRepetivelLeitura campo={campo} valor={rv?.valor} />
      </div>
    );
  }
  const valorFormatado = formatarValorCampo(campo, rv?.valor);
  const anexo = campo.tipo === 'arquivo_multiplo' || campo.tipo === 'link_ou_arquivo' ? partesDeAnexo(rv?.valor) : null;
  const temArquivo = Boolean(rv?.arquivos?.length);
  const temLink = Boolean(anexo && (anexo.links.length > 0 || anexo.texto));
  const vazio = !temArquivo && !temLink && (!valorFormatado || valorFormatado === '—');

  return (
    <div className="space-y-1">
      <dt className="text-xs leading-snug" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
        {campo.label}
      </dt>
      <dd
        className="whitespace-pre-wrap text-[15px] leading-relaxed"
        style={{
          color: vazio ? 'var(--moni-text-tertiary)' : 'var(--moni-text-primary)',
          fontFamily: 'var(--moni-font-sans)',
        }}
      >
        {anexo ? (
          <div className="space-y-1">
            {temArquivo
              ? rv?.arquivos?.map((arq, i) => (
                  <a
                    key={i}
                    href={arq.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center underline"
                    style={{ color: 'var(--moni-green-800)' }}
                  >
                    {arq.nome}
                  </a>
                ))
              : null}
            {anexo.links.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center break-all underline"
                style={{ color: 'var(--moni-green-800)' }}
              >
                {url}
              </a>
            ))}
            {anexo.texto ? <span className="block whitespace-pre-wrap">{anexo.texto}</span> : null}
            {vazio ? '—' : null}
          </div>
        ) : (
          valorFormatado
        )}
      </dd>
    </div>
  );
}

function campoTemResposta(campo: FormularioCampo, dados: FormularioResposta['dados']): boolean {
  const valor = dados[campo.id];
  if (valor?.arquivos?.length) return true;
  const texto = formatarValorCampo(campo, valor?.valor).trim();
  return Boolean(texto && texto !== '—');
}

export function FormularioRespostaCorpo({
  secoes,
  dados,
  somentePreenchidos = false,
}: {
  secoes: FormularioSecao[];
  dados: FormularioResposta['dados'];
  somentePreenchidos?: boolean;
}) {
  const blocos = secoes
    .map((secao) => {
      const campos = camposVisiveis(secao.campos, dados).filter((campo) =>
        somentePreenchidos ? campoTemResposta(campo, dados) : true,
      );
      return { secao, campos };
    })
    .filter((bloco) => !somentePreenchidos || bloco.campos.length > 0);

  return (
    <div className="space-y-5">
      {blocos.map(({ secao, campos }) => (
        <section
          key={secao.id}
          style={{
            background: 'var(--moni-surface-0)',
            border: 'var(--moni-border-width) solid var(--moni-border-default)',
            borderRadius: 'var(--moni-radius-lg)',
            boxShadow: 'var(--moni-shadow-card)',
          }}
        >
          <h2
            className="px-5 pb-1 pt-4 text-lg"
            style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
          >
            {secao.titulo}
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2">
            {campos.map((campo, index, lista) => {
              const grupo = campo.config?.grupo?.trim() || null;
              const grupoAnterior = index > 0 ? lista[index - 1]?.config?.grupo?.trim() || null : null;
              return (
                <Fragment key={campo.id}>
                  {grupo && grupo !== grupoAnterior ? (
                    <div
                      className="px-5 py-3 sm:col-span-2"
                      style={{ borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' }}
                    >
                      <p className="text-base" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}>
                        {grupo}
                      </p>
                    </div>
                  ) : null}
                  <div
                    className={`px-5 py-4 ${campoEhLongo(campo.tipo) ? 'sm:col-span-2' : ''}`}
                    style={{ borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' }}
                  >
                    <RespostaCampo campo={campo} dados={dados} />
                  </div>
                </Fragment>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
