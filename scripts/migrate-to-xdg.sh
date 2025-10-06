#!/bin/bash

# Migration script to move agent-tts data from ~/.agent-tts to XDG Base Directory locations
# This script follows the XDG Base Directory Specification:
# https://specifications.freedesktop.org/basedir-spec/latest/

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# XDG paths with fallback defaults
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
XDG_CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"

# Old and new paths
OLD_DIR="$HOME/.agent-tts"
NEW_CONFIG_DIR="$XDG_CONFIG_HOME/agent-tts"
NEW_STATE_DIR="$XDG_STATE_HOME/agent-tts"
NEW_CACHE_DIR="$XDG_CACHE_HOME/agent-tts"

echo -e "${GREEN}Agent TTS XDG Migration Tool${NC}"
echo "=============================="
echo ""
echo "This script will migrate your agent-tts data to XDG Base Directory locations:"
echo "  Config: $NEW_CONFIG_DIR"
echo "  State:  $NEW_STATE_DIR"
echo "  Cache:  $NEW_CACHE_DIR"
echo ""

# Check if old directory exists
if [ ! -d "$OLD_DIR" ]; then
  echo -e "${YELLOW}No existing ~/.agent-tts directory found. Nothing to migrate.${NC}"
  exit 0
fi

echo -e "${YELLOW}Found existing data in $OLD_DIR${NC}"
echo ""

# Ask for confirmation
read -p "Do you want to proceed with the migration? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Migration cancelled."
  exit 0
fi

echo ""
echo "Starting migration..."
echo ""

# Create new directories
mkdir -p "$NEW_CONFIG_DIR"
mkdir -p "$NEW_STATE_DIR"
mkdir -p "$NEW_CACHE_DIR"

# Migrate configuration files
echo -e "${GREEN}[1/4]${NC} Migrating configuration..."
if [ -f "$OLD_DIR/index.ts" ]; then
  cp -v "$OLD_DIR/index.ts" "$NEW_CONFIG_DIR/config.ts"
  echo "  ✓ Configuration file migrated (renamed index.ts → config.ts)"
elif [ -f "$OLD_DIR/index.js" ]; then
  cp -v "$OLD_DIR/index.js" "$NEW_CONFIG_DIR/config.js"
  echo "  ✓ Configuration file migrated (renamed index.js → config.js)"
else
  echo "  ℹ No configuration files found"
fi

# Migrate images
if [ -d "$OLD_DIR/images" ]; then
  cp -rv "$OLD_DIR/images" "$NEW_CONFIG_DIR/"
  echo "  ✓ Images migrated"
else
  echo "  ℹ No images directory found"
fi

# Migrate database and state
echo -e "${GREEN}[2/4]${NC} Migrating database and state..."
if [ -f "$OLD_DIR/agent-tts.db" ]; then
  cp -v "$OLD_DIR/agent-tts.db" "$NEW_STATE_DIR/"
  echo "  ✓ Database migrated"
else
  echo "  ℹ No database found"
fi

# Migrate backups
if [ -d "$OLD_DIR/backups" ]; then
  cp -rv "$OLD_DIR/backups" "$NEW_STATE_DIR/"
  echo "  ✓ Database backups migrated"
else
  echo "  ℹ No backups directory found"
fi

# Migrate logs
if [ -d "$OLD_DIR/logs" ]; then
  cp -rv "$OLD_DIR/logs" "$NEW_STATE_DIR/"
  echo "  ✓ Logs migrated"
else
  echo "  ℹ No logs directory found"
fi

# Migrate audio cache
echo -e "${GREEN}[3/4]${NC} Migrating audio cache..."
if [ -d "$OLD_DIR/audio" ]; then
  cp -rv "$OLD_DIR/audio" "$NEW_CACHE_DIR/"
  echo "  ✓ Audio cache migrated"
else
  echo "  ℹ No audio cache found"
fi

# Create backup of old directory
echo -e "${GREEN}[4/4]${NC} Creating backup..."
BACKUP_DIR="$HOME/.agent-tts.backup.$(date +%Y%m%d-%H%M%S)"
mv "$OLD_DIR" "$BACKUP_DIR"
echo "  ✓ Old directory backed up to: $BACKUP_DIR"

echo ""
echo -e "${GREEN}Migration completed successfully!${NC}"
echo ""
echo "Your data has been moved to:"
echo "  • Config:    $NEW_CONFIG_DIR"
echo "  • Database:  $NEW_STATE_DIR"
echo "  • Audio:     $NEW_CACHE_DIR"
echo ""
echo "The old directory has been backed up to:"
echo "  • $BACKUP_DIR"
echo ""
echo "You can safely delete the backup once you've confirmed everything works:"
echo "  rm -rf $BACKUP_DIR"
echo ""
echo -e "${YELLOW}Please restart agent-tts for the changes to take effect.${NC}"
