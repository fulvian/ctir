import { logger } from "@/utils/logger";

export interface TaskClassification {
  category: TaskCategory;
  complexity: number; // 0-1 scale
  estimatedTokens: number;
  recommendedStrategy: RoutingStrategy;
  confidence: number;
  reasoning: string;
  keywords: string[];
  contextRequirements: ContextRequirement[];
}

export enum TaskCategory {
  SIMPLE_DEBUG = "simple_debug",
  CODE_FORMATTING = "code_formatting", 
  UNIT_TESTING = "unit_testing",
  DOCUMENTATION = "documentation",
  REFACTORING_MINOR = "refactoring_minor",
  ARCHITECTURE_DESIGN = "architecture_design",
  COMPLEX_DEBUGGING = "complex_debugging",
  INTEGRATION_WORK = "integration_work",
  PERFORMANCE_OPT = "performance_optimization",
  SECURITY_AUDIT = "security_audit"
}

export enum RoutingStrategy {
  CLAUDE_DIRECT = "claude_direct",
  OPENROUTER_SPECIALIZED = "openrouter_specialized", 
  LOCAL_MODEL = "local_model",
  HYBRID_APPROACH = "hybrid_approach"
}

export enum ContextRequirement {
  FULL_PROJECT_CONTEXT = "full_project_context",
  MULTIPLE_FILES = "multiple_files",
  TEST_CONTEXT = "test_context",
  DOCUMENTATION_CONTEXT = "documentation_context",
  API_CONTEXT = "api_context",
  DATABASE_CONTEXT = "database_context",
  MINIMAL_CONTEXT = "minimal_context"
}

export class TaskClassifier {
  private categoryPatterns: Map<TaskCategory, RegExp[]> = new Map();
  private complexityIndicators: Map<string, number> = new Map();
  private contextKeywords: Map<ContextRequirement, string[]> = new Map();

  constructor() {
    this.initializePatterns();
    logger.info("Task Classifier initialized");
  }

  /**
   * Classify a task based on description and context
   */
  async classifyTask(taskContext: any): Promise<TaskClassification> {
    const description = taskContext.description.toLowerCase();
    const contextFiles = taskContext.contextFiles || [];
    
    logger.debug("Classifying task", { description, contextFiles });

    // 1. Determine category
    const category = this.determineCategory(description);
    
    // 2. Calculate complexity
    const complexity = this.calculateComplexity(description, contextFiles, category);
    
    // 3. Estimate token usage
    const estimatedTokens = this.estimateTokenUsage(description, contextFiles, complexity);
    
    // 4. Determine recommended strategy
    const recommendedStrategy = this.determineStrategy(category, complexity, estimatedTokens);
    
    // 5. Calculate confidence
    const confidence = this.calculateConfidence(description, category, complexity);
    
    // 6. Generate reasoning
    const reasoning = this.generateReasoning(category, complexity, recommendedStrategy);
    
    // 7. Extract keywords
    const keywords = this.extractKeywords(description);
    
    // 8. Determine context requirements
    const contextRequirements = this.determineContextRequirements(category, complexity, contextFiles);

    return {
      category,
      complexity,
      estimatedTokens,
      recommendedStrategy,
      confidence,
      reasoning,
      keywords,
      contextRequirements
    };
  }

  /**
   * Determine task category based on description patterns
   */
  private determineCategory(description: string): TaskCategory {
    for (const [category, patterns] of this.categoryPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(description)) {
          return category;
        }
      }
    }
    
    // Default to simple debug if no pattern matches
    return TaskCategory.SIMPLE_DEBUG;
  }

  /**
   * Calculate task complexity (0-1 scale)
   */
  private calculateComplexity(description: string, contextFiles: string[], category: TaskCategory): number {
    let complexity = 0.5; // Base complexity
    
    // Category-based complexity
    const categoryComplexity = {
      [TaskCategory.SIMPLE_DEBUG]: 0.2,
      [TaskCategory.CODE_FORMATTING]: 0.1,
      [TaskCategory.UNIT_TESTING]: 0.3,
      [TaskCategory.DOCUMENTATION]: 0.2,
      [TaskCategory.REFACTORING_MINOR]: 0.4,
      [TaskCategory.ARCHITECTURE_DESIGN]: 0.9,
      [TaskCategory.COMPLEX_DEBUGGING]: 0.7,
      [TaskCategory.INTEGRATION_WORK]: 0.6,
      [TaskCategory.PERFORMANCE_OPT]: 0.8,
      [TaskCategory.SECURITY_AUDIT]: 0.8
    };
    
    complexity = categoryComplexity[category];
    
    // Adjust based on description keywords
    for (const [keyword, weight] of this.complexityIndicators) {
      if (description.includes(keyword)) {
        complexity += weight;
      }
    }
    
    // Adjust based on context files
    if (contextFiles.length > 5) complexity += 0.1;
    if (contextFiles.length > 10) complexity += 0.1;
    
    // Adjust based on file types
    const hasTests = contextFiles.some(f => f.includes('test') || f.includes('spec'));
    const hasConfig = contextFiles.some(f => f.includes('config') || f.includes('env'));
    const hasMultipleTypes = new Set(contextFiles.map(f => f.split('.').pop())).size > 3;
    
    if (hasTests) complexity += 0.1;
    if (hasConfig) complexity += 0.1;
    if (hasMultipleTypes) complexity += 0.1;
    
    // Clamp between 0 and 1
    return Math.min(Math.max(complexity, 0), 1);
  }

  /**
   * Estimate token usage based on task characteristics
   */
  private estimateTokenUsage(description: string, contextFiles: string[], complexity: number): number {
    let tokens = 1000; // Base tokens for task description
    
    // Add tokens for context files
    tokens += contextFiles.length * 500;
    
    // Add tokens based on complexity
    tokens += complexity * 3000;
    
    // Add tokens for description length
    tokens += description.length * 2;
    
    // Add tokens for specific keywords
    const highTokenKeywords = ['architecture', 'design', 'refactor', 'optimize', 'security'];
    for (const keyword of highTokenKeywords) {
      if (description.includes(keyword)) {
        tokens += 1000;
      }
    }
    
    return Math.round(tokens);
  }

  /**
   * Determine recommended routing strategy
   */
  private determineStrategy(category: TaskCategory, complexity: number, estimatedTokens: number): RoutingStrategy {
    // High complexity or high token usage -> Claude direct
    if (complexity > 0.7 || estimatedTokens > 10000) {
      return RoutingStrategy.CLAUDE_DIRECT;
    }
    
    // Simple tasks -> Local model
    if (complexity < 0.3 && estimatedTokens < 3000) {
      return RoutingStrategy.LOCAL_MODEL;
    }
    
    // Specialized tasks -> OpenRouter specialized
    if ([TaskCategory.UNIT_TESTING, TaskCategory.DOCUMENTATION, TaskCategory.CODE_FORMATTING].includes(category)) {
      return RoutingStrategy.OPENROUTER_SPECIALIZED;
    }
    
    // Medium complexity -> Hybrid approach
    return RoutingStrategy.HYBRID_APPROACH;
  }

  /**
   * Calculate classification confidence
   */
  private calculateConfidence(description: string, category: TaskCategory, complexity: number): number {
    let confidence = 0.7; // Base confidence
    
    // Increase confidence if description is detailed
    if (description.length > 100) confidence += 0.1;
    if (description.length > 200) confidence += 0.1;
    
    // Increase confidence if multiple patterns match
    const matchingPatterns = this.categoryPatterns.get(category)?.filter(pattern => 
      pattern.test(description)
    ).length || 0;
    
    if (matchingPatterns > 1) confidence += 0.1;
    
    // Decrease confidence for edge cases
    if (complexity > 0.8 && complexity < 0.9) confidence -= 0.1;
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Generate reasoning for the classification
   */
  private generateReasoning(category: TaskCategory, complexity: number, strategy: RoutingStrategy): string {
    const reasons: string[] = [];
    
    reasons.push(`Category: ${category} (complexity: ${(complexity * 100).toFixed(1)}%)`);
    
    if (complexity > 0.7) {
      reasons.push("High complexity task requiring advanced reasoning");
    } else if (complexity < 0.3) {
      reasons.push("Simple task suitable for local processing");
    } else {
      reasons.push("Medium complexity task requiring balanced approach");
    }
    
    switch (strategy) {
      case RoutingStrategy.CLAUDE_DIRECT:
        reasons.push("Recommended Claude Code for maximum capability");
        break;
      case RoutingStrategy.OPENROUTER_SPECIALIZED:
        reasons.push("Recommended specialized model for efficiency");
        break;
      case RoutingStrategy.LOCAL_MODEL:
        reasons.push("Recommended local model for speed and privacy");
        break;
      case RoutingStrategy.HYBRID_APPROACH:
        reasons.push("Recommended hybrid approach for optimal balance");
        break;
    }
    
    return reasons.join(". ");
  }

  /**
   * Extract keywords from task description
   */
  private extractKeywords(description: string): string[] {
    const keywords: string[] = [];
    const commonKeywords = [
      'bug', 'fix', 'error', 'issue', 'problem',
      'feature', 'implement', 'add', 'create',
      'refactor', 'optimize', 'improve', 'enhance',
      'test', 'testing', 'unit', 'integration',
      'documentation', 'docs', 'comment', 'explain',
      'security', 'vulnerability', 'audit',
      'performance', 'speed', 'memory', 'optimization',
      'api', 'endpoint', 'service', 'integration',
      'database', 'query', 'migration', 'schema'
    ];
    
    for (const keyword of commonKeywords) {
      if (description.includes(keyword)) {
        keywords.push(keyword);
      }
    }
    
    return keywords;
  }

  /**
   * Determine context requirements
   */
  private determineContextRequirements(category: TaskCategory, complexity: number, contextFiles: string[]): ContextRequirement[] {
    const requirements: ContextRequirement[] = [];
    
    // Always need minimal context
    requirements.push(ContextRequirement.MINIMAL_CONTEXT);
    
    // Category-based requirements
    switch (category) {
      case TaskCategory.ARCHITECTURE_DESIGN:
      case TaskCategory.COMPLEX_DEBUGGING:
        requirements.push(ContextRequirement.FULL_PROJECT_CONTEXT);
        break;
        
      case TaskCategory.UNIT_TESTING:
        requirements.push(ContextRequirement.TEST_CONTEXT);
        break;
        
      case TaskCategory.DOCUMENTATION:
        requirements.push(ContextRequirement.DOCUMENTATION_CONTEXT);
        break;
        
      case TaskCategory.INTEGRATION_WORK:
        requirements.push(ContextRequirement.API_CONTEXT);
        break;
    }
    
    // Complexity-based requirements
    if (complexity > 0.6) {
      requirements.push(ContextRequirement.MULTIPLE_FILES);
    }
    
    // File-based requirements
    if (contextFiles.some(f => f.includes('test'))) {
      requirements.push(ContextRequirement.TEST_CONTEXT);
    }
    if (contextFiles.some(f => f.includes('api') || f.includes('service'))) {
      requirements.push(ContextRequirement.API_CONTEXT);
    }
    if (contextFiles.some(f => f.includes('db') || f.includes('database'))) {
      requirements.push(ContextRequirement.DATABASE_CONTEXT);
    }
    
    return [...new Set(requirements)]; // Remove duplicates
  }

  /**
   * Initialize classification patterns
   */
  private initializePatterns(): void {
    this.categoryPatterns = new Map([
      [TaskCategory.SIMPLE_DEBUG, [
        /fix.*bug/i,
        /resolve.*error/i,
        /syntax.*error/i,
        /typo/i,
        /missing.*import/i,
        /undefined.*variable/i
      ]],
      [TaskCategory.CODE_FORMATTING, [
        /format.*code/i,
        /prettier/i,
        /lint/i,
        /style.*fix/i,
        /indentation/i,
        /whitespace/i
      ]],
      [TaskCategory.UNIT_TESTING, [
        /write.*test/i,
        /unit.*test/i,
        /test.*case/i,
        /coverage/i,
        /mock/i,
        /stub/i
      ]],
      [TaskCategory.DOCUMENTATION, [
        /document/i,
        /comment/i,
        /readme/i,
        /explain/i,
        /describe/i,
        /api.*doc/i
      ]],
      [TaskCategory.REFACTORING_MINOR, [
        /refactor/i,
        /clean.*up/i,
        /simplify/i,
        /extract.*method/i,
        /rename/i,
        /reorganize/i
      ]],
      [TaskCategory.ARCHITECTURE_DESIGN, [
        /architecture/i,
        /design.*pattern/i,
        /system.*design/i,
        /microservice/i,
        /component.*structure/i,
        /framework.*choice/i
      ]],
      [TaskCategory.COMPLEX_DEBUGGING, [
        /debug.*complex/i,
        /multi.*file.*bug/i,
        /performance.*issue/i,
        /memory.*leak/i,
        /race.*condition/i,
        /concurrent.*issue/i
      ]],
      [TaskCategory.INTEGRATION_WORK, [
        /integrate/i,
        /api.*integration/i,
        /third.*party/i,
        /webhook/i,
        /oauth/i,
        /external.*service/i
      ]],
      [TaskCategory.PERFORMANCE_OPT, [
        /optimize/i,
        /performance/i,
        /speed.*up/i,
        /memory.*optimization/i,
        /bottleneck/i,
        /profiling/i
      ]],
      [TaskCategory.SECURITY_AUDIT, [
        /security/i,
        /vulnerability/i,
        /audit/i,
        /penetration/i,
        /injection/i,
        /authentication/i
      ]]
    ]);

    this.complexityIndicators = new Map([
      ['complex', 0.3],
      ['multiple', 0.2],
      ['several', 0.2],
      ['many', 0.2],
      ['architecture', 0.4],
      ['design', 0.3],
      ['system', 0.3],
      ['framework', 0.3],
      ['integration', 0.3],
      ['performance', 0.3],
      ['security', 0.3],
      ['concurrent', 0.3],
      ['distributed', 0.3],
      ['microservice', 0.3],
      ['database', 0.2],
      ['api', 0.2],
      ['service', 0.2],
      ['simple', -0.2],
      ['quick', -0.2],
      ['easy', -0.2],
      ['minor', -0.2],
      ['small', -0.2]
    ]);

    this.contextKeywords = new Map([
      [ContextRequirement.FULL_PROJECT_CONTEXT, ['architecture', 'system', 'framework', 'design']],
      [ContextRequirement.MULTIPLE_FILES, ['multiple', 'several', 'many', 'across']],
      [ContextRequirement.TEST_CONTEXT, ['test', 'testing', 'spec', 'coverage']],
      [ContextRequirement.DOCUMENTATION_CONTEXT, ['document', 'comment', 'readme', 'api']],
      [ContextRequirement.API_CONTEXT, ['api', 'endpoint', 'service', 'integration']],
      [ContextRequirement.DATABASE_CONTEXT, ['database', 'db', 'query', 'migration']],
      [ContextRequirement.MINIMAL_CONTEXT, ['simple', 'quick', 'minor', 'small']]
    ]);
  }
}
