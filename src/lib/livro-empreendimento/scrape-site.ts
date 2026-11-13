import { ehLinkGoogle, fotosDoPainelGoogle } from '@/lib/livro-empreendimento/scrape-google'

export interface VantagemLocalizacao {
  icone: string
  texto: string
}

export interface ScrapedData {
  fotoPrincipal?: string
  fotoSecundaria?: string
  frasePrincipal?: string
  fraseSecundaria?: string
  subtitulo?: string
  vantagens: VantagemLocalizacao[]
}

const FOTO_IGNORADA = /logo|icon|icone|favicon|sprite|vector|leaf|avatar|menu|placeholder|running-icon|\.svg(\?|$)/i

function absoluteUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href
  } catch {
    return src
  }
}

function cleanText(t: string): string {
  return t.replace(/\s+/g, ' ').trim()
}

function textoComQuebras(fragment: string): string {
  return fragment
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function textByClass(html: string, className: string): string {
  const re = new RegExp(
    `class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|p|span|h[1-6])>`,
    'i',
  )
  const match = html.match(re)
  return match ? textoComQuebras(match[1]) : ''
}

function primeiraFrase(texto: string, maximo = 320): string {
  const limpo = cleanText(texto)
  if (!limpo) return ''
  const corte = limpo.search(/(?<=\.)\s+/)
  const frase = corte > 40 ? limpo.slice(0, corte + 1) : limpo
  if (frase.length <= maximo) return frase
  const ate = frase.slice(0, maximo)
  const espaco = ate.lastIndexOf(' ')
  return `${(espaco > 80 ? ate.slice(0, espaco) : ate).trim()}…`
}

function limparClausula(texto: string): string {
  let t = cleanText(texto).replace(/[.]+$/, '')
  t = t.replace(/^(além de estar|alem de estar|além de|alem de|está|esta|com|que|e)\s+/i, '')
  t = t.trim()
  if (t.length < 12) return ''
  return t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1)
}

function clausulas(texto: string): string[] {
  return texto
    .split(/(?<=[a-zà-ÿ][.!])\s+/)
    .flatMap((frase) => frase.split(/,\s+|;\s+|\s+e\s+(?=próximo|proximo|fácil|facil|com\s)/i))
    .map((parte) => parte.trim())
    .filter((parte) => parte.length >= 12 && parte.length <= 140)
}

function categoria(texto: string): 'pin' | 'shop' | 'road' | null {
  if (/shopping|loja|supermercado|comércio|comercio/i.test(texto)) return 'shop'
  if (/acesso|rodovia|avenida|estrada/i.test(texto)) return 'road'
  if (/\bkm\b|minutos/i.test(texto)) return 'pin'
  return null
}

function fraseContraste(texto: string): string {
  const match = texto.match(/([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,5}) e a ([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3})/i)
  if (!match) return ''
  const esquerda = match[1].trim().split(/\s+/).slice(-2).join(' ')
  const direita = match[2].trim().replace(/[.,;].*$/, '').trim()
  if (esquerda.length < 8 || direita.length < 8) return ''
  const titulo = esquerda.charAt(0).toLocaleUpperCase('pt-BR') + esquerda.slice(1)
  const complemento = direita.charAt(0).toLocaleLowerCase('pt-BR') + direita.slice(1)
  return `${titulo}, ${complemento}`
}

function fraseRegiao(texto: string): string {
  const primeira = primeiraFrase(texto, 420).replace(/\.$/, '').trim()
  if (!primeira) return ''
  let frase = primeira.replace(/^.*?est[aá] localizad[oa] em uma\s+/i, '')
  if (frase.length < 40) frase = primeira
  frase = frase.charAt(0).toLocaleUpperCase('pt-BR') + frase.slice(1)
  frase = frase.replace(/,\s+a apenas\b/i, ' – a apenas')
  frase = frase.replace(/\bda cidade de\b/gi, 'de')
  if (frase.length <= 230) return frase
  const ate = frase.slice(0, 230)
  const espaco = ate.lastIndexOf(' ')
  return (espaco > 120 ? ate.slice(0, espaco) : ate).trim()
}

function vantagensExplicitas(texto: string): VantagemLocalizacao[] {
  const saida: VantagemLocalizacao[] = []
  const minutos = texto.match(
    /a\s+(\d+\s+minutos)\s+do\s+(.+?)(?:\s+e\s+pr[oó]ximo\s+ao\s+(.+?))?(?=,|\.|$)/i,
  )
  if (minutos) {
    const lugar = minutos[2].trim()
    const extra = (minutos[3] ?? '').trim().replace(/^shopping\s+/i, '')
    let linha = `A ${minutos[1]} do ${lugar}`
    if (extra) linha += ` e próximo ao ${extra}`
    saida.push({ icone: 'pin', texto: linha })
  }

  const lojas = texto.match(/cercad[oa]\s+por\s+(.+?)(?=\s+e\s+com\b|,|\.)/i)
  if (lojas) {
    const miolo = lojas[1].trim()
    saida.push({
      icone: 'shop',
      texto: `Cercado por ${miolo.charAt(0).toLocaleLowerCase('pt-BR')}${miolo.slice(1)}`,
    })
  }

  const acesso = texto.match(/f[aá]cil acesso\s+(.+?)(?=,|\s+e\s+|$)/i)
  if (acesso) {
    let destino = acesso[1].trim().replace(/\.+$/, '').replace(/^à\s+/i, '')
    destino = destino.replace(/\brodovia\b/i, 'Rodovia')
    saida.push({ icone: 'road', texto: `Fácil acesso à ${destino}` })
  }

  return saida.slice(0, 3)
}

function vantagensDaLocalizacao(texto: string): VantagemLocalizacao[] {
  const explicitas = vantagensExplicitas(texto)
  if (explicitas.length >= 2) return explicitas

  const porTipo = new Map<string, string>()
  for (const parte of clausulas(texto)) {
    const tipo = categoria(parte)
    if (!tipo || porTipo.has(tipo)) continue
    const limpa = limparClausula(parte)
    if (limpa) porTipo.set(tipo, limpa)
  }
  return (['pin', 'shop', 'road'] as const)
    .filter((tipo) => porTipo.has(tipo))
    .map((tipo) => ({ icone: tipo, texto: porTipo.get(tipo) ?? '' }))
    .filter((item) => item.texto)
}

function fotosDoHtml(html: string, base: string): string[] {
  const bruto: string[] = []
  for (const match of html.matchAll(/data-bg-image=["']url\(([^)]+)\)["']/gi)) bruto.push(match[1])
  for (const match of html.matchAll(/url\((['"]?)(https?:\/\/[^)'"]+)\1\)/gi)) bruto.push(match[2])
  for (const match of html.matchAll(/\b(?:data-src|data-lazy-src|src)=["']([^"']+)["']/gi)) bruto.push(match[1])

  const fotos: string[] = []
  const vistos = new Set<string>()
  for (const raw of bruto) {
    const limpo = raw.trim().replace(/^['"]|['"]$/g, '')
    if (!limpo || limpo.startsWith('data:')) continue
    const abs = absoluteUrl(limpo, base)
    if (vistos.has(abs) || FOTO_IGNORADA.test(abs)) continue
    if (!/\.(jpe?g|webp|avif)(\?|$)/i.test(abs)) continue
    vistos.add(abs)
    fotos.push(abs)
  }
  return fotos
}

function metaContent(html: string, property: string): string {
  const reProp = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    'i',
  )
  const reContent = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  )
  return cleanText(html.match(reProp)?.[1] ?? html.match(reContent)?.[1] ?? '')
}

/**
 * Lê o HTML público do site do condomínio.
 * Cobre página estática (og:image, h1) e tema com foto em data-bg-image, como o da Artesano.
 */
export async function scrapeSiteContent(siteUrl: string): Promise<ScrapedData> {
  if (ehLinkGoogle(siteUrl)) {
    const fotos = await fotosDoPainelGoogle(siteUrl)
    return {
      vantagens: [],
      fotoPrincipal: fotos[0],
      fotoSecundaria: fotos[1],
    }
  }

  const result: ScrapedData = { vantagens: [] }

  const res = await fetch(siteUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CasaMoniBot/1.0; +https://moni.casa)',
      Accept: 'text/html',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao acessar ${siteUrl}`)
  }

  const html = await res.text()
  const fotos = fotosDoHtml(html, siteUrl)
  if (fotos[0]) result.fotoPrincipal = fotos[0]
  if (fotos[1]) result.fotoSecundaria = fotos[1]

  const ogTitle = metaContent(html, 'og:title')
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const h1Text = h1Match ? cleanText(h1Match[1].replace(/<[^>]+>/g, ' ')) : ''
  const manchete = cleanText(textByClass(html, 'ps-title').replace(/\n/g, ' '))
  const fraseLonga = cleanText(textByClass(html, 'ps-subtitle').replace(/\n/g, ' '))
  const descricaoCurta = cleanText(textByClass(html, 'ps-desc').replace(/\n/g, ' '))
  const tituloLocal = textByClass(html, 'pj-loc-title')
  const textoLocal = cleanText(textByClass(html, 'pj-loc-texto').replace(/\n/g, ' '))

  const taglineMatch = html.match(
    /<(?:div|p|span|h[1-6])[^>]+class=["'][^"']*(?:tagline|slogan|headline|hero-title|hero__title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|span|h[1-6])>/i,
  )
  const taglineText = taglineMatch ? cleanText(taglineMatch[1].replace(/<[^>]+>/g, ' ')) : ''

  result.frasePrincipal =
    (fraseLonga.length > 20 ? fraseLonga : '') ||
    (descricaoCurta.length > 20 ? descricaoCurta : '') ||
    (manchete.length > 8 ? manchete : '') ||
    (h1Text.length > 8 ? h1Text : '') ||
    (taglineText.length > 8 ? taglineText : '') ||
    (ogTitle.length > 8 ? ogTitle : '') ||
    undefined

  const tituloContraste = fraseContraste(textoLocal || descricaoCurta)
  const tituloCurto = tituloContraste
    || (manchete.length > 0 && manchete.length <= 80 ? manchete : '')
    || tituloLocal
  if (tituloCurto && cleanText(tituloCurto.replace(/\n/g, ' ')) !== result.frasePrincipal) {
    result.fraseSecundaria = tituloCurto
  }

  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  const descPara = pMatches
    .map((m) => cleanText(m[1].replace(/<[^>]+>/g, ' ')))
    .find((t) => t.length > 60 && t.length < 400)

  const corpo = textoLocal || descricaoCurta || descPara || ''
  const subtitulo = fraseRegiao(corpo) || primeiraFrase(corpo)
  if (subtitulo) result.subtitulo = subtitulo

  result.vantagens = vantagensDaLocalizacao(textoLocal || corpo)

  if (result.vantagens.length === 0) {
    const liMatches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    const liTexts = liMatches
      .map((m) => cleanText(m[1].replace(/<[^>]+>/g, ' ')))
      .filter((t) => t.length > 18 && t.length < 120)
      .slice(0, 3)
    for (const texto of liTexts) {
      result.vantagens.push({ icone: 'pin', texto })
    }
  }

  return result
}
