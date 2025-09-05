import type { CTIRSession } from "@/models/session";
import { TaskCategory, type CTIRTask } from "@/models/task";
import type { RoutingDecision, TokenBudget } from "@/models/routing";

export class RoutingEngine {
  private mcpAvailable = true;
  private ccrAvailable = true;
  private localOnlyMode = false;
  private geminiAvailable = false;
  private geminiCreditAvailable = false;

  setMcpAvailability(available: boolean) {
    this.mcpAvailable = available;
  }

  setCcrAvailability(available: boolean) {
    this.ccrAvailable = available;
  }

  setGeminiAvailability(available: boolean) {
    this.geminiAvailable = available;
  }

  setGeminiCreditAvailable(available: boolean) {
    this.geminiCreditAvailable = available;
  }

  enableLocalOnlyMode(): void {
    this.localOnlyMode = true;
  }

  disableLocalOnlyMode(): void {
    this.localOnlyMode = false;
  }

  private normalizeBudget(session: CTIRSession): TokenBudget {
    const remaining = 1 - Math.min(1, session.tokenBudget.used / session.tokenBudget.limit);
    return { remaining };
  }

  decide(task: CTIRTask, session: CTIRSession): RoutingDecision {
    const budget = this.normalizeBudget(session);
    const complexity = task.complexity?.totalScore ?? 0.5;
    const category = task.category ?? TaskCategory.DOCUMENTATION;
    const estimatedTokens = (task as any).estimatedTokens ?? 0;

    // SOLUZIONE FINALE: Routing intelligente con Gemini e Ollama
    // Task semplici → Ollama locale (veloce e gratuito)
    if (complexity < 0.3 && estimatedTokens < 200) {
      return {
        strategy: "ccr_local",
        confidence: 0.9,
        reasoning: "Task semplice → Ollama locale (veloce e gratuito)",
      };
    }

    // Task medi → Gemini Flash (solo se non è un task complesso)
    if (complexity < 0.6 && estimatedTokens < 500 && complexity <= 0.4) {
      return {
        strategy: "gemini_flash", 
        confidence: 0.8,
        reasoning: "Task medio → Gemini Flash",
      };
    }

    // Task complessi → Claude Sonnet (totalScore >= 0.5)
    return {
      strategy: "claude_direct",
      confidence: 0.85,
      reasoning: "Task complesso → Claude Sonnet",
    };

    // PRIORITÀ 5: Gemini se disponibile (DISABILITATO - usa logica sopra)
    if (false && this.geminiAvailable && this.geminiCreditAvailable) {
      const heavy = complexity > 0.6 || estimatedTokens > 500;
      if (!this.localOnlyMode) {
        if (heavy) {
          return {
            strategy: "gemini_pro",
            confidence: 0.82,
            reasoning: "Complex/specific task → Gemini 1.5 Pro",
          };
        }
        return {
          strategy: "gemini_flash",
          confidence: 0.8,
          reasoning: "Light/iterative task → Gemini 1.5 Flash",
        };
      } else {
        // Even in local-only mode (Claude exhausted), use Gemini first if credit is available
        if (heavy) {
          return {
            strategy: "gemini_pro",
            confidence: 0.8,
            reasoning: "Claude exhausted; using Gemini 2.5 Pro as orchestrator for complex but bounded tasks",
          };
        }
        return {
          strategy: "gemini_flash",
          confidence: 0.78,
          reasoning: "Claude exhausted; using Gemini 1.5 Flash for light tasks",
        };
      }
    }

    // If local-only mode (e.g., 5h window exhausted), never use Claude
    if (this.localOnlyMode) {
      // Prefer CCR for simple categories when available, else MCP if available
      if (
        complexity < 0.35 &&
        [TaskCategory.SIMPLE_DEBUG, TaskCategory.CODE_FORMATTING].includes(category) &&
        this.ccrAvailable
      ) {
        return {
          strategy: "ccr_local",
          model: process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b",
          confidence: 0.85,
          reasoning: "Local-only mode active; simple task routed to CCR",
        };
      }

      if (this.mcpAvailable) {
        const model =
          [TaskCategory.UNIT_TESTING, TaskCategory.DOCUMENTATION].includes(category)
            ? process.env.DEFAULT_GENERATION_MODEL || "qwen2.5-coder:7b"
            : process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b";
        return {
          strategy: "mcp_delegate",
          model,
          confidence: 0.8,
          reasoning: "Local-only mode active; delega a MCP locale",
        };
      }

      // If neither CCR nor MCP are available, last resort is to declare Claude but with low confidence
      return {
        strategy: "claude_direct",
        confidence: 0.2,
        reasoning: "Local-only mode active but no local backends available; fallback to Claude",
      };
    }

    // Decision rules (MVP) - DISABILITATO - usa logica sopra
    if (false && complexity > 0.7 || budget.remaining < 0.1) {
      return {
        strategy: "claude_direct",
        confidence: 0.8,
        reasoning: "High complexity or low token budget; keep on Claude Code",
      };
    }

    if (
      complexity < 0.3 &&
      [TaskCategory.SIMPLE_DEBUG, TaskCategory.CODE_FORMATTING].includes(category) &&
      this.ccrAvailable
    ) {
      return {
        strategy: "ccr_local",
        model: process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b",
        confidence: 0.7,
        reasoning: "Simple, repetitive task suited for local CCR model",
      };
    }

    // If CCR would have been preferred but is unavailable, try MCP if suitable
    if (
      complexity < 0.3 &&
      [TaskCategory.SIMPLE_DEBUG, TaskCategory.CODE_FORMATTING].includes(category) &&
      !this.ccrAvailable &&
      this.mcpAvailable
    ) {
      return {
        strategy: "mcp_delegate",
        model: process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b",
        confidence: 0.6,
        reasoning: "CCR unavailable; delegating to MCP as fallback",
      };
    }

    if (false &&
      complexity < 0.6 &&
      [TaskCategory.UNIT_TESTING, TaskCategory.DOCUMENTATION].includes(category) &&
      this.mcpAvailable
    ) {
      return {
        strategy: "mcp_delegate",
        model: process.env.DEFAULT_GENERATION_MODEL || "qwen2.5-coder:7b",
        confidence: 0.65,
        reasoning: "Medium complexity specialized task suited for MCP delegation",
      };
    }

    // If MCP would have been preferred but is unavailable, fall back safely (DISABILITATO)
    if (false &&
      complexity < 0.6 &&
      [TaskCategory.UNIT_TESTING, TaskCategory.DOCUMENTATION].includes(category) &&
      !this.mcpAvailable
    ) {
      return {
        strategy: "claude_direct",
        confidence: 0.6,
        reasoning: "MCP unavailable; falling back to Claude Code",
      };
    }

    return {
      strategy: "claude_direct",
      confidence: 0.55,
      reasoning: "Default safe choice: Claude Code",
    };
  }
}
