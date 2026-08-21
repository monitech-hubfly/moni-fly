# Script de teste: Verificar se CardModal existe e está correto

Write-Host "🔍 TESTANDO ESTRUTURA DO CARD MODAL" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray
Write-Host ""

$errors = @()
$warnings = @()
$success = @()

# Teste 1: Verificar se os arquivos existem
Write-Host "📁 Teste 1: Verificando arquivos..." -ForegroundColor Yellow

$files = @(
    "src\app\funil-stepone\CardModal.tsx",
    "src\app\funil-stepone\KanbanWrapper.tsx",
    "src\app\funil-stepone\KanbanColumn.tsx",
    "src\app\funil-stepone\page.tsx"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
        $success += "Arquivo $file existe"
    } else {
        Write-Host "  ❌ $file NÃO ENCONTRADO" -ForegroundColor Red
        $errors += "Arquivo $file não encontrado"
    }
}

Write-Host ""

# Teste 2: Verificar imports no KanbanWrapper
Write-Host "📦 Teste 2: Verificando imports no KanbanWrapper..." -ForegroundColor Yellow

$wrapperContent = Get-Content "src\app\funil-stepone\KanbanWrapper.tsx" -Raw

if ($wrapperContent -match "import.*CardModal.*from.*'\./CardModal'") {
    Write-Host "  ✅ CardModal importado corretamente" -ForegroundColor Green
    $success += "CardModal importado no KanbanWrapper"
} else {
    Write-Host "  ❌ CardModal NÃO está importado" -ForegroundColor Red
    $errors += "CardModal não está importado no KanbanWrapper"
}

if ($wrapperContent -match "cardId\s*&&") {
    Write-Host "  ✅ Condição cardId encontrada" -ForegroundColor Green
    $success += "Condição cardId existe"
} else {
    Write-Host "  ❌ Condição cardId NÃO encontrada" -ForegroundColor Red
    $errors += "Condição cardId não encontrada no KanbanWrapper"
}

Write-Host ""

# Teste 3: Verificar onClick no KanbanColumn
Write-Host "🖱️  Teste 3: Verificando onClick no KanbanColumn..." -ForegroundColor Yellow

$columnContent = Get-Content "src\app\funil-stepone\KanbanColumn.tsx" -Raw

if ($columnContent -match "onClick.*router\.push.*funil-stepone\?card=") {
    Write-Host "  ✅ onClick configurado corretamente" -ForegroundColor Green
    $success += "onClick do card configurado"
} else {
    Write-Host "  ❌ onClick NÃO está configurado" -ForegroundColor Red
    $errors += "onClick não está configurado no botão do card"
}

Write-Host ""

# Teste 4: Verificar se CardModal tem useEffect
Write-Host "⚙️  Teste 4: Verificando CardModal..." -ForegroundColor Yellow

$modalContent = Get-Content "src\app\funil-stepone\CardModal.tsx" -Raw

if ($modalContent -match "useEffect.*loadCard") {
    Write-Host "  ✅ useEffect com loadCard encontrado" -ForegroundColor Green
    $success += "CardModal tem useEffect correto"
} else {
    Write-Host "  ⚠️  useEffect com loadCard não encontrado" -ForegroundColor Yellow
    $warnings += "CardModal pode não ter useEffect correto"
}

if ($modalContent -match "console\.log.*\[CardModal\]") {
    Write-Host "  ✅ Console.log de debug encontrado" -ForegroundColor Green
    $success += "CardModal tem logs de debug"
} else {
    Write-Host "  ⚠️  Console.log de debug não encontrado" -ForegroundColor Yellow
    $warnings += "CardModal não tem logs de debug (dificulta troubleshooting)"
}

Write-Host ""

# Teste 5: Verificar cache do Next.js
Write-Host "🗄️  Teste 5: Verificando cache..." -ForegroundColor Yellow

if (Test-Path ".next") {
    Write-Host "  ⚠️  Pasta .next existe (pode estar com cache antigo)" -ForegroundColor Yellow
    $warnings += "Cache do Next.js presente - recomendado limpar"
} else {
    Write-Host "  ✅ Pasta .next não existe (cache limpo)" -ForegroundColor Green
    $success += "Cache do Next.js limpo"
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Gray
Write-Host ""

# Resumo
Write-Host "📊 RESUMO:" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Sucessos: $($success.Count)" -ForegroundColor Green
Write-Host "⚠️  Avisos: $($warnings.Count)" -ForegroundColor Yellow
Write-Host "❌ Erros: $($errors.Count)" -ForegroundColor Red
Write-Host ""

if ($errors.Count -gt 0) {
    Write-Host "🔴 ERROS ENCONTRADOS:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  • $error" -ForegroundColor Red
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "⚠️  AVISOS:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Recomendações
Write-Host "💡 RECOMENDAÇÕES:" -ForegroundColor Cyan
Write-Host ""

if ($errors.Count -eq 0) {
    Write-Host "Os arquivos estão corretos! O problema provavelmente é:" -ForegroundColor Green
    Write-Host "  1. Cache do Next.js desatualizado" -ForegroundColor White
    Write-Host "  2. Cache do navegador" -ForegroundColor White
    Write-Host "  3. RLS do Supabase bloqueando" -ForegroundColor White
    Write-Host ""
    Write-Host "Execute:" -ForegroundColor Cyan
    Write-Host "  1. Remove-Item -Recurse -Force .next" -ForegroundColor White
    Write-Host "  2. npm run dev" -ForegroundColor White
    Write-Host "  3. Limpe o cache do navegador (Ctrl+Shift+R)" -ForegroundColor White
} else {
    Write-Host "Corrija os erros acima antes de continuar!" -ForegroundColor Red
}

Write-Host ""
