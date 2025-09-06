# CTIR Model Indicator Integration for Claude Code
# Ready-to-use configuration

## Quick Integration

### Method 1: Direct Command in Claude Code
Run this command in Claude Code to see the current model:

```bash
./scripts/claude-code-ctir-indicator.sh show
```

### Method 2: Footer Display
To show in footer format:

```bash
./scripts/claude-code-ctir-indicator.sh footer
```

### Method 3: Inline Status
For status line integration:

```bash
./scripts/claude-code-ctir-indicator.sh inline
```

## Claude Code Configuration Integration

### Add to Claude Code Custom Commands
Add this to your Claude Code configuration:

```bash
# CTIR Model Indicator
alias ctir-status='./scripts/claude-code-ctir-indicator.sh show'
alias ctir-footer='./scripts/claude-code-ctir-indicator.sh footer'
alias ctir-refresh='./scripts/claude-code-ctir-indicator.sh refresh'
```

### Integration with cc-sessions
If you're using cc-sessions, add this to your `statusline-script.sh`:

```bash
# Add CTIR indicator to cc-sessions status line
get_ctir_indicator() {
    local ctir_indicator=$(./scripts/claude-code-ctir-indicator.sh raw)
    echo -e "\033[38;5;111mCTIR: $ctir_indicator\033[0m"
}

# Then add to your status line output:
# echo -e "$progress_info | $task_info | $(get_ctir_indicator)"
```

### Custom Claude Code Footer
Create a custom footer by running:

```bash
# Continuous footer display
while true; do
    clear
    ./scripts/claude-code-ctir-indicator.sh footer
    sleep 5
done
```

## Real-time Monitoring

### Terminal Monitor
```bash
# Monitor CTIR status in real-time
watch -n 5 './scripts/claude-code-ctir-indicator.sh show'
```

### API Direct Access
```bash
# Direct API access
curl -s http://localhost:3001/model-indicator | jq -r '.indicator'
```

## Example Outputs

### Standard Format
```
🎭 CTIR: Sonnet 4 (Anthropic) | Conf: 90% | 🟢 0% | 🟢 active
```

### Footer Format
```
┌─ CTIR Model Status ─────────────────────────────────────────────┐
│ 🎭 CTIR: Sonnet 4 (Anthropic) | Conf: 90% | Conf: 90% | 🟢 0% | 🟢 active │
└─────────────────────────────────────────────────────────────────┘
```

### Inline Format
```
CTIR: 🎭 CTIR: Sonnet 4 (Anthropic) | Conf: 90% | 🟢 0% | 🟢 active
```

## Troubleshooting

### CTIR Not Running
If you see "🎭 CTIR: Offline":
1. Check CTIR is running: `curl http://localhost:3001/health`
2. Start CTIR: `npm run dev`

### Script Not Found
If you get "command not found":
1. Make sure you're in the CTIR directory
2. Check script permissions: `ls -la scripts/claude-code-ctir-indicator.sh`
3. Make executable: `chmod +x scripts/claude-code-ctir-indicator.sh`

### API Errors
If you see "🎭 CTIR: Error":
1. Check CTIR logs
2. Verify port 3001 is available
3. Test API directly: `curl http://localhost:3001/model-indicator`

## Advanced Integration

## Claude Proxy Setup

To force Claude Code/CLI to use the CTIR proxy when Claude is limited:

```bash
# Point Anthropic SDK/CLI to CTIR
export ANTHROPIC_BASE_URL="http://localhost:3001"
# Kept for compatibility with some clients
export ANTHROPIC_API_URL="http://localhost:3001"

# Ensure the CLI does not bypass via a direct key
unset ANTHROPIC_API_KEY

# Launch Claude
claude
```

Notes:
- The official Anthropic SDK and many CLIs look for `ANTHROPIC_BASE_URL`.
- CTIR still needs the real Anthropic key to contact Claude when available. Set `CLAUDE_API_KEY` in your `.env` for the CTIR server (not in the shell where you run `claude`).


### Custom Status Line
Create your own status line with CTIR:

```bash
#!/bin/bash
# Custom status line with CTIR

# Get current directory
CWD=$(basename "$PWD")

# Get git branch
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "no-git")

# Get CTIR indicator
CTIR_STATUS=$(./scripts/claude-code-ctir-indicator.sh raw)

# Format output
echo "📁 $CWD | 🌿 $GIT_BRANCH | $CTIR_STATUS"
```

### Python Integration
```python
import subprocess
import json

def get_ctir_indicator():
    try:
        result = subprocess.run([
            './scripts/claude-code-ctir-indicator.sh', 'raw'
        ], capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            return "🎭 CTIR: Error"
    except:
        return "🎭 CTIR: Offline"

# Use in your Python scripts
indicator = get_ctir_indicator()
print(f"Current model: {indicator}")
```

## Next Steps

1. **Test the integration**: Run `./scripts/claude-code-ctir-indicator.sh show`
2. **Add to Claude Code**: Use the commands above in Claude Code
3. **Customize**: Modify the script colors and format as needed
4. **Monitor**: Use the monitoring commands for real-time updates

The CTIR model indicator is now ready for integration with Claude Code!
