/**
 * Remove fundo branco dos emojis PNG, tornando-o transparente.
 * Uso: node scripts/remove-emoji-bg.mjs
 */
import sharp from 'sharp'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CAROMETRO_DIR = join(__dirname, '..', 'public', 'carometro')

const WHITE_THRESHOLD = 240 // pixels com r,g,b >= 240 serão transparentes

async function removeWhiteBackground(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
      data[i + 3] = 0
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels } })
    .png()
    .toFile(inputPath)
  console.log('Processado:', inputPath)
}

async function main() {
  const files = await readdir(CAROMETRO_DIR)
  const pngs = files.filter(f => f.endsWith('.png') && f.startsWith('carometro-emoji'))
  for (const f of pngs) {
    await removeWhiteBackground(join(CAROMETRO_DIR, f))
  }
  console.log('Concluído:', pngs.length, 'imagens')
}

main().catch(err => { console.error(err); process.exit(1) })
