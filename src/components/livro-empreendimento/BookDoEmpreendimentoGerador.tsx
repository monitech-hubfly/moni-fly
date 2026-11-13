'use client';

import { useCallback, useRef, useState } from 'react';
import { DocumentArrowDownIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { SearchableSelect } from '@/components/SearchableSelect';
import { DadosNegocioBookSecao } from '@/components/livro-empreendimento/DadosNegocioBookSecao';
import type { FunilLivroOpcao } from '@/app/apresentacoes/book-empreendimento/dados-negocio-actions';
import { CAMPOS_EXIBICAO_CONDOMINIO } from '@/lib/condominio-campos-exibicao';
import type { CondominioRow } from '@/lib/condominios';

const MODELOS_CASA = [
  { codigo: 'ALE',  nome: 'ALÊ',  area: '47,0 m²',    suites: 2, banheiros: 1, dimensoes: '3,50 × 12,00 m', preco: 'R$ 288.553,20' },
  { codigo: 'DUDA', nome: 'DUDA', area: '103,0 m²',   suites: 3, banheiros: 2, dimensoes: '9,00 × 13,00 m', preco: 'R$ 533.937,05' },
  { codigo: 'LU',   nome: 'LU',   area: '191,5 m²',   suites: 3, banheiros: 3, dimensoes: '12,20 × 19 m',   preco: 'R$ 1.151.798,00' },
  { codigo: 'ISA',  nome: 'ISA',  area: '237,1 m²',   suites: 3, banheiros: 4, dimensoes: '8 × 17 m',       preco: 'R$ 1.352.110,00' },
  { codigo: 'LIZ',  nome: 'LIZ',  area: '234,2 m²',   suites: 4, banheiros: 5, dimensoes: '10,5 × 21 m',   preco: 'R$ 1.687.745,00' },
  { codigo: 'VAL',  nome: 'VAL',  area: '360,5 m²',   suites: 4, banheiros: 4, dimensoes: '10 × 20 m',      preco: 'R$ 1.747.719,00' },
  { codigo: 'IVY',  nome: 'IVY',  area: '305,9 m²',   suites: 4, banheiros: 5, dimensoes: '10 × 17 m',      preco: 'R$ 1.925.960,00' },
  { codigo: 'EVA',  nome: 'EVA',  area: '369,6 m²',   suites: 4, banheiros: 5, dimensoes: '10 × 20 m',      preco: 'R$ 2.330.656,00' },
  { codigo: 'CISSA',nome: 'CISSA',area: '425,0 m²',   suites: 4, banheiros: 5, dimensoes: '11 × 35 m',      preco: 'R$ 2.408.889,00' },
  { codigo: 'SOL',  nome: 'SOL',  area: '339,6 m²',   suites: 4, banheiros: 5, dimensoes: '10 × 21 m',      preco: 'R$ 2.529.190,00' },
  { codigo: 'GAL',  nome: 'GAL',  area: '393,5 m²',   suites: 4, banheiros: 5, dimensoes: '11,60 × 20 m',   preco: 'R$ 2.639.884,00' },
  { codigo: 'LENA', nome: 'LENA', area: '708,3 m²',   suites: 6, banheiros: 8, dimensoes: '24 × 42 m',      preco: 'R$ 3.527.092,00' },
];

const CAMPOS_IMAGEM_CONDOMINIO = [
  { id: 'condominio-abertura', rotulo: 'Abertura' },
  { id: 'condominio-localizacao', rotulo: 'Localização' },
] as const

const CAMPOS_IMAGEM_LOTE = [
  { id: 'lote-vista-aerea', rotulo: 'Vista aérea' },
  { id: 'lote-foto-2', rotulo: 'Foto 2' },
  { id: 'lote-foto-3', rotulo: 'Foto 3' },
] as const

const LIMITE_IMAGEM_LOTE = 1400
const MAX_BYTES_IMAGEM_LOTE = 25 * 1024 * 1024

async function abrirBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { resizeWidth: LIMITE_IMAGEM_LOTE, resizeQuality: 'medium' })
  } catch {
    return await createImageBitmap(file)
  }
}

async function lerImagemLote(file: File): Promise<string> {
  if (!file || file.size <= 0) throw new Error('Não foi possível ler a imagem')
  if (file.size > MAX_BYTES_IMAGEM_LOTE) {
    throw new Error('A imagem é grande demais. Use um arquivo de até 25 MB.')
  }
  if (file.type && !/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error('Use uma imagem JPG, PNG ou WebP.')
  }

  const bitmap = await abrirBitmap(file)
  try {
    const maior = Math.max(bitmap.width, bitmap.height, 1)
    const escala = Math.min(1, LIMITE_IMAGEM_LOTE / maior)
    const width = Math.max(1, Math.round(bitmap.width * escala))
    const height = Math.max(1, Math.round(bitmap.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const contexto = canvas.getContext('2d')
    if (!contexto) throw new Error('Não foi possível ler a imagem')
    contexto.drawImage(bitmap, 0, 0, width, height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    if (!dataUrl.startsWith('data:image/')) throw new Error('Não foi possível ler a imagem')
    return dataUrl
  } finally {
    bitmap.close()
  }
}

function CampoImagemLote({
  id,
  rotulo,
  valor,
  onArquivo,
}: {
  id: string
  rotulo: string
  valor: string
  onArquivo: (arquivo: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="relative flex min-h-11 flex-col gap-2 rounded-lg border border-[var(--moni-border)] p-3">
      <span className="text-xs text-stone-500">{rotulo}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-11 cursor-pointer flex-col text-left"
      >
        {valor ? (
          <img src={valor} alt="" className="h-24 w-full rounded-md object-cover" />
        ) : (
          <span className="flex h-24 items-center text-sm text-[var(--moni-navy-800)]">Escolher imagem</span>
        )}
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        className="absolute h-px w-px opacity-0"
        tabIndex={-1}
        onChange={(event) => {
          const arquivo = event.target.files?.[0]
          event.target.value = ''
          event.target.blur()
          if (!arquivo) return
          onArquivo(arquivo)
        }}
      />
    </div>
  )
}

function comFotosDoCondominio(conteudo: unknown, imagens: [string, string]): unknown {
  const base = conteudo && typeof conteudo === 'object' ? { ...(conteudo as Record<string, unknown>) } : {}
  const principal = imagens[0] || (typeof base.fotoPrincipal === 'string' ? base.fotoPrincipal : undefined)
  const secundaria = imagens[1] || (typeof base.fotoSecundaria === 'string' ? base.fotoSecundaria : undefined)
  const anexou = Boolean(imagens[0] || imagens[1])
  const fotos = anexou
    ? [principal, secundaria].filter((foto): foto is string => Boolean(foto))
    : base.fotos
  return { ...base, fotoPrincipal: principal, fotoSecundaria: secundaria, fotos }
}

function palavrasDoCondominio(item: CondominioRow): string {
  const partes: string[] = [];
  for (const campo of CAMPOS_EXIBICAO_CONDOMINIO) {
    try {
      partes.push(campo.valor(item));
    } catch {
      /* um campo inválido não pode derrubar a página */
    }
  }
  return partes.join(' ');
}

export function BookDoEmpreendimentoGerador({
  condominios = [],
  funis = [],
}: {
  condominios?: CondominioRow[];
  funis?: FunilLivroOpcao[];
}) {
  const [modeloSelecionado, setModeloSelecionado] = useState<string | null>(null);
  const [condominioId, setCondominioId] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [imagensCondominio, setImagensCondominio] = useState<[string, string]>(['', '']);
  const [imagensLote, setImagensLote] = useState<[string, string, string]>(['', '', '']);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkBca, setLinkBca] = useState('');
  const definirLinkBca = useCallback((url: string) => {
    setLinkBca(url.trim());
  }, []);

  const modelo = MODELOS_CASA.find((m) => m.codigo === modeloSelecionado);
  const condominio = condominios.find((item) => item.id === condominioId) ?? null;

  function selecionarCondominio(id: string) {
    setCondominioId(id);
    const escolhido = condominios.find((item) => item.id === id);
    const site = escolhido?.site_url;
    setSiteUrl(typeof site === 'string' ? site.trim() : '');
    if (id !== condominioId) setImagensCondominio(['', '']);
  }

  async function handleGerar() {
    if (!modeloSelecionado || !condominioId) return;
    setGerando(true);
    setErro(null);
    try {
      const site = siteUrl.trim();
      let conteudoSite: unknown;
      if (site) {
        const scrape = await fetch('/api/livro-empreendimento/scrape-condominio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ condominio_id: condominioId, site_url: site }),
        });
        const scrapeData = await scrape.json().catch(() => ({})) as { error?: string; scraped?: { aviso?: string } };
        if (!scrape.ok) {
          throw new Error(scrapeData.error ?? 'Não foi possível ler o site do condomínio');
        }
        conteudoSite = scrapeData.scraped;
        if (scrapeData.scraped?.aviso && !imagensCondominio[0] && !imagensCondominio[1]) {
          setErro(scrapeData.scraped.aviso);
        }
      }
      conteudoSite = comFotosDoCondominio(conteudoSite, imagensCondominio);

      const res = await fetch('/api/livro-empreendimento/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          casa_codigo: modeloSelecionado,
          condominio_id: condominioId,
          conteudo_site: conteudoSite,
          imagens_lote: imagensLote,
          link_bca: linkBca || undefined,
        }),
      });

      const data = await res.json().catch(() => ({})) as { url?: string; error?: string; aviso_bca?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'Erro ao gerar o book');
      }

      if (!data.url) {
        throw new Error('URL do PDF não retornada pela API');
      }

      if (data.aviso_bca) {
        setErro((atual) => (atual ? `${atual} ${data.aviso_bca}` : data.aviso_bca ?? null));
      }

      // Abre o PDF em nova aba — o signed URL do Storage permite download direto
      const a = document.createElement('a');
      a.href = data.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = `book-empreendimento-${modeloSelecionado}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--moni-surface-50)]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-xs text-stone-400">
          <Link href="/apresentacoes" className="hover:text-[var(--moni-primary)]">
            Apresentações
          </Link>
          <span>/</span>
          <span className="text-stone-600">Book do Empreendimento</span>
        </div>

        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--moni-navy-800)]">
            <BookOpenIcon className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--moni-navy-800)]">Book do Empreendimento</h1>
            <p className="text-sm text-stone-500">Selecione a casa e o condomínio. As folhas 2 e 3 saem dos dados do condomínio.</p>
          </div>
        </div>

        {/* Seletor de modelo */}
        <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--moni-navy-800)]">Modelo de casa</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {MODELOS_CASA.map((m) => (
              <button
                key={m.codigo}
                type="button"
                onClick={() => setModeloSelecionado(m.codigo)}
                className={`flex flex-col rounded-lg border p-3 text-left transition ${
                  modeloSelecionado === m.codigo
                    ? 'border-[var(--moni-navy-800)] bg-[var(--moni-navy-800)] text-white'
                    : 'border-[var(--moni-border)] bg-white text-[var(--moni-navy-800)] hover:border-[var(--moni-navy-800)] hover:bg-[var(--moni-light)]'
                }`}
              >
                <span className="text-sm font-bold">{m.nome}</span>
                <span className={`text-[11px] ${modeloSelecionado === m.codigo ? 'text-white/70' : 'text-stone-400'}`}>
                  {m.area} · {m.suites} suítes
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-[var(--moni-navy-800)]">Condomínio</h2>
          <label className="mb-1 block text-xs text-stone-400" htmlFor="condominio-livro">
            Buscar no cadastro
          </label>
          <SearchableSelect
            id="condominio-livro"
            className="w-full"
            size="md"
            value={condominioId}
            onChange={selecionarCondominio}
            placeholder="Digite para buscar o condomínio"
            searchPlaceholder="Nome, cidade, endereço ou site"
            aria-label="Buscar condomínio"
            triggerClassName="min-h-11 w-full border-[var(--moni-border)] text-[var(--moni-navy-800)]"
            options={(condominios ?? []).map((item) => {
              const local = [item.cidade, item.estado].filter(Boolean).join(' / ');
              return {
                value: String(item.id),
                label: local ? `${item.nome} — ${local}` : item.nome,
                keywords: palavrasDoCondominio(item),
              };
            })}
          />
          {condominio ? (
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {CAMPOS_EXIBICAO_CONDOMINIO.map((campo) => {
                const largo = campo.key === 'descricao_breve' || campo.key === 'site_url';
                if (campo.key === 'site_url') {
                  return (
                    <div key={campo.key} className="sm:col-span-2">
                      <label className="text-[11px] font-medium text-stone-400" htmlFor="site-condominio-livro">
                        {campo.label}
                      </label>
                      <input
                        id="site-condominio-livro"
                        type="url"
                        inputMode="url"
                        value={siteUrl}
                        onChange={(event) => setSiteUrl(event.target.value)}
                        placeholder="https://siteDoCondominio.com.br"
                        className="mt-0.5 w-full bg-white px-3 text-sm text-[var(--moni-navy-800)] outline-none"
                        style={{
                          minHeight: 44,
                          borderRadius: 'var(--moni-radius-md)',
                          border: 'var(--moni-border-width) solid var(--moni-border-default)',
                          fontFamily: 'var(--moni-font-sans)',
                        }}
                      />
                    </div>
                  );
                }
                let valor = '—';
                try {
                  valor = campo.valor(condominio);
                } catch {
                  valor = '—';
                }
                return (
                  <div key={campo.key} className={largo ? 'sm:col-span-2' : ''}>
                    <dt className="text-[11px] font-medium text-stone-400">{campo.label}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--moni-navy-800)]">{valor}</dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="mt-3 text-xs text-stone-400">
              Escolha um condomínio para ver o cadastro completo, inclusive o site.
            </p>
          )}
          <p className="mt-3 text-xs text-stone-400">
            O site pode ser ajustado aqui e entra na leitura das folhas 2 e 3. Sem ele, essas folhas usam nome, cidade e a descrição já cadastrada.
          </p>
        </div>

        <DadosNegocioBookSecao funis={funis} onLinkBca={definirLinkBca} />

        <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-[var(--moni-navy-800)]">Imagens do condomínio</h2>
          <p className="mb-4 text-xs text-stone-400">
            Duas fotos: a primeira na abertura e a segunda na página de localização.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS_IMAGEM_CONDOMINIO.map((campo, indice) => (
              <CampoImagemLote
                key={campo.id}
                id={campo.id}
                rotulo={campo.rotulo}
                valor={imagensCondominio[indice]}
                onArquivo={(arquivo) => {
                  void lerImagemLote(arquivo)
                    .then((dataUrl) => {
                      setImagensCondominio((atual) => {
                        const proxima: [string, string] = [atual[0], atual[1]]
                        proxima[indice] = dataUrl
                        return proxima
                      })
                      setErro(null)
                    })
                    .catch((falha: unknown) => {
                      setErro(falha instanceof Error ? falha.message : 'Não foi possível ler a imagem')
                    })
                }}
              />
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-[var(--moni-navy-800)]">Imagens do lote</h2>
          <p className="mb-4 text-xs text-stone-400">
            Três fotos, nesta ordem: vista aérea em cima e as duas de baixo na ficha do lote.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {CAMPOS_IMAGEM_LOTE.map((campo, indice) => (
              <CampoImagemLote
                key={campo.id}
                id={campo.id}
                rotulo={campo.rotulo}
                valor={imagensLote[indice]}
                onArquivo={(arquivo) => {
                  void lerImagemLote(arquivo)
                    .then((dataUrl) => {
                      setImagensLote((atual) => {
                        const proxima: [string, string, string] = [atual[0], atual[1], atual[2]]
                        proxima[indice] = dataUrl
                        return proxima
                      })
                      setErro(null)
                    })
                    .catch((falha: unknown) => {
                      setErro(falha instanceof Error ? falha.message : 'Não foi possível ler a imagem')
                    })
                }}
              />
            ))}
          </div>
        </div>

        {/* Resumo do modelo selecionado */}
        {modelo && (
          <div className="mb-6 rounded-xl border border-[var(--moni-border)] bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-[var(--moni-navy-800)]">Resumo — Casa {modelo.nome}</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <span className="text-xs text-stone-400">Área total</span>
                <p className="font-medium text-[var(--moni-navy-800)]">{modelo.area}</p>
              </div>
              <div>
                <span className="text-xs text-stone-400">Suítes</span>
                <p className="font-medium text-[var(--moni-navy-800)]">{modelo.suites}</p>
              </div>
              <div>
                <span className="text-xs text-stone-400">Banheiros</span>
                <p className="font-medium text-[var(--moni-navy-800)]">{modelo.banheiros}</p>
              </div>
              <div>
                <span className="text-xs text-stone-400">Dimensões</span>
                <p className="font-medium text-[var(--moni-navy-800)]">{modelo.dimensoes}</p>
              </div>
            </div>
            <div className="mt-3 border-t border-stone-100 pt-3">
              <span className="text-xs text-stone-400">Preço base</span>
              <p className="text-base font-semibold text-[var(--moni-gold-600)]">{modelo.preco}</p>
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {/* Botão gerar */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGerar}
            disabled={!modeloSelecionado || !condominioId || gerando}
            className="flex items-center gap-2 rounded-lg bg-[var(--moni-navy-800)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--moni-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DocumentArrowDownIcon className="h-4 w-4 shrink-0" aria-hidden />
            {gerando ? 'Gerando PDF…' : 'Gerar Book em PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
