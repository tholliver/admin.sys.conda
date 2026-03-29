# deploy.ps1
$ErrorActionPreference = "Stop"

# ── Config ─────────────────────────────────────────
$REPO_URL     = "https://github.com/tholliver/admin.sys.conda.git"
$PM2_APP_NAME = "sys.conda"
$BRANCH       = "master"
$APP_DIR      = Join-Path $PSScriptRoot "admin.sys.conda"
# ───────────────────────────────────────────────────

function log     { param($msg) Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg" }
function success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function fail    { param($msg) Write-Host "❌ $msg" -ForegroundColor Red; exit 1 }

log "🚀 Deploy started"
log "📁 Target: $APP_DIR"

# ── Check required tools ────────────────────────────
foreach ($tool in @("git", "bun", "pm2")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { fail "$tool not found in PATH" }
}
success "Tools verified (git, bun, pm2)"

# ── Clone or pull ───────────────────────────────────
if (Test-Path "$APP_DIR\.git") {
    log "📦 Pulling $BRANCH..."
    Set-Location $APP_DIR
    git fetch origin; if ($LASTEXITCODE -ne 0) { fail "Git fetch failed" }
    git reset --hard "origin/$BRANCH"; if ($LASTEXITCODE -ne 0) { fail "Git reset failed" }
} else {
    log "📥 Cloning into $APP_DIR..."
    git clone --branch $BRANCH $REPO_URL $APP_DIR; if ($LASTEXITCODE -ne 0) { fail "Git clone failed" }
    Set-Location $APP_DIR
}
success "Code ready — $(git log -1 --pretty='%h %s')"

# ── Ensure logs dir exists ──────────────────────────
New-Item -ItemType Directory -Force -Path "$APP_DIR\logs" | Out-Null

# ── Install deps ────────────────────────────────────
log "📦 Installing dependencies..."
bun install; if ($LASTEXITCODE -ne 0) { fail "bun install failed" }
success "Dependencies installed"

# ── Build ───────────────────────────────────────────
log "🔨 Building..."
bun run build; if ($LASTEXITCODE -ne 0) { fail "Build failed" }
if (-not (Test-Path "$APP_DIR\dist\server\entry.mjs")) { fail "Build output missing: dist/server/entry.mjs not found" }
success "Build complete"

# ── PM2 ─────────────────────────────────────────────
$ecosystemFile = "$APP_DIR\ecosystem.config.cjs"
$isRunning = pm2 describe $PM2_APP_NAME 2>$null | Select-String "online"

if ($isRunning) {
    log "♻️  Reloading PM2 ($PM2_APP_NAME)..."
    pm2 reload $ecosystemFile --only $PM2_APP_NAME; if ($LASTEXITCODE -ne 0) { fail "PM2 reload failed" }
} else {
    log "▶️  Starting PM2 ($PM2_APP_NAME)..."
    pm2 start $ecosystemFile --only $PM2_APP_NAME; if ($LASTEXITCODE -ne 0) { fail "PM2 start failed" }
}

pm2 save | Out-Null

Write-Host ""
Write-Host "══════════════════════════════════"
success "🎉 Deploy finished at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "══════════════════════════════════"
pm2 status $PM2_APP_NAME
