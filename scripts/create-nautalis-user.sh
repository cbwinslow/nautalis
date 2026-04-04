#!/bin/bash
# Nautalis System User Setup Script
# Creates a dedicated 'nautalis' system user for running the daemon securely.
# Run this script as root or with sudo.

set -e

NAUTALIS_USER="nautalis"
NAUTALIS_GROUP="nautalis"

echo "🐙 Creating Nautalis system user..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "ERROR: This script must be run as root or with sudo" >&2
   exit 1
fi

# Check if user already exists
if id "$NAUTALIS_USER" &>/dev/null; then
  echo "  User '$NAUTALIS_USER' already exists. Skipping creation."
else
  # Create group if it doesn't exist
  if ! getent group "$NAUTALIS_GROUP" >/dev/null; then
    echo "  Creating group: $NAUTALIS_GROUP"
    groupadd --system "$NAUTALIS_GROUP"
  fi

  # Create system user with no login shell
  echo "  Creating user: $NAUTALIS_USER"
  useradd \
    --system \
    --no-create-home \
    --home "/nonexistent" \
    --shell /usr/sbin/nologin \
    --group "$NAUTALIS_GROUP" \
    "$NAUTALIS_USER"
fi

# Create optional config directory if it doesn't exist
CONFIG_DIR="/etc/nautalis"
if [ ! -d "$CONFIG_DIR" ]; then
  echo "  Creating config directory: $CONFIG_DIR"
  mkdir -p "$CONFIG_DIR"
  chown "$NAUTALIS_USER:$NAUTALIS_GROUP" "$CONFIG_DIR"
  chmod 755 "$CONFIG_DIR"
else
  echo "  Config directory exists: $CONFIG_DIR"
fi

# Create optional data directory if it doesn't exist
DATA_DIR="/var/lib/nautalis"
if [ ! -d "$DATA_DIR" ]; then
  echo "  Creating data directory: $DATA_DIR"
  mkdir -p "$DATA_DIR"
  chown "$NAUTALIS_USER:$NAUTALIS_GROUP" "$DATA_DIR"
  chmod 755 "$DATA_DIR"
else
  echo "  Data directory exists: $DATA_DIR"
fi

echo ""
echo "✅ Nautalis system user setup complete!"
echo ""
echo "To run the daemon as the nautalis user:"
echo "  sudo -u $NAUTALIS_USER nautalis daemon start"
echo ""
echo "For production, consider creating a systemd service:"
echo "  [Unit]"
echo "  Description=Nautalis Daemon"
echo "  After=network.target postgresql.service"
echo ""
echo "  [Service]"
echo "  Type=simple"
echo "  User=$NAUTALIS_USER"
echo "  Group=$NAUTALIS_GROUP"
echo "  ExecStart=$(which nautalis) daemon start"
echo "  Restart=on-failure"
echo ""
echo "  [Install]"
echo "  WantedBy=multi-user.target"
echo ""
