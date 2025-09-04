import type { CTIRSession } from "@/models/session";
import { TaskCategory, type CTIRTask } from "@/models/task";
import type { RoutingDecision, TokenBudget } from "@/models/routing";

export class RoutingEngine {
  private normalizeBudget(session: CTIRSession): TokenBudget {
    const remaining = 1 - Math.min(1, session.tokenBudget.used / session.tokenBudget.limit);
    return { remaining };
  }

  decide(task: CTIRTask, session: CTIRSession): RoutingDecision {
    const budget = this.normalizeBudget(session);
    const complexity = task.complexity?.totalScore ?? 0.5;
    const category = task.category ?? TaskCategory.DOCUMENTATION;

    // Decision rules (MVP)
    if (complexity > 0.7 || budget.remaining < 0.1) {
      return {
        strategy: "claude_direct",
        confidence: 0.8,
        reasoning: "High complexity or low token budget; keep on Claude Code",
      };
    }

    if (
      complexity < 0.3 &&
      [TaskCategory.SIMPLE_DEBUG, TaskCategory.CODE_FORMATTING].includes(category)
    ) {
      return {
        strategy: "ccr_local",
        model: process.env.DEFAULT_DEBUG_MODEL || "qwen2.5-coder:7b",
        confidence: 0.7,
        reasoning: "Simple, repetitive task suited for local CCR model",
      };
    }

    if (
      complexity < 0.6 &&
      [TaskCategory.UNIT_TESTING, TaskCategory.DOCUMENTATION].includes(category)
    ) {
      return {
        strategy: "mcp_delegate",
        model: process.env.DEFAULT_GENERATION_MODEL || "qwen2.5-coder:7b",
        confidence: 0.65,
        reasoning: "Medium complexity specialized task suited for MCP delegation",
      };
    }

    return {
      strategy: "claude_direct",
      confidence: 0.55,
      reasoning: "Default safe choice: Claude Code",
    };
  }
}
