# ⚡ SCRIPT AUTOMÁTICO: Limpar cache e forçar atualização

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  LIMPEZA TOTAL DE CACHE - Remover Fundo Azul" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Parar processos Node (servidor)
Write-Host "⏸️  Parando servidor Next.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "✅ Servidor parado" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Nenhum servidor rodando" -ForegroundColor Cyan
}
Write-Host ""

# Limpar .next
Write-Host "🗑️  Limpando cache do Next.js..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "✅ .next removido" -ForegroundColor Green
} else {
    Write-Host "ℹ️  .next já estava limpo" -ForegroundColor Cyan
}

# Limpar node_modules/.cache
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "✅ node_modules\.cache removido" -ForegroundColor Green
}

# Limpar .turbo (se existir)
if (Test-Path ".turbo") {
    Remove-Item -Recurse -Force ".turbo"
    Write-Host "✅ .turbo removido" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ CACHE LIMPO COM SUCESSO!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Execute: " -ForegroundColor White -NoNewline
Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "2️⃣  No navegador:" -ForegroundColor White
Write-Host "   • Feche TODAS as abas do projeto" -ForegroundColor Gray
Write-Host "   • Pressione Ctrl+Shift+Delete" -ForegroundColor Gray
Write-Host "   • Limpe cache (última hora)" -ForegroundColor Gray
Write-Host "   • Abra: http://localhost:3000/funil-stepone" -ForegroundColor Gray
Write-Host ""
Write-Host "3️⃣  Teste:" -ForegroundColor White
Write-Host "   • Abra um card" -ForegroundColor Gray
Write-Host "   • Veja se o fundo é BRANCO/OFF-WHITE" -ForegroundColor Gray
Write-Host "   • NÃO deve ter azul escuro!" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 DICA: Se ainda aparecer azul:" -ForegroundColor Cyan
Write-Host "   • Pressione Ctrl+Shift+R (5 vezes)" -ForegroundColor Yellow
Write-Host "   • Ou abra em janela anônima (Ctrl+Shift+N)" -ForegroundColor Yellow
Write-Host ""

Write-Host "🚀 Iniciando servidor..." -ForegroundColor Green
Write-Host ""

# Iniciar servidor
npm run dev
