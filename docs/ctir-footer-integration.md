# CTIR Model Indicator Integration for Claude Code
# This file provides instructions for integrating CTIR model indicator into Claude Code footer

## Integration Methods

### Method 1: Direct API Integration (Recommended)
Add this to your Claude Code configuration or custom prompt:

```
# CTIR Model Indicator
To show the current LLM model being used, run this command in Claude Code:
```bash
curl -s http://localhost:3001/model-indicator | jq -r '.indicator'
```

This will display: `🎭 CTIR: Sonnet 4 (Anthropic) | Conf: 90% | 🟢 0% | 🟢 active`

### Method 2: Status Line Integration
Add to your Claude Code status line configuration:

```bash
# Add to your status line script
CTIR_INDICATOR=$(curl -s http://localhost:3001/model-indicator | jq -r '.indicator' 2>/dev/null || echo "🎭 CTIR: Offline")
echo "CTIR: $CTIR_INDICATOR"
```

### Method 3: Custom Footer Display
Create a custom footer display by running:

```bash
# Continuous monitoring
watch -n 5 'curl -s http://localhost:3001/model-indicator | jq -r ".indicator"'
```

### Method 4: Integration with cc-sessions
If you're using cc-sessions, add this to your statusline-script.sh:

```bash
# Add CTIR indicator to cc-sessions status line
get_ctir_indicator() {
    local ctir_indicator=$(curl -s --connect-timeout 2 http://localhost:3001/model-indicator | jq -r '.indicator' 2>/dev/null || echo "🎭 CTIR: Offline")
    echo -e "\033[38;5;111mCTIR: $ctir_indicator\033[0m"
}
```

## Real-time Monitoring

### Terminal Monitor
```bash
# Run the CTIR monitor script
./scripts/ctir-model-indicator.sh monitor
```

### API Endpoint Details
- **URL**: `http://localhost:3001/model-indicator`
- **Method**: GET
- **Response**: JSON with indicator and detailed data
- **Update Frequency**: Every 5 seconds

### Example Response
```json
{
  "indicator": "🎭 CTIR: Sonnet 4 (Anthropic) | Conf: 90% | 🟢 0% | 🟢 active",
  "data": {
    "currentModel": "claude-3-5-sonnet-20241022",
    "modelProvider": "Anthropic",
    "routingStrategy": "claude_direct",
    "confidence": 0.9,
    "sessionState": "active",
    "tokenUsage": {
      "percentage": 0,
      "warning": "Transcript not found"
    },
    "lastUpdate": "2025-09-05T22:54:08.680Z"
  },
  "timestamp": "2025-09-05T22:54:12.328Z"
}
```

## Indicator Format Explanation

The indicator format is: `🎭 CTIR: [Model] ([Provider]) | Conf: [Confidence]% | [Token Color] [Token%] | [State Color] [State]`

- **🎭**: CTIR icon
- **Model**: Current LLM model name (simplified)
- **Provider**: Model provider (Anthropic, OpenRouter, CCR Local, MCP Local)
- **Confidence**: Routing confidence (0-100%)
- **Token Color**: 🟢 < 75%, 🟡 75-90%, 🔴 > 90%
- **Token%**: Current token usage percentage
- **State Color**: 🟢 active, 🟡 warning, 🔴 critical, 🟠 fallback, ⏳ pending
- **State**: Session state (active, token_limit_approaching, fallback_mode, etc.)

## Troubleshooting

### CTIR Not Running
If you see "🎭 CTIR: Offline", check:
1. CTIR is running: `curl http://localhost:3001/health`
2. Port 3001 is available
3. No firewall blocking localhost connections

### API Errors
If you see "🎭 CTIR: Error", check:
1. CTIR logs for errors
2. API endpoint accessibility
3. JSON parsing issues

### Performance
- The indicator updates every 5 seconds
- API calls are cached to avoid excessive requests
- Timeout is set to 5 seconds for responsiveness
