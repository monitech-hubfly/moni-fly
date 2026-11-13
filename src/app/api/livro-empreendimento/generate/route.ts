import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderBookHtml, type BookContext, type CondominioLivro } from '@/lib/livro-empreendimento/render-html'
import { generateBook } from '@/lib/livro-empreendimento/generate-pdf'
import { cenariosDaPlanilhaBca } from '@/lib/livro-empreendimento/cenarios-bca'

function colunaLivroAusente(error: { code?: string; message?: string }): boolean {
  return error.code === '42703'
    || error.code === 'PGRST204'
    || /does not exist|schema cache/i.test(error.message ?? '')
}

function textoCurto(value: unknown, max = 600): string | undefined {
  if (typeof value !== 'string') return undefined
  const texto = value.replace(/\s+/g, ' ').trim()
  return texto ? texto.slice(0, max) : undefined
}

function urlHttp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.href
  } catch {
    return undefined
  }
}

function urlFoto(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const texto = value.trim().replace(/\s+/g, '')
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(texto)) {
    return texto.length > 2_500_000 ? undefined : texto
  }
  return urlHttp(value)
}

function moedaLivro(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const texto = value.trim()
  if (!texto || !/\d/.test(texto)) return null
  let numero = texto.replace(/r\$/gi, '').replace(/\s/g, '')
  const temVirgula = numero.includes(',')
  const temPonto = numero.includes('.')
  if (temVirgula && temPonto) numero = numero.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+$/.test(numero)) numero = numero.replace(/,/g, '')
  else if (temVirgula) numero = numero.replace(',', '.')
  else if (temPonto && /^\d{1,3}(\.\d{3})+$/.test(numero)) numero = numero.replace(/\./g, '')
  numero = numero.replace(/[^\d.-]/g, '')
  const n = Number(numero)
  if (!Number.isFinite(n)) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n).replace(/\u00a0/g, ' ')
}

function imagensLote(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 3).map((item) => {
    if (typeof item !== 'string') return ''
    const texto = item.trim().replace(/\s+/g, '')
    if (!/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(texto)) return ''
    if (texto.length > 2_500_000) return ''
    return texto
  })
}

function conteudoSite(value: unknown): CondominioLivro | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const vantagens = Array.isArray(raw.vantagens)
    ? raw.vantagens.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const icone = textoCurto((item as { icone?: unknown }).icone, 20)
        const texto = textoCurto((item as { texto?: unknown }).texto, 180)
        if (!icone || !texto) return []
        return [{ icone, texto }]
      }).slice(0, 3)
    : []
  const fotos = Array.isArray(raw.fotos)
    ? raw.fotos.flatMap((item) => {
        const url = urlFoto(item)
        return url ? [url] : []
      }).slice(0, 12)
    : []
  return {
    nome: '',
    fotoPrincipal: urlFoto(raw.fotoPrincipal) ?? fotos[0],
    fotoSecundaria: urlFoto(raw.fotoSecundaria) ?? fotos[1],
    fotos,
    frasePrincipal: textoCurto(raw.frasePrincipal),
    fraseSecundaria: textoCurto(raw.fraseSecundaria, 160),
    subtitulo: textoCurto(raw.subtitulo),
    vantagensLocalizacao: vantagens,
  }
}

export const runtime = 'nodejs' // Puppeteer requer Node.js runtime — NÃO Edge
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Receber parâmetros. O gerador atual envia `codigo`; o contrato novo é `casa_codigo`.
    const body = await request.json()
    const { condominio_id, kanban_card_id, conteudo_site, imagens_lote, link_bca, valor_terreno, custo_obra, vgv_pretendido, formato } = body as {
      casa_codigo?: string
      codigo?: string
      condominio_id?: string
      kanban_card_id?: string
      conteudo_site?: unknown
      imagens_lote?: unknown
      link_bca?: string
      valor_terreno?: string
      custo_obra?: string
      vgv_pretendido?: string
      formato?: string
    }
    const formatoBook = formato === 'pptx' ? 'pptx' : 'pdf'
    const site = conteudoSite(conteudo_site)
    const casa_codigo = (body.casa_codigo ?? body.codigo)?.trim()

    if (!casa_codigo) {
      return NextResponse.json({ error: 'casa_codigo é obrigatório' }, { status: 400 })
    }

    // 1. Buscar dados do modelo de casa.
    // O seed guarda codigo curto (al) e nome (ALE). O frontend manda ALE.
    const { data: porCodigo, error: codigoError } = await supabase
      .from('casas_modelos')
      .select('*')
      .eq('codigo', casa_codigo)
      .eq('ativo', true)
      .maybeSingle()

    if (codigoError) {
      return NextResponse.json({ error: codigoError.message }, { status: 500 })
    }

    let casa = porCodigo
    if (!casa) {
      const { data: porNome, error: nomeError } = await supabase
        .from('casas_modelos')
        .select('*')
        .ilike('nome', casa_codigo)
        .eq('ativo', true)
        .maybeSingle()

      if (nomeError) {
        return NextResponse.json({ error: nomeError.message }, { status: 500 })
      }
      casa = porNome
    }

    if (!casa) {
      return NextResponse.json(
        { error: `Modelo de casa '${casa_codigo}' não encontrado` },
        { status: 404 }
      )
    }

    // 2. Buscar dados do condomínio (se fornecido)
    let condominioLivro: BookContext['condominio'] = null
    if (condominio_id) {
      const { data: cond, error: condError } = await supabase
        .from('condominios')
        .select('nome, cidade, estado, descricao_breve')
        .eq('id', condominio_id)
        .maybeSingle()

      if (condError) {
        return NextResponse.json({ error: condError.message }, { status: 500 })
      }
      if (!cond) {
        return NextResponse.json({ error: 'Condomínio não encontrado' }, { status: 404 })
      }

      const livroRes = await supabase
        .from('condominios')
        .select('livro_foto_principal, livro_foto_secundaria, livro_frase_principal, livro_frase_secundaria, livro_subtitulo, livro_vantagens_localizacao')
        .eq('id', condominio_id)
        .maybeSingle()

      if (livroRes.error && !colunaLivroAusente(livroRes.error)) {
        return NextResponse.json({ error: livroRes.error.message }, { status: 500 })
      }

      const livro = livroRes.error ? null : livroRes.data
      const descricao = typeof cond.descricao_breve === 'string' ? cond.descricao_breve.trim() : ''
      const vantagensDb = Array.isArray(livro?.livro_vantagens_localizacao)
        ? livro.livro_vantagens_localizacao as { icone: string; texto: string }[]
        : []
      condominioLivro = {
        nome: cond.nome,
        cidade: cond.cidade ?? undefined,
        estado: cond.estado ?? undefined,
        fotoPrincipal: site?.fotoPrincipal ?? livro?.livro_foto_principal ?? undefined,
        fotoSecundaria: site?.fotoSecundaria ?? livro?.livro_foto_secundaria ?? undefined,
        fotos: site?.fotos?.length ? site.fotos : undefined,
        frasePrincipal: site?.frasePrincipal ?? livro?.livro_frase_principal ?? undefined,
        fraseSecundaria: site?.fraseSecundaria ?? livro?.livro_frase_secundaria ?? undefined,
        subtitulo: site?.subtitulo ?? livro?.livro_subtitulo ?? (descricao || undefined),
        vantagensLocalizacao: site?.vantagensLocalizacao?.length
          ? site.vantagensLocalizacao
          : vantagensDb,
      }
    }

    const linkBca = typeof link_bca === 'string' ? link_bca.trim().slice(0, 2000) : ''
    let cenarios: BookContext['cenarios'] = null
    let avisoBca: string | undefined
    if (linkBca) {
      try {
        cenarios = await cenariosDaPlanilhaBca(linkBca, user.email ?? undefined)
        if (!cenarios) {
          avisoBca = 'A pasta do BCA está fechada e os cenários de venda ficaram zerados.'
        }
      } catch (falha) {
        console.error('[livro-empreendimento] BCA', falha)
        avisoBca = 'Não foi possível ler a planilha do BCA. Os cenários de venda ficaram zerados.'
      }
    }

    // 3. Montar contexto do book
    const ctx: BookContext = {
      casa: {
        codigo: casa.codigo,
        nome: casa.nome,
        area_m2: Number(casa.area_m2),
        num_suites: casa.num_suites,
        num_banheiros: casa.num_banheiros,
        num_vagas: casa.num_vagas,
        dimensoes: casa.dimensoes ?? '',
        preco_base: Number(casa.preco_base),
        descricao: casa.descricao ?? undefined,
        imagens: Array.isArray(casa.imagens) ? casa.imagens : [],
        especificacoes: casa.especificacoes ?? {},
      },
      condominio: condominioLivro,
      imagensLote: imagensLote(imagens_lote),
      cenarios,
      valorTerreno: moedaLivro(valor_terreno),
      valorObra: moedaLivro(custo_obra),
      vgvTarget: moedaLivro(vgv_pretendido),
    }

    // 4. Renderizar HTML das 27 páginas
    const html = renderBookHtml(ctx)

    // 5. Só o formato pedido
    const arquivo = await generateBook(html, formatoBook)
    const extensao = formatoBook === 'pptx' ? 'pptx' : 'pdf'
    const contentType = formatoBook === 'pptx'
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : 'application/pdf'

    // 6. Upload para Supabase Storage
    const timestamp = Date.now()
    const nomeBase = `book-empreendimento-${casa.codigo}`
    const storagePath = `livros/${casa.codigo}/${timestamp}.${extensao}`
    const bucket = supabase.storage.from('livros-empreendimento')

    const { error: uploadError } = await bucket.upload(storagePath, arquivo, {
      contentType,
      upsert: false,
    })

    if (uploadError) {
      console.error('[livro-empreendimento] Upload error:', uploadError)
      return NextResponse.json({ error: 'Falha ao salvar o book' }, { status: 500 })
    }

    // 6. Registrar no banco
    await supabase.from('livros_empreendimento').insert({
      casa_modelo_id: casa.id,
      condominio_id: condominio_id ?? null,
      kanban_card_id: kanban_card_id ?? null,
      gerado_por: user.id,
      storage_path: storagePath,
      versao: 1,
      contexto_json: {
        casa: ctx.casa,
        condominio: ctx.condominio,
        formato: formatoBook,
      },
    })

    // 7. URL assinada (válida por 1 hora)
    const { data: signedData, error: signError } = await bucket.createSignedUrl(storagePath, 3600, {
      download: `${nomeBase}.${extensao}`,
    })

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json({ error: 'Falha ao gerar URL de download' }, { status: 500 })
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      formato: formatoBook,
      storage_path: storagePath,
      aviso_bca: avisoBca,
    })

  } catch (error) {
    console.error('[livro-empreendimento] Erro inesperado:', error)
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
