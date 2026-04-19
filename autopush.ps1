# autopush.ps1
# GLUV project auto commit and push
#
# Usage:
#   .\autopush.ps1
#   .\autopush.ps1 "fix: some bug"

param(
    [string]$Message = "chore: auto-sync from Cowork"
)

Write-Host ""
Write-Host "==== GLUV AutoPush ====" -ForegroundColor Cyan

# Step 1: remove stale lock file if any
if (Test-Path ".git/index.lock") {
    Remove-Item ".git/index.lock" -Force -ErrorAction SilentlyContinue
    Write-Host "[1/5] Removed stale .git/index.lock" -ForegroundColor Green
} else {
    Write-Host "[1/5] No lock file (OK)" -ForegroundColor Green
}

# Step 2: stage all changes
git add -A
Write-Host "[2/5] Staged all changes" -ForegroundColor Green

# Step 3: check if there is anything to commit
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "[3/5] Nothing to commit. Exiting." -ForegroundColor Yellow
    exit 0
}

Write-Host "[3/5] Files to commit:" -ForegroundColor Cyan
$staged | ForEach-Object { Write-Host "       - $_" -ForegroundColor Gray }

# Step 4: commit
Write-Host "[4/5] Committing with message: $Message" -ForegroundColor Cyan
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed. See error above." -ForegroundColor Red
    exit 1
}

# Step 5: push
Write-Host "[5/5] Pushing to origin/main..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Done! Pushed to GitHub." -ForegroundColor Green
    Write-Host "https://github.com/windyflower1219-design/GLUV" -ForegroundColor Blue
} else {
    Write-Host ""
    Write-Host "Push failed. Check network or GitHub credentials." -ForegroundColor Red
    Write-Host "Hint: run 'git config --global credential.helper manager' and retry." -ForegroundColor Yellow
    exit 1
}
