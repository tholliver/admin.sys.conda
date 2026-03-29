# deploy.ps1
$ErrorActionPreference = "Stop"

# ── Config ─────────────────────────────────────────
$APP_DIR  = "C:\Users\mad\.daconda\sys.conda"
$PM2_APP_NAME = "sys.conda"
$BRANCH   = "master"
# ───────────────────────────────────────────────────

$LOG_FILE = "$APP_DIR\deploy.log"

function log     { param($msg) $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"; Write-Host $line; Add-Content $LOG_FILE $line }
function success { param($msg) $line = "✅ $msg"; Write-Host $line -ForegroundColor Green; Add-Content $LOG_FILE $line }
function fail    { param($msg) $line = "❌ $msg"; Write-Host $line -ForegroundColor Red; Add-Content $LOG_FILE $line; exit 1 }

log "🚀 Deploy started"

Set-Location $APP_DIR -ErrorAction Stop | Out-Null

log "📦 Pulling $BRANCH..."
git fetch origin; if ($LASTEXITCODE -ne 0) { fail "Git fetch failed" }
git reset --hard "origin/$BRANCH"; if ($LASTEXITCODE -ne 0) { fail "Git reset failed" }
$commitInfo = git log -1 --pretty='%h %s'
success "Code updated — $commitInfo"

log "📥 Installing dependencies..."
bun install; if ($LASTEXITCODE -ne 0) { fail "bun install failed" }
success "Dependencies installed"

log "🔨 Building..."
bun run build; if ($LASTEXITCODE -ne 0) { fail "Build failed" }
success "Build complete"

log "♻️  Reloading PM2..."
pm2 reload "$APP_DIR\ecosystem.config.cjs" --only $PM2_APP_NAME; if ($LASTEXITCODE -ne 0) { fail "PM2 reload failed" }
success "PM2 reloaded"

Write-Host ""
Write-Host "══════════════════════════════════"
success "🎉 Deployment finished at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "══════════════════════════════════"
pm2 status $PM2_APP_NAME
