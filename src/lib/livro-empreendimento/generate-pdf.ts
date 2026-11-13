import type { Browser } from 'puppeteer'
import PptxGenJS from 'pptxgenjs'

/**
 * Converte o HTML do book em PDF e em PowerPoint.
 * As duas saídas nascem da mesma página no Chrome, então o slide
 * fica igual à folha do PDF.
 *
 * No Vercel o Chrome completo do pacote `puppeteer` não entra na função.
 * Lá usamos `@sparticuz/chromium` (Chrome 143) com `puppeteer-core`.
 * Localmente continua o Puppeteer com o Chrome instalado na máquina.
 */
const ARGS_LOCAL = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
const LARGURA_PX = 1334
const ALTURA_PX = 750
const POLEGADA = 96

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = (await import('puppeteer-core')).default
    chromium.setGraphicsMode = false
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
    return browser as unknown as Browser
  }

  const puppeteer = (await import('puppeteer')).default
  return puppeteer.launch({
    headless: true,
    args: ARGS_LOCAL,
  })
}

async function montarPptx(imagens: Buffer[]): Promise<Buffer> {
  const largura = LARGURA_PX / POLEGADA
  const altura = ALTURA_PX / POLEGADA
  const apresentacao = new PptxGenJS()
  apresentacao.defineLayout({ name: 'BOOK', width: largura, height: altura })
  apresentacao.layout = 'BOOK'
  apresentacao.author = 'Casa Moní'
  apresentacao.title = 'Book do Empreendimento'

  for (const imagem of imagens) {
    const slide = apresentacao.addSlide()
    slide.addImage({
      data: `image/jpeg;base64,${imagem.toString('base64')}`,
      x: 0,
      y: 0,
      w: largura,
      h: altura,
    })
  }

  const saida = await apresentacao.write({ outputType: 'nodebuffer' })
  if (saida instanceof Uint8Array) return Buffer.from(saida)
  if (saida instanceof ArrayBuffer) return Buffer.from(saida)
  throw new Error('Falha ao montar o PowerPoint')
}

export async function generateBook(html: string, formato: 'pdf' | 'pptx'): Promise<Buffer> {
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: LARGURA_PX, height: ALTURA_PX, deviceScaleFactor: 2 })
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 60000,
    })
    await Promise.race([
      page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all(Array.from(document.images).map((img) => {
          if (img.complete) return
          return new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
          })
        }))
      }),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ])

    if (formato === 'pdf') {
      return Buffer.from(await page.pdf({
        width: `${LARGURA_PX}px`,
        height: `${ALTURA_PX}px`,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      }))
    }

    const folhas = await page.$$('.page')
    if (folhas.length === 0) throw new Error('O book não tem páginas para o PowerPoint')

    const imagens: Buffer[] = []
    for (const folha of folhas) {
      const foto = await folha.screenshot({ type: 'jpeg', quality: 86 })
      imagens.push(Buffer.from(foto))
    }

    return montarPptx(imagens)
  } finally {
    await browser.close()
  }
}
