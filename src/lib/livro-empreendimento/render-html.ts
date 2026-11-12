/**
 * HTML das 27 páginas do Book do Empreendimento.
 * Autossuficiente para o Puppeteer: paleta no :root, sem CSS externo e sem Google Fonts.
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
  frasePrincipal?: string  // livro_frase_principal
  fraseSecundaria?: string // livro_frase_secundaria (itálico ouro)
  subtitulo?: string       // livro_subtitulo — descrição da região
  vantagensLocalizacao?: { icone: string; texto: string }[] // livro_vantagens_localizacao
}

export interface BookContext {
  casa: CasaModelo
  condominio?: CondominioLivro | null
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
  const needle = altText.toLowerCase()
  return listaImagens(ctx).find((img) => img.alt?.toLowerCase().includes(needle))
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

function renderFoto(imagem: Imagem | undefined): string {
  if (!imagem) return ''
  return `<img class="full-bleed" src="${escapeHtml(imgUrl(imagem.path))}" alt="${escapeHtml(imagem.alt)}" />`
}

function renderFullBleed(titulo: string, imagem: Imagem | undefined): string {
  if (!imagem) {
    return placeholderPage(titulo, 'A preencher')
  }

  return `<section class="page page-imagem">
    ${renderFoto(imagem)}
    <div class="legenda">
      <div class="rule rule-light"></div>
      <h2 class="legenda-titulo">${escapeHtml(titulo)}</h2>
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
    <div class="cover-footer">
      <div class="cover-footer-rule"></div>
      <div class="cover-footer-row">${moniWordmarkSvg}<p class="cover-footer-label">BOOK DO EMPREENDIMENTO &middot; ${ano}</p></div>
    </div>
  </section>`
}

function renderAberturaCondominio(ctx: BookContext): string {
  if (!ctx.condominio) return placeholderPage('Parte 01', 'O Condomínio')

  const c = ctx.condominio
  const nomeEsc = escapeHtml(c.nome)
  const fraseEsc = c.frasePrincipal ? escapeHtml(c.frasePrincipal) : ''
  const imgHtml = c.fotoPrincipal
    ? '<img class="full-bleed" src="' + escapeHtml(c.fotoPrincipal) + '" alt="Condomínio" />'
    : ''

  return '<section class="page page-cond-abertura">' +
    imgHtml +
    '<div class="cond-overlay"></div>' +
    '<div class="cond-ab-copy">' +
      '<p class="cond-ab-parte">PARTE 01</p>' +
      '<p class="cond-ab-nome">' + nomeEsc + '</p>' +
      '<h2 class="cond-ab-titulo">O condomínio</h2>' +
      (fraseEsc ? '<p class="cond-ab-sub">' + fraseEsc + '</p>' : '') +
    '</div>' +
    '</section>'
}

function renderLocalizacao(ctx: BookContext): string {
  if (!ctx.condominio) return placeholderPage('Localização', 'A preencher — dados do condomínio')

  const c = ctx.condominio
  const nomeEsc = escapeHtml(c.nome)
  const cidadeEstado = [c.cidade, c.estado]
    .filter((parte): parte is string => Boolean(parte))
    .map((parte) => escapeHtml(parte))
    .join(' / ')
  const tituloParts = c.frasePrincipal ? c.frasePrincipal.split(',') : ['', '']
  const tituloNegrito = escapeHtml(tituloParts[0]?.trim() ?? c.nome)
  const tituloItalico = c.fraseSecundaria ? escapeHtml(c.fraseSecundaria) : (tituloParts[1] ? escapeHtml(tituloParts[1].trim()) : '')
  const subtituloEsc = c.subtitulo ? escapeHtml(c.subtitulo) : ''
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
      '<span class="loc-item-txt">' + escapeHtml(v.texto) + '</span>' +
    '</div>'
  }

  return '<section class="page page-loc">' +
    '<div class="loc-esquerda">' +
      '<p class="loc-nome">' + nomeEsc + '</p>' +
      (cidadeEstado ? '<p class="loc-cidade">O CONDOMÍNIO &middot; ' + cidadeEstado + '</p>' : '') +
      '<h2 class="loc-titulo">' +
        '<span class="loc-titulo-bold">' + tituloNegrito + '</span>' +
        (tituloItalico ? ',<br/><em class="loc-titulo-italic">' + tituloItalico + '</em>' : '') +
      '</h2>' +
      (subtituloEsc ? '<p class="loc-sub">' + subtituloEsc + '</p>' : '') +
      '<div class="loc-rule"></div>' +
      '<div class="loc-vantagens">' + vantagensHtml + '</div>' +
    '</div>' +
    '<div class="loc-direita">' + foto2Html + '</div>' +
    '</section>'
}

function renderAmenidades(_ctx: BookContext): string {
  return placeholderPage('Amenidades', 'A preencher — dados do condomínio')
}

function renderFaixasLote(_ctx: BookContext): string {
  return placeholderPage('Faixas de lote', 'A preencher — dados do condomínio')
}

function renderOcupacao(_ctx: BookContext): string {
  return placeholderPage('Ocupação', 'A preencher — dados do condomínio')
}

function renderMasterplan(_ctx: BookContext): string {
  return placeholderPage('Masterplan', 'A preencher — dados do condomínio')
}

function renderDetalheLote(_ctx: BookContext): string {
  return placeholderPage('Detalhe do lote', 'A preencher — dados do condomínio')
}

function renderAberturaCasa(ctx: BookContext): string {
  const nome = escapeHtml(ctx.casa.nome)
  return `<section class="page page-abertura">
    ${renderFoto(getImagem(ctx, 0))}
    <div class="overlay-abertura"></div>
    <div class="abertura-copy">
      <p class="abertura-parte">Parte 02</p>
      <h2 class="abertura-nome">${nome}</h2>
    </div>
  </section>`
}

function renderFilosofiaModelo(ctx: BookContext): string {
  const nome = escapeHtml(ctx.casa.nome)
  const texto = ctx.casa.descricao?.trim() || `Texto editorial da ${ctx.casa.nome}`
  const paragrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('')

  return `<section class="page page-cream">
    <div class="filosofia">
      <p class="kicker">O modelo</p>
      <h2 class="filosofia-nome">${nome}</h2>
      <div class="rule"></div>
      <div class="filosofia-texto">${paragrafos}</div>
    </div>
  </section>`
}

function renderImagemFull(titulo: string, ctx: BookContext, indice: number): string {
  return renderFullBleed(titulo, getImagem(ctx, indice))
}

function renderSuiteMaster(ctx: BookContext): string {
  return renderFullBleed('Suíte Master', getImagemPorAlt(ctx, 'Master'))
}

function renderBanhoMaster(ctx: BookContext): string {
  return renderFullBleed('Banho Master', getImagemPorAlt(ctx, 'Banho'))
}

function renderEasyToPlay(ctx: BookContext): string {
  const imagem = encontrarPorAlt(ctx, 'Gourmet') ?? getImagemPorAlt(ctx, 'Rooftop')
  return renderFullBleed('Easy to Play', imagem)
}

function renderRooftop(ctx: BookContext): string {
  return renderFullBleed('Rooftop', getImagemPorAlt(ctx, 'Rooftop'))
}

function renderFichaTecnica(ctx: BookContext): string {
  const { casa } = ctx
  const programa = casa.especificacoes?.programa?.filter((item) => item.trim()) ?? []
  const programaHtml = programa.length
    ? `<div class="ficha-programa">
        <p class="kicker">Programa</p>
        <ul>${programa.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </div>`
    : ''

  return `<section class="page page-cream">
    <div class="ficha">
      <p class="kicker">Ficha técnica</p>
      <h2 class="ficha-nome">${escapeHtml(casa.nome)}</h2>
      <div class="rule"></div>
      <div class="ficha-grid">
        <div class="ficha-item ficha-item-largo">
          <p class="ficha-valor">${formatNumero(casa.area_m2)} m²</p>
          <p class="ficha-label">Área</p>
        </div>
        <div class="ficha-item">
          <p class="ficha-valor">${rotuloContagem(casa.num_suites, 'suíte', 'suítes')}</p>
          <p class="ficha-label">Suítes</p>
        </div>
        <div class="ficha-item">
          <p class="ficha-valor">${rotuloContagem(casa.num_banheiros, 'banheiro', 'banheiros')}</p>
          <p class="ficha-label">Banheiros</p>
        </div>
        <div class="ficha-item">
          <p class="ficha-valor">${rotuloContagem(casa.num_vagas, 'vaga', 'vagas')}</p>
          <p class="ficha-label">Vagas</p>
        </div>
        <div class="ficha-item">
          <p class="ficha-valor">${escapeHtml(casa.dimensoes)}</p>
          <p class="ficha-label">Dimensões</p>
        </div>
      </div>
      ${programaHtml}
    </div>
  </section>`
}

function renderAnaliseMercado(_ctx: BookContext): string {
  return placeholderPage('Análise de mercado', 'A preencher')
}

function renderPosicionamento(_ctx: BookContext): string {
  return placeholderPage('Posicionamento', 'A preencher')
}

function renderViabilidade(_ctx: BookContext): string {
  return placeholderPage('Viabilidade', 'A preencher')
}

function renderCenarios(_ctx: BookContext): string {
  return placeholderPage('Cenários', 'A preencher')
}

function renderEncerramento(_ctx: BookContext): string {
  return `<section class="page page-fim">
    <div class="fim-centro">
      <p class="fim-logo">MONÍ</p>
      <div class="rule rule-center"></div>
      <p class="fim-tagline">Viver bem é uma escolha.</p>
    </div>
    <p class="fim-site">moni.casa</p>
  </section>`
}

function estilos(): string {
  return `
    :root {
      --moni-navy-800: #0C2633;
      --moni-navy-600: #163545;
      --moni-green-800: #2F4A3A;
      --moni-earth-800: #4A3929;
      --moni-gold-400: #D4AD68;
      --moni-gold-200: #e8c98a;
      --moni-cream: #F5F0E8;
      --moni-white: #FFFFFF;
      --moni-font-display: Georgia, 'Times New Roman', serif;
      --moni-font-sans: Arial, Helvetica, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page { size: A4 landscape; margin: 0; }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--moni-navy-800);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 297mm;
      height: 210mm;
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
      background: var(--moni-navy-800);
    }

    .rule {
      width: 18mm;
      height: 0.5px;
      background: var(--moni-gold-400);
      border: 0;
    }

    .rule-light { background: var(--moni-gold-200); }
    .rule-center { margin-left: auto; margin-right: auto; }

    .kicker {
      font-family: var(--moni-font-sans);
      font-size: 10px;
      letter-spacing: 0.34em;
      text-transform: uppercase;
      color: var(--moni-green-800);
    }

    /* ── Capa ── */
    .page-cover { background: var(--moni-navy-800); }

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

    .cover-content {
      position: absolute;
      left: 11mm;
      right: 48mm;
      bottom: 20mm;
      z-index: 2;
    }

    .cover-kicker {
      font-family: var(--moni-font-sans);
      font-size: 7.5px;
      letter-spacing: 0.38em;
      text-transform: uppercase;
      color: var(--moni-gold-400);
      margin-bottom: 1.5mm;
    }

    .cover-titulo {
      display: block;
      line-height: 0.88;
      margin-bottom: 4mm;
    }

    .cover-word-casa {
      font-family: var(--moni-font-display);
      font-size: 76px;
      font-weight: 700;
      color: var(--moni-white);
      letter-spacing: 0.01em;
    }

    .cover-word-codigo {
      font-family: var(--moni-font-display);
      font-size: 76px;
      font-weight: 400;
      font-style: italic;
      color: var(--moni-gold-400);
      letter-spacing: 0.01em;
    }

    .cover-subtitulo {
      font-family: var(--moni-font-display);
      font-size: 12.5px;
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
      font-family: var(--moni-font-sans);
      font-size: 9.5px;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.60);
    }

    .meta-icon { width: 11px; height: 13px; color: rgba(255,255,255,0.60); flex-shrink: 0; }
    .meta-icon-lote { width: 12px; height: 12px; }

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

    .moni-wordmark { width: 56px; height: 13px; display: block; }

    .fim-logo {
      font-family: var(--moni-font-sans);
      font-size: 13px;
      letter-spacing: 0.52em;
      text-transform: uppercase;
      text-indent: 0.52em;
      color: var(--moni-white);
    }

    .cover-footer-label {
      font-family: var(--moni-font-sans);
      font-size: 8.5px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.60);
    }

    .page-placeholder {
      background: var(--moni-navy-800);
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
      font-family: var(--moni-font-display);
      font-weight: normal;
      font-size: 36px;
      line-height: 1.15;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--moni-gold-400);
    }

    .placeholder-sub {
      margin-top: 6mm;
      font-family: var(--moni-font-sans);
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--moni-cream) 78%, var(--moni-navy-600));
    }

    .placeholder-hint {
      margin-top: 8mm;
      font-family: var(--moni-font-sans);
      font-size: 10px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--moni-cream) 78%, var(--moni-navy-600));
    }

    /* ── Folha 2: Abertura Condomínio ── */
    .page-cond-abertura { background: var(--moni-navy-800); }

    .cond-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        170deg,
        rgba(12,38,51,0.08) 0%,
        rgba(12,38,51,0.52) 55%,
        rgba(12,38,51,0.90) 100%
      );
    }

    .cond-ab-copy {
      position: absolute;
      left: 14mm;
      right: 60mm;
      bottom: 14mm;
      z-index: 2;
    }

    .cond-ab-parte {
      font-family: var(--moni-font-sans);
      font-size: 7px;
      letter-spacing: 0.44em;
      text-transform: uppercase;
      color: var(--moni-gold-400);
      margin-bottom: 2mm;
    }

    .cond-ab-nome {
      font-family: var(--moni-font-sans);
      font-size: 9px;
      letter-spacing: 0.38em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.75);
      margin-bottom: 1.5mm;
    }

    .cond-ab-titulo {
      font-family: var(--moni-font-display);
      font-size: 68px;
      font-weight: 700;
      line-height: 0.9;
      letter-spacing: 0.01em;
      color: var(--moni-white);
      margin-bottom: 4mm;
    }

    .cond-ab-sub {
      font-family: var(--moni-font-display);
      font-size: 13px;
      line-height: 1.4;
      color: rgba(255,255,255,0.78);
      max-width: 180mm;
    }

    /* ── Folha 3: Localização ── */
    .page-loc {
      display: flex;
      background: var(--moni-cream);
    }

    .loc-esquerda {
      width: 42%;
      padding: 14mm 11mm 14mm 14mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #F5F0E8;
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
      background: var(--moni-navy-800);
    }

    .loc-nome {
      font-family: var(--moni-font-sans);
      font-size: 9px;
      letter-spacing: 0.38em;
      text-transform: uppercase;
      color: var(--moni-navy-800);
      margin-bottom: 1mm;
    }

    .loc-cidade {
      font-family: var(--moni-font-sans);
      font-size: 8px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #7B9E87;
      margin-bottom: 6mm;
    }

    .loc-titulo {
      font-family: var(--moni-font-display);
      font-size: 32px;
      line-height: 1.08;
      margin-bottom: 5mm;
      color: var(--moni-navy-800);
    }

    .loc-titulo-bold {
      font-weight: 700;
    }

    .loc-titulo-italic {
      font-weight: 400;
      font-style: italic;
      color: var(--moni-gold-400);
    }

    .loc-sub {
      font-family: var(--moni-font-display);
      font-size: 10.5px;
      line-height: 1.6;
      color: #3A3A3A;
      margin-bottom: 6mm;
      max-width: 90mm;
    }

    .loc-rule {
      width: 100%;
      height: 0.5px;
      background: rgba(12,38,51,0.18);
      margin-bottom: 5mm;
    }

    .loc-vantagens {
      display: flex;
      flex-direction: column;
      gap: 3.5mm;
    }

    .loc-item {
      display: flex;
      align-items: flex-start;
      gap: 3mm;
    }

    .loc-icone {
      flex-shrink: 0;
      color: var(--moni-navy-800);
      opacity: 0.65;
      margin-top: 0.5mm;
    }

    .loc-item-txt {
      font-family: var(--moni-font-sans);
      font-size: 9.5px;
      line-height: 1.5;
      color: #3A3A3A;
    }

    .loc-item-txt strong {
      font-weight: 700;
      color: var(--moni-navy-800);
    }

    .page-abertura { background: var(--moni-navy-800); }

    .overlay-abertura {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to top,
        color-mix(in srgb, var(--moni-navy-800) 88%, transparent) 0%,
        color-mix(in srgb, var(--moni-navy-800) 42%, transparent) 46%,
        color-mix(in srgb, var(--moni-navy-800) 18%, transparent) 100%
      );
    }

    .abertura-copy {
      position: absolute;
      left: 16mm;
      right: 16mm;
      bottom: 22mm;
    }

    .abertura-parte {
      font-family: var(--moni-font-sans);
      font-size: 11px;
      letter-spacing: 0.38em;
      text-transform: uppercase;
      color: var(--moni-gold-200);
    }

    .abertura-nome {
      margin-top: 4mm;
      font-family: var(--moni-font-display);
      font-weight: normal;
      font-size: 58px;
      line-height: 0.92;
      letter-spacing: 0.04em;
      color: var(--moni-gold-400);
    }

    .page-cream {
      background: var(--moni-cream);
      color: var(--moni-earth-800);
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
      font-family: var(--moni-font-display);
      font-weight: normal;
      font-size: 42px;
      line-height: 1;
      letter-spacing: 0.04em;
      color: var(--moni-navy-800);
    }

    .filosofia .rule,
    .ficha .rule { margin: 8mm 0 8mm; }

    .filosofia-texto p {
      max-width: 240mm;
      font-family: var(--moni-font-display);
      font-size: 16px;
      line-height: 1.65;
      color: var(--moni-earth-800);
    }

    .filosofia-texto p + p { margin-top: 5mm; }

    .page-imagem { background: var(--moni-navy-800); }

    .legenda {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 28mm 16mm 16mm;
      background: linear-gradient(
        to top,
        color-mix(in srgb, var(--moni-navy-800) 90%, transparent) 0%,
        color-mix(in srgb, var(--moni-navy-800) 55%, transparent) 48%,
        color-mix(in srgb, var(--moni-navy-800) 0%, transparent) 100%
      );
    }

    .legenda-titulo {
      margin-top: 5mm;
      font-family: var(--moni-font-display);
      font-weight: normal;
      font-size: 32px;
      line-height: 1;
      letter-spacing: 0.03em;
      color: var(--moni-white);
    }

    .ficha-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 9mm 12mm;
      margin-top: 2mm;
    }

    .ficha-item-largo { grid-column: 1 / -1; }

    .ficha-valor {
      font-family: var(--moni-font-display);
      font-size: 26px;
      line-height: 1.1;
      color: var(--moni-navy-800);
    }

    .ficha-label {
      margin-top: 1.5mm;
      font-family: var(--moni-font-sans);
      font-size: 10px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--moni-earth-800);
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
      font-family: var(--moni-font-display);
      font-size: 14px;
      line-height: 1.55;
      color: var(--moni-earth-800);
    }

    .ficha-programa li + li { margin-top: 1.5mm; }

    .ficha-programa li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 2.5mm;
      height: 0.5px;
      background: var(--moni-gold-400);
    }

    .page-fim {
      background: var(--moni-navy-800);
      color: var(--moni-white);
    }

    .fim-centro {
      position: absolute;
      left: 16mm;
      right: 16mm;
      top: 50%;
      transform: translateY(-50%);
      text-align: center;
    }

    .fim-logo { font-size: 22px; }

    .fim-centro .rule { margin: 8mm auto; }

    .fim-tagline {
      font-family: var(--moni-font-display);
      font-style: italic;
      font-size: 18px;
      color: var(--moni-gold-400);
    }

    .fim-site {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 16mm;
      text-align: center;
      font-family: var(--moni-font-sans);
      font-size: 11px;
      letter-spacing: 0.22em;
      color: var(--moni-cream);
    }
  `
}

export function renderBookHtml(ctx: BookContext): string {
  const paginas = [
    renderCover(ctx),
    renderAberturaCondominio(ctx),
    renderLocalizacao(ctx),
    renderAmenidades(ctx),
    renderFaixasLote(ctx),
    renderOcupacao(ctx),
    renderMasterplan(ctx),
    renderDetalheLote(ctx),
    renderAberturaCasa(ctx),
    renderFilosofiaModelo(ctx),
    renderImagemFull('Fachada', ctx, 1),
    renderImagemFull('Perspectiva', ctx, 2),
    renderImagemFull('Living', ctx, 3),
    renderImagemFull('Estar', ctx, 4),
    renderImagemFull('Interior', ctx, 5),
    renderImagemFull('Detalhe', ctx, 6),
    renderImagemFull('Planta', ctx, 7),
    renderSuiteMaster(ctx),
    renderBanhoMaster(ctx),
    renderEasyToPlay(ctx),
    renderRooftop(ctx),
    renderFichaTecnica(ctx),
    renderAnaliseMercado(ctx),
    renderPosicionamento(ctx),
    renderViabilidade(ctx),
    renderCenarios(ctx),
    renderEncerramento(ctx),
  ]

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Book do Empreendimento — ${escapeHtml(ctx.casa.nome)}</title>
  <style>${estilos()}</style>
</head>
<body>
${paginas.join('\n')}
</body>
</html>`
}
