# === НАСТРОЙКИ ===
$repoUrl = "https://github.com/perudosmundos/audio.git"
$commitMsg = "Автоматический коммит: обновление проекта"
# ==================

# Проверка, есть ли .git
if (-not (Test-Path ".git")) {
    git init
    git branch -M main
    git remote add origin $repoUrl
} else {
    # Если remote уже есть, обновим его на всякий случай
    git remote set-url origin $repoUrl
}

# Добавить все изменения
git add .

# Сделать коммит (если есть изменения)
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "$commitMsg"
} else {
    Write-Host "Нет изменений для коммита."
}

# Отправить на GitHub
git push -u origin main