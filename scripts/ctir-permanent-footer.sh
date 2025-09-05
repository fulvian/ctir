#!/bin/bash

# CTIR Permanent Footer Display
# Shows CTIR model indicator in a persistent footer

# Colors
CTIR_COLOR="\033[38;5;111m"
BORDER_COLOR="\033[38;5;242m"
RESET="\033[0m"

# Function to clear and show footer
show_footer() {
    # Clear screen
    clear
    
    # Show header
    echo -e "${CTIR_COLOR}🎭 CTIR Model Indicator - Live Footer${RESET}"
    echo -e "${BORDER_COLOR}════════════════════════════════════════════════════════════════${RESET}"
    echo ""
    
    # Get and display current indicator
    local indicator=$(./scripts/claude-code-ctir-indicator.sh raw)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${BORDER_COLOR}┌─ Current Model Status ───────────────────────────────────────────┐${RESET}"
    echo -e "${BORDER_COLOR}│${RESET} $indicator ${BORDER_COLOR}│${RESET}"
    echo -e "${BORDER_COLOR}└─────────────────────────────────────────────────────────────────┘${RESET}"
    echo ""
    
    # Show detailed info
    echo -e "${CTIR_COLOR}📊 Detailed Information:${RESET}"
    ./scripts/claude-code-ctir-indicator.sh details | sed 's/^/   /'
    echo ""
    
    # Show timestamp
    echo -e "${BORDER_COLOR}Last update: $timestamp${RESET}"
    echo -e "${BORDER_COLOR}Press Ctrl+C to stop${RESET}"
    echo ""
}

# Main loop
main() {
    echo -e "${CTIR_COLOR}🎭 Starting CTIR Permanent Footer...${RESET}"
    echo -e "${BORDER_COLOR}Press Ctrl+C to stop${RESET}"
    echo ""
    
    # Initial display
    show_footer
    
    # Update every 5 seconds
    while true; do
        sleep 5
        show_footer
    done
}

# Handle Ctrl+C
trap 'echo -e "\n\n${CTIR_COLOR}👋 CTIR Footer stopped. Thank you!${RESET}"; exit 0' INT

# Run main function
main
