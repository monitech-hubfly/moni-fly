import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const TARGET = 'http://localhost:3000/sirene/chamados';
const LOG_FILE = '_pw_console_log.txt';
const consoleLines = [];

function log(...args) {
  const line = args.join(' ');
  console.log(line);
  consoleLines.push(line);
}

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Capturar todos os erros do console do browser
page.on('console', msg => {
  if (msg.type() === 'error') log('[BROWSER ERROR]', msg.text());
});
page.on('pageerror', err => log('[PAGE ERROR]', err.message, err.stack ?? ''));

log('=== Abrindo', TARGET);
await page.goto(TARGET);

// Aguardar até 120s o usuário logar (URL volta para /sirene/chamados)
log('=== Aguardando login manual (até 2 min)...');
try {
  await page.waitForURL(url => url.href.includes('sirene/chamados'), { timeout: 120_000 });
  log('=== Logado. URL atual:', page.url());
} catch {
  log('=== TIMEOUT: login não detectado em 2 min. Encerrando.');
  writeFileSync(LOG_FILE, consoleLines.join('\n'));
  await browser.close();
  process.exit(1);
}

// Tirar screenshot pra confirmar que está na tela certa
await page.screenshot({ path: '_pw_screenshot_logged.png', fullPage: false });
log('=== Screenshot salvo: _pw_screenshot_logged.png');

// Procurar botões de status que permitem "Concluir" (SubInteracao status buttons)
// Clicar no primeiro botão "Concluir" visível dentro de uma atividade aberta
log('=== Procurando botões de Concluir...');

// Aguardar a lista de chamados carregar
await page.waitForTimeout(3000);

// Procurar qualquer botão ou elemento com texto "Concluir" ou "concluído"
const botoesConcluir = await page.locator('button', { hasText: /conclu/i }).all();
log(`=== Encontrados ${botoesConcluir.length} botões com "conclu"`);

if (botoesConcluir.length === 0) {
  log('=== Nenhum botão Concluir encontrado. Pode precisar abrir um chamado primeiro.');
  log('=== Aguardando 30s para interação manual...');
  await page.waitForTimeout(30_000);
}

// Capturar mais erros por 5 min enquanto usuário interage
log('=== Monitorando console por 5 min. Interaja com a página normalmente.');
log('=== Tente: abrir chamado → atividade → Concluir → preencher horas → Recorrente');
await page.waitForTimeout(300_000);

writeFileSync(LOG_FILE, consoleLines.join('\n'));
log('=== Log salvo em', LOG_FILE);
await browser.close();
