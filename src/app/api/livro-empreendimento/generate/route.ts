import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderBookHtml, type BookContext } from '@/lib/livro-empreendimento/render-html'
import { generatePdf } from '@/lib/livro-empreendimento/generate-pdf'

export const runtime = 'nodejs' // Puppeteer requer Node.js runtime — NÃO Edge
export const maxDuration = 60 // 60 segundos de timeout

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
    const { condominio_id, kanban_card_id } = body as {
      casa_codigo?: string
      codigo?: string
      condominio_id?: string
      kanban_card_id?: string
    }
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
        .select('nome, cidade, estado, descricao_breve, livro_foto_principal, livro_foto_secundaria, livro_frase_principal, livro_frase_secundaria, livro_subtitulo, livro_vantagens_localizacao')
        .eq('id', condominio_id)
        .single()

      if (condError) {
        return NextResponse.json({ error: condError.message }, { status: 500 })
      }

      if (cond) {
        const descricao = typeof cond.descricao_breve === 'string' ? cond.descricao_breve.trim() : ''
        condominioLivro = {
          nome: cond.nome,
          cidade: cond.cidade ?? undefined,
          estado: cond.estado ?? undefined,
          fotoPrincipal: cond.livro_foto_principal ?? undefined,
          fotoSecundaria: cond.livro_foto_secundaria ?? undefined,
          frasePrincipal: cond.livro_frase_principal ?? undefined,
          fraseSecundaria: cond.livro_frase_secundaria ?? undefined,
          subtitulo: cond.livro_subtitulo ?? (descricao || undefined),
          vantagensLocalizacao: Array.isArray(cond.livro_vantagens_localizacao)
            ? cond.livro_vantagens_localizacao as { icone: string; texto: string }[]
            : [],
        }
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
    }

    // 4. Renderizar HTML das 27 páginas
    const html = renderBookHtml(ctx)

    // 5. Converter para PDF via Puppeteer
    const pdfBuffer = await generatePdf(html)

    // 6. Upload para Supabase Storage
    const timestamp = Date.now()
    const storagePath = `livros/${casa.codigo}/${timestamp}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('livros-empreendimento')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('[livro-empreendimento] Upload error:', uploadError)
      return NextResponse.json({ error: 'Falha ao salvar PDF' }, { status: 500 })
    }

    // 6. Registrar no banco
    await supabase.from('livros_empreendimento').insert({
      casa_modelo_id: casa.id,
      condominio_id: condominio_id ?? null,
      kanban_card_id: kanban_card_id ?? null,
      gerado_por: user.id,
      storage_path: storagePath,
      versao: 1,
      contexto_json: ctx,
    })

    // 7. Gerar URL assinada (válida por 1 hora)
    const { data: signedData, error: signError } = await supabase.storage
      .from('livros-empreendimento')
      .createSignedUrl(storagePath, 3600)

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json({ error: 'Falha ao gerar URL de download' }, { status: 500 })
    }

    return NextResponse.json({
      url: signedData.signedUrl,
      storage_path: storagePath,
    })

  } catch (error) {
    console.error('[livro-empreendimento] Erro inesperado:', error)
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
