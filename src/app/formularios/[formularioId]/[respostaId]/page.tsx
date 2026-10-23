import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buscarRespostaDetalhada } from '@/lib/actions/formulario-actions';
import { corDoStatus, formatarValorCampo, labelDoStatus } from '@/lib/formularios/apresentacao';
import { opcoesParaLista } from '@/lib/formularios/apresentacao';
import type { FormularioCampo, FormularioCampoTipo, FormularioSecao } from '@/types/formularios';

interface Props {
  params: Promise<{ formularioId: string; respostaId: string }>;
}

export const dynamic = 'force-dynamic';

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

  const { data: secoes } = await supabase
    .from('formulario_secoes')
    .select('id, nome, ordem, condicional_campo_id, condicional_valor')
    .eq('formulario_id', formularioId)
    .order('ordem');

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

  return (
    <div className="min-h-0 bg-[var(--moni-surface-50)]">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={`/formularios/${formularioId}`}
          className="text-sm"
          style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        >
          ← Respostas
        </Link>
        <div className="mt-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl" style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}>
              {resposta.nome_franqueado ?? 'Sem identificação'}
            </h1>
            <span
              className="rounded px-2 py-0.5 text-sm"
              style={{
                color: corDoStatus(resposta.status),
                border: 'var(--moni-border-width) solid var(--moni-border-default)',
                fontFamily: 'var(--moni-font-sans)',
              }}
            >
              {labelDoStatus(resposta.status)}
            </span>
          </div>
          {resposta.numero_franquia ? (
            <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              FK{resposta.numero_franquia}
            </p>
          ) : null}
          {resposta.enviado_em ? (
            <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
              Enviado em {new Date(resposta.enviado_em).toLocaleDateString('pt-BR')}
            </p>
          ) : null}
        </div>
        <div className="space-y-8">
          {secoesParaMostrar.map((secao) => {
            const campos = secao.campos;
            return (
              <div key={secao.id}>
                <h2
                  className="mb-3 border-b pb-1 text-base"
                  style={{
                    color: 'var(--moni-navy-800)',
                    borderColor: 'var(--moni-border-default)',
                    fontFamily: 'var(--moni-font-display)',
                  }}
                >
                  {secao.titulo}
                </h2>
                <dl className="space-y-4">
                  {campos.map((campo) => {
                    const rv = resposta.dados[campo.id];
                    const valorFormatado = formatarValorCampo(campo, rv?.valor);
                    return (
                      <div key={campo.id} className="space-y-1">
                        <dt className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
                          {campo.label}
                        </dt>
                        <dd
                          className="whitespace-pre-wrap text-sm font-medium"
                          style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
                        >
                          {campo.tipo === 'arquivo_multiplo' || campo.tipo === 'link_ou_arquivo' ? (
                            <div className="space-y-1">
                              {rv?.arquivos?.length
                                ? rv.arquivos.map((arq, i) => (
                                    <a
                                      key={i}
                                      href={arq.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block truncate underline"
                                      style={{ color: 'var(--moni-green-800)' }}
                                    >
                                      {arq.nome}
                                    </a>
                                  ))
                                : '—'}
                              {rv?.valor && campo.tipo === 'link_ou_arquivo' ? (
                                <a
                                  href={String(rv.valor)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block truncate underline"
                                  style={{ color: 'var(--moni-green-800)' }}
                                >
                                  {String(rv.valor)}
                                </a>
                              ) : null}
                            </div>
                          ) : (
                            valorFormatado
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
