import { CTIRTask, TaskCategory } from "@/models/task";
import { CTIRSession } from "@/models/session";
import { RoutingDecision } from "@/models/routing";

export class SimpleRoutingEngine {
  decide(task: CTIRTask, session: CTIRSession): RoutingDecision {
    const complexity = task.complexity?.totalScore ?? 0.5;
    const estimatedTokens = (task as any).estimatedTokens ?? 0;

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

    // Task complessi → Claude Sonnet
    return {
      strategy: "claude_direct",
      confidence: 0.85,
      reasoning: "Task complesso → Claude Sonnet",
    };
  }
}
