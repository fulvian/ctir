# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **MAJOR FEATURE**: Implemented intelligent routing system with CTIR Proxy
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

### Fixed
- **PERFORMANCE**: Replaced problematic Ollama TypeScript library with direct REST API calls
- **ROUTING**: Fixed routing logic to properly distribute tasks across multiple AI providers
- **INTEGRATION**: Resolved Claude Code proxy configuration and environment variable setup
- **CRITICAL FIX**: Resolved API key authentication issues in CTIR Proxy by extracting API key from Authorization header
- **ROUTING LOGIC**: Fixed complex routing logic conflicts by implementing SimpleRoutingEngine with clean decision tree
- **CLASSIFIER**: Enhanced TaskClassifier to properly recognize complex tasks (machine learning, AI, algorithms, etc.)

### Changed
- **ARCHITECTURE**: Updated routing strategy to use multi-provider approach:
  - Simple tasks (< 200 tokens) → Ollama local (phi4-mini:3.8b)
  - Medium tasks (< 500 tokens) → Gemini Flash (gemini-1.5-flash)
  - Complex tasks → Claude Sonnet (claude-3-5-sonnet-20241022)
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
