# Deploy script for DosMundosPodcast
# UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Configuration
$repoUrl = "https://github.com/perudosmundos/audio.git"
$commitMsg = "Auto commit: Improved proxy servers and audio compatibility for Russia"
$branchName = "main"

Write-Host "Starting deployment process..." -ForegroundColor Green

# Check if .git exists
if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..." -ForegroundColor Yellow
    git init
    git branch -M $branchName
    git remote add origin $repoUrl
    Write-Host "Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "Updating git remote..." -ForegroundColor Yellow
    git remote set-url origin $repoUrl
    Write-Host "Git remote updated" -ForegroundColor Green
}

# Check repository status
Write-Host "Checking repository status..." -ForegroundColor Yellow
$status = git status --porcelain

if ($status) {
    Write-Host "Found changes to commit:" -ForegroundColor Yellow
    Write-Host $status -ForegroundColor Gray
    
    # Add all changes
    Write-Host "Adding all changes..." -ForegroundColor Yellow
    git add .
    Write-Host "Changes added to staging" -ForegroundColor Green

    # Create commit
    Write-Host "Creating commit..." -ForegroundColor Yellow
    git commit -m "$commitMsg"
    Write-Host "Commit created successfully" -ForegroundColor Green

    # Push to GitHub
    Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
    try {
        git push -u origin $branchName
        Write-Host "Successfully pushed to GitHub!" -ForegroundColor Green
        
        # Deployment info
        Write-Host "`nDeployment Summary:" -ForegroundColor Cyan
        Write-Host "   Repository: $repoUrl" -ForegroundColor White
        Write-Host "   Branch: $branchName" -ForegroundColor White
        Write-Host "   Commit: $commitMsg" -ForegroundColor White
        Write-Host "   Vercel will automatically deploy the changes" -ForegroundColor White
        
        Write-Host "`nDeployment process completed successfully!" -ForegroundColor Green
        Write-Host "   The changes will be live on Vercel in a few minutes." -ForegroundColor Cyan
        
    } catch {
        Write-Host "Error pushing to GitHub: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "No changes to commit." -ForegroundColor Yellow
    Write-Host "   Repository is up to date." -ForegroundColor Gray
}

Write-Host "`nScript execution completed." -ForegroundColor Green 