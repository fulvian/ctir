import { TaskCategory, type CTIRTask, type TaskComplexityScore } from "@/models/task";

export class TaskClassifier {
  analyze(description: string): {
    category: TaskCategory;
    complexity: TaskComplexityScore;
  } {
    const text = description.toLowerCase();

    // Simple keyword-based heuristics for MVP
    let category = TaskCategory.DOCUMENTATION;
    if (/lint|format|prettier|style/.test(text)) category = TaskCategory.CODE_FORMATTING;
    else if (/test|unit|coverage/.test(text)) category = TaskCategory.UNIT_TESTING;
    else if (/refactor|cleanup/.test(text)) category = TaskCategory.REFACTORING_MINOR;
    else if (/optimi[sz]e|performance|slow/.test(text)) category = TaskCategory.PERFORMANCE_OPT;
    else if (/integrat(e|ion)|api|connect/.test(text)) category = TaskCategory.INTEGRATION_WORK;
    else if (/design|architect|plan/.test(text)) category = TaskCategory.ARCHITECTURE_DESIGN;
    else if (/multi-file|complex|race|deadlock/.test(text)) category = TaskCategory.COMPLEX_DEBUGGING;
    else if (/bug|error|fix|stack trace/.test(text)) category = TaskCategory.SIMPLE_DEBUG;

    const fileCount = /multi|across files|monorepo|completo|complete|sistema|system/.test(text) ? 5 : 1;
    const lineCount = /large|big|thousands|massive|completo|complete|sistema|system|preprocessing|training|validation|deployment/.test(text) ? 1000 : 100;
    const contextDeps = /depends|needs context|cross|completo|complete|sistema|system|integration|integrate/.test(text) ? 5 : 1;
    const domainKnowledge = /ml|machine learning|ai|artificial intelligence|crypto|compiler|kernel|deep learning|neural|algorithm|optimization|statistical|predictive|analytics/.test(text) ? 5 : 1;

    // Normalize to 0..1 (lightweight heuristic)
    const weights = { file: 0.3, line: 0.2, ctx: 0.25, domain: 0.25 };
    const norm = (n: number, max: number) => Math.min(1, n / max);
    const total =
      norm(fileCount, 10) * weights.file +
      norm(lineCount, 2000) * weights.line +
      norm(contextDeps, 10) * weights.ctx +
      norm(domainKnowledge, 10) * weights.domain;

    const complexity: TaskComplexityScore = {
      fileCount,
      lineCount,
      contextDeps,
      domainKnowledge,
      totalScore: Number(total.toFixed(3)),
    };
    return { category, complexity };
  }

  enrich(task: CTIRTask): CTIRTask {
    const { category, complexity } = this.analyze(task.description);
    return { ...task, category, complexity };
  }
}
