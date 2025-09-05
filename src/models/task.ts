export enum TaskCategory {
  SIMPLE_DEBUG = "simple_debug",
  CODE_FORMATTING = "code_formatting",
  UNIT_TESTING = "unit_testing",
  DOCUMENTATION = "documentation",
  REFACTORING_MINOR = "refactoring_minor",
  ARCHITECTURE_DESIGN = "architecture",
  COMPLEX_DEBUGGING = "complex_debug",
  INTEGRATION_WORK = "integration",
  PERFORMANCE_OPT = "performance",
}

export interface TaskComplexityScore {
  readonly fileCount: number;
  readonly lineCount: number;
  readonly contextDeps: number;
  readonly domainKnowledge: number;
  readonly totalScore: number; // 0..1
}

export interface CTIRTask {
  id?: string;
  description: string;
  category?: TaskCategory;
  complexity?: TaskComplexityScore;
  estimatedTokens?: number;
}

