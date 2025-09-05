#!/usr/bin/env python3

"""
CTIR Footer Integration Demo
Simulates how the CTIR model indicator would appear in Claude Code footer
"""

import json
import time
import subprocess
import sys
from datetime import datetime

def get_ctir_indicator():
    """Get CTIR model indicator"""
    try:
        result = subprocess.run([
            "/Users/fulvioventura/Desktop/ctir/scripts/ctir-model-indicator.sh", 
            "indicator"
        ], capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            return "🎭 CTIR: Error"
    except:
        return "🎭 CTIR: Offline"

def get_ctir_details():
    """Get detailed CTIR information"""
    try:
        result = subprocess.run([
            "/Users/fulvioventura/Desktop/ctir/scripts/ctir-model-indicator.sh", 
            "details"
        ], capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            return "Details: Error"
    except:
        return "Details: Offline"

def simulate_claude_code_footer():
    """Simulate Claude Code footer with CTIR indicator"""
    
    print("🎭 CTIR Footer Integration Demo")
    print("=" * 50)
    print("This simulates how CTIR model indicator would appear in Claude Code footer")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            # Clear screen (works on most terminals)
            print("\033[2J\033[H", end="")
            
            # Get current time
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Simulate Claude Code footer layout
            print("╭" + "─" * 78 + "╮")
            print("│ " + "Claude Code - CTIR Integration Demo".ljust(76) + " │")
            print("├" + "─" * 78 + "┤")
            
            # Get CTIR indicator
            indicator = get_ctir_indicator()
            details = get_ctir_details()
            
            # Format indicator line
            indicator_line = f"│ 🎭 {indicator}".ljust(78) + " │"
            print(indicator_line)
            
            # Add details if available
            if details and details != "Details: Offline":
                detail_lines = details.split('\n')
                for line in detail_lines[:3]:  # Show first 3 lines
                    if line.strip():
                        detail_line = f"│   {line}".ljust(78) + " │"
                        print(detail_line)
            
            # Add timestamp
            time_line = f"│ Last update: {current_time}".ljust(78) + " │"
            print(time_line)
            
            # Add status
            status_line = f"│ Status: CTIR Active | Claude Code Pro | Integration Demo".ljust(78) + " │"
            print(status_line)
            
            print("╰" + "─" * 78 + "╯")
            print("\nThis is how CTIR model indicator would appear in Claude Code footer")
            print("Real integration would show this information continuously")
            print("\nPress Ctrl+C to stop...")
            
            # Wait before next update
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n\n👋 Demo stopped. Thank you for testing CTIR integration!")
        print("\nTo integrate this into your Claude Code:")
        print("1. Add the indicator script to your Claude Code configuration")
        print("2. Use the API endpoint: http://localhost:3001/model-indicator")
        print("3. Follow the integration guide in docs/ctir-footer-integration.md")

def show_integration_examples():
    """Show different integration examples"""
    
    print("🎭 CTIR Integration Examples")
    print("=" * 40)
    
    print("\n1. Simple API Call:")
    print("   curl -s http://localhost:3001/model-indicator | jq -r '.indicator'")
    
    print("\n2. Bash Integration:")
    print("   CTIR_INDICATOR=$(curl -s http://localhost:3001/model-indicator | jq -r '.indicator')")
    print("   echo \"CTIR: $CTIR_INDICATOR\"")
    
    print("\n3. Python Integration:")
    print("   import requests")
    print("   response = requests.get('http://localhost:3001/model-indicator')")
    print("   print(response.json()['indicator'])")
    
    print("\n4. Continuous Monitoring:")
    print("   watch -n 5 'curl -s http://localhost:3001/model-indicator | jq -r \".indicator\"'")
    
    print("\n5. cc-sessions Integration:")
    print("   Add to your statusline-script.sh:")
    print("   get_ctir_indicator() {")
    print("     curl -s http://localhost:3001/model-indicator | jq -r '.indicator'")
    print("   }")

def main():
    """Main function"""
    if len(sys.argv) > 1:
        if sys.argv[1] == "demo":
            simulate_claude_code_footer()
        elif sys.argv[1] == "examples":
            show_integration_examples()
        else:
            print("Usage: python3 ctir-footer-demo.py [demo|examples]")
    else:
        print("CTIR Footer Integration Demo")
        print("Usage: python3 ctir-footer-demo.py [demo|examples]")
        print("\nCommands:")
        print("  demo     - Simulate Claude Code footer with CTIR indicator")
        print("  examples - Show integration examples")

if __name__ == "__main__":
    main()
