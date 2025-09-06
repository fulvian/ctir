#!/bin/bash
# Store CTIR secrets into macOS Keychain and (optionally) update .env

set -e

echo "🔐 CTIR Key Setup (macOS Keychain)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "❌ This helper supports macOS only."
  exit 1
fi

read -p "Anthropic CLAUDE_API_KEY (leave empty to skip): " -r CLAUDE
read -p "OpenRouter OPEN_ROUTER_API_KEY (leave empty to skip): " -r OPENROUTER

if [[ -n "$CLAUDE" ]]; then
  security add-generic-password -a "$USER" -s CTIR_CLAUDE_API_KEY -w "$CLAUDE" -U >/dev/null
  echo "✅ Stored CTIR_CLAUDE_API_KEY in Keychain"
fi

if [[ -n "$OPENROUTER" ]]; then
  security add-generic-password -a "$USER" -s CTIR_OPEN_ROUTER_API_KEY -w "$OPENROUTER" -U >/dev/null
  echo "✅ Stored CTIR_OPEN_ROUTER_API_KEY in Keychain"
fi

echo ""
echo "ℹ️  At runtime CTIR will read .env first, then hydrate missing keys from Keychain."
echo "   - Service names: CTIR_CLAUDE_API_KEY, CTIR_OPEN_ROUTER_API_KEY"
echo "   - Account: $USER"

read -p "Also mirror values into .env now? (y/N): " -n 1 -r; echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  touch .env
  if [[ -n "$CLAUDE" ]]; then
    if grep -q '^CLAUDE_API_KEY=' .env; then
      sed -i '' "s|^CLAUDE_API_KEY=.*|CLAUDE_API_KEY=$CLAUDE|" .env
    else
      echo "CLAUDE_API_KEY=$CLAUDE" >> .env
    fi
  fi
  if [[ -n "$OPENROUTER" ]]; then
    if grep -q '^OPEN_ROUTER_API_KEY=' .env; then
      sed -i '' "s|^OPEN_ROUTER_API_KEY=.*|OPEN_ROUTER_API_KEY=$OPENROUTER|" .env
    else
      echo "OPEN_ROUTER_API_KEY=$OPENROUTER" >> .env
    fi
  fi
  echo "✅ Updated .env"
fi

echo "✅ Done"

