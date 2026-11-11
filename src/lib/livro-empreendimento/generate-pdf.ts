import type { Browser } from 'puppeteer'

/**
 * Converte uma string HTML em Buffer de PDF A4 via Puppeteer.
 * Usado para geração do Book do Empreendimento.
 *
 * No Vercel o Chrome completo do pacote `puppeteer` não entra na função.
 * Lá usamos `@sparticuz/chromium` (Chrome 143) com `puppeteer-core`.
 * Localmente continua o Puppeteer com o Chrome instalado na máquina.
 */
const ARGS_LOCAL = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']

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

export async function generatePdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 60000,
    })

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
