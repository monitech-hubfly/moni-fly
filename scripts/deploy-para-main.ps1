param(
  [Parameter(Mandatory=$true)]
  [string]$CommitHash
)

Write-Host "Deploy: cherry-pick $CommitHash para main" -ForegroundColor Cyan

git stash
git checkout main
git pull origin main

git cherry-pick $CommitHash
if (-not $?) {
  Write-Host "CONFLITO no cherry-pick - parando, resolva manualmente." -ForegroundColor Red
  exit 1
}

git status --short
git log --oneline -3

Write-Host ""
Write-Host "Cherry-pick aplicado. Revise o resultado acima." -ForegroundColor Yellow
$confirmacao = Read-Host "Digite 'sim' para confirmar o push para main (qualquer outra tecla cancela)"
if ($confirmacao -ne 'sim') {
  Write-Host "Push cancelado. Ainda em main com o cherry-pick aplicado — resolva manualmente." -ForegroundColor Red
  exit 1
}

git push origin main

git checkout funcionalidade-danilo
git stash pop
git status --short

Write-Host "Deploy concluido." -ForegroundColor Green
