#!/usr/bin/env bash
set -euo pipefail

# Deploy CTIR to production locations and register services.
# Supports Linux (systemd) and macOS (launchd, user-level).

REPO_DIR=$(cd "$(dirname "$0")/../.." && pwd)
OS=$(uname -s)
NODE_BIN=$(command -v node || true)
if [ -z "${NODE_BIN}" ]; then
  echo "❌ Node.js not found in PATH" >&2
  exit 1
fi

echo "ℹ️ Detected OS: ${OS}"

if [ "${OS}" = "Linux" ]; then
  echo "🚀 Deploying on Linux (systemd)"

  # Create service user and dirs
  if ! id ctir >/dev/null 2>&1; then
    (useradd -r -s /usr/sbin/nologin ctir 2>/dev/null || adduser --system --no-create-home ctir 2>/dev/null || true)
  fi
  install -d -m 0755 -o ctir -g ctir /opt/ctir /etc/ctir /var/lib/ctir

  echo "📁 Syncing repository to /opt/ctir"
  rsync -a --delete --exclude ".git" --exclude "node_modules" "${REPO_DIR}/" /opt/ctir/
  chown -R ctir:ctir /opt/ctir

  echo "⚙️ Preparing environment file"
  if [ -f "/opt/ctir/.env" ]; then
    cp /opt/ctir/.env /etc/ctir/ctir.env
  else
    cp /opt/ctir/.env.example /etc/ctir/ctir.env
  fi
  sed -i 's#^DB_PATH=.*#DB_PATH=/var/lib/ctir/ctir.db#' /etc/ctir/ctir.env || true

  echo "📦 Installing and building (this may take a while)"
  cd /opt/ctir
  sudo -u ctir -H npm install
  sudo -u ctir -H npm run build
  sudo -u ctir -H npm run db:setup
  sudo -u ctir -H npm run mcp:install
  sudo -u ctir -H npm run mcp:build

  echo "🧾 Installing systemd units"
  cp local-development/configs/systemd/ctir.service /etc/systemd/system/ctir.service
  cp local-development/configs/systemd/ctir-ollama-mcp.service /etc/systemd/system/ctir-ollama-mcp.service
  systemctl daemon-reload
  systemctl enable ctir.service ctir-ollama-mcp.service
  systemctl restart ctir.service ctir-ollama-mcp.service
  systemctl status --no-pager ctir.service || true

  echo "✅ Deployment complete on Linux."

elif [ "${OS}" = "Darwin" ]; then
  echo "🚀 Deploying on macOS (launchd, user-level)"
  WORKDIR="${REPO_DIR}"
  LAUNCHD_DIR="${HOME}/Library/LaunchAgents"
  mkdir -p "${LAUNCHD_DIR}"

  # Prepare plists with placeholders replaced
  APP_PLIST="${LAUNCHD_DIR}/com.ctir.app.plist"
  MCP_PLIST="${LAUNCHD_DIR}/com.ctir.ollama-mcp.plist"
  sed "s#__NODE_PATH__#${NODE_BIN}#g; s#__WORKDIR__#${WORKDIR}#g" \
    "${REPO_DIR}/local-development/configs/launchd/com.ctir.app.plist" >"${APP_PLIST}"
  sed "s#__NODE_PATH__#${NODE_BIN}#g; s#__WORKDIR__#${WORKDIR}#g" \
    "${REPO_DIR}/local-development/configs/launchd/com.ctir.ollama-mcp.plist" >"${MCP_PLIST}"

  echo "📦 Installing and building"
  cd "${WORKDIR}"
  npm install
  npm run build
  npm run db:setup
  npm run mcp:install
  npm run mcp:build

  echo "🧾 Loading launch agents"
  launchctl unload "${APP_PLIST}" 2>/dev/null || true
  launchctl unload "${MCP_PLIST}" 2>/dev/null || true
  launchctl load "${APP_PLIST}"
  launchctl load "${MCP_PLIST}"
  launchctl start com.ctir.app || true
  launchctl start com.ctir.ollama-mcp || true

  echo "✅ Deployment complete on macOS."

else
  echo "❌ Unsupported OS: ${OS}" >&2
  exit 2
fi

