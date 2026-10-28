import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buscarRespostaDetalhada } from '@/lib/actions/formulario-actions';
import { formatarValorCampo, labelDoStatus, linhasDoGrupo, normalizarCondicional, opcoesParaLista } from '@/lib/formularios/apresentacao';
import type { FormularioCampo, FormularioCampoTipo, FormularioResposta, FormularioSecao } from '@/types/formularios';

interface Props {
  params: Promise<{ formularioId: string; respostaId: string }>;
}

export const dynamic = 'force-dynamic';

function classeDoStatus(status: string): string {
  if (status === 'enviado') return 'moni-tag-concluido';
  if (status === 'em_preenchimento') return 'moni-tag-atencao';
  return 'moni-tag-arquivado';
}

function campoEhLongo(tipo: FormularioCampoTipo): boolean {
  return tipo === 'texto_longo' || tipo === 'grupo_repetivel' || tipo === 'arquivo_multiplo' || tipo === 'link_ou_arquivo';
}

function textoDaResposta(secoes: FormularioSecao[], dados: FormularioResposta['dados'], teste: (label: string) => boolean): string | null {
  for (const secao of secoes) {
    for (const campo of secao.campos) {
      if (!teste(normalizarCondicional(campo.label))) continue;
      const texto = formatarValorCampo(campo, dados[campo.id]?.valor).trim();
      if (texto && texto !== '—') return texto;
    }
  }
  return null;
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
                  <p className="mb-3 text-base" style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}>
                    {bloco.titulo}
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

function RespostaCampo({ campo, dados }: { campo: FormularioCampo; dados: FormularioResposta['dados'] }) {
  const rv = dados[campo.id];
  if (campo.tipo === 'grupo_repetivel') {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          {campo.label}
        </p>
        <GrupoRepetivelLeitura campo={campo} valor={rv?.valor} />
      </div>
    );
  }
  const valorFormatado = formatarValorCampo(campo, rv?.valor);
  const temArquivo = Boolean(rv?.arquivos?.length);
  const temLink = campo.tipo === 'link_ou_arquivo' && Boolean(rv?.valor);
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
        {campo.tipo === 'arquivo_multiplo' || campo.tipo === 'link_ou_arquivo' ? (
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
              : vazio
                ? '—'
                : null}
            {temLink ? (
              <a
                href={String(rv?.valor)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center break-all underline"
                style={{ color: 'var(--moni-green-800)' }}
              >
                {String(rv?.valor)}
              </a>
            ) : null}
          </div>
        ) : (
          valorFormatado
        )}
      </dd>
    </div>
  );
}

const TIPOS: FormularioCampoTipo[] = [
  'texto',
  'texto_curto',
  'texto_longo',
  'email',
  'telefone',
  'moeda',
  'numero',
  'data',
  'link',
  'select',
  'select_estado',
  'select_cidade',
  'checkbox',
  'arquivo_multiplo',
  'link_ou_arquivo',
  'grupo_repetivel',
];

export default async function RespostaDetalhadaPage({ params }: Props) {
  const { formularioId, respostaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role === 'frank' || profile?.role === 'franqueado') redirect('/portal-frank');

  const resposta = await buscarRespostaDetalhada(respostaId);
  if (!resposta) redirect(`/formularios/${formularioId}`);

  const [{ data: formulario }, { data: secoes }] = await Promise.all([
    supabase.from('formularios').select('nome, categoria').eq('id', formularioId).maybeSingle(),
    supabase
      .from('formulario_secoes')
      .select('id, nome, ordem, condicional_campo_id, condicional_valor')
      .eq('formulario_id', formularioId)
      .order('ordem'),
  ]);

  const secaoIds = (secoes ?? []).map((secao) => String((secao as { id: string }).id));
  const camposPorSecao = new Map<string, FormularioCampo[]>();
  if (secaoIds.length > 0) {
    const selectComConfig =
      'id, secao_id, nome, tipo, ordem, opcoes, config, condicional_campo_id, condicional_valor';
    const selectSemConfig =
      'id, secao_id, nome, tipo, ordem, opcoes, condicional_campo_id, condicional_valor';
    const comConfig = await supabase.from('formulario_campos').select(selectComConfig).in('secao_id', secaoIds);
    const fallback =
      comConfig.error && /config/i.test(comConfig.error.message)
        ? await supabase.from('formulario_campos').select(selectSemConfig).in('secao_id', secaoIds)
        : null;
    const camposRows = fallback
      ? (fallback.data ?? []).map((campo) => ({ ...campo, config: null }))
      : (comConfig.data ?? []);
    for (const campo of camposRows) {
      const row = campo as Record<string, unknown>;
      const secaoId = String(row.secao_id ?? '');
      const tipoRaw = String(row.tipo ?? 'texto');
      const item: FormularioCampo = {
        id: String(row.id),
        secao_id: secaoId,
        label: String(row.nome ?? ''),
        tipo: TIPOS.includes(tipoRaw as FormularioCampoTipo) ? (tipoRaw as FormularioCampoTipo) : 'texto',
        obrigatorio: false,
        ordem: Number(row.ordem ?? 0),
        placeholder: null,
        descricao: null,
        opcoes: opcoesParaLista(row.opcoes),
        config: (row.config as FormularioCampo['config']) ?? null,
        condicional_campo_id: (row.condicional_campo_id as string | null) ?? null,
        condicional_valor: (row.condicional_valor as string | null) ?? null,
        ativo: true,
      };
      const lista = camposPorSecao.get(secaoId) ?? [];
      lista.push(item);
      camposPorSecao.set(secaoId, lista);
    }
  }

  const secoesParaMostrar: FormularioSecao[] = (secoes ?? []).map((secao) => {
    const row = secao as {
      id: string;
      nome: string;
      ordem: number;
      condicional_campo_id: string | null;
      condicional_valor: string | null;
    };
    const campos = (camposPorSecao.get(row.id) ?? []).sort((a, b) => a.ordem - b.ordem);
    return {
      id: row.id,
      formulario_id: formularioId,
      titulo: row.nome,
      descricao: null,
      ordem: row.ordem,
      condicional_campo_id: row.condicional_campo_id,
      condicional_valor: row.condicional_valor,
      campos,
    };
  });

  const nome =
    resposta.nome_franqueado?.trim() ||
    textoDaResposta(secoesParaMostrar, resposta.dados, (label) => label.includes('nome completo')) ||
    'Sem identificação';
  const cidade = textoDaResposta(
    secoesParaMostrar,
    resposta.dados,
    (label) => label.includes('cidade') && label.includes('reside'),
  );
  const estado = textoDaResposta(
    secoesParaMostrar,
    resposta.dados,
    (label) => label.includes('estado') && label.includes('reside'),
  );
  const local = [cidade, estado].filter(Boolean).join(' · ');
  const categoria = String(formulario?.categoria ?? '').trim();
  const quando = resposta.enviado_em
    ? new Date(resposta.enviado_em).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
    : null;

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Link
          href={`/formularios/${formularioId}`}
          className="inline-flex min-h-11 items-center text-sm"
          style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          ← Respostas
        </Link>
        <header className="mt-4 mb-8">
          {categoria ? (
            <p
              className="text-xs uppercase tracking-[0.14em]"
              style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}
            >
              {categoria}
            </p>
          ) : null}
          <h1
            className="mt-2 text-4xl leading-tight"
            style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
          >
            {nome}
          </h1>
          {formulario?.nome ? (
            <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              {formulario.nome}
            </p>
          ) : null}
          <div
            className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
            style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
          >
            <span className={classeDoStatus(resposta.status)}>{labelDoStatus(resposta.status)}</span>
            {local ? <span>{local}</span> : null}
            {resposta.numero_franquia ? <span>Franquia {resposta.numero_franquia}</span> : null}
            {quando ? <span>Enviado em {quando}</span> : null}
          </div>
        </header>
        <div className="space-y-5">
          {secoesParaMostrar.map((secao) => (
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
                {secao.campos.map((campo) => (
                  <div
                    key={campo.id}
                    className={`px-5 py-4 ${campoEhLongo(campo.tipo) ? 'sm:col-span-2' : ''}`}
                    style={{ borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' }}
                  >
                    <RespostaCampo campo={campo} dados={resposta.dados} />
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
