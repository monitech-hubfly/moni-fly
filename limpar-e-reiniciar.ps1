# Script para limpar cache do Next.js e reiniciar servidor
# Execute: .\limpar-e-reiniciar.ps1

Write-Host "🧹 Limpando cache do Next.js..." -ForegroundColor Yellow

# Para o servidor se estiver rodando (opcional)
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⏸️  Parando processos Node..." -ForegroundColor Yellow
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Remove a pasta .next
if (Test-Path ".next") {
    Write-Host "🗑️  Removendo pasta .next..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".next"
    Write-Host "✅ Pasta .next removida" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Pasta .next não existe" -ForegroundColor Cyan
}

# Remove node_modules/.cache se existir
if (Test-Path "node_modules\.cache") {
    Write-Host "🗑️  Removendo cache do node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "✅ Cache do node_modules removido" -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ Limpeza concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "1. Execute: npm run dev" -ForegroundColor White
Write-Host "2. Abra o navegador: http://localhost:3000/funil-stepone" -ForegroundColor White
Write-Host "3. Limpe o cache do navegador (Ctrl+Shift+R)" -ForegroundColor White
Write-Host "4. Abra o DevTools (F12) e vá para a aba Console" -ForegroundColor White
Write-Host "5. Clique em um card e veja os logs" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Iniciando servidor..." -ForegroundColor Yellow
Write-Host ""

# Inicia o servidor
npm run dev
