# Установка кодировки UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# === НАСТРОЙКИ ===
$repoUrl = "https://github.com/perudosmundos/audio.git"
$commitMsg = "Auto commit: Improved proxy servers and audio compatibility for Russia"
$branchName = "main"
# ==================

Write-Host "🚀 Starting deployment process..." -ForegroundColor Green

# Проверка, есть ли .git
if (-not (Test-Path ".git")) {
    Write-Host "📁 Initializing git repository..." -ForegroundColor Yellow
    git init
    git branch -M $branchName
    git remote add origin $repoUrl
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
} else {
    # Если remote уже есть, обновим его на всякий случай
    Write-Host "🔄 Updating git remote..." -ForegroundColor Yellow
    git remote set-url origin $repoUrl
    Write-Host "✅ Git remote updated" -ForegroundColor Green
}

# Проверяем статус репозитория
Write-Host "📊 Checking repository status..." -ForegroundColor Yellow
$status = git status --porcelain

if ($status) {
    Write-Host "📝 Found changes to commit:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor Gray
    
    # Добавить все изменения
    Write-Host "➕ Adding all changes..." -ForegroundColor Yellow
    git add .
    Write-Host "✅ Changes added to staging" -ForegroundColor Green

    # Сделать коммит
    Write-Host "💾 Creating commit..." -ForegroundColor Yellow
    git commit -m "$commitMsg"
    Write-Host "✅ Commit created successfully" -ForegroundColor Green

    # Отправить на GitHub
    Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
    try {
        git push -u origin $branchName
        Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
        
        # Информация о деплое
        Write-Host "`n📋 Deployment Summary:" -ForegroundColor Cyan
        Write-Host "   • Repository: $repoUrl" -ForegroundColor White
        Write-Host "   • Branch: $branchName" -ForegroundColor White
        Write-Host "   • Commit: $commitMsg" -ForegroundColor White
        Write-Host "   • Vercel will automatically deploy the changes" -ForegroundColor White
        
        Write-Host "`n🎉 Deployment process completed successfully!" -ForegroundColor Green
        Write-Host "   The changes will be live on Vercel in a few minutes." -ForegroundColor Cyan
        
    } catch {
        Write-Host "❌ Error pushing to GitHub: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "ℹ️  No changes to commit." -ForegroundColor Yellow
    Write-Host "   Repository is up to date." -ForegroundColor Gray
}

Write-Host "`n🏁 Script execution completed." -ForegroundColor Green