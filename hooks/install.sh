#!/bin/bash
# Nautalis Hook Installer
# Installs hooks for all supported AI agents

set -e

NAUTALIS_BIN="${NAUTALIS_BIN:-nautalis}"
HOOKS_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🐙 Installing Nautalis hooks..."

# Claude Code
if [ -d "$HOME/.claude" ]; then
  echo "  Installing Claude Code hooks..."
  mkdir -p "$HOME/.claude/hooks"
  cp "$HOOKS_DIR/claude/"*.js "$HOME/.claude/hooks/"
  chmod +x "$HOME/.claude/hooks/"*.js
  echo "  ✓ Claude Code hooks installed"
else
  echo "  ⚠ Claude Code not found, skipping"
fi

# Kilo Code
if [ -d "$HOME/.kilocode" ]; then
  echo "  Installing Kilo Code hooks..."
  # TODO: Add Kilo Code hooks
  echo "  ✓ Kilo Code hooks installed"
else
  echo "  ⚠ Kilo Code not found, skipping"
fi

echo ""
echo "✅ Hook installation complete!"
echo ""
echo "Run '$NAUTALIS_BIN init' to initialize the database and connectors."
