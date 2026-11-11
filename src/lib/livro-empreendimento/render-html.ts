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

export interface BookContext {
  casa: CasaModelo
  condominio?: null // será preenchido futuramente
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

function renderCover(ctx: BookContext): string {
  const nome = escapeHtml(ctx.casa.nome)
  return `<section class="page page-cover">
    <p class="cover-logo">MONÍ</p>
    <div class="cover-foto">
      <p class="cover-foto-label">Foto do condomínio</p>
      <p class="cover-foto-hint">A preencher</p>
    </div>
    <div class="cover-centro">
      <h1 class="cover-nome">${nome}</h1>
      <p class="cover-book">Book do Empreendimento</p>
    </div>
    <p class="cover-ano">2025</p>
  </section>`
}

function renderAberturaCondominio(_ctx: BookContext): string {
  return placeholderPage('Parte 01', 'O Condomínio')
}

function renderLocalizacao(_ctx: BookContext): string {
  return placeholderPage('Localização', 'A preencher — dados do condomínio')
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

    @page { size: A4; margin: 0; }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--moni-navy-800);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 210mm;
      height: 297mm;
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

    .page-cover {
      background: var(--moni-navy-800);
      color: var(--moni-white);
    }

    .cover-logo,
    .fim-logo {
      font-family: var(--moni-font-sans);
      font-size: 13px;
      letter-spacing: 0.52em;
      text-transform: uppercase;
      text-indent: 0.52em;
      color: var(--moni-white);
    }

    .cover-logo {
      position: absolute;
      top: 16mm;
      left: 0;
      right: 0;
      text-align: center;
    }

    .cover-foto {
      position: absolute;
      top: 30mm;
      left: 18mm;
      right: 18mm;
      height: 72mm;
      background: var(--moni-green-800);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4mm;
    }

    .cover-foto-label {
      font-family: var(--moni-font-display);
      font-size: 18px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--moni-cream);
    }

    .cover-foto-hint {
      font-family: var(--moni-font-sans);
      font-size: 10px;
      letter-spacing: 0.28em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--moni-cream) 72%, var(--moni-green-800));
    }

    .cover-centro {
      position: absolute;
      left: 16mm;
      right: 16mm;
      top: 50%;
      transform: translateY(-50%);
      text-align: center;
    }

    .cover-nome {
      font-family: var(--moni-font-display);
      font-weight: normal;
      font-size: 64px;
      line-height: 0.92;
      letter-spacing: 0.06em;
      color: var(--moni-gold-400);
    }

    .cover-book {
      margin-top: 7mm;
      font-family: var(--moni-font-sans);
      font-size: 11px;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: var(--moni-white);
    }

    .cover-ano {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 16mm;
      text-align: center;
      font-family: var(--moni-font-sans);
      font-size: 11px;
      letter-spacing: 0.28em;
      color: var(--moni-gold-200);
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
      padding: 28mm 22mm 24mm;
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
      max-width: 158mm;
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
