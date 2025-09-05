#!/bin/bash

# CTIR Model Indicator for Claude Code Footer
# Add this to your Claude Code configuration or run manually

# Configuration
CTIR_API_URL="http://localhost:3001"
CACHE_FILE="/tmp/ctir-claude-footer.json"
CACHE_EXPIRY=5  # seconds

# Colors (Ayu Dark theme)
CTIR_COLOR="\033[38;5;111m"      # Entity blue
MODEL_COLOR="\033[38;5;114m"     # Green
WARNING_COLOR="\033[38;5;215m"   # Orange
ERROR_COLOR="\033[38;5;203m"     # Red
DIM_COLOR="\033[38;5;242m"       # Dim gray
RESET="\033[0m"

# Function to get CTIR indicator
get_ctir_indicator() {
    local current_time=$(date +%s)
    local cache_time=0
    
    # Check cache first
    if [[ -f "$CACHE_FILE" ]]; then
        cache_time=$(python3 -c "
import json
try:
    with open('$CACHE_FILE', 'r') as f:
        data = json.load(f)
        print(data.get('timestamp', 0))
except:
    print(0)
" 2>/dev/null)
    fi
    
    # Use cache if recent
    if [[ $((current_time - cache_time)) -lt $CACHE_EXPIRY ]]; then
        python3 -c "
import json
try:
    with open('$CACHE_FILE', 'r') as f:
        data = json.load(f)
        print(data.get('indicator', '🎭 CTIR: Loading...'))
except:
    print('🎭 CTIR: Cache Error')
" 2>/dev/null
        return
    fi
    
    # Fetch from API
    local response=$(curl -s --connect-timeout 2 --max-time 3 "$CTIR_API_URL/model-indicator" 2>/dev/null)
    
    if [[ $? -eq 0 && -n "$response" ]]; then
        # Parse and cache
        python3 -c "
import json, sys
try:
    data = json.loads('$response')
    indicator = data.get('indicator', '🎭 CTIR: Unknown')
    
    # Cache result
    cache_data = {
        'indicator': indicator,
        'timestamp': $(date +%s)
    }
    
    with open('$CACHE_FILE', 'w') as f:
        json.dump(cache_data, f)
    
    print(indicator)
except:
    print('🎭 CTIR: Parse Error')
" 2>/dev/null
    else
        # Fallback
        if [[ -f "$CACHE_FILE" ]]; then
            python3 -c "
import json
try:
    with open('$CACHE_FILE', 'r') as f:
        data = json.load(f)
        print(data.get('indicator', '🎭 CTIR: Offline'))
except:
    print('🎭 CTIR: Offline')
" 2>/dev/null
        else
            echo "🎭 CTIR: Offline"
        fi
    fi
}

# Function to format indicator
format_indicator() {
    local indicator="$1"
    
    if [[ "$indicator" == *"Error"* ]] || [[ "$indicator" == *"Offline"* ]]; then
        echo -e "${ERROR_COLOR}$indicator${RESET}"
    elif [[ "$indicator" == *"Warning"* ]] || [[ "$indicator" == *"🟡"* ]]; then
        echo -e "${WARNING_COLOR}$indicator${RESET}"
    elif [[ "$indicator" == *"🟢"* ]] || [[ "$indicator" == *"active"* ]]; then
        echo -e "${MODEL_COLOR}$indicator${RESET}"
    else
        echo -e "${CTIR_COLOR}$indicator${RESET}"
    fi
}

# Main function
main() {
    case "${1:-show}" in
        "show")
            local indicator=$(get_ctir_indicator)
            format_indicator "$indicator"
            ;;
        "raw")
            get_ctir_indicator
            ;;
        "refresh")
            rm -f "$CACHE_FILE"
            local indicator=$(get_ctir_indicator)
            format_indicator "$indicator"
            ;;
        "footer")
            # Format for Claude Code footer
            local indicator=$(get_ctir_indicator)
            echo -e "${DIM_COLOR}┌─ CTIR Model Status ─────────────────────────────────────────────┐${RESET}"
            echo -e "${DIM_COLOR}│${RESET} $(format_indicator "$indicator") ${DIM_COLOR}│${RESET}"
            echo -e "${DIM_COLOR}└─────────────────────────────────────────────────────────────────┘${RESET}"
            ;;
        "inline")
            # Inline format for status lines
            local indicator=$(get_ctir_indicator)
            echo -e "${CTIR_COLOR}CTIR:${RESET} $(format_indicator "$indicator")"
            ;;
        "help")
            echo "CTIR Model Indicator for Claude Code"
            echo ""
            echo "Usage: $0 [show|raw|refresh|footer|inline|help]"
            echo ""
            echo "Commands:"
            echo "  show     - Show formatted indicator (default)"
            echo "  raw      - Show raw indicator without formatting"
            echo "  refresh  - Force refresh and show indicator"
            echo "  footer   - Show in footer format"
            echo "  inline   - Show in inline format for status lines"
            echo "  help     - Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                    # Show current indicator"
            echo "  $0 footer             # Show in footer format"
            echo "  $0 inline             # Show inline for status lines"
            echo ""
            echo "Integration:"
            echo "  Add to Claude Code configuration:"
            echo "  CTIR_INDICATOR=\$($0 raw)"
            echo "  echo \"CTIR: \$CTIR_INDICATOR\""
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            ;;
    esac
}

# Run main function
main "$@"
