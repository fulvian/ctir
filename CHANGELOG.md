# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Model Indicator System**: Real-time footer indicator showing which LLM model is currently working
  - **ModelIndicator**: Core class for tracking and displaying current model status
  - **API Endpoint**: `/model-indicator` endpoint exposing real-time model information
  - **Visual Indicators**: Color-coded status showing model provider, confidence, token usage, and session state
  - **Integration**: Full integration with CTIRCore and ModernSessionManager
  - **Test Script**: `scripts/test-model-indicator.js` for monitoring model indicator in real-time
  - **Format**: `🎭 CTIR: Sonnet 4 (Anthropic) | Conf: 90% | 🟢 0% | 🟢 active`
- **Claude Code Footer Integration**: Complete integration system for displaying CTIR model indicator in Claude Code footer
  - **Integration Scripts**: `claude-code-ctir-indicator.sh` with multiple display formats (show, footer, inline)
  - **Real-time Monitoring**: Cached API calls with 5-second refresh for optimal performance
  - **Multiple Formats**: Standard, footer box, inline status, and raw output formats
  - **cc-sessions Compatible**: Integration examples for cc-sessions statusline
  - **Documentation**: Complete integration guide with examples and troubleshooting
  - **Demo Scripts**: `ctir-footer-demo.py` for testing integration patterns
  - **Ready-to-use**: Immediate integration commands for Claude Code users
  - **Permanent Footer**: `ctir-permanent-footer.sh` for continuous footer display
  - **cc-sessions Hook**: `ctir-cc-sessions-hook.sh` for seamless cc-sessions integration
  - **Startup Automation**: `start-ctir-claude.sh` for one-command system startup
  - **Verified Working**: Successfully tested and confirmed working in Claude Code terminal

### Files Added
- `src/core/model-indicator.ts` - Core ModelIndicator class for real-time model tracking
- `scripts/claude-code-ctir-indicator.sh` - Main integration script with multiple display formats
- `scripts/ctir-model-indicator.sh` - Advanced indicator script with caching and monitoring
- `scripts/ctir-footer-hook.py` - Python hook for Claude Code integration
- `scripts/ctir-footer-demo.py` - Demo script showing integration patterns
- `scripts/ctir-permanent-footer.sh` - Continuous footer display script
- `scripts/ctir-cc-sessions-hook.sh` - cc-sessions integration hook
- `scripts/start-ctir-claude.sh` - Automated startup script for complete system
- `docs/ctir-footer-integration.md` - Technical integration documentation
- `docs/claude-code-integration-guide.md` - User guide for Claude Code integration

### Integration Methods
- **Direct Command**: `./scripts/claude-code-ctir-indicator.sh show` - Immediate indicator display
- **Footer Format**: `./scripts/claude-code-ctir-indicator.sh footer` - Boxed footer display
- **Permanent Footer**: `./scripts/ctir-permanent-footer.sh` - Continuous monitoring
- **cc-sessions**: Integration with cc-sessions statusline system
- **API Direct**: `curl http://localhost:3001/model-indicator` - Direct API access
- **Automated Startup**: `./scripts/start-ctir-claude.sh` - One-command system startup

### Testing & Verification
- **API Endpoint**: Verified `/model-indicator` endpoint responding correctly
- **Claude Code Integration**: Confirmed working in Claude Code terminal (tested with `./scripts/claude-code-ctir-indicator.sh footer`)
- **Real-time Updates**: Model indicator updates every 5 seconds with cached API calls
- **Multiple Formats**: All display formats (show, footer, inline) tested and working
- **Error Handling**: Graceful fallback when CTIR is offline or API unavailable
- **Performance**: Cached responses prevent excessive API calls while maintaining real-time updates

### Usage Examples
```bash
# Show current model status
./scripts/claude-code-ctir-indicator.sh show

# Display in footer format
./scripts/claude-code-ctir-indicator.sh footer

# Continuous monitoring
./scripts/ctir-permanent-footer.sh

# One-command startup
./scripts/start-ctir-claude.sh
```

### Technical Improvements
- **Caching System**: 5-second cache for API responses to optimize performance
- **Error Resilience**: Graceful handling of CTIR offline states and API failures
- **Color Coding**: Ayu Dark theme colors for consistent visual experience
- **Multiple Output Formats**: Flexible display options for different use cases
- **Cross-Platform**: Bash scripts compatible with macOS, Linux, and Unix systems
- **API Integration**: RESTful API design with JSON responses and proper error handling
- **Real-time Monitoring**: Live updates without blocking Claude Code operations

### Changed
- **CTIRCore**: Added ModelIndicator integration and getter methods
- **CTIRProxy**: Added `/model-indicator` endpoint and CTIRCore reference
- **Engine Integration**: ModelIndicator starts automatically with CTIRCore
- **API Structure**: Enhanced proxy with model indicator endpoint

### Next Steps
- **Automatic Footer**: Integration with Claude Code UI for automatic footer display
- **WebSocket Updates**: Real-time updates via WebSocket for instant model changes
- **Custom Themes**: Additional color themes beyond Ayu Dark
- **Metrics Dashboard**: Web-based dashboard for model usage analytics
- **Mobile Support**: Mobile-friendly indicator display options

- **MAJOR FEATURE: Multi-Model Orchestration System** - Complete implementation of intelligent task orchestration
  - **CTIROrchestrationEngine**: Central orchestration engine with Sonnet 4 as primary orchestrator
  - **TaskClassifier**: Advanced task classification with 10 categories and complexity scoring
  - **CCSessionsIntegration**: Full integration with cc-sessions for task management and memory preservation
  - **Multi-Model Routing**: Intelligent routing to specialized OpenRouter models based on task characteristics
  - **Context Preservation**: Automatic context saving and restoration for session continuity
  - **Task Files**: Structured YAML task files with routing metadata
  - **Test Suite**: Comprehensive testing for all orchestration components
- **MAJOR ARCHITECTURE CHANGE**: Implemented OpenRouter Multi-Model Strategy replacing Gemini/Ollama dual logic
- **NEW**: OpenRouter integration with 5 specialized models:
  - Qwen3-Coder-480B-A35B (Technical Lead & Architecture)
  - OpenAI GPT-OSS-120B (Rapid Prototyping Specialist)  
  - Google Gemini 2.5 Pro Experimental (Problem Solver & Research)
  - Qwen2.5-Coder-32B-Instruct (Multi-Language Developer)
  - Agentica DeepCoder-14B-Preview (Efficiency Champion)
- **NEW**: Intelligent routing strategy: Sonnet 4 (primary) + OpenRouter (specialized tasks + fallback)
- **NEW**: Modern Session Management System - Complete overhaul of Claude Code monitoring
  - `ClaudeCodeHeartbeatMonitor`: Multi-source Claude Code detection (process, port, config files)
  - `ModernSessionManager`: Intelligent session state management with transitions
  - Bidirectional heartbeat communication via file system
  - Multi-source consensus for reliable Claude Code detection
  - Session states: ACTIVE, APPROACHING_LIMIT, FALLBACK_MODE, RESET_PENDING, RESETTING
  - **REPLACES**: Old unstable log file monitoring system
- **NEW**: Circuit breaker pattern for OpenRouter API resilience
- **NEW**: Usage tracking and credit management for OpenRouter models
- **NEW**: Model-specific configurations with temperature and token limits
- **NEW**: Enhanced routing logic with domain knowledge and complexity analysis
- **NEW**: CTIR Proxy server on port 3001 for intercepting Claude Code requests
- **NEW**: Task classification system using TaskClassifier for complexity analysis
- **NEW**: Routing decision engine using RoutingEngine for optimal model selection
- **NEW**: Automatic configuration script for Claude Code integration
- **NEW**: End-to-end testing suite for routing validation
- **NEW**: Support for routing strategies: claude_direct, ccr_local, mcp_delegate, gemini_flash, gemini_pro
- **NEW**: Real-time task analysis endpoint at /analyze-task
- **NEW**: Health monitoring endpoint at /health
- **NEW**: Gemini API integration for task routing (Flash/Pro models)
- **NEW**: Ollama REST API integration replacing TypeScript library for better performance
- **NEW**: SimpleRoutingEngine with clean decision tree for reliable task routing
- **NEW**: Enhanced TaskClassifier with improved pattern recognition for complex domains

### Changed
- **DEPRECATED**: Gemini integration (replaced by OpenRouter)
- **DEPRECATED**: Old Claude Code log file monitoring (replaced by Modern Session Management)
- **UPDATED**: Routing strategies to use OpenRouter models instead of Gemini
- **UPDATED**: Configuration files to include OpenRouter settings
- **UPDATED**: Environment variables (removed GEMINI_API_KEY, added OPEN_ROUTER_API_KEY)
- **UPDATED**: Prometheus metrics to reflect OpenRouter circuit breaker status
- **UPDATED**: CTIRStatus interface to include modern session management fields
- **UPDATED**: Core engine to use ModernSessionManager instead of old monitoring

### Fixed
- **PERFORMANCE**: Replaced problematic Ollama TypeScript library with direct REST API calls
- **ROUTING**: Fixed routing logic to properly distribute tasks across multiple AI providers
- **INTEGRATION**: Resolved Claude Code proxy configuration and environment variable setup
- **CRITICAL FIX**: Resolved API key authentication issues in CTIR Proxy by extracting API key from Authorization header
- **ROUTING LOGIC**: Fixed complex routing logic conflicts by implementing SimpleRoutingEngine with clean decision tree
- **CLASSIFIER**: Enhanced TaskClassifier to properly recognize complex tasks (machine learning, AI, algorithms, etc.)

### Changed
- **ARCHITECTURE**: Updated routing strategy to use Sonnet 4 + OpenRouter Multi-Model approach:
  - Sonnet 4 remains primary model for complex tasks (complexity > 0.6)
  - OpenRouter models handle specialized tasks and fallback scenarios
  - DeepCoder-14B for performance optimization (complexity < 0.3)
  - Qwen2.5-Coder-32B for multi-language and legacy maintenance
  - GPT-OSS-120B for rapid prototyping and debugging
  - Gemini 2.5 Pro for research and complex problems
  - Qwen3-Coder-480B for architecture design
- **DEPRECATED**: Gemini integration (maintained for compatibility but not used in routing)
- **ENHANCED**: Task classification with domain knowledge analysis
- **IMPROVED**: Routing confidence scoring based on model specialization
- Initial CTIR core implementation with task classification and routing
- MCP server (ctir-ollama-mcp) with analyze_error, generate_unit_tests, format_code tools
- Auto-resume system for 5-hour Claude Code sessions
- SQLite database schema for work state persistence
- TypeScript configuration with path aliases
- Basic health checks for Node.js, database, and Ollama connectivity
- **NEW**: Active token monitoring system with automatic fallback activation
- **NEW**: Real-time status file (.claude/ctir-status.json) for external monitoring
- **NEW**: Intelligent session reset detection and automatic fallback clearing
- **NEW**: Status checking script (npm run status) for real-time CTIR monitoring
- **NEW**: Automatic Claude Code log monitoring for 5-hour limit detection
- **NEW**: TypeScript contracts for integrations: cc-sessions, CCR, MCP (`src/integrations/contracts/*`)
- **NEW**: cc-sessions adapter with real task CRUD, weighting, and session snapshot persistence (`src/integrations/cc-sessions-adapter.ts`)
- **NEW**: CCR adapter with persistent local-only mode and routing decision state (`src/integrations/ccr-adapter.ts`)
- **NEW**: Intelligent auto-resume system with context restoration
- **NEW**: Seamless session continuation after token limit reset
- **NEW**: Gemini (Google AI Studio) integration with health/credit-aware routing
- **NEW**: Automatic selection between Gemini 2.5 Pro and 2.5 Flash based on task complexity and budget
- **NEW**: Fallback sequencing: Claude → Gemini → CCR/MCP (Ollama) with daily credit tracking
- **NEW**: Startup helper script to run CTIR within a Claude Code session (`scripts/start-ctir-session.sh`) and npm alias `start:session`
 - **NEW**: Stdio MCP client (`src/integrations/mcp-adapter.ts`) with health, timeout/retry/backoff and stdout JSON parsing
 - **NEW**: RoutingEngine supports `localOnlyMode` to force CCR/MCP when Claude 5h window is exhausted
 - **NEW**: Auto‑Resume wired with cc-sessions snapshot save/load
 - **NEW**: `npm run status` enhanced with integration health (cc-sessions/CCR/MCP) and routing info

### Changed
- Improved error handling and logging throughout the codebase
- Enhanced configuration validation and missing file detection
- Fixed package.json dependencies and script commands
- Added proper type annotations and interfaces
- Switched runtime to CommonJS for stable import resolution in Node
- Converted CLI helper scripts to CommonJS (status, set-limit, simulate-reset)
- Enhanced Claude Code limit detection with robust regex patterns (cooldown/rate-limit variants)

### Fixed
- **CRITICAL FIX**: Resolved persistent oscillation in Claude Code session monitoring that caused infinite loops between fallback activation and reset
- **ENHANCED**: Implemented deterministic reset time parsing from Claude Code limit messages with precise timer scheduling
- **IMPROVED**: Added comprehensive logging for debugging session monitoring issues and limit detection
- **FIXED**: Corrected flag reset logic in `claude-monitor.ts` to prevent continuous re-detection of session limits
- **OPTIMIZED**: Replaced generic polling with precise timer-based reset scheduling for better resource efficiency

### Technical Improvements
- **CRITICAL FIX**: Resolved persistent oscillation in Claude Code session monitoring by implementing proper flag reset logic and deterministic reset time parsing
- **ENHANCED**: Added comprehensive regex patterns for extracting reset timestamps from Claude Code limit messages (supports formats like "resets at 5pm", "come back at 3:30pm", etc.)
- **OPTIMIZED**: Replaced generic 5-minute polling with precise timer scheduling based on extracted reset time (30-second buffer before actual reset)
- **IMPROVED**: Added granular debug logging throughout the session monitoring process for better troubleshooting and observability
- **ROBUST**: Implemented fallback mechanism that reverts to polling if timestamp extraction fails
- **ADDED**: Metrics endpoint (`/metrics`) for real-time system observability in Prometheus format.
- **IMPROVED**: Reworked Claude Code session monitoring to be deterministic. It now parses the exact reset time from the limit message, replacing polling with a precise timer.
- **ADDED**: A structured JSON logger (`src/utils/logger.ts`) for improved observability and replaced `console.log` calls in core modules.
- **NEW**: Implemented stabilization logic for Claude Code session monitoring (threshold-based detection).
- **NEW**: Added a Circuit Breaker pattern to the Gemini integration for improved resilience against API failures.
- Added robust configuration file validation
- Enhanced MCP server error handling and timeout management
- Implemented proper fallback mechanisms for unavailable services
- Added comprehensive logging for debugging and monitoring
- Fixed TypeScript type definitions and import issues
- Optimized performance and memory usage
- **NEW**: Active token monitoring system that automatically detects Claude Code limits
- **NEW**: Intelligent fallback mode activation when approaching 5-hour limit
- **NEW**: Real-time status file updates for external monitoring
- **NEW**: Automatic session reset detection and fallback mode clearing
- **NEW**: Gemini usage tracking (daily JSON file) and rate-limit buffer control (CTIR_RATE_LIMIT_BUFFER)

### Session Monitoring Oscillation Fix (Critical Issue Resolution)

**Problem**: The Claude Code session monitoring system was experiencing persistent oscillation between fallback activation and reset, causing infinite loops and making logs unusable.

**Root Cause Analysis**:
- Flag `isLimitDetectedAndWaitingForReset` was set but never properly reset
- System continued re-reading the same log content containing limit messages
- Generic polling every 5 minutes was inefficient and unreliable

**Solution Implemented**:
1. **Flag Reset Logic**: Added explicit flag reset in both precise timer and polling fallback paths
2. **Deterministic Parsing**: Implemented regex patterns to extract exact reset timestamps from limit messages
3. **Precise Timer**: Replaced polling with setTimeout-based scheduling (30-second buffer before reset)
4. **Granular Logging**: Added comprehensive debug logging for troubleshooting
5. **Robust Fallback**: Maintained polling as fallback if timestamp extraction fails

**Technical Details**:
- Enhanced regex patterns support multiple time formats: "resets at 5pm", "come back at 3:30pm", etc.
- Timer precision: 30-second buffer before actual reset time
- Logging includes: flag state, log positions, detection counts, reset times, error details
- Fallback mechanism ensures system remains functional even if parsing fails

**Files Modified**:
- `src/core/claude-monitor.ts`: Core monitoring logic with flag reset and precise timing
- `CHANGELOG.md`: Documentation of the fix and technical details

### Testing
- End-to-end testing confirms full system functionality
- MCP server health checks pass successfully
- Database initialization works correctly
- Build process completes without errors
- All major components integrate properly
- **NEW**: Automatic limit detection tested and working
- **NEW**: Session reset simulation successful
- **NEW**: Fallback mode activation/deactivation verified
- **NEW**: MCP tools functional in both normal and fallback modes
- **NEW**: Complete end-to-end test cycle successful:
  - ✅ CTIR startup and monitoring activation
  - ✅ Claude Code limit detection and fallback mode
  - ✅ MCP tools working in fallback mode (analyze_error, generate_unit_tests)
  - ✅ Session reset detection and auto-resume preparation
  - ✅ Seamless transition back to normal mode
- **NEW**: E2E runner script (`scripts/e2e-runner.js`) and npm script `npm run e2e` to validate active → fallback → reset workflow
- **NEW**: Real Claude Code session test in progress
- **NEW**: Log file auto-discovery implemented for Cursor integration
- **NEW**: Enhanced monitoring with manual flag detection
- **NEW**: Process-based fallback monitoring active
- **NEW**: CTIR Enhanced Plan v1 created at `docs/sviluppo/sviluppo_ctir_enhanced_1.md` outlining full integration of cc-sessions, CCR, and MCP local with production-focused phases (no stubs/mocks)
- **NEW**: Contracts-first integration approach to ensure stable APIs before wiring adapters
- **FIXED**: TypeScript compilation errors (require -> import)
- **FIXED**: Async/await handling in log file discovery
- **IMPROVED**: Lazy initialization of log paths for better performance

## [1.0.0] - 2025-01-XX

### Added
- Initial release of CTIR (Claude Task Intelligence Router)
- Core routing engine with intelligent task classification
- MCP server integration for local model delegation
- Auto-resume functionality for Claude Code sessions
- Database persistence layer
- Configuration management system
- Health monitoring and error handling

### Known Issues
- CCR and CC-Sessions integrations are currently stubs
- Some configuration files need to be created manually
- End-to-end testing not fully implemented
