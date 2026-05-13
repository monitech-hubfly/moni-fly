# ⚡ SCRIPT AUTOMÁTICO: Corrigir cores dos modais
# Resolve o problema do fundo azul escuro (Dark Mode)

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  CORREÇÃO: Fundo Azul Escuro nos Modais" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar arquivos modificados
Write-Host "📋 Verificando arquivos modificados..." -ForegroundColor Yellow
Write-Host ""

$arquivos = @(
    "src\styles\moni-tokens.css",
    "src\app\funil-stepone\CardModal.tsx",
    "src\app\funil-stepone\NovoCardModal.tsx"
)

$todosExistem = $true
foreach ($arquivo in $arquivos) {
    if (Test-Path $arquivo) {
        Write-Host "  ✅ $arquivo" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $arquivo NÃO ENCONTRADO" -ForegroundColor Red
        $todosExistem = $false
    }
}

if (-not $todosExistem) {
    Write-Host ""
    Write-Host "❌ Alguns arquivos não foram encontrados!" -ForegroundColor Red
    Write-Host "Você está na raiz do projeto?" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""

# 2. Verificar se dark mode foi desabilitado
Write-Host "🎨 Verificando dark mode..." -ForegroundColor Yellow

$cssContent = Get-Content "src\styles\moni-tokens.css" -Raw

if ($cssContent -match "/\*\s*@media\s*\(prefers-color-scheme:\s*dark\)") {
    Write-Host "  ✅ Dark mode DESABILITADO (comentado)" -ForegroundColor Green
} elseif ($cssContent -match "@media\s*\(prefers-color-scheme:\s*dark\)") {
    Write-Host "  ⚠️  Dark mode ainda ATIVO" -ForegroundColor Yellow
    Write-Host "     O código foi modificado mas pode não ter sido salvo" -ForegroundColor Yellow
} else {
    Write-Host "  ℹ️  Dark mode não encontrado no CSS" -ForegroundColor Cyan
}

Write-Host ""

# 3. Parar servidor Node
Write-Host "⏸️  Parando servidor Next.js..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  ✅ Servidor parado" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Nenhum servidor rodando" -ForegroundColor Cyan
}

Write-Host ""

# 4. Limpar cache
Write-Host "🗑️  Limpando cache do Next.js..." -ForegroundColor Yellow

$removidos = 0

if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "  ✅ .next removido" -ForegroundColor Green
    $removidos++
}

if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "  ✅ node_modules\.cache removido" -ForegroundColor Green
    $removidos++
}

if (Test-Path ".turbo") {
    Remove-Item -Recurse -Force ".turbo"
    Write-Host "  ✅ .turbo removido" -ForegroundColor Green
    $removidos++
}

if ($removidos -eq 0) {
    Write-Host "  ℹ️  Cache já estava limpo" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ PREPARAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# 5. Instruções finais
Write-Host "📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Execute agora: " -ForegroundColor White -NoNewline
Write-Host "npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "2️⃣  No navegador (MUITO IMPORTANTE!):" -ForegroundColor White
Write-Host ""
Write-Host "    Opção A - Hard Reload (mais rápido):" -ForegroundColor Cyan
Write-Host "      • Vá para: http://localhost:3000/funil-stepone" -ForegroundColor Gray
Write-Host "      • Pressione: Ctrl+Shift+R (5 vezes!)" -ForegroundColor Gray
Write-Host ""
Write-Host "    Opção B - Limpar cache (mais garantido):" -ForegroundColor Cyan
Write-Host "      • Feche TODAS as abas do projeto" -ForegroundColor Gray
Write-Host "      • Pressione: Ctrl+Shift+Delete" -ForegroundColor Gray
Write-Host "      • Marque: 'Imagens e arquivos em cache'" -ForegroundColor Gray
Write-Host "      • Período: 'Última hora'" -ForegroundColor Gray
Write-Host "      • Clique: 'Limpar dados'" -ForegroundColor Gray
Write-Host "      • Abra: http://localhost:3000/funil-stepone" -ForegroundColor Gray
Write-Host ""
Write-Host "    Opção C - Janela anônima (para testar):" -ForegroundColor Cyan
Write-Host "      • Pressione: Ctrl+Shift+N" -ForegroundColor Gray
Write-Host "      • Abra: http://localhost:3000/funil-stepone" -ForegroundColor Gray
Write-Host ""

Write-Host "3️⃣  Abra um card e verifique:" -ForegroundColor White
Write-Host "    ✅ Coluna esquerda: off-white suave (#f9f7f4)" -ForegroundColor Gray
Write-Host "    ✅ Coluna direita: branco puro (#ffffff)" -ForegroundColor Gray
Write-Host "    ✅ Textos: verde/marrom (NÃO branco)" -ForegroundColor Gray
Write-Host "    ❌ SEM fundo azul escuro" -ForegroundColor Gray
Write-Host ""

Write-Host "💡 DICA:" -ForegroundColor Cyan
Write-Host "   Se ainda aparecer azul, seu Windows pode estar em Dark Mode" -ForegroundColor Gray
Write-Host "   Configurações → Personalização → Cores → Claro" -ForegroundColor Gray
Write-Host ""

Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
