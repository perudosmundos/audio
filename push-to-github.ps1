# Установка кодировки UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# === НАСТРОЙКИ ===
$repoUrl = "https://github.com/perudosmundos/audio.git"
$commitMsg = "Auto commit: project update"
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
    Write-Host "No changes to commit."
}

# Отправить на GitHub
git push -u origin main