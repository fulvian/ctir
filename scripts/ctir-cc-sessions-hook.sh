#!/bin/bash

# CTIR Integration Hook for cc-sessions
# Add this to your cc-sessions statusline-script.sh

# Get CTIR indicator
get_ctir_indicator() {
    local ctir_indicator=$(curl -s --connect-timeout 2 http://localhost:3001/model-indicator | jq -r '.indicator' 2>/dev/null || echo "🎭 CTIR: Offline")
    
    # Color coding
    if [[ "$ctir_indicator" == *"Error"* ]] || [[ "$ctir_indicator" == *"Offline"* ]]; then
        echo -e "\033[38;5;203m$ctir_indicator\033[0m"  # Red
    elif [[ "$ctir_indicator" == *"Warning"* ]] || [[ "$ctir_indicator" == *"🟡"* ]]; then
        echo -e "\033[38;5;215m$ctir_indicator\033[0m"  # Orange
    elif [[ "$ctir_indicator" == *"🟢"* ]] || [[ "$ctir_indicator" == *"active"* ]]; then
        echo -e "\033[38;5;114m$ctir_indicator\033[0m"  # Green
    else
        echo -e "\033[38;5;111m$ctir_indicator\033[0m"  # Blue
    fi
}

# Main function
main() {
    case "${1:-indicator}" in
        "indicator")
            get_ctir_indicator
            ;;
        "footer")
            echo -e "\033[38;5;242m┌─ CTIR Model Status ─────────────────────────────────────────────┐\033[0m"
            echo -e "\033[38;5;242m│\033[0m $(get_ctir_indicator) \033[38;5;242m│\033[0m"
            echo -e "\033[38;5;242m└─────────────────────────────────────────────────────────────────┘\033[0m"
            ;;
        "inline")
            echo -e "\033[38;5;111mCTIR:\033[0m $(get_ctir_indicator)"
            ;;
        *)
            echo "Usage: $0 [indicator|footer|inline]"
            ;;
    esac
}

main "$@"
