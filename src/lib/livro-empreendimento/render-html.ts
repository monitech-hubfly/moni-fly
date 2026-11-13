/**
 * HTML das 27 páginas do Book do Empreendimento.
 * Requer Google Fonts (Playfair Display + Inter) via @import — Puppeteer com waitUntil:load.
 */

export interface Imagem {
  path: string
  alt: string
  tipo: 'render' | 'planta'
}

export interface CasaModelo {
  codigo: string
  nome: string
  area_m2: number
  num_suites: number
  num_banheiros: number
  num_vagas: number
  dimensoes: string
  preco_base: number
  descricao?: string
  imagens: Imagem[]
  especificacoes?: {
    programa?: string[]
    acabamentos?: string[]
    sistemas?: string[]
  }
}

export interface CondominioLivro {
  nome: string
  cidade?: string
  estado?: string
  fotoPrincipal?: string   // livro_foto_principal
  fotoSecundaria?: string  // livro_foto_secundaria
  fotos?: string[]         // carrossel do Google; as duas primeiras repetem as de cima
  frasePrincipal?: string  // livro_frase_principal
  fraseSecundaria?: string // livro_frase_secundaria (itálico ouro)
  subtitulo?: string       // livro_subtitulo — descrição da região
  vantagensLocalizacao?: { icone: string; texto: string }[] // livro_vantagens_localizacao
}

export interface BookContext {
  casa: CasaModelo
  condominio?: CondominioLivro | null
  imagensLote?: string[]
}

const BASE_IMAGENS = 'https://pub-f88479dcde19436782f2cdc1eb048fdb.r2.dev/'

function imgUrl(path: string): string {
  return BASE_IMAGENS + path
}

function listaImagens(ctx: BookContext): Imagem[] {
  return Array.isArray(ctx.casa.imagens) ? ctx.casa.imagens : []
}

function getImagem(ctx: BookContext, indice: number): Imagem | undefined {
  return listaImagens(ctx)[indice]
}

function ultimaRender(ctx: BookContext): Imagem | undefined {
  const imagens = listaImagens(ctx)
  for (let i = imagens.length - 1; i >= 0; i -= 1) {
    if (imagens[i]?.tipo === 'render') return imagens[i]
  }
  return undefined
}

function encontrarPorAlt(ctx: BookContext, altText: string): Imagem | undefined {
  return encontrarPorAltIndice(ctx, altText, 0)
}

function encontrarPorAltIndice(ctx: BookContext, altText: string, indice: number): Imagem | undefined {
  const needle = altText.toLowerCase()
  return listaImagens(ctx).filter((img) => img.alt?.toLowerCase().includes(needle))[indice]
}

function semAcento(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function ehRooftop(img: Imagem): boolean {
  const rotulo = semAcento(`${img.alt} ${img.path}`)
  return rotulo.includes('rooftop') || rotulo.includes('cobertura')
}

function ehPlantaTecnica(img: Imagem): boolean {
  if (img.tipo === 'planta') return true
  const alt = semAcento(img.alt || '')
  return alt.includes('layout') || alt.includes('planta baixa') || alt === 'planta' || alt.startsWith('planta ')
}

function imagensJaUsadas(ctx: BookContext): Set<string> {
  const usadas = new Set<string>()
  const capa = encontrarPorAlt(ctx, 'Fachada') ?? ultimaRender(ctx) ?? getImagem(ctx, 0)
  const abertura = encontrarPorAlt(ctx, 'Fachada Noturna')
    ?? encontrarPorAlt(ctx, 'Quintal')
    ?? encontrarPorAlt(ctx, 'Piscina')
  const escolhidas = [
    capa,
    abertura,
    encontrarPorAltIndice(ctx, 'Living', 0),
    encontrarPorAlt(ctx, 'Cozinha'),
    encontrarPorAltIndice(ctx, 'Living', 1),
    fotoEstarJantar(ctx),
  ]
  for (const img of escolhidas) {
    if (img?.path) usadas.add(img.path)
  }
  return usadas
}

function fotoPatio(ctx: BookContext): Imagem | undefined {
  const usadas = imagensJaUsadas(ctx)
  const livres = listaImagens(ctx).filter((img) => img.path && !usadas.has(img.path) && !ehRooftop(img) && !ehPlantaTecnica(img))
  const patio = livres.find((img) => semAcento(img.alt || '').includes('patio'))
  if (patio) return patio
  return livres.find((img) => {
    const alt = semAcento(img.alt || '')
    return alt.includes('quintal') || alt.includes('jardim') || alt.includes('plantas') || alt.includes('vegeta')
  })
}

function getImagemPorAlt(ctx: BookContext, altText: string): Imagem | undefined {
  return encontrarPorAlt(ctx, altText) ?? ultimaRender(ctx)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatNumero(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function rotuloContagem(valor: number, singular: string, plural: string): string {
  return `${valor} ${valor === 1 ? singular : plural}`
}

function placeholderPage(titulo: string, subtitulo: string): string {
  const hint = subtitulo.toLowerCase().includes('a preencher')
    ? ''
    : '<p class="placeholder-hint">A preencher</p>'

  return `<section class="page page-placeholder">
    <div class="placeholder-inner">
      <div class="rule"></div>
      <h2 class="placeholder-title">${escapeHtml(titulo)}</h2>
      <p class="placeholder-sub">${escapeHtml(subtitulo)}</p>
      ${hint}
    </div>
  </section>`
}

/** Nomes como no Configurador / Catálogo (Sol, Gal, Alê), não o código curto (so, ga, al). */
const NOME_CATALOGO: Record<string, string> = {
  al: 'Alê',
  ale: 'Alê',
  du: 'Duda',
  duda: 'Duda',
  lu: 'Lu',
  is: 'Isa',
  isa: 'Isa',
  li: 'Liz',
  liz: 'Liz',
  va: 'Val',
  val: 'Val',
  iv: 'Ivy',
  ivy: 'Ivy',
  ev: 'Eva',
  eva: 'Eva',
  ci: 'Cissa',
  cissa: 'Cissa',
  so: 'Sol',
  sol: 'Sol',
  ga: 'Gal',
  gal: 'Gal',
  le: 'Lena',
  lena: 'Lena',
  mi: 'Mia',
  mia: 'Mia',
}

function chaveCatalogo(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function nomeCatalogo(casa: CasaModelo): string {
  for (const valor of [casa.nome, casa.codigo]) {
    const nome = NOME_CATALOGO[chaveCatalogo(valor)]
    if (nome) return nome
  }
  const base = casa.nome.trim() || casa.codigo.trim()
  if (!base) return ''
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase()
}

function blank(value?: string | number, unit = ''): string {
  if (value !== undefined && value !== null && value !== '')
    return `${value}${unit}`
  return `<span class="blank">—${unit}</span>`
}

function renderCover(ctx: BookContext): string {
  const codigo = escapeHtml(nomeCatalogo(ctx.casa))
  const fachada = getImagemPorAlt(ctx, 'Fachada') ?? getImagem(ctx, 0)
  const fotoUrl = fachada ? imgUrl(fachada.path) : ''
  const imgHtml = fotoUrl ? '<img class="full-bleed" src="' + fotoUrl + '" alt="Fachada" />' : ''
  const ano = new Date().getFullYear()

  const pinSvg = '<svg class="meta-icon" viewBox="0 0 12 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 1C3.24 1 1 3.24 1 6C1 9.5 6 15.5 6 15.5C6 15.5 11 9.5 11 6C11 3.24 8.76 1 6 1Z" stroke="currentColor" stroke-width="1.1"/><circle cx="6" cy="6" r="2" stroke="currentColor" stroke-width="1"/></svg>'

  const loteSvg = '<svg class="meta-icon meta-icon-lote" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="4.5" height="4.5" stroke="currentColor" stroke-width="1"/><rect x="7" y="0.5" width="4.5" height="4.5" stroke="currentColor" stroke-width="1"/><rect x="0.5" y="7" width="4.5" height="4.5" stroke="currentColor" stroke-width="1"/><rect x="7" y="7" width="4.5" height="4.5" stroke="currentColor" stroke-width="1"/></svg>'

  const moniWordmarkSvg = '<svg class="moni-wordmark" viewBox="0 0 72 16" xmlns="http://www.w3.org/2000/svg"><text x="0" y="13" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="white" font-weight="300" letter-spacing="1">M</text><ellipse cx="24.5" cy="8" rx="6.8" ry="7.2" fill="none" stroke="white" stroke-width="1.1"/><line x1="17.7" y1="8" x2="31.3" y2="8" stroke="white" stroke-width="1.1"/><text x="34" y="13" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="white" font-weight="300" letter-spacing="1">NÍ</text></svg>'

  const topIconSvg = '<svg class="cover-top-icon" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10" stroke="rgba(255,255,255,0.65)" stroke-width="0.8"/><line x1="1" y1="11" x2="21" y2="11" stroke="rgba(255,255,255,0.65)" stroke-width="0.8"/></svg>'

  return `<section class="page page-cover">
    ${imgHtml}
    <div class="cover-overlay"></div>
    <div class="cover-top-left">${topIconSvg}</div>
    <div class="cover-content">
      <p class="cover-kicker">Discover Casa Living</p>
      <h1 class="cover-titulo"><span class="cover-word-casa">Casa</span><span class="cover-word-codigo"> ${codigo}</span></h1>
      <p class="cover-subtitulo">Um modelo residencial da coleção Casa Moní</p>
      <div class="cover-meta">
        <span class="cover-meta-item">${pinSvg}</span>
        <span class="cover-meta-sep">·</span>
        <span class="cover-meta-item">${loteSvg}</span>
      </div>
    </div>
    <div class="moni-wm">
      <span>Casa Moní</span>
      <span>Book do Empreendimento</span>
      <span>Uso interno — confidencial</span>
      <span>moni.casa</span>
    </div>
  <div class="cover-footer">
      <div class="cover-footer-rule"></div>
      <div class="cover-footer-row">${moniWordmarkSvg}<p class="cover-footer-label">BOOK DO EMPREENDIMENTO &middot; ${ano}</p></div>
    </div>
  </section>`
}

function destacarTrecho(texto: string, re: RegExp): string {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`
  const rx = new RegExp(re.source, flags)
  let html = ''
  let cursor = 0
  for (const match of texto.matchAll(rx)) {
    const inicio = match.index ?? 0
    html += escapeHtml(texto.slice(cursor, inicio))
    html += '<strong>' + escapeHtml(match[0]) + '</strong>'
    cursor = inicio + match[0].length
  }
  html += escapeHtml(texto.slice(cursor))
  return html
}

function renderAberturaCondominio(ctx: BookContext): string {
  if (!ctx.condominio) return placeholderPage('Parte 01', 'O Condomínio')

  const c = ctx.condominio
  const casaNome = escapeHtml(`Casa ${nomeCatalogo(ctx.casa)}`)
  const fraseEsc = c.frasePrincipal ? escapeHtml(c.frasePrincipal) : ''
  const imgHtml = c.fotoPrincipal
    ? '<img class="full-bleed" src="' + escapeHtml(c.fotoPrincipal) + '" alt="Condomínio" />'
    : ''

  return '<section class="page page-cond-abertura">' +
    imgHtml +
    '<div class="cond-overlay"></div>' +
    '<div class="cond-ab-copy">' +
      '<p class="cond-ab-parte">PARTE 01</p>' +
      '<p class="cond-ab-casa">' + casaNome + '</p>' +
      '<h2 class="cond-ab-titulo">O condomínio</h2>' +
      (fraseEsc ? '<p class="cond-ab-sub">' + fraseEsc + '</p>' : '') +
    '</div>' +
    '    <div class=\"moni-wm\">\n      <span>Casa Moní</span>\n      <span>Book do Empreendimento</span>\n      <span>Uso interno — confidencial</span>\n      <span>moni.casa</span>\n    </div>' +
    '</section>'
}

function normalizarTitulo(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function repeteNome(frase: string, nome: string): boolean {
  const f = normalizarTitulo(frase)
  const n = normalizarTitulo(nome)
  if (!f || !n) return false
  return f === n || f === `o ${n}` || f === `condominio ${n}` || f === `residencial ${n}`
}

function reduzirFrase(frase: string): string {
  const texto = frase.replace(/\s+/g, ' ').trim()
  const porQue = texto.split(/\s+que\s+/i)[0]?.trim() ?? ''
  if (porQue.length >= 12 && porQue.length <= 56 && porQue.length < texto.length) {
    return porQue.replace(/[,:;.\s]+$/, '')
  }
  const porVirgula = texto.split(',')[0]?.trim() ?? ''
  if (porVirgula.length >= 12 && porVirgula.length <= 56 && porVirgula.length < texto.length) {
    return porVirgula
  }
  const palavras = texto.split(' ')
  const escolhidas: string[] = []
  for (const palavra of palavras) {
    const next = [...escolhidas, palavra].join(' ')
    if (next.length > 48 && escolhidas.length >= 3) break
    escolhidas.push(palavra)
    if (next.length >= 32 && !/^(de|da|do|das|dos|em|na|no|nas|nos|para|por|com|e|a|o|um|uma)$/i.test(palavra)) {
      break
    }
  }
  while (escolhidas.length > 2 && /^(de|da|do|das|dos|em|na|no|nas|nos|para|por|com|e|a|o)$/i.test(escolhidas[escolhidas.length - 1] ?? '')) {
    escolhidas.pop()
  }
  return escolhidas.join(' ').replace(/[,:;.\s]+$/, '')
}

function tituloLocalizacao(c: CondominioLivro): { bold: string; italic: string; virgula: boolean } {
  const nome = c.nome?.trim() ?? ''
  const candidatas = [c.fraseSecundaria, c.frasePrincipal, c.subtitulo]
    .map((item) => item?.replace(/\s+/g, ' ').trim() ?? '')
    .filter((item) => item.length > 0 && !repeteNome(item, nome))

  let fonte = ''
  for (const candidata of candidatas) {
    const reduzida = candidata.length <= 72 ? candidata : reduzirFrase(candidata)
    if (reduzida.length >= 8 && !repeteNome(reduzida, nome)) {
      fonte = reduzida
      break
    }
  }
  if (!fonte) return { bold: '', italic: '', virgula: false }

  const linhas = fonte.split('\n').map((linha) => linha.trim()).filter(Boolean)
  if (linhas.length >= 2) {
    return { bold: linhas[0], italic: linhas.slice(1).join(' '), virgula: false }
  }
  const partes = fonte.split(',')
  if (partes.length >= 2 && (partes[0]?.trim().length ?? 0) <= 48) {
    const bold = partes[0].trim()
    const italic = partes.slice(1).join(',').trim()
    if (!repeteNome(bold, nome)) return { bold, italic, virgula: true }
  }
  return { bold: fonte.trim(), italic: '', virgula: false }
}

function renderFotosCarrossel(ctx: BookContext): string[] {
  const fotos = ctx.condominio?.fotos ?? []
  return fotos.slice(2).map((src) =>
    '<section class="page page-cond-foto">' +
      '<img class="full-bleed" src="' + escapeHtml(src) + '" alt="Condomínio" />' +
    '</section>',
  )
}

function renderLocalizacao(ctx: BookContext): string {
  if (!ctx.condominio) return placeholderPage('Localização', 'A preencher — dados do condomínio')

  const c = ctx.condominio
  const nomeEsc = escapeHtml(c.nome)
  const cidadeEstado = [c.cidade, c.estado]
    .filter((parte): parte is string => Boolean(parte))
    .map((parte) => escapeHtml(parte))
    .join(' / ')
  const titulo = tituloLocalizacao(c)
  const tituloNegrito = escapeHtml(titulo.bold)
  const tituloItalico = titulo.italic ? escapeHtml(titulo.italic) : ''
  const subtituloEsc = c.subtitulo
    ? destacarTrecho(c.subtitulo, /\d+\s*km(?:\s+de\s+\S+(?:\s+\S+)?)?/i)
    : ''
  const foto2Html = c.fotoSecundaria
    ? '<img class="loc-foto" src="' + escapeHtml(c.fotoSecundaria) + '" alt="Condomínio" />'
    : '<div class="loc-foto loc-foto-placeholder"></div>'

  const iconePinSvg = '<svg viewBox="0 0 12 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="13" height="16"><path d="M6 1C3.24 1 1 3.24 1 6C1 9.5 6 15.5 6 15.5C6 15.5 11 9.5 11 6C11 3.24 8.76 1 6 1Z" stroke="currentColor" stroke-width="1.1"/><circle cx="6" cy="6" r="2" stroke="currentColor" stroke-width="1"/></svg>'
  const iconeShopSvg = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><rect x="1" y="4" width="14" height="10" rx="1" stroke="currentColor" stroke-width="1.1"/><path d="M5 4V3a3 3 0 1 1 6 0v1" stroke="currentColor" stroke-width="1.1"/></svg>'
  const iconeRodSvg = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M8 1v14M4 3l4 2 4-2M4 13l4-2 4 2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>'

  const icones: string[] = [iconePinSvg, iconeShopSvg, iconeRodSvg]
  const vantagens = c.vantagensLocalizacao && c.vantagensLocalizacao.length > 0
    ? c.vantagensLocalizacao
    : []

  let vantagensHtml = ''
  for (let i = 0; i < vantagens.length && i < 3; i++) {
    const v = vantagens[i]
    vantagensHtml += '<div class="loc-item">' +
      '<span class="loc-icone">' + (icones[i] ?? icones[0]) + '</span>' +
      '<span class="loc-item-txt">' + destacarTrecho(v.texto, /\d+\s+minutos/i) + '</span>' +
    '</div>'
  }

  return '<section class="page page-loc">' +
    '<div class="loc-esquerda">' +
      '<p class="loc-nome">' + nomeEsc + '</p>' +
      (cidadeEstado ? '<p class="loc-cidade">O CONDOMÍNIO &middot; ' + cidadeEstado + '</p>' : '') +
      (tituloNegrito
        ? '<h2 class="loc-titulo">' +
            '<span class="loc-titulo-bold">' + tituloNegrito + '</span>' +
            (tituloItalico
              ? (titulo.virgula ? ',<br/>' : '<br/>') + '<em class="loc-titulo-italic">' + tituloItalico + '</em>'
              : '') +
          '</h2>'
        : '') +
      (subtituloEsc ? '<p class="loc-sub">' + subtituloEsc + '</p>' : '') +
      '<div class="loc-vantagens">' + vantagensHtml + '</div>' +
    '</div>' +
    '<div class="loc-direita">' + foto2Html + '</div>' +
    '</section>'
}

function renderFaixasLote(ctx: BookContext): string {
  const nomeCondominio = escapeHtml(ctx.condominio?.nome ?? 'Condomínio')
  return `<section class="page page-faixas">
    <div class="fx-body">
      <p class="fx-logo">${nomeCondominio}</p>
      <p class="fx-label">LOTES &amp; VALORES</p>
      <h2 class="fx-titulo">Faixas de lote</h2>
      <div class="fx-cards">
        <div class="fx-card">
          <div class="fx-card-inner">
            <p class="fx-card-nome">Médios</p>
            <p class="fx-card-area">≈ 450–500 m²</p>
            <hr class="fx-rule" />
            <p class="fx-card-label">VALOR DE REFERÊNCIA</p>
            <p class="fx-card-preco">R$ 890 mil<br/>– 1,1 mi</p>
          </div>
        </div>
        <div class="fx-card fx-card--destaque">
          <div class="fx-card-inner">
            <p class="fx-card-nome">Grandes</p>
            <p class="fx-card-area">≈ 550–650 m²</p>
            <hr class="fx-rule fx-rule--light" />
            <p class="fx-card-label">VALOR DE REFERÊNCIA</p>
            <p class="fx-card-preco">R$ 1,0 mi<br/>– 1,35 mi</p>
          </div>
        </div>
        <div class="fx-card">
          <div class="fx-card-inner">
            <p class="fx-card-nome">Extra grandes</p>
            <p class="fx-card-area">≈ 800–950 m²</p>
            <hr class="fx-rule" />
            <p class="fx-card-label">VALOR DE REFERÊNCIA</p>
            <p class="fx-card-preco">R$ 1,2 mi<br/>– 1,6 mi+</p>
          </div>
        </div>
      </div>
    </div>
  </section>`
}

function renderOcupacao(ctx: BookContext): string {
  const nome = escapeHtml(ctx.condominio?.nome ?? 'Condomínio')
  const stats = [
    { valor: '0', label: 'Lotes exclusivos', ouro: false },
    { valor: '0', label: 'Casas construídas', ouro: false },
    { valor: '0', label: 'Casas em construção', ouro: false },
    { valor: '0', label: 'Casas à venda no condomínio', ouro: true },
    { valor: '0', label: 'Anos de condomínio', ouro: false },
    { valor: '0', label: 'Estações de lazer', ouro: false },
  ]
  const statsHtml = stats.map((item) =>
    '<div class="oc-stat">' +
      '<p class="oc-stat-num' + (item.ouro ? ' oc-stat-num--ouro' : '') + '">' + item.valor + '</p>' +
      '<p class="oc-stat-lbl">' + escapeHtml(item.label) + '</p>' +
    '</div>',
  ).join('')

  return `<section class="page page-ocupacao">
    <div class="oc-esquerda">
      <p class="oc-nome">${nome}</p>
      <p class="oc-kicker">Estágio de ocupação</p>
      <h2 class="oc-titulo">Ocupação</h2>
      <div class="oc-rule"></div>
      <p class="oc-disp-lbl">Lotes ainda disponíveis</p>
      <p class="oc-disp-num">0</p>
      <p class="oc-disp-txt">De 0 lotes exclusivos, cerca de 0 seguem disponíveis<br/>— uma janela clara de oportunidade.</p>
    </div>
    <div class="oc-direita">
      <div class="oc-lote">
        <div>
          <p class="oc-lote-lbl">Lote · Setor</p>
          <p class="oc-lote-num">0 m²</p>
        </div>
        <div class="oc-lote-valor-bloco">
          <p class="oc-lote-lbl">Valor</p>
          <p class="oc-lote-valor">R$ 0</p>
        </div>
      </div>
      <div class="oc-card">${statsHtml}</div>
    </div>
  </section>`
}

function renderDetalheLote(ctx: BookContext): string {
  const sol = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="2.4" stroke="currentColor" stroke-width="1.1"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>'
  const topo = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 12.5l4.2-5.2 2.6 2.8 2.2-2.6 4 5" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>'
  const recuo = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8h10M3 8l2-2M3 8l2 2M13 8l-2-2M13 8l-2 2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  const fotos = ctx.imagensLote ?? []
  const fotoHtml = (indice: number, legenda?: string) => {
    const src = fotos[indice]
    const img = src ? '<img src="' + escapeHtml(src) + '" alt="" />' : ''
    const texto = legenda ? '<span>' + escapeHtml(legenda) + '</span>' : ''
    return img + texto
  }

  return `<section class="page page-lote">
    <div class="lt-esquerda">
      <p class="lt-kicker">O terreno</p>
      <h2 class="lt-titulo">A ficha do <em>lote</em></h2>
      <p class="lt-medida-lbl">Área do lote</p>
      <p class="lt-medida-num">0 m²</p>
      <p class="lt-medida-lbl">Valor do lote</p>
      <p class="lt-medida-valor">R$ 0</p>
      <div class="lt-itens">
        <div class="lt-item">${sol}<span>Posição do sol ·</span></div>
        <div class="lt-item">${topo}<span>Topografia ·</span></div>
        <div class="lt-item">${recuo}<span>Recuos · 0 m frente · 0 m fundo · 0 m laterais</span></div>
      </div>
    </div>
    <div class="lt-direita">
      <div class="lt-foto lt-foto-grande">${fotoHtml(0, 'Vista aérea')}</div>
      <div class="lt-fotos">
        <div class="lt-foto">${fotoHtml(1)}</div>
        <div class="lt-foto">${fotoHtml(2)}</div>
      </div>
    </div>
  </section>`
}

function renderAberturaCasa(ctx: BookContext): string {
  const codigo = escapeHtml(nomeCatalogo(ctx.casa))
  const foto = encontrarPorAlt(ctx, 'Fachada Noturna')
    ?? encontrarPorAlt(ctx, 'Quintal')
    ?? encontrarPorAlt(ctx, 'Piscina')
  const fotoUrl = foto ? imgUrl(foto.path) : ''
  const imgHtml = fotoUrl ? '<img class="full-bleed" src="' + escapeHtml(fotoUrl) + '" alt="" />' : ''

  return `<section class="page page-cover">
    ${imgHtml}
    <div class="cover-overlay"></div>
    <div class="parte2-top">
      <p class="parte2-label">Parte 02</p>
      <span class="parte2-rule"></span>
    </div>
    <div class="cover-content">
      <p class="cover-kicker">O modelo</p>
      <h1 class="cover-titulo"><span class="cover-word-casa">Casa</span><span class="cover-word-codigo"> ${codigo}</span></h1>
      <p class="parte2-texto">As casas nascem do encontro entre madeira, luz e natureza. Volumes horizontais revestidos em ripado, curvas que abraçam e ambientes que se abrem para fora, para que a vida aconteça em cada espaço.</p>
      <p class="parte2-fecho">Porque viver bem não deveria ser complicado.</p>
    </div>
  </section>`
}

function plantasCatalogo(ctx: BookContext): Imagem[] {
  return listaImagens(ctx).filter((img) => img.path && ehPlantaTecnica(img))
}

function renderPlantas(ctx: BookContext): string {
  const plantas = plantasCatalogo(ctx)
  if (plantas.length === 0) return ''
  const uma = plantas.length === 1
  const orient = uma ? 'horizontal' : 'vertical'
  const slots = plantas.map((img) =>
    `<div class="planta-slot"><img class="planta-img" data-orient="${orient}" src="${escapeHtml(imgUrl(img.path))}" alt="" /></div>`,
  ).join('')
  return `<section class="page page-plantas ${uma ? 'page-plantas-uma' : 'page-plantas-varias'}">${slots}</section>`
}

function renderFilosofiaModelo(ctx: BookContext): string {
  const foto = encontrarPorAlt(ctx, 'Living')
  const fotoUrl = foto ? imgUrl(foto.path) : ''
  const fotoHtml = fotoUrl
    ? `<img class="filo-foto" src="${escapeHtml(fotoUrl)}" alt="" />`
    : ''

  return `<section class="page page-filo${fotoUrl ? ' page-filo-foto' : ''}">
    <div class="filo">
      <p class="filo-kicker">O modelo</p>
      <h2 class="filo-titulo">Uma casa que <em>respira leveza</em></h2>
      <p class="filo-texto">As casas nascem do encontro entre madeira, luz e natureza. Volumes horizontais revestidos em ripado, curvas que abraçam e ambientes que se abrem para fora, para que a vida aconteça em cada espaço.</p>
      <div class="filo-topicos">
        <p class="filo-topico">Cheios e vazios em equilíbrio</p>
        <p class="filo-topico">Conforto em tons quentes</p>
      </div>
      <p class="filo-fecho">Porque viver bem não deveria ser complicado.</p>
    </div>
    ${fotoHtml}
  </section>`
}

function renderLivingIntegrado(ctx: BookContext): string {
  const foto = encontrarPorAlt(ctx, 'Living')
  const fotoUrl = foto ? imgUrl(foto.path) : ''
  if (!fotoUrl) return ''
  const fotoHtml = `<img class="living-foto" src="${escapeHtml(fotoUrl)}" alt="" />`

  return `<section class="page page-living">
    ${fotoHtml}
    <div class="living-overlay"></div>
    <p class="living-kicker">Living integrado</p>
    <div class="living">
      <h2 class="living-titulo">Tudo em um só gesto</h2>
      <p class="living-texto">Estar, jantar e cozinha fluem sob o teto ripado contínuo, com vidros que dissolvem o limite entre dentro e fora.</p>
    </div>
  </section>`
}

function fotosCatalogo(ctx: BookContext, termo: string): Imagem[] {
  const needle = semAcento(termo)
  return listaImagens(ctx).filter((img) => {
    if (!img.path || ehPlantaTecnica(img)) return false
    return semAcento(`${img.alt ?? ''} ${img.path}`).includes(needle)
  })
}

function fotosJaUsadasAntesDoEstar(ctx: BookContext): Set<string> {
  const usadas = new Set<string>()
  const capa = encontrarPorAlt(ctx, 'Fachada') ?? ultimaRender(ctx) ?? getImagem(ctx, 0)
  const abertura = encontrarPorAlt(ctx, 'Fachada Noturna')
    ?? encontrarPorAlt(ctx, 'Quintal')
    ?? encontrarPorAlt(ctx, 'Piscina')
  const living = encontrarPorAlt(ctx, 'Living')
  for (const img of [capa, abertura, living]) {
    if (img?.path) usadas.add(img.path)
  }
  return usadas
}

function fotoEstarJantar(ctx: BookContext): Imagem | undefined {
  const usadas = fotosJaUsadasAntesDoEstar(ctx)
  const cozinha = fotosCatalogo(ctx, 'cozinha').find((img) => !usadas.has(img.path))
  if (cozinha) return cozinha
  return fotosCatalogo(ctx, 'living').find((img) => !usadas.has(img.path))
}

function renderEstarJantar(ctx: BookContext): string {
  const foto = fotoEstarJantar(ctx)
  const fotoUrl = foto ? imgUrl(foto.path) : ''
  if (!fotoUrl) return ''
  const fotoHtml = `<img class="ej-foto" src="${escapeHtml(fotoUrl)}" alt="" />`

  return `<section class="page page-estar">
    <div class="ej">
      <p class="ej-kicker">Estar &amp; jantar</p>
      <h2 class="ej-titulo">Conforto em<br/>tons quentes</h2>
      <p class="ej-texto">O mobiliário de desenho contemporâneo compõe uma paleta acolhedora e convida a pausar — para a conversa, a leitura, o tempo em família.</p>
    </div>
    ${fotoHtml}
  </section>`
}

function renderCentroConvivencia(ctx: BookContext): string {
  const usadas = fotosJaUsadasAntesDoEstar(ctx)
  const estar = fotoEstarJantar(ctx)
  if (estar?.path) usadas.add(estar.path)
  const foto = fotosCatalogo(ctx, 'living').find((img) => !usadas.has(img.path))
  const fotoUrl = foto ? imgUrl(foto.path) : ''
  if (!fotoUrl) return ''
  const fotoHtml = `<img class="conv-foto" src="${escapeHtml(fotoUrl)}" alt="" />`

  return `<section class="page page-conv">
    ${fotoHtml}
    <div class="conv-overlay"></div>
    <div class="conv">
      <p class="conv-kicker">Cozinha</p>
      <h2 class="conv-titulo">O centro da convivência</h2>
      <p class="conv-texto">Ilha em pedra, marcenaria clara e generosa bancada — a cozinha se integra ao jantar e ao estar em um só ambiente para receber.</p>
    </div>
  </section>`
}

function renderPatioIntimo(ctx: BookContext): string {
  const foto = fotoPatio(ctx)
  if (!foto) return ''

  return `<section class="page page-patio">
    <img class="patio-foto" src="${escapeHtml(imgUrl(foto.path))}" alt="" />
    <div class="patio-overlay"></div>
    <div class="patio">
      <p class="patio-kicker">Pátio íntimo</p>
      <h2 class="patio-titulo">Um coração ao ar livre</h2>
      <p class="patio-texto">Protegido pelo ripado, o pátio reúne a família em torno do fogo — extensão natural do living, aberto ao céu.</p>
    </div>
  </section>`
}

function fotoSuiteMaster(ctx: BookContext): Imagem | undefined {
  return listaImagens(ctx).find((img) => {
    if (!img.path || ehPlantaTecnica(img)) return false
    const alt = semAcento(img.alt || '')
    return alt.includes('suite') && alt.includes('master')
  })
}

function renderSuiteMaster(ctx: BookContext): string {
  const foto = fotoSuiteMaster(ctx)
  const fotoUrl = foto ? imgUrl(foto.path) : ''
  if (!fotoUrl) return ''
  const fotoHtml = `<img class="suite-foto" src="${escapeHtml(fotoUrl)}" alt="" />`

  return `<section class="page page-suite">
    ${fotoHtml}
    <div class="suite-overlay"></div>
    <div class="suite">
      <p class="suite-kicker">Suíte master</p>
      <h2 class="suite-titulo">O refúgio<br/>do dia</h2>
      <p class="suite-texto">Luz difusa, materiais macios e o ripado que emoldura a paisagem. Um quarto que convida ao descanso e começa o dia com calma.</p>
    </div>
  </section>`
}

function renderBanhoMaster(ctx: BookContext): string {
  const usadas = imagensJaUsadas(ctx)
  const patio = fotoPatio(ctx)
  const suite = fotoSuiteMaster(ctx)
  if (patio?.path) usadas.add(patio.path)
  if (suite?.path) usadas.add(suite.path)

  const imagens = listaImagens(ctx).filter((img) => img.path && !ehPlantaTecnica(img) && !usadas.has(img.path))
  const porAlt = (pred: (alt: string) => boolean) =>
    imagens.find((img) => pred(semAcento(`${img.alt ?? ''} ${img.path}`)))
  const foto = porAlt((alt) => alt.includes('closet'))
    ?? porAlt((alt) => alt.includes('suite') && alt.includes('master'))
    ?? porAlt((alt) => alt.includes('banheiro'))
    ?? porAlt((alt) => alt.includes('banho') && !alt.includes('master'))
    ?? porAlt((alt) => alt.includes('banho') && alt.includes('master'))
  const fotoUrl = foto ? imgUrl(foto.path) : ''
  if (!fotoUrl) return ''
  const fotoHtml = `<img class="bm-foto" src="${escapeHtml(fotoUrl)}" alt="" />`

  return `<section class="page page-banho">
    <div class="bm">
      <p class="bm-kicker">Banho master</p>
      <h2 class="bm-titulo">O ritual do bem-estar</h2>
      <p class="bm-texto">Pedra clara, ripado e iluminação suave criam a atmosfera de um spa privativo. Dupla bancada e ventilação natural completam o cuidado com cada detalhe.</p>
    </div>
    ${fotoHtml}
  </section>`
}

function renderEasyToPlay(ctx: BookContext): string {
  const foto = listaImagens(ctx).find((img) => !ehPlantaTecnica(img) && semAcento(img.alt || '').includes('gourmet'))
  const fotoUrl = foto ? imgUrl(foto.path) : ''
  if (!fotoUrl) return ''
  const fotoHtml = `<img class="play-foto" src="${escapeHtml(fotoUrl)}" alt="" />`

  return `<section class="page page-play">
    ${fotoHtml}
    <div class="play-overlay"></div>
    <p class="play-kicker">Easy to play</p>
    <h2 class="play-titulo">Feito para receber</h2>
  </section>`
}

function renderRooftop(ctx: BookContext): string {
  const foto = listaImagens(ctx).find((img) => {
    if (ehPlantaTecnica(img) || !img.path) return false
    const rotulo = semAcento(`${img.alt} ${img.path}`)
    return rotulo.includes('rooftop') || rotulo.includes('terraco')
  })
  if (!foto) return ''

  return `<section class="page page-terraco">
    <img class="terraco-foto" src="${escapeHtml(imgUrl(foto.path))}" alt="" />
    <div class="terraco-overlay"></div>
    <div class="terraco">
      <p class="terraco-kicker">Terraço</p>
      <h2 class="terraco-titulo">A vista que <em>encerra o dia</em></h2>
      <p class="terraco-texto">No topo da GAL, a piscina de borda infinita se funde ao horizonte. Um lugar para respirar, contemplar e simplesmente estar.</p>
    </div>
  </section>`
}

function renderFichaTecnica(ctx: BookContext): string {
  const nome = escapeHtml(nomeCatalogo(ctx.casa).toUpperCase())

  return `<section class="page page-esp">
    <div class="esp">
      <p class="esp-kicker">Ficha técnica · Casa ${nome}</p>
      <h2 class="esp-titulo">Especificações completas</h2>
      <div class="esp-cards">
        <div class="esp-card"><p class="esp-num">0</p><p class="esp-label">Suítes</p></div>
        <div class="esp-card"><p class="esp-num">0</p><p class="esp-label">Banheiros</p></div>
        <div class="esp-card"><p class="esp-num">0</p><p class="esp-label">Vagas cobertas</p></div>
        <div class="esp-card"><p class="esp-num esp-num-gold">0 m²</p><p class="esp-label">Área construída</p></div>
      </div>
      <div class="esp-mercado">
        <div class="esp-mercado-texto">
          <h2 class="esp-mercado-titulo">Análise de<br/>Mercado.</h2>
          <p class="esp-mercado-sub">O estoque de vendas<br/>hoje.</p>
        </div>
        <div class="esp-mercado-painel">
          <p class="esp-comp-kicker">Compatibilidade com o padrão Moní</p>
          <div class="esp-bar" aria-hidden="true">
            <span class="esp-bar-alta">0 alta</span>
            <span class="esp-bar-media"></span>
            <span class="esp-bar-baixa"></span>
          </div>
          <div class="esp-legenda">
            <span><i class="esp-dot esp-dot-alta"></i>0 alta compatibilidade</span>
            <span><i class="esp-dot esp-dot-media"></i>0 média</span>
            <span><i class="esp-dot esp-dot-baixa"></i>0 baixa</span>
          </div>
          <div class="esp-precos">
            <div class="esp-preco">
              <p class="esp-preco-label">Preço médio</p>
              <p class="esp-preco-valor">R$ 0</p>
            </div>
            <div class="esp-preco esp-preco-gold">
              <p class="esp-preco-label">Valor médio do m²</p>
              <p class="esp-preco-valor esp-preco-valor-gold">R$ 0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`
}

function renderPosicionamento(_ctx: BookContext): string {
  return `<section class="page page-pos">
    <div class="pos">
      <div class="pos-esq">
        <p class="pos-kicker">Posicionamento competitivo</p>
        <h2 class="pos-titulo">A alternativa <em>ideal</em></h2>
        <p class="pos-texto">Com programa completo e visual moderno, a Casa GAL supera a maioria dos concorrentes diretos. A topografia em aclive favorece a implantação e a arquitetura em ripado se torna um diferencial claro na região.</p>
      </div>
      <div class="pos-dir">
        <p class="pos-frente">Frente aos concorrentes mais prováveis</p>
        <div class="pos-bar" aria-hidden="true">
          <span class="pos-bar-ouro"></span>
          <span class="pos-bar-cinza"></span>
        </div>
        <div class="pos-nums">
          <div>
            <p class="pos-num pos-num-ouro">0</p>
            <p class="pos-rotulo">Avaliações <strong>melhores</strong></p>
          </div>
          <div>
            <p class="pos-num">0</p>
            <p class="pos-rotulo">Avaliações <strong>similares</strong></p>
          </div>
          <div>
            <p class="pos-num pos-num-cinza">0</p>
            <p class="pos-rotulo">Concorrentes <strong>superiores</strong></p>
          </div>
        </div>
        <p class="pos-fecho">Perde apenas para <span class="pos-fecho-num">0</span> — <em>a alternativa ideal.</em></p>
      </div>
    </div>
  </section>`
}

function renderViabilidade(_ctx: BookContext): string {
  return `<section class="page page-via">
    <div class="via">
      <p class="via-kicker">Viabilidade</p>
      <h2 class="via-titulo">Do terreno ao <em>VGV</em></h2>
      <div class="via-box">
        <div class="via-cell">
          <p class="via-label">Valor do terreno</p>
          <p class="via-valor">R$ 0</p>
        </div>
        <div class="via-cell">
          <p class="via-label">Valor de obra</p>
          <p class="via-valor">R$ 0</p>
        </div>
        <div class="via-cell">
          <p class="via-label">VGV target</p>
          <p class="via-valor via-valor-gold">R$ 0</p>
        </div>
      </div>
      <div class="via-base">
        <div class="via-resumo">
          <p>Custo total <span>R$ 0</span> · Potencial de resultado <span>R$ 0</span></p>
          <p>≈ <span>0%</span> sobre o VGV (target)</p>
        </div>
        <div class="via-bar" aria-hidden="true">
          <span class="via-bar-terreno"></span>
          <span class="via-bar-obra"></span>
          <span class="via-bar-resultado"></span>
        </div>
        <div class="via-legenda">
          <span><i class="via-dot via-dot-terreno"></i>Terreno</span>
          <span><i class="via-dot via-dot-obra"></i>Obra</span>
          <span><i class="via-dot via-dot-resultado"></i>Resultado</span>
        </div>
        <p class="via-nota">Valores de referência sujeitos a alteração conforme projeto final e tabela vigente.</p>
      </div>
    </div>
  </section>`
}

function renderCenarios(_ctx: BookContext): string {
  return `<section class="page page-cen">
    <div class="cen">
      <p class="cen-kicker">Viabilidade · Cenários</p>
      <h2 class="cen-titulo">Cenários de venda</h2>
      <table class="cen-tabela">
        <thead>
          <tr>
            <th></th>
            <th>Planta</th>
            <th class="cen-target">Target</th>
            <th>Liquidação</th>
          </tr>
        </thead>
        <tbody>
          <tr class="cen-bruta">
            <td>Venda bruta</td>
            <td class="cen-num">R$ 0</td>
            <td class="cen-target cen-num">R$ 0</td>
            <td class="cen-num">R$ 0</td>
          </tr>
          <tr>
            <td>R$/m² – área de vendas (0 m²)</td>
            <td class="cen-num">0</td>
            <td class="cen-target cen-num">0</td>
            <td class="cen-num">0</td>
          </tr>
          <tr>
            <td>R$/m² – área útil (0 m²)</td>
            <td class="cen-num">0</td>
            <td class="cen-target cen-num">0</td>
            <td class="cen-num">0</td>
          </tr>
          <tr>
            <td>Mês de venda (após início de obra)</td>
            <td class="cen-num">mês 0</td>
            <td class="cen-target cen-num">mês 0</td>
            <td class="cen-num">mês 0</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>`
}

function renderEncerramento(ctx: BookContext): string {
  const casa = escapeHtml(nomeCatalogo(ctx.casa).toUpperCase())
  const condominio = ctx.condominio?.nome?.trim()
  const noCondominio = condominio ? `, no ${escapeHtml(condominio)}` : ''
  const marca = '<svg class="fim-marca" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10" stroke="rgba(255,255,255,0.7)" stroke-width="0.8"/><line x1="1" y1="11" x2="21" y2="11" stroke="rgba(255,255,255,0.7)" stroke-width="0.8"/></svg>'
  const wordmark = '<svg class="fim-wordmark" viewBox="0 0 72 16" xmlns="http://www.w3.org/2000/svg"><text x="0" y="13" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="white" font-weight="300" letter-spacing="1">M</text><ellipse cx="24.5" cy="8" rx="6.8" ry="7.2" fill="none" stroke="white" stroke-width="1.1"/><line x1="17.7" y1="8" x2="31.3" y2="8" stroke="white" stroke-width="1.1"/><text x="34" y="13" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="white" font-weight="300" letter-spacing="1">NÍ</text></svg>'

  return `<section class="page page-fim">
    <div class="fim-centro">
      ${marca}
      <h2 class="fim-frase">A Casa ${casa}${noCondominio} —<br/>um convite para <em>viver bem.</em></h2>
      ${wordmark}
    </div>
  </section>`
}

function estilos(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@300;400;500&display=swap');

    :root {
      --navy: #0C2633;
      --navy-mid: #163545;
      --green: #2F4A3A;
      --green-mid: #4d7a62;
      --earth: #4A3929;
      --gold: #D4AD68;
      --gold-light: #e8c98a;
      --cream: #F5F0E8;
      --white: #FFFFFF;
      --gray-light: #E8E4DC;
      --gray-mid: #9A9490;
      --text-dark: #1A1612;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page { size: 1334px 750px; margin: 0; }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--navy);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 1334px;
      height: 750px;
      overflow: hidden;
      position: relative;
      page-break-after: always;
      break-after: page;
    }

    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .full-bleed {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: var(--navy);
    }

    .rule {
      width: 18mm;
      height: 0.5px;
      background: var(--gold);
      border: 0;
    }

    .rule-light { background: var(--gold-light); }
    .rule-center { margin-left: auto; margin-right: auto; }

    .kicker {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      letter-spacing: 0.34em;
      text-transform: uppercase;
      color: var(--green);
    }

    /* ── Capa ── */
    .page-cover { background: var(--navy); }

    .cover-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        145deg,
        rgba(12,38,51,0.76) 0%,
        rgba(12,38,51,0.44) 44%,
        rgba(12,38,51,0.10) 100%
      );
    }

    .cover-top-left {
      position: absolute;
      top: 11mm;
      left: 11mm;
      z-index: 2;
    }

    .cover-top-icon { width: 22px; height: 22px; display: block; }

    .parte2-top {
      position: absolute;
      top: 28px;
      left: 36px;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .parte2-label {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .parte2-rule {
      display: block;
      width: 52px;
      height: 1px;
      background: var(--gold);
    }

    .parte2-texto {
      max-width: 760px;
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 22px;
      font-weight: 400;
      line-height: 1.55;
      color: rgba(255,255,255,0.78);
    }

    .parte2-fecho {
      max-width: 760px;
      margin: 16px 0 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px;
      font-style: italic;
      font-weight: 500;
      line-height: 1.4;
      color: var(--gold);
    }

    .cover-content {
      position: absolute;
      left: 11mm;
      right: 48mm;
      bottom: 20mm;
      z-index: 2;
    }

    .cover-kicker {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 13px;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 3mm;
    }

    .cover-titulo {
      display: block;
      line-height: 0.88;
      margin-bottom: 4mm;
    }

    .cover-word-casa {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 96px;
      font-weight: 700;
      color: var(--white);
      letter-spacing: 0.01em;
    }

    .cover-word-codigo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 96px;
      font-weight: 400;
      font-style: italic;
      color: var(--gold);
      letter-spacing: 0.01em;
    }

    .cover-subtitulo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      line-height: 1.4;
      color: rgba(255,255,255,0.80);
      margin-bottom: 4mm;
    }

    .cover-meta {
      display: flex;
      align-items: center;
      gap: 5mm;
      margin-top: 1mm;
    }

    .cover-meta-item {
      display: flex;
      align-items: center;
      gap: 2mm;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 13px;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.60);
    }

    .meta-icon { width: 14px; height: 16px; color: rgba(255,255,255,0.60); flex-shrink: 0; }
    .meta-icon-lote { width: 15px; height: 15px; }

    .cover-meta-sep {
      color: rgba(255,255,255,0.35);
      font-size: 10px;
    }

    .cover-footer {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 0 11mm 7mm;
      z-index: 2;
    }

    .cover-footer-rule {
      width: 100%;
      height: 0.5px;
      background: rgba(255,255,255,0.20);
      margin-bottom: 4.5mm;
    }

    .cover-footer-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .moni-wordmark { width: 72px; height: 16px; display: block; }

    .fim-logo {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 13px;
      letter-spacing: 0.52em;
      text-transform: uppercase;
      text-indent: 0.52em;
      color: var(--white);
    }

    .cover-footer-label {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.60);
    }

    .page-placeholder {
      background: var(--navy);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .placeholder-inner {
      width: 150mm;
      text-align: center;
    }

    .placeholder-inner .rule { margin: 0 auto 8mm; }

    .placeholder-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: normal;
      font-size: 36px;
      line-height: 1.15;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .placeholder-sub {
      margin-top: 6mm;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--cream) 78%, var(--navy-mid));
    }

    .placeholder-hint {
      margin-top: 8mm;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--cream) 78%, var(--navy-mid));
    }

    /* ── Folha 2: Abertura Condomínio ── */
    .page-cond-abertura { background: var(--navy); }
    .page-cond-foto { background: var(--navy); }

    .cond-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(12,38,51,0.78) 0%,
        rgba(12,38,51,0.34) 34%,
        rgba(12,38,51,0.08) 68%
      );
    }

    .cond-ab-copy {
      position: absolute;
      left: 13mm;
      right: 42%;
      bottom: 12mm;
      z-index: 2;
    }

    .cond-ab-parte {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 8px;
      font-weight: 500;
      letter-spacing: 0.46em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 4mm;
    }

    .cond-ab-casa {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.42em;
      text-transform: uppercase;
      color: var(--white);
      margin-bottom: 3mm;
    }

    .cond-ab-titulo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 68px;
      font-weight: 700;
      line-height: 0.9;
      letter-spacing: 0.01em;
      color: var(--white);
      margin-bottom: 4mm;
    }

    .cond-ab-sub {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 14px;
      font-weight: 400;
      line-height: 1.35;
      color: var(--white);
      max-width: 150mm;
    }

    /* ── Folha 3: Localização ── */
    .page-loc {
      display: flex;
      background: var(--cream);
    }

    .loc-esquerda {
      width: 42%;
      padding: 14mm 11mm 14mm 14mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: var(--cream);
      position: relative;
      z-index: 1;
    }

    .loc-direita {
      flex: 1;
      position: relative;
      overflow: hidden;
    }

    .loc-foto {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }

    .loc-foto-placeholder {
      background: var(--navy);
    }

    .loc-nome {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.34em;
      text-transform: uppercase;
      color: var(--navy);
      margin-bottom: 2mm;
    }

    .loc-cidade {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 8px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--green-mid);
      margin-bottom: 6mm;
    }

    .loc-titulo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36px;
      line-height: 1.05;
      margin-bottom: 5mm;
      color: var(--navy);
    }

    .loc-titulo-bold {
      font-weight: 700;
    }

    .loc-titulo-italic {
      font-weight: 400;
      font-style: italic;
      color: var(--gold);
    }

    .loc-sub {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 12px;
      line-height: 1.45;
      color: var(--earth);
      margin-bottom: 6mm;
      max-width: 92mm;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .loc-sub strong {
      font-weight: 700;
      color: var(--navy);
    }

    .loc-vantagens {
      display: flex;
      flex-direction: column;
      margin-top: 2mm;
    }

    .loc-item {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr);
      column-gap: 8px;
      align-items: start;
      padding: 3.2mm 0;
    }

    .loc-item + .loc-item {
      border-top: 0.5px solid rgba(12,38,51,0.16);
    }

    .loc-icone {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 14px;
      color: var(--navy);
      opacity: 0.65;
    }

    .loc-icone svg {
      display: block;
      width: auto;
      height: 13px;
      max-width: 13px;
    }

    .loc-item-txt {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 9.5px;
      line-height: 14px;
      color: #3A3A3A;
    }

    .loc-item-txt strong {
      font-weight: 700;
      color: var(--navy);
    }

    .page-abertura { background: var(--navy); }

    .overlay-abertura {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        color-mix(in srgb, var(--navy) 88%, transparent) 0%,
        color-mix(in srgb, var(--navy) 42%, transparent) 46%,
        color-mix(in srgb, var(--navy) 18%, transparent) 100%
      );
    }

    .abertura-copy {
      position: absolute;
      left: 16mm;
      right: 16mm;
      bottom: 22mm;
    }

    .abertura-parte {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      letter-spacing: 0.38em;
      text-transform: uppercase;
      color: var(--gold-light);
    }

    .abertura-nome {
      margin-top: 4mm;
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: normal;
      font-size: 58px;
      line-height: 0.92;
      letter-spacing: 0.04em;
      color: var(--gold);
    }

    .page-cream {
      background: var(--cream);
      color: var(--earth);
    }

    .filosofia,
    .ficha {
      height: 100%;
      padding: 16mm 22mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .filosofia-nome,
    .ficha-nome {
      margin-top: 4mm;
      font-family: 'Playfair Display', Georgia, serif;
      font-weight: normal;
      font-size: 42px;
      line-height: 1;
      letter-spacing: 0.04em;
      color: var(--navy);
    }

    .filosofia .rule,
    .ficha .rule { margin: 8mm 0 8mm; }

    .filosofia-texto p {
      max-width: 240mm;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 16px;
      line-height: 1.65;
      color: var(--earth);
    }

    .filosofia-texto p + p { margin-top: 5mm; }

    .page-filo {
      background: var(--navy);
      color: var(--white);
    }

    .filo {
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 64px 88px;
      max-width: 980px;
    }

    .filo-kicker {
      margin: 0 0 16px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .filo-titulo {
      margin: 0 0 22px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 52px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--white);
    }

    .filo-titulo em {
      font-style: italic;
      font-weight: 500;
      color: var(--gold);
    }

    .filo-texto {
      margin: 0;
      max-width: 720px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.65;
      color: rgba(255,255,255,0.78);
    }

    .filo-topicos {
      display: flex;
      gap: 28px;
      margin-top: 28px;
    }

    .filo-topico {
      margin: 0;
      padding-top: 12px;
      border-top: 0.5px solid var(--gold);
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      line-height: 1.3;
      color: var(--white);
    }

    .filo-fecho {
      margin: 28px 0 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 18px;
      font-style: italic;
      color: var(--gold);
    }

    .page-filo-foto .filo {
      width: 734px;
      max-width: none;
      padding: 56px 40px 56px 72px;
    }

    .page-filo-foto .filo-texto { max-width: none; }

    .page-filo-foto .filo-topicos {
      flex-direction: column;
      gap: 18px;
      max-width: 460px;
    }

    .filo-foto {
      position: absolute;
      top: 0;
      right: 0;
      width: 600px;
      height: 100%;
      object-fit: cover;
    }

    .page-plantas {
      background: var(--cream);
      display: flex;
      align-items: stretch;
      justify-content: center;
      gap: 28px;
      padding: 40px 44px;
      box-sizing: border-box;
    }

    .page-plantas-uma .planta-slot { width: 100%; }

    .page-plantas-varias .planta-slot {
      flex: 1 1 0;
      min-width: 0;
    }

    .planta-slot {
      position: relative;
      overflow: hidden;
    }

    .planta-img {
      position: absolute;
      left: 50%;
      top: 50%;
      max-width: 100%;
      max-height: 100%;
      width: auto;
      height: auto;
      transform: translate(-50%, -50%);
    }

    .page-estar { background: var(--cream); color: var(--navy); }

    .ej {
      height: 100%;
      width: 546px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 72px 56px 72px 80px;
    }

    .ej-kicker {
      margin: 0 0 20px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .ej-titulo {
      margin: 0 0 22px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.02;
      color: var(--navy);
    }

    .ej-texto {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.6;
      color: color-mix(in srgb, var(--earth) 62%, var(--gray-mid));
    }

    .ej-foto {
      position: absolute;
      top: 0;
      right: 0;
      width: 788px;
      height: 100%;
      object-fit: cover;
    }

    .ej-foto-vazia {
      background: color-mix(in srgb, var(--navy) 8%, var(--cream));
    }

    .page-living { background: var(--navy); }

    .living-foto {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .living-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(12, 38, 51, 0.78) 0%,
        rgba(12, 38, 51, 0.28) 32%,
        rgba(12, 38, 51, 0) 56%
      );
    }

    .living-kicker {
      position: absolute;
      top: 36px;
      left: 48px;
      z-index: 2;
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .living {
      position: absolute;
      left: 48px;
      bottom: 48px;
      z-index: 2;
      max-width: 820px;
    }

    .living-titulo {
      margin: 0 0 14px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 52px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--white);
    }

    .living-texto {
      margin: 0;
      max-width: 720px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 20px;
      font-weight: 400;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.9);
    }

    .page-conv { background: var(--navy); }

    .conv-foto {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .conv-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(12, 38, 51, 0.78) 0%,
        rgba(12, 38, 51, 0.34) 28%,
        rgba(12, 38, 51, 0) 52%
      );
    }

    .conv {
      position: absolute;
      left: 72px;
      bottom: 52px;
      z-index: 2;
      max-width: 760px;
    }

    .conv-kicker {
      margin: 0 0 12px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .conv-titulo {
      margin: 0 0 12px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--white);
    }

    .conv-texto {
      margin: 0;
      max-width: 640px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.88);
    }

    .page-patio { background: var(--green); }

    .patio-foto {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .patio-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(12, 38, 51, 0.78) 0%,
        rgba(12, 38, 51, 0.34) 28%,
        rgba(12, 38, 51, 0) 52%
      );
    }

    .patio {
      position: absolute;
      left: 72px;
      bottom: 52px;
      z-index: 2;
      max-width: 820px;
    }

    .patio-kicker {
      margin: 0 0 12px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .patio-titulo {
      margin: 0 0 12px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--white);
    }

    .patio-texto {
      margin: 0;
      max-width: 680px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.88);
    }

    .page-suite { background: var(--navy); }

    .suite-foto {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .suite-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to left,
        rgba(12, 38, 51, 0.5) 0%,
        rgba(12, 38, 51, 0.16) 24%,
        rgba(12, 38, 51, 0) 46%
      );
    }

    .suite {
      position: absolute;
      right: 72px;
      top: 46%;
      z-index: 2;
      width: 390px;
      transform: translateY(-50%);
      text-align: right;
    }

    .suite-kicker {
      margin: 0 0 14px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .suite-titulo {
      margin: 0 0 16px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.02;
      color: var(--white);
    }

    .suite-texto {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.88);
    }

    .page-banho { background: var(--white); color: var(--navy); }

    .bm {
      height: 100%;
      width: 620px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 72px 48px 72px 72px;
    }

    .bm-kicker {
      margin: 0 0 18px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .bm-titulo {
      margin: 0 0 18px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36px;
      font-weight: 700;
      line-height: 1.08;
      color: var(--navy);
    }

    .bm-texto {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.6;
      color: color-mix(in srgb, var(--earth) 62%, var(--gray-mid));
    }

    .bm-foto {
      position: absolute;
      top: 0;
      right: 0;
      width: 714px;
      height: 100%;
      object-fit: cover;
    }

    .bm-foto-vazia {
      background: color-mix(in srgb, var(--navy) 6%, var(--white));
    }

    .page-play { background: var(--navy); }

    .play-foto {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .play-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(12, 38, 51, 0.72) 0%,
        rgba(12, 38, 51, 0.22) 24%,
        rgba(12, 38, 51, 0) 46%
      );
    }

    .play-kicker {
      position: absolute;
      top: 36px;
      left: 48px;
      z-index: 2;
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .play-titulo {
      position: absolute;
      left: 56px;
      bottom: 48px;
      z-index: 2;
      margin: 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 52px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--white);
    }

    .page-terraco { background: var(--navy); }

    .terraco-foto {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .terraco-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        rgba(12, 38, 51, 0.72) 0%,
        rgba(12, 38, 51, 0.28) 32%,
        rgba(12, 38, 51, 0) 58%
      );
    }

    .terraco {
      position: absolute;
      left: 64px;
      bottom: 48px;
      z-index: 2;
      max-width: 760px;
    }

    .terraco-kicker {
      margin: 0 0 12px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .terraco-titulo {
      margin: 0 0 12px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--white);
    }

    .terraco-titulo em {
      font-style: italic;
      font-weight: 500;
      color: var(--gold);
    }

    .terraco-texto {
      margin: 0;
      max-width: 640px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.55;
      color: rgba(255, 255, 255, 0.9);
    }

    .page-esp {
      background: var(--cream);
      color: var(--navy);
    }

    .esp {
      height: 100%;
      box-sizing: border-box;
      padding: 112px 56px 36px;
      display: flex;
      flex-direction: column;
    }

    .esp-kicker {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .esp-titulo {
      margin: 8px 0 18px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 40px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--navy);
    }

    .esp-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: var(--white);
      border: 0.5px solid var(--gray-light);
      border-radius: 16px;
      overflow: hidden;
    }

    .esp-card {
      padding: 18px 28px 16px;
      border-right: 0.5px solid var(--gray-light);
    }

    .esp-card:last-child { border-right: 0; }

    .esp-num {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 36px;
      font-weight: 500;
      line-height: 1;
      color: var(--navy);
    }

    .esp-num-gold { color: var(--gold); }

    .esp-label {
      margin: 8px 0 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--gray-mid);
    }

    .esp-mercado {
      flex: 1;
      display: grid;
      grid-template-columns: 340px 1fr;
      gap: 36px;
      align-items: center;
      margin-top: 28px;
    }

    .esp-mercado-titulo {
      margin: 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.02;
      color: var(--navy);
    }

    .esp-mercado-sub {
      margin: 22px 0 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      font-weight: 500;
      line-height: 1.25;
      color: var(--navy);
    }

    .esp-comp-kicker {
      margin: 0 0 10px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--gray-mid);
    }

    .esp-bar {
      display: flex;
      height: 36px;
      border-radius: 8px;
      overflow: hidden;
    }

    .esp-bar-alta,
    .esp-bar-media,
    .esp-bar-baixa {
      display: flex;
      align-items: center;
      flex: 1;
    }

    .esp-bar-alta {
      background: var(--navy);
      padding-left: 14px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 13px;
      font-weight: 500;
      color: var(--white);
    }

    .esp-bar-media { background: var(--gold); }
    .esp-bar-baixa { background: var(--gray-mid); }

    .esp-legenda {
      display: flex;
      gap: 18px;
      margin-top: 10px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 12px;
      color: var(--earth);
    }

    .esp-legenda span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .esp-dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      display: inline-block;
    }

    .esp-dot-alta { background: var(--navy); }
    .esp-dot-media { background: var(--gold); }
    .esp-dot-baixa { background: var(--gray-mid); }

    .esp-precos {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 18px;
    }

    .esp-preco {
      background: var(--white);
      border: 0.5px solid var(--gray-light);
      border-radius: 14px;
      padding: 16px 20px 14px;
    }

    .esp-preco-gold { border-color: var(--gold); }

    .esp-preco-label {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--gray-mid);
    }

    .esp-preco-valor {
      margin: 8px 0 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 36px;
      font-weight: 500;
      line-height: 1;
      color: var(--navy);
    }

    .esp-preco-valor-gold { color: var(--gold); }

    .page-pos { background: var(--navy); color: var(--white); }

    .pos {
      height: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .pos-esq,
    .pos-dir {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 64px 72px;
    }

    .pos-dir { border-left: 0.5px solid rgba(255, 255, 255, 0.16); }

    .pos-kicker,
    .pos-frente {
      margin: 0 0 16px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .pos-frente {
      margin-bottom: 18px;
      letter-spacing: 0.16em;
      color: rgba(255, 255, 255, 0.55);
    }

    .pos-titulo {
      margin: 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--white);
    }

    .pos-titulo em {
      font-style: italic;
      font-weight: 500;
      color: var(--gold);
    }

    .pos-texto {
      margin: 20px 0 0;
      max-width: 460px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 1.6;
      color: rgba(255, 255, 255, 0.82);
    }

    .pos-bar {
      display: flex;
      height: 8px;
      border-radius: 99px;
      overflow: hidden;
    }

    .pos-bar-ouro,
    .pos-bar-cinza { flex: 1; }

    .pos-bar-ouro { background: var(--gold); }
    .pos-bar-cinza { background: var(--gray-mid); }

    .pos-nums {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 28px;
    }

    .pos-num {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 48px;
      font-weight: 500;
      line-height: 1;
      color: var(--white);
    }

    .pos-num-ouro { color: var(--gold); }
    .pos-num-cinza { color: var(--gray-mid); }

    .pos-rotulo {
      margin: 8px 0 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 13px;
      font-weight: 400;
      line-height: 1.3;
      color: rgba(255, 255, 255, 0.72);
    }

    .pos-rotulo strong { font-weight: 600; color: var(--white); }

    .pos-fecho {
      margin: 32px 0 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 20px;
      font-style: italic;
      font-weight: 500;
      color: var(--gold);
    }

    .pos-fecho em { font-style: italic; }

    .pos-fecho-num {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-style: normal;
      font-variant-numeric: lining-nums;
      font-weight: 500;
    }

    .page-via { background: var(--navy); color: var(--white); }

    .via {
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: 52px 64px 40px;
    }

    .via-kicker {
      margin: 0 0 12px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .via-titulo {
      margin: 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 52px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--white);
    }

    .via-titulo em {
      font-style: italic;
      font-weight: 500;
      color: var(--gold);
    }

    .via-box {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      min-height: 196px;
      margin-top: 28px;
      border: 0.5px solid rgba(255, 255, 255, 0.22);
      border-radius: 14px;
      overflow: hidden;
    }

    .via-cell {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 32px 32px 36px;
      border-right: 0.5px solid rgba(255, 255, 255, 0.16);
    }

    .via-cell:last-child { border-right: 0; }

    .via-label {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.55);
    }

    .via-valor {
      margin: 12px 0 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 36px;
      font-weight: 500;
      line-height: 1;
      color: var(--white);
    }

    .via-valor-gold { color: var(--gold); }

    .via-base { margin-top: auto; }

    .via-resumo {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: baseline;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.78);
    }

    .via-resumo p { margin: 0; }

    .via-resumo span {
      font-variant-numeric: lining-nums;
      font-weight: 500;
      color: var(--gold);
    }

    .via-bar {
      display: flex;
      height: 8px;
      margin-top: 16px;
      border-radius: 99px;
      overflow: hidden;
    }

    .via-bar-terreno,
    .via-bar-obra,
    .via-bar-resultado { flex: 1; }

    .via-bar-terreno { background: var(--gray-light); }
    .via-bar-obra { background: var(--gray-mid); }
    .via-bar-resultado { background: var(--gold); }

    .via-legenda {
      display: flex;
      gap: 18px;
      margin-top: 12px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.72);
    }

    .via-legenda span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .via-dot {
      width: 8px;
      height: 8px;
      border-radius: 2px;
      display: inline-block;
    }

    .via-dot-terreno { background: var(--gray-light); }
    .via-dot-obra { background: var(--gray-mid); }
    .via-dot-resultado { background: var(--gold); }

    .via-nota {
      margin: 14px 0 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.45);
    }

    .page-cen { background: var(--cream); color: var(--navy); }

    .cen {
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 64px 72px;
    }

    .cen-kicker {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--gold);
    }

    .cen-titulo {
      margin: 10px 0 28px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 44px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--navy);
    }

    .cen-tabela {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: var(--white);
      border: 0.5px solid var(--gray-light);
      border-radius: 14px;
      overflow: hidden;
    }

    .cen-tabela th,
    .cen-tabela td {
      padding: 18px 24px;
      text-align: right;
      vertical-align: middle;
    }

    .cen-tabela th:first-child,
    .cen-tabela td:first-child { text-align: left; }

    .cen-tabela th {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--gray-mid);
    }

    .cen-tabela td {
      border-top: 0.5px solid var(--gray-light);
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 14px;
      font-weight: 400;
      color: var(--earth);
    }

    .cen-bruta td {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--navy);
    }

    .cen-num {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-weight: 500;
    }

    .cen-bruta td.cen-num {
      font-size: 22px;
      font-weight: 600;
    }

    .cen-target {
      background: var(--navy);
      color: var(--gold);
    }

    .cen-tabela th.cen-target {
      color: var(--gold);
    }

    .cen-tabela td.cen-target {
      border-top-color: rgba(255, 255, 255, 0.12);
      color: var(--gold);
    }

    .ficha-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9mm 12mm;
      margin-top: 2mm;
    }

    .ficha-item-largo { grid-column: 1 / -1; }

    .ficha-valor {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 26px;
      line-height: 1.1;
      color: var(--navy);
    }

    .ficha-label {
      margin-top: 1.5mm;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--earth);
    }

    .ficha-programa { margin-top: 12mm; }

    .ficha-programa ul {
      margin-top: 4mm;
      padding: 0;
      list-style: none;
    }

    .ficha-programa li {
      position: relative;
      padding-left: 6mm;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 14px;
      line-height: 1.55;
      color: var(--earth);
    }

    .ficha-programa li + li { margin-top: 1.5mm; }

    .ficha-programa li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 2.5mm;
      height: 0.5px;
      background: var(--gold);
    }


    /* ── Folha 5: Faixas de Lote ── */
    .page-faixas {
      background: var(--cream);
      display: flex;
      flex-direction: column;
      padding: 0;
    }

    .fx-logo {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.42em;
      text-transform: uppercase;
      color: var(--navy);
      margin: 0 0 12px;
    }

    .fx-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 104px 72px 48px;
    }

    .fx-label {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
      margin: 0 0 14px;
    }

    .fx-titulo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 40px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--navy);
      margin: 0 0 28px;
    }

    .fx-cards {
      display: flex;
      gap: 22px;
      height: 268px;
      align-items: stretch;
    }

    .fx-card {
      flex: 1;
      border: 0.5px solid var(--gold);
      border-radius: 6px;
      background: var(--white);
      display: flex;
      align-items: flex-start;
    }

    .fx-card--destaque {
      background: var(--navy);
      border-color: var(--navy);
      box-shadow: 0 14px 28px rgba(12, 38, 51, 0.16);
    }

    .fx-card-inner {
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      height: 100%;
      padding: 22px 24px 20px;
      width: 100%;
    }

    .fx-card-nome {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 26px;
      color: var(--navy);
      margin-bottom: 10px;
    }

    .fx-card--destaque .fx-card-nome {
      color: var(--white);
    }

    .fx-card-area {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 13px;
      color: color-mix(in srgb, var(--navy) 60%, transparent);
      margin-bottom: 20px;
    }

    .fx-card--destaque .fx-card-area {
      color: rgba(255,255,255,0.60);
    }

    .fx-rule {
      border: none;
      border-top: 0.5px solid var(--gold);
      margin-top: auto;
      margin-bottom: 18px;
    }

    .fx-rule--light {
      border-top-color: rgba(212,173,104,0.5);
    }

    .fx-card-label {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 9px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 10px;
    }

    .fx-card-preco {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 32px;
      font-weight: bold;
      line-height: 1.15;
      color: var(--gold);
    }

    .blank {
      display: inline-block;
      color: var(--gray-mid);
      font-style: italic;
    }

    .page-ocupacao {
      display: flex;
      background: var(--cream);
    }

    .oc-esquerda {
      width: 44%;
      flex-shrink: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 56px 48px 56px 52px;
      background: var(--navy);
      color: var(--white);
    }

    .oc-nome {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.34em;
      text-transform: uppercase;
      margin: 0 0 12px;
    }

    .oc-kicker {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gold);
      margin: 0 0 16px;
    }

    .oc-titulo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 48px;
      font-weight: 700;
      line-height: 1.02;
      margin: 0 0 18px;
    }

    .oc-rule {
      width: 100%;
      height: 0.5px;
      background: rgba(255,255,255,0.28);
      margin-bottom: 22px;
    }

    .oc-disp-lbl {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.55);
      margin: 0 0 8px;
    }

    .oc-disp-num {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 58px;
      font-weight: 500;
      line-height: 1;
      color: var(--gold);
      margin: 0 0 14px;
    }

    .oc-disp-txt {
      margin: 0;
      max-width: 280px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.55;
      color: rgba(255,255,255,0.72);
    }

    .oc-direita {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 16px;
      padding: 40px 36px 40px 32px;
    }

    .oc-lote,
    .oc-card {
      width: 100%;
      box-sizing: border-box;
    }

    .oc-lote {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--navy);
      border-radius: 12px;
      padding: 22px 28px;
    }

    .oc-lote-lbl {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.55);
      margin: 0 0 6px;
    }

    .oc-lote-num {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 34px;
      font-weight: 500;
      line-height: 1;
      color: var(--white);
      margin: 0;
    }

    .oc-lote-valor-bloco {
      text-align: right;
    }

    .oc-lote-valor {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 30px;
      font-weight: 500;
      line-height: 1;
      color: var(--gold);
      margin: 0;
    }

    .oc-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 22px 20px;
      background: var(--white);
      border-radius: 14px;
      padding: 28px 32px;
    }

    .oc-stat-num {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 32px;
      font-weight: 500;
      line-height: 1;
      color: var(--navy);
      margin: 0 0 6px;
    }

    .oc-stat-num--ouro {
      color: var(--gold);
    }

    .oc-stat-lbl {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 9px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--gray-mid);
      margin: 0;
    }

    .page-lote {
      display: flex;
      background: var(--cream);
    }

    .lt-esquerda {
      width: 42%;
      flex-shrink: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 48px 40px 48px 48px;
    }

    .lt-kicker {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: var(--gray-mid);
      margin: 0 0 10px;
    }

    .lt-titulo {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 40px;
      font-weight: 700;
      line-height: 1.05;
      color: var(--navy);
      margin: 0 0 28px;
    }

    .lt-titulo em {
      font-style: italic;
      font-weight: 500;
      color: var(--gold);
    }

    .lt-medida-lbl {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--gray-mid);
      margin: 14px 0 4px;
    }

    .lt-medida-num,
    .lt-medida-valor {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-variant-numeric: lining-nums;
      font-size: 32px;
      font-weight: 500;
      line-height: 1;
      margin: 0;
    }

    .lt-medida-num { color: var(--navy); }
    .lt-medida-valor { color: var(--gold); }

    .lt-itens {
      margin-top: 28px;
      border-top: 0.5px solid rgba(12,38,51,0.16);
    }

    .lt-item {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr);
      column-gap: 10px;
      align-items: center;
      padding: 12px 0;
      border-bottom: 0.5px solid rgba(12,38,51,0.16);
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: var(--navy);
    }

    .lt-item svg {
      display: block;
      width: 15px;
      height: 15px;
      color: var(--navy);
    }

    .lt-direita {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 8px 8px 0;
      background: var(--cream);
    }

    .lt-foto-grande { flex: 1.35; }
    .lt-fotos { flex: 1; display: flex; gap: 8px; }
    .lt-fotos .lt-foto { flex: 1; }

    .lt-foto {
      position: relative;
      background: color-mix(in srgb, var(--navy) 55%, var(--cream));
      overflow: hidden;
    }

    .lt-foto img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .lt-foto span {
      position: absolute;
      left: 16px;
      bottom: 14px;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.85);
    }

    .page-fim {
      background: var(--navy);
      color: var(--white);
    }

    .moni-wm {
      position: absolute;
      bottom: 24px;
      left: 36px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      z-index: 1;
      pointer-events: none;
    }
    .moni-wm span {
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 7px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.08);
      line-height: 1.6;
    }

    .fim-centro {
      position: absolute;
      left: 80px;
      right: 80px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .fim-marca {
      width: 22px;
      height: 22px;
      margin-bottom: 28px;
    }

    .fim-frase {
      margin: 0;
      max-width: 920px;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36px;
      font-weight: 500;
      line-height: 1.35;
      color: var(--white);
    }

    .fim-frase em {
      font-style: italic;
      font-weight: 500;
      color: var(--gold);
    }

    .fim-wordmark {
      width: 78px;
      height: 18px;
      margin-top: 28px;
    }

    .fim-site {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 16mm;
      text-align: center;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 11px;
      letter-spacing: 0.22em;
      color: var(--cream);
    }
  `
}

export function renderBookHtml(ctx: BookContext): string {
  const paginas = [
    renderCover(ctx),
    renderAberturaCondominio(ctx),
    renderLocalizacao(ctx),
    ...renderFotosCarrossel(ctx),
    renderFaixasLote(ctx),
    renderOcupacao(ctx),
    renderDetalheLote(ctx),
    renderAberturaCasa(ctx),
    renderFilosofiaModelo(ctx),
    renderPlantas(ctx),
    renderLivingIntegrado(ctx),
    renderEstarJantar(ctx),
    renderCentroConvivencia(ctx),
    renderPatioIntimo(ctx),
    renderSuiteMaster(ctx),
    renderBanhoMaster(ctx),
    renderEasyToPlay(ctx),
    renderRooftop(ctx),
    renderFichaTecnica(ctx),
    renderPosicionamento(ctx),
    renderViabilidade(ctx),
    renderCenarios(ctx),
    renderEncerramento(ctx),
  ].filter((pagina) => pagina.trim().length > 0)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Book do Empreendimento — ${escapeHtml(ctx.casa.nome)}</title>
  <style>${estilos()}</style>
</head>
<body>
${paginas.join('\n')}
<script>
function orientarPlantas() {
  document.querySelectorAll('.planta-img').forEach(function (img) {
    var slot = img.parentElement
    if (!slot) return
    var sw = slot.clientWidth
    var sh = slot.clientHeight
    var nw = img.naturalWidth
    var nh = img.naturalHeight
    if (!nw || !nh || !sw || !sh) return
    var querHorizontal = img.getAttribute('data-orient') === 'horizontal'
    var jaHorizontal = nw >= nh
    var girar = querHorizontal !== jaHorizontal
    var dw = girar ? nh : nw
    var dh = girar ? nw : nh
    var escala = Math.min(sw / dw, sh / dh)
    var fw = dw * escala
    var fh = dh * escala
    img.style.maxWidth = 'none'
    img.style.maxHeight = 'none'
    img.style.width = (girar ? fh : fw) + 'px'
    img.style.height = (girar ? fw : fh) + 'px'
    img.style.transform = girar
      ? 'translate(-50%, -50%) rotate(90deg)'
      : 'translate(-50%, -50%)'
  })
}
if (document.readyState === 'complete') orientarPlantas()
else window.addEventListener('load', orientarPlantas)
</script>
</body>
</html>`
}
