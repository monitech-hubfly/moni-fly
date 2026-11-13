import type { Browser, Page } from 'puppeteer'

const FOTO_PAINEL = /^data:image\/(?:jpeg|jpg|webp);/i
const FOTO_REMOTA = /googleusercontent\.com|ggpht\.com/i
const FOTO_LIXO = /\/maps\/vt|gstatic\.com|logo|favicon|avatar|profile|streetviewpixels/i

export interface CandidataFotoPainel {
  src: string
  largura: number
  altura: number
  href?: string
}

export function ehLinkGoogle(siteUrl: string): boolean {
  try {
    const url = new URL(siteUrl)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'maps.app.goo.gl') return true
    if (host === 'goo.gl') return url.pathname.startsWith('/maps')
    const google = host === 'google.com'
      || host.endsWith('.google.com')
      || host === 'google.com.br'
      || host.endsWith('.google.com.br')
    if (!google) return false
    return url.pathname.startsWith('/search') || url.pathname.startsWith('/maps') || host.startsWith('maps.')
  } catch {
    return false
  }
}

export function ampliarFotoGoogle(url: string): string {
  if (url.startsWith('data:')) return url
  if (!FOTO_REMOTA.test(url)) return url
  const semTamanho = url.replace(/=(?:w\d+|s\d+).*$/i, '')
  return `${semTamanho}=w1400`
}

const LIMITE_CARROSSEL = 24

export class LeituraGoogleBloqueada extends Error {
  constructor() {
    super('O Google pediu uma verificação e não liberou as fotos do painel. O book segue sem essas fotos.')
    this.name = 'LeituraGoogleBloqueada'
  }
}

/** Fotos do lugar, na ordem do carrossel. O mapa e os ícones ficam de fora. */
export function escolherFotosDoPainel(candidatos: CandidataFotoPainel[], limite = LIMITE_CARROSSEL): string[] {
  const vistos = new Set<string>()
  const fotos: string[] = []
  for (const item of candidatos) {
    const src = item.src.trim()
    if (!src || FOTO_LIXO.test(src)) continue
    if (item.largura > 0 && item.largura < 80) continue
    if (item.altura > 0 && item.altura < 80) continue
    if (item.largura > 0 && item.altura > 0 && item.largura / item.altura > 2.2) continue
    if (!FOTO_PAINEL.test(src) && !FOTO_REMOTA.test(src)) continue
    if (FOTO_REMOTA.test(src) && /\/a[-/]|=s(?:16|32|40|48|64)\b/i.test(src)) continue
    if (src.startsWith('data:') && src.length > 2_500_000) continue
    // O recorte do mapa vem como webp curto. As fotos do carrossel são jpeg.
    if (/^data:image\/webp/i.test(src) && src.length < 8_000) continue
    const chave = src.startsWith('data:') ? src : src.replace(/=(?:w\d+|s\d+).*$/i, '')
    if (vistos.has(chave)) continue
    vistos.add(chave)
    fotos.push(ampliarFotoGoogle(src))
    if (fotos.length === limite) break
  }
  return fotos
}

async function abrirChrome(): Promise<Browser> {
  const puppeteer = (await import('puppeteer')).default
  if (!process.env.VERCEL) {
    try {
      const os = await import('node:os')
      const path = await import('node:path')
      // Sem janela, o Google troca o painel pela página de verificação.
      return await puppeteer.launch({
        headless: false,
        channel: 'chrome',
        userDataDir: path.join(os.tmpdir(), 'moni-livro-google'),
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--lang=pt-BR',
          '--window-size=1440,1000',
          '--window-position=-2400,-2400',
        ],
      })
    } catch {
      // Segue para o Chrome do Puppeteer.
    }
  }
  try {
    return await puppeteer.launch({
      headless: true,
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--lang=pt-BR',
      ],
    })
  } catch {
    if (process.env.VERCEL) {
      const chromium = (await import('@sparticuz/chromium')).default
      const core = (await import('puppeteer-core')).default
      chromium.setGraphicsMode = false
      const browser = await core.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      })
      return browser as unknown as Browser
    }
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--lang=pt-BR',
      ],
    })
  }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function lerPainel(page: Page): Promise<{ bloqueado: boolean; imgs: CandidataFotoPainel[] }> {
  return page.evaluate(() => {
    const bloqueado = location.pathname.indexOf('/sorry') === 0
    const aviso = Array.from(document.querySelectorAll('span, div')).find((el) => {
      const texto = (el instanceof HTMLElement ? el.innerText : el.textContent || '').replace(/\s+/g, ' ').trim()
      return texto.indexOf('sujeitas a direitos autorais') >= 0 && texto.length < 90
    })
    let cursor = aviso?.parentElement || null
    let galeria: Element | null = null
    for (let nivel = 0; nivel < 14 && cursor && cursor !== document.body; nivel += 1) {
      const miniaturas = Array.from(cursor.querySelectorAll('img')).filter((img) => {
        const largura = img.naturalWidth || img.getBoundingClientRect().width
        return largura >= 80 && largura <= 160
      })
      if (miniaturas.length >= 3) {
        galeria = cursor
        break
      }
      cursor = cursor.parentElement
    }
    const dialog = document.querySelector('[role="dialog"]')
    const painel = document.querySelector('#rhs')
    const raizes = [galeria, dialog, painel].filter((raiz): raiz is Element => Boolean(raiz))
    const origem = raizes.length > 0 ? raizes : [document.body]
    const imgs = origem.flatMap((raiz) => Array.from(raiz.querySelectorAll('img'))).slice(0, 80).map((img) => ({
      src: img.currentSrc || img.src || '',
      largura: img.naturalWidth || 0,
      altura: img.naturalHeight || 0,
      href: img.closest('a')?.getAttribute('href') || '',
    }))
    return { bloqueado, imgs }
  })
}

async function abrirCarrossel(page: Page): Promise<void> {
  const ponto = await page.evaluate(() => {
    const painel = document.querySelector('#rhs')
    if (!painel) return null
    const rotulos = Array.from(painel.querySelectorAll('a, button, [role="tab"], span, div'))
    const matches = rotulos.filter((el) => {
      const texto = (el instanceof HTMLElement ? el.innerText : el.textContent || '').replace(/\s+/g, ' ').trim()
      return texto === 'Ver fotos' || texto === 'Fotos'
    })
    const visiveis = matches.filter((el) => {
      const caixa = el.getBoundingClientRect()
      return caixa.width > 8 && caixa.height > 8
    })
    const fotos = (visiveis.length > 0 ? visiveis : matches)
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0]
    if (fotos) {
      const caixa = fotos.getBoundingClientRect()
      if (caixa.width > 8 && caixa.height > 8) {
        return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
      }
      if (fotos instanceof HTMLElement) fotos.click()
    }
    const img = Array.from(painel.querySelectorAll('img')).find((item) => {
      const src = item.currentSrc || item.src || ''
      return src.startsWith('data:image/jpeg') && (item.naturalWidth || 0) >= 100
    })
    if (!img) return null
    const caixa = img.getBoundingClientRect()
    if (caixa.width < 8) return null
    return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
  })
  if (ponto) await page.mouse.click(ponto.x, ponto.y)
}

async function avancarCarrossel(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const aviso = Array.from(document.querySelectorAll('span, div')).find((el) => {
      const texto = (el instanceof HTMLElement ? el.innerText : el.textContent || '').replace(/\s+/g, ' ').trim()
      return texto.indexOf('sujeitas a direitos autorais') >= 0 && texto.length < 90
    })
    let faixa = aviso?.parentElement || null
    while (faixa && faixa.scrollHeight <= faixa.clientHeight + 40) faixa = faixa.parentElement
    if (faixa && faixa !== document.body && faixa !== document.documentElement) {
      const antes = faixa.scrollTop
      faixa.scrollTop += Math.max(faixa.clientHeight - 40, 240)
      if (faixa.scrollTop !== antes) return true
    }
    const dialog = document.querySelector('[role="dialog"]')
    const painel = document.querySelector('#rhs')
    const raiz = dialog || painel
    if (!raiz) return false
    const rolavel = Array.from(raiz.querySelectorAll('div')).find((el) => el.scrollWidth > el.clientWidth + 40)
    if (rolavel) rolavel.scrollLeft += rolavel.clientWidth
    const botoes = Array.from(raiz.querySelectorAll('button, [role="button"]'))
    const proximo = botoes.find((el) => {
      const rotulo = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`.toLowerCase()
      if (/p[aá]gina|resultado/.test(rotulo)) return false
      return /pr[oó]xim|avan[cç]ar|next|imagem seguinte|foto seguinte/.test(rotulo)
    })
    if (!proximo || proximo.getAttribute('aria-disabled') === 'true') return Boolean(rolavel)
    if (proximo instanceof HTMLElement) proximo.click()
    return true
  })
}

/**
 * O HTML estático da busca não traz o painel. As fotos do lugar ficam no
 * carrossel da aba Fotos e só aparecem depois que a página abre.
 */
export async function fotosDoPainelGoogle(siteUrl: string): Promise<string[]> {
  // No Vercel o Chrome sem janela cai na verificação e o book inteiro falhava.
  if (process.env.VERCEL) throw new LeituraGoogleBloqueada()
  let browser: Browser
  try {
    browser = await abrirChrome()
  } catch {
    throw new LeituraGoogleBloqueada()
  }
  try {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    await page.setViewport({ width: 1440, height: 1000 })
    await page.goto('https://www.google.com/?hl=pt-BR', { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => undefined)
    await esperar(800)
    await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForFunction(() => {
      const painel = document.querySelector('#rhs')
      if (painel && painel.querySelector('img')) return true
      return location.pathname.indexOf('/sorry') === 0
    }, { timeout: 12_000 }).catch(() => undefined)

    const primeiro = await lerPainel(page)
    if (primeiro.bloqueado) throw new LeituraGoogleBloqueada()

    const acumulado = [...primeiro.imgs]
    await abrirCarrossel(page)
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('span, div')).some((el) => {
        const texto = (el instanceof HTMLElement ? el.innerText : el.textContent || '').replace(/\s+/g, ' ').trim()
        return texto.indexOf('sujeitas a direitos autorais') >= 0 && texto.length < 90
      })
    }, { timeout: 8_000 }).catch(() => undefined)
    await esperar(600)

    let semNovidade = 0
    for (let passo = 0; passo < LIMITE_CARROSSEL; passo += 1) {
      const agora = await lerPainel(page)
      if (agora.bloqueado) break
      const antes = escolherFotosDoPainel(acumulado).length
      acumulado.push(...agora.imgs)
      const depois = escolherFotosDoPainel(acumulado).length
      if (depois >= LIMITE_CARROSSEL) break
      const andou = await avancarCarrossel(page)
      if (!andou || depois === antes) semNovidade += 1
      else semNovidade = 0
      if (semNovidade >= 2) break
      await esperar(700)
    }

    const fotos = escolherFotosDoPainel(acumulado)
    if (fotos.length === 0) {
      throw new Error('Não encontrei as fotos do condomínio no carrossel do Google.')
    }
    return fotos
  } finally {
    await browser.close()
  }
}
