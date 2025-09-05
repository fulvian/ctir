#!/usr/bin/env python3

"""
CTIR Model Indicator Hook for Claude Code
Integrates with cc-sessions pattern to show current LLM model in footer
"""

import json
import sys
import os
import subprocess
import time
from pathlib import Path

# Configuration
CTIR_INDICATOR_SCRIPT = "/Users/fulvioventura/Desktop/ctir/scripts/ctir-model-indicator.sh"
CACHE_FILE = "/tmp/ctir-footer-cache.json"
UPDATE_INTERVAL = 5  # seconds

def log_message(message, level="INFO"):
    """Log message with timestamp"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] CTIR Footer Hook: {message}", file=sys.stderr)

def get_model_indicator():
    """Get current model indicator from CTIR"""
    try:
        if not os.path.exists(CTIR_INDICATOR_SCRIPT):
            return "🎭 CTIR: Script Not Found"
        
        result = subprocess.run(
            [CTIR_INDICATOR_SCRIPT, "indicator"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        else:
            return f"🎭 CTIR: Error ({result.returncode})"
            
    except subprocess.TimeoutExpired:
        return "🎭 CTIR: Timeout"
    except Exception as e:
        log_message(f"Error getting indicator: {e}", "ERROR")
        return "🎭 CTIR: Error"

def get_cached_indicator():
    """Get cached indicator if recent enough"""
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as f:
                cache_data = json.load(f)
            
            cache_time = cache_data.get('timestamp', 0)
            current_time = time.time()
            
            if current_time - cache_time < UPDATE_INTERVAL:
                return cache_data.get('indicator', '🎭 CTIR: Cached')
    except Exception as e:
        log_message(f"Error reading cache: {e}", "WARNING")
    
    return None

def update_cache(indicator):
    """Update cache with new indicator"""
    try:
        cache_data = {
            'indicator': indicator,
            'timestamp': time.time()
        }
        
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache_data, f)
            
    except Exception as e:
        log_message(f"Error updating cache: {e}", "WARNING")

def should_update_indicator():
    """Determine if we should update the indicator"""
    try:
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as f:
                cache_data = json.load(f)
            
            cache_time = cache_data.get('timestamp', 0)
            current_time = time.time()
            
            return current_time - cache_time >= UPDATE_INTERVAL
    except:
        pass
    
    return True

def main():
    """Main hook function"""
    try:
        # Read input from Claude Code
        input_data = json.loads(sys.stdin.read())
        
        # Extract relevant information
        tool_name = input_data.get('tool_name', 'unknown')
        tool_result = input_data.get('tool_result', {})
        
        log_message(f"Tool used: {tool_name}")
        
        # Check if we should update the indicator
        if should_update_indicator():
            indicator = get_model_indicator()
            update_cache(indicator)
            log_message(f"Updated indicator: {indicator}")
        else:
            cached = get_cached_indicator()
            if cached:
                indicator = cached
                log_message(f"Using cached indicator: {indicator}")
            else:
                indicator = get_model_indicator()
                update_cache(indicator)
                log_message(f"Fallback indicator: {indicator}")
        
        # Output the indicator for Claude Code footer
        output = {
            "ctir_model_indicator": indicator,
            "timestamp": time.time(),
            "tool_name": tool_name
        }
        
        print(json.dumps(output))
        
    except json.JSONDecodeError as e:
        log_message(f"JSON decode error: {e}", "ERROR")
        print(json.dumps({
            "ctir_model_indicator": "🎭 CTIR: Parse Error",
            "error": str(e)
        }))
    except Exception as e:
        log_message(f"Unexpected error: {e}", "ERROR")
        print(json.dumps({
            "ctir_model_indicator": "🎭 CTIR: Hook Error",
            "error": str(e)
        }))

if __name__ == "__main__":
    main()
