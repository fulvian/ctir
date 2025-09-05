import type { CTIRSession } from "@/models/session";
import { TaskCategory, type CTIRTask } from "@/models/task";
import type { RoutingDecision, TokenBudget, RoutingStrategy } from "@/models/routing";
import { OpenRouterIntegration, type OpenRouterModel } from "@/integrations/openrouter";

export class RoutingEngine {
  private mcpAvailable = true;
  private ccrAvailable = true;
  private localOnlyMode = false;
  private openRouterAvailable = false;
  private openRouterCreditAvailable = false;
  private openRouterIntegration: OpenRouterIntegration;

  constructor() {
    this.openRouterIntegration = new OpenRouterIntegration();
  }

  setMcpAvailability(available: boolean) {
    this.mcpAvailable = available;
  }

  setCcrAvailability(available: boolean) {
    this.ccrAvailable = available;
  }

  setOpenRouterAvailability(available: boolean) {
    this.openRouterAvailable = available;
  }

  setOpenRouterCreditAvailable(available: boolean) {
    this.openRouterCreditAvailable = available;
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
    const domainKnowledge = task.complexity?.domainKnowledge ?? 1;

    // === STRATEGIA SONNET 4 + OPENROUTER MULTI-MODEL ===

    // PRIORITÀ 1: Sonnet 4 (Claude Code) - Modello principale per task complessi
    if (!this.localOnlyMode && complexity > 0.6) {
      return {
        strategy: "claude_direct",
        confidence: 0.9,
        reasoning: "Task complesso → Sonnet 4 (modello principale)",
      };
    }

    // PRIORITÀ 2: OpenRouter per task specializzati (anche se Sonnet 4 disponibile)
    
    // DeepCoder-14B per ottimizzazione performance e competitive programming
    if (category === TaskCategory.PERFORMANCE_OPT && complexity < 0.3) {
      return {
        strategy: "openrouter_efficiency",
        model: "agentica-org/deepcoder-14b-preview",
        confidence: 0.85,
        reasoning: "Ottimizzazione performance → DeepCoder-14B (Efficiency Champion)",
      };
    }

    // Qwen2.5-Coder-32B per multi-language e manutenzione legacy
    if ([TaskCategory.REFACTORING_MINOR, TaskCategory.CODE_FORMATTING].includes(category) && 
        complexity < 0.4) {
      return {
        strategy: "openrouter_multilang",
        model: "qwen/qwen2.5-coder-32b-instruct",
        confidence: 0.8,
        reasoning: "Multi-language/Legacy maintenance → Qwen2.5-Coder-32B",
      };
    }

    // GPT-OSS-120B per prototipazione rapida e debugging
    if ([TaskCategory.SIMPLE_DEBUG, TaskCategory.INTEGRATION_WORK].includes(category) && 
        complexity >= 0.3 && complexity <= 0.6) {
      return {
        strategy: "openrouter_prototyping",
        model: "openai/gpt-oss-120b",
        confidence: 0.8,
        reasoning: "Rapid prototyping/Debugging → GPT-OSS-120B",
      };
    }

    // Gemini 2.5 Pro per ricerca e problemi complessi
    if (domainKnowledge > 3 && complexity > 0.5) {
      return {
        strategy: "openrouter_research",
        model: "google/gemini-2.5-pro-experimental",
        confidence: 0.85,
        reasoning: "Research/Complex problems → Gemini 2.5 Pro Experimental",
      };
    }

    // Qwen3-Coder-480B per architettura e design
    if (category === TaskCategory.ARCHITECTURE_DESIGN && complexity > 0.7) {
      return {
        strategy: "openrouter_technical",
        model: "qwen/qwen3-coder-480b-a35b-instruct",
        confidence: 0.9,
        reasoning: "Architecture design → Qwen3-Coder-480B (Technical Lead)",
      };
    }

    // PRIORITÀ 3: Fallback quando Sonnet 4 non disponibile (localOnlyMode)
    if (this.localOnlyMode) {
      // Se OpenRouter disponibile, usa il modello più adatto
      if (this.openRouterAvailable && this.openRouterCreditAvailable) {
        if (complexity > 0.7) {
          return {
            strategy: "openrouter_technical",
            model: "qwen/qwen3-coder-480b-a35b-instruct",
            confidence: 0.8,
            reasoning: "Local-only mode: Complex task → Qwen3-Coder-480B",
          };
        }
        
        if (complexity > 0.5) {
          return {
            strategy: "openrouter_research",
            model: "google/gemini-2.5-pro-experimental",
            confidence: 0.75,
            reasoning: "Local-only mode: Medium-complex task → Gemini 2.5 Pro",
          };
        }

        return {
          strategy: "openrouter_prototyping",
          model: "openai/gpt-oss-120b",
          confidence: 0.7,
          reasoning: "Local-only mode: Simple task → GPT-OSS-120B",
        };
      }

      // Fallback a CCR locale se disponibile
      if (complexity < 0.35 && 
          [TaskCategory.SIMPLE_DEBUG, TaskCategory.CODE_FORMATTING].includes(category) &&
          this.ccrAvailable) {
        return {
          strategy: "ccr_local",
          model: process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b",
          confidence: 0.6,
          reasoning: "Local-only mode: CCR fallback per task semplici",
        };
      }

      // Ultimo fallback a MCP locale
      if (this.mcpAvailable) {
        const model = [TaskCategory.UNIT_TESTING, TaskCategory.DOCUMENTATION].includes(category)
          ? process.env.DEFAULT_GENERATION_MODEL || "qwen2.5-coder:7b"
          : process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b";
        return {
          strategy: "mcp_delegate",
          model,
          confidence: 0.5,
          reasoning: "Local-only mode: MCP fallback",
        };
      }

      // Fallback finale a Sonnet 4 con bassa confidenza
      return {
        strategy: "claude_direct",
        confidence: 0.2,
        reasoning: "Local-only mode: Nessun backend locale disponibile, fallback a Sonnet 4",
      };
    }

    // PRIORITÀ 4: Default per task non classificati
    if (complexity > 0.5) {
      return {
        strategy: "claude_direct",
        confidence: 0.7,
        reasoning: "Task non classificato complesso → Sonnet 4",
      };
    }

    // Default per task semplici
    return {
      strategy: "openrouter_prototyping",
      model: "openai/gpt-oss-120b",
      confidence: 0.6,
      reasoning: "Task semplice → GPT-OSS-120B (default)",
    };
  }
}
