#!/bin/bash

# CTIR Model Indicator Script
# Integrates with Claude Code to show current LLM model status
# Based on cc-sessions statusline pattern

# Configuration
CTIR_API_URL="http://localhost:3001"
UPDATE_INTERVAL=5  # seconds
CACHE_FILE="/tmp/ctir-model-indicator-cache.json"
CACHE_EXPIRY=10  # seconds

# Colors for Ayu Dark theme (matching cc-sessions)
CTIR_COLOR="\033[38;5;111m"      # 59C2FF entity blue
MODEL_COLOR="\033[38;5;114m"     # AAD94C green
WARNING_COLOR="\033[38;5;215m"   # FFB454 orange
ERROR_COLOR="\033[38;5;203m"     # F26D78 red
DIM_COLOR="\033[38;5;242m"       # Dim gray
TEXT_COLOR="\033[38;5;250m"      # BFBDB6 light gray
RESET="\033[0m"

# Function to get model indicator from CTIR API
get_model_indicator() {
    local current_time=$(date +%s)
    local cache_time=0
    
    # Check if cache exists and is recent
    if [[ -f "$CACHE_FILE" ]]; then
        cache_time=$(python3 -c "
import json, os
try:
    with open('$CACHE_FILE', 'r') as f:
        data = json.load(f)
        print(data.get('timestamp', 0))
except:
    print(0)
" 2>/dev/null)
    fi
    
    # Use cache if recent enough
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
    
    # Fetch fresh data from API
    local response=$(curl -s --connect-timeout 2 --max-time 5 "$CTIR_API_URL/model-indicator" 2>/dev/null)
    
    if [[ $? -eq 0 && -n "$response" ]]; then
        # Parse response and cache it
        python3 -c "
import json, sys
try:
    data = json.loads('$response')
    indicator = data.get('indicator', '🎭 CTIR: Unknown')
    
    # Cache the result
    cache_data = {
        'indicator': indicator,
        'timestamp': $(date +%s),
        'raw_data': data
    }
    
    with open('$CACHE_FILE', 'w') as f:
        json.dump(cache_data, f)
    
    print(indicator)
except Exception as e:
    print('🎭 CTIR: Parse Error')
" 2>/dev/null
    else
        # Fallback to cached data or default
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

# Function to get detailed model info
get_model_details() {
    if [[ -f "$CACHE_FILE" ]]; then
        python3 -c "
import json
try:
    with open('$CACHE_FILE', 'r') as f:
        data = json.load(f)
        raw_data = data.get('raw_data', {})
        model_data = raw_data.get('data', {})
        
        model = model_data.get('currentModel', 'Unknown')
        provider = model_data.get('modelProvider', 'Unknown')
        strategy = model_data.get('routingStrategy', 'Unknown')
        confidence = model_data.get('confidence', 0)
        session_state = model_data.get('sessionState', 'Unknown')
        
        print(f'Model: {model}')
        print(f'Provider: {provider}')
        print(f'Strategy: {strategy}')
        print(f'Confidence: {int(confidence * 100)}%')
        print(f'State: {session_state}')
        
        token_usage = model_data.get('tokenUsage')
        if token_usage:
            percentage = token_usage.get('percentage', 0)
            warning = token_usage.get('warning', '')
            print(f'Tokens: {percentage}%')
            if warning and warning != 'Transcript not found':
                print(f'Warning: {warning}')
except:
    print('Details: Unavailable')
" 2>/dev/null
    else
        echo "Details: No data"
    fi
}

# Function to format indicator with colors
format_indicator() {
    local indicator="$1"
    
    # Apply colors based on content
    if [[ "$indicator" == *"Error"* ]] || [[ "$indicator" == *"Offline"* ]]; then
        echo -e "${ERROR_COLOR}$indicator${RESET}"
    elif [[ "$indicator" == *"Warning"* ]] || [[ "$indicator" == *"🟡"* ]]; then
        echo -e "${WARNING_COLOR}$indicator${RESET}"
    elif [[ "$indicator" == *"🟢"* ]] || [[ "$indicator" == *"active"* ]]; then
        echo -e "${MODEL_COLOR}$indicator${RESET}"
    else
        echo -e "${TEXT_COLOR}$indicator${RESET}"
    fi
}

# Main function
main() {
    case "${1:-indicator}" in
        "indicator")
            local indicator=$(get_model_indicator)
            format_indicator "$indicator"
            ;;
        "details")
            get_model_details
            ;;
        "refresh")
            rm -f "$CACHE_FILE"
            local indicator=$(get_model_indicator)
            format_indicator "$indicator"
            ;;
        "monitor")
            echo -e "${CTIR_COLOR}🎭 CTIR Model Indicator Monitor${RESET}"
            echo -e "${DIM_COLOR}Press Ctrl+C to stop${RESET}"
            echo ""
            
            while true; do
                clear
                echo -e "${CTIR_COLOR}🎭 CTIR Model Indicator Monitor${RESET}"
                echo -e "${DIM_COLOR}Last update: $(date)${RESET}"
                echo ""
                
                local indicator=$(get_model_indicator)
                format_indicator "$indicator"
                echo ""
                
                get_model_details
                echo ""
                echo -e "${DIM_COLOR}Refreshing every ${UPDATE_INTERVAL}s...${RESET}"
                
                sleep $UPDATE_INTERVAL
            done
            ;;
        *)
            echo "Usage: $0 [indicator|details|refresh|monitor]"
            echo ""
            echo "Commands:"
            echo "  indicator  - Show current model indicator (default)"
            echo "  details    - Show detailed model information"
            echo "  refresh    - Force refresh and show indicator"
            echo "  monitor    - Continuous monitoring mode"
            ;;
    esac
}

# Run main function with all arguments
main "$@"
