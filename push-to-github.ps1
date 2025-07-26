# Установка кодировки UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# === НАСТРОЙКИ ===
$repoUrl = "https://github.com/perudosmundos/audio.git"
$commitMsg = "Fix: Added direct audio access and improved proxy fallback - removed problematic CORS proxies and added direct API route"
# ==================

Write-Host "Starting project update process..." -ForegroundColor Green

# Проверка, есть ли .git
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    git branch -M main
    git remote add origin $repoUrl
    Write-Host "Git repository initialized successfully" -ForegroundColor Green
} else {
    # Если remote уже есть, обновим его на всякий случай
    Write-Host "Updating remote URL..." -ForegroundColor Yellow
    git remote set-url origin $repoUrl
    Write-Host "Remote URL updated" -ForegroundColor Green
}

# Проверяем статус изменений
Write-Host "Checking changes status..." -ForegroundColor Yellow
git status

# Добавить все изменения
Write-Host "Adding all changes to staging..." -ForegroundColor Yellow
git add .

# Сделать коммит (если есть изменения)
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating commit with changes..." -ForegroundColor Yellow
    git commit -m "$commitMsg"
    Write-Host "Commit created: $commitMsg" -ForegroundColor Green
} else {
    Write-Host "No changes to commit." -ForegroundColor Blue
}

# Отправить на GitHub
Write-Host "Pushing changes to GitHub..." -ForegroundColor Yellow
try {
    git push -u origin main
    Write-Host "Changes successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "Project will be automatically updated on Vercel" -ForegroundColor Cyan
} catch {
    Write-Host "Error pushing to GitHub: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Process completed successfully!" -ForegroundColor Green
Write-Host "What was fixed:" -ForegroundColor Cyan
Write-Host "   - Improved audio proxy with streaming support" -ForegroundColor White
Write-Host "   - Added Range request support for audio" -ForegroundColor White
Write-Host "   - Implemented fallback mechanisms for bypassing blocks" -ForegroundColor White
Write-Host "   - Increased API route execution time limits" -ForegroundColor White
Write-Host "   - Added API for testing audio availability" -ForegroundColor White