import puppeteer from 'puppeteer'

/**
 * Converte uma string HTML em Buffer de PDF A4 via Puppeteer.
 * Usado para geração do Book do Empreendimento.
 *
 * IMPORTANTE: esta função roda no servidor (Next.js API Route).
 * Puppeteer deve estar instalado: npm install puppeteer
 */
const ARGS_SERVERLESS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',
  '--single-process',
  '--disable-gpu',
]

export async function generatePdf(html: string): Promise<Buffer> {
  // --single-process / --no-zygote derrubam o Chrome no Windows ao chamar printToPDF.
  // No serverless (Vercel) esses args continuam necessários.
  const serverless = Boolean(process.env.VERCEL)
  const browser = await puppeteer.launch({
    // Puppeteer 25: true usa o headless novo (--headless=new). O valor 'new' deixou de existir no tipo.
    headless: true,
    args: serverless
      ? ARGS_SERVERLESS
      : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  try {
    const page = await browser.newPage()

    // Aguarda imagens externas carregarem (R2 CDN)
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
