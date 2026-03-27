#!/bin/bash
# deploy.sh

set -e

# ── Config ─────────────────────────────────────────
APP_DIR="/home/mad/.daconda/sys.conda"
PM2_APP_NAME="sys.conda"
BRANCH="master"
# ───────────────────────────────────────────────────

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="$APP_DIR/deploy.log"

log() { echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"; }
success() { echo -e "\033[0;32m✅ $1\033[0m" | tee -a "$LOG_FILE"; }
fail() { echo -e "\033[0;31m❌ $1\033[0m" | tee -a "$LOG_FILE"; exit 1; }

log "🚀 Deploy started"

cd "$APP_DIR" || fail "Cannot cd into $APP_DIR"

log "📦 Pulling $BRANCH..."
git fetch origin || fail "Git fetch failed"
git reset --hard origin/$BRANCH || fail "Git reset failed"
success "Code updated — $(git log -1 --pretty='%h %s')"

log "📥 Installing dependencies..."
bun install || fail "bun install failed"
success "Dependencies installed"

log "🔨 Building..."
bun run build || fail "Build failed"
success "Build complete"

log "♻️  Reloading PM2..."
pm2 reload "$APP_DIR/ecosystem.config.cjs" --only "$PM2_APP_NAME" || fail "PM2 reload failed"
success "PM2 reloaded"

echo ""
echo "══════════════════════════════════"
success "🎉 Deployment finished at $TIMESTAMP"
echo "══════════════════════════════════"
pm2 status "$PM2_APP_NAME"
