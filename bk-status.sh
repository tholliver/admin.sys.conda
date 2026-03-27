#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

BACKUP_DIR="/home/mad/.daconda/sys.conda/backups"
LOG_FILE="/var/log/sysconda_backup.log"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║         sys.conda — BACKUP STATUS            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Timezone & Time ───────────────────────────────────────────────────────────
echo -e "${BLUE}▸ SYSTEM TIME${NC}"
echo -e "  Local : $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo -e "  UTC   : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

# ── Cron jobs ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}▸ CRON JOBS${NC}"
echo -e "  ${BOLD}User (backup):${NC}"
crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" | while read line; do
    echo -e "    ${GREEN}$line${NC}"
done
echo -e "  ${BOLD}Root (shutdown):${NC}"
sudo crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" | while read line; do
    echo -e "    ${YELLOW}$line${NC}"
done
echo ""

# ── Backup script ─────────────────────────────────────────────────────────────
echo -e "${BLUE}▸ BACKUP SCRIPT${NC}"
if [[ -x /usr/local/bin/sysconda_backup.sh ]]; then
    echo -e "  ${GREEN}✓ /usr/local/bin/sysconda_backup.sh — executable${NC}"
else
    echo -e "  ${RED}✗ Script missing or not executable${NC}"
fi
echo ""

# ── pg_dump ───────────────────────────────────────────────────────────────────
echo -e "${BLUE}▸ POSTGRESQL${NC}"
PG_PATH=$(which pg_dump 2>/dev/null)
if [[ -n "$PG_PATH" ]]; then
    PG_VER=$(pg_dump --version 2>/dev/null)
    echo -e "  ${GREEN}✓ $PG_VER${NC}"
    echo -e "    Path: $PG_PATH"
else
    echo -e "  ${RED}✗ pg_dump not found${NC}"
fi
echo ""

# ── Backup files ──────────────────────────────────────────────────────────────
echo -e "${BLUE}▸ BACKUP FILES ($BACKUP_DIR)${NC}"
if [[ -d "$BACKUP_DIR" ]]; then
    FILES=$(ls -t "$BACKUP_DIR"/*.dump 2>/dev/null)
    if [[ -z "$FILES" ]]; then
        echo -e "  ${YELLOW}No backup files found${NC}"
    else
        COUNT=0
        while IFS= read -r f; do
            COUNT=$((COUNT + 1))
            NAME=$(basename "$f")
            SIZE=$(stat -c%s "$f" 2>/dev/null || echo 0)
            SIZE_KB=$((SIZE / 1024))
            MTIME=$(stat -c '%y' "$f" | cut -d'.' -f1)
            if [[ $COUNT -eq 1 ]]; then
                echo -e "  ${GREEN}★ $NAME — ${SIZE_KB}KB — $MTIME [LATEST]${NC}"
            else
                echo -e "    $NAME — ${SIZE_KB}KB — $MTIME"
            fi
        done <<< "$FILES"
        TOTAL=$(echo "$FILES" | wc -l)
        echo -e "  ${BOLD}Total: $TOTAL file(s)${NC}"
    fi
else
    echo -e "  ${RED}✗ Backup directory not found${NC}"
fi
echo ""

# ── Last backup timestamp ─────────────────────────────────────────────────────
echo -e "${BLUE}▸ LAST CRON BACKUP${NC}"
LAST_FILE="$BACKUP_DIR/.last_backup"
if [[ -f "$LAST_FILE" ]]; then
    LAST_TS=$(cat "$LAST_FILE")
    echo -e "  ${GREEN}✓ $LAST_TS${NC}"
else
    echo -e "  ${YELLOW}⚠ .last_backup not written yet${NC}"
fi
echo ""

# ── Recent log ────────────────────────────────────────────────────────────────
echo -e "${BLUE}▸ LAST 5 LOG ENTRIES${NC}"
if [[ -f "$LOG_FILE" ]]; then
    tail -5 "$LOG_FILE" | while read line; do
        if echo "$line" | grep -q "SUCCESS"; then
            echo -e "  ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "ERROR"; then
            echo -e "  ${RED}$line${NC}"
        else
            echo -e "  $line"
        fi
    done
else
    echo -e "  ${YELLOW}No log file found${NC}"
fi

echo ""
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
