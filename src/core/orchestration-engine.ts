import { logger } from "@/utils/logger";
import { TaskClassifier } from "@/models/task-classifier";
import { RoutingEngine } from "@/core/router";
import { OpenRouterIntegration } from "@/integrations/openrouter";
import { CCSessionsIntegration } from "@/integrations/cc-sessions";

export interface TaskContext {
  taskId: string;
  description: string;
  complexity: number;
  category: string;
  contextFiles: string[];
  projectState: ProjectState;
  userPreferences: UserPreferences;
}

export interface ProjectState {
  currentBranch: string;
  modifiedFiles: string[];
  lastCommit: string;
  dependencies: string[];
  testStatus: 'passing' | 'failing' | 'unknown';
}

export interface UserPreferences {
  preferredModel: string;
  maxComplexityForLocal: number;
  enableAutoRouting: boolean;
  notificationLevel: 'silent' | 'minimal' | 'verbose';
}

export interface TaskExecutionResult {
  status: string;
  message: string;
  model?: string;
  success?: boolean;
  qualityScore?: number;
}

export interface OrchestrationDecision {
  primaryModel: string;
  fallbackModel?: string;
  reasoning: string;
  confidence: number;
  estimatedTokens: number;
  contextStrategy: 'minimal' | 'full' | 'incremental';
}

export class CTIROrchestrationEngine {
  private taskClassifier: TaskClassifier;
  private routingEngine: RoutingEngine;
  private openRouterIntegration: OpenRouterIntegration;
  private ccSessionsIntegration: CCSessionsIntegration;
  private activeTasks: Map<string, TaskContext> = new Map();
  private modelPerformance: Map<string, ModelMetrics> = new Map();

  constructor() {
    this.taskClassifier = new TaskClassifier();
    this.routingEngine = new RoutingEngine();
    this.openRouterIntegration = new OpenRouterIntegration();
    this.ccSessionsIntegration = new CCSessionsIntegration();
    
    logger.info("CTIR Orchestration Engine initialized");
  }

  /**
   * Main orchestration method - analyzes task and routes to optimal model
   */
  async orchestrateTask(
    taskDescription: string,
    contextFiles: string[] = [],
    userPreferences: Partial<UserPreferences> = {}
  ): Promise<OrchestrationDecision> {
    
    logger.info("Starting task orchestration", { taskDescription, contextFiles });

    // 1. Create task context using cc-sessions integration
    const taskContext = await this.createTaskContext(
      taskDescription, 
      contextFiles, 
      userPreferences
    );

    // 2. Classify task complexity and category
    const classification = await this.taskClassifier.classifyTask(taskContext);
    
    // 3. Determine optimal routing strategy
    const routingDecision = this.routingEngine.decide(
      classification.ctirTask,
      taskContext.session
    );

    // 4. Create orchestration decision
    const decision: OrchestrationDecision = {
      primaryModel: routingDecision.model,
      fallbackModel: routingDecision.fallbackModel,
      reasoning: routingDecision.reasoning,
      confidence: routingDecision.confidence,
      estimatedTokens: this.estimateTokenUsage(taskContext, classification),
      contextStrategy: this.determineContextStrategy(classification)
    };

    // 5. Store task context for memory preservation
    this.activeTasks.set(taskContext.taskId, taskContext);
    await this.ccSessionsIntegration.saveTaskContext(taskContext);

    logger.info("Task orchestration completed", { 
      taskId: taskContext.taskId,
      decision 
    });

    return decision;
  }

  /**
   * Execute task using the orchestrated model
   */
  async executeTask(
    taskId: string,
    decision: OrchestrationDecision
  ): Promise<TaskExecutionResult> {
    
    const taskContext = this.activeTasks.get(taskId);
    if (!taskContext) {
      throw new Error(`Task ${taskId} not found`);
    }

    logger.info("Executing task", { taskId, model: decision.primaryModel });

    try {
      // 1. Prepare context for the selected model
      const preparedContext = await this.prepareModelContext(
        taskContext, 
        decision
      );

      // 2. Execute using the primary model
      const result = await this.executeWithModel(
        decision.primaryModel,
        preparedContext,
        decision.contextStrategy
      );

      // 3. Update performance metrics
      await this.updateModelPerformance(decision.primaryModel, result);

      // 4. Save execution context for continuity
      await this.ccSessionsIntegration.saveExecutionContext(taskId, result);

      return result;

    } catch (error) {
      logger.error("Task execution failed", { taskId, error });
      
      // Try fallback model if available
      if (decision.fallbackModel) {
        logger.info("Attempting fallback model", { 
          fallback: decision.fallbackModel 
        });
        
        return await this.executeWithFallback(
          taskId,
          decision.fallbackModel,
          taskContext
        );
      }
      
      throw error;
    }
  }

  /**
   * Create task context using cc-sessions integration
   */
  private async createTaskContext(
    description: string,
    contextFiles: string[],
    userPreferences: Partial<UserPreferences>
  ): Promise<TaskContext> {
    
    const taskId = this.generateTaskId();
    
    // Get current project state
    const projectState = await this.ccSessionsIntegration.getProjectState();
    
    // Merge user preferences with defaults
    const preferences: UserPreferences = {
      preferredModel: 'sonnet-4',
      maxComplexityForLocal: 0.6,
      enableAutoRouting: true,
      notificationLevel: 'minimal',
      ...userPreferences
    };

    return {
      taskId,
      description,
      complexity: 0, // Will be calculated by classifier
      category: '', // Will be determined by classifier
      contextFiles,
      projectState: {
        ...projectState,
        dependencies: projectState.dependencies || []
      },
      userPreferences: preferences
    };
  }

  /**
   * Execute task with specific model
   */
  private async executeWithModel(
    modelName: string,
    context: PreparedContext,
    strategy: 'minimal' | 'full' | 'incremental'
  ): Promise<TaskExecutionResult> {
    
    const startTime = Date.now();
    
    try {
      let result: TaskExecutionResult;
      
      if (modelName === 'sonnet-4') {
        // Use Claude Code directly (no API key needed)
        result = await this.executeWithClaudeCode(context);
      } else {
        // Use OpenRouter for other models
        const openRouterResult = await this.openRouterIntegration.executeTask(
          modelName,
          context.taskDescription,
          context.contextSummary
        );
        result = {
          status: "executed_by_openrouter",
          message: openRouterResult,
          model: modelName,
          success: true,
          qualityScore: 0.8
        };
      }

      const executionTime = Date.now() - startTime;
      
      return {
        ...result,
        executionTime,
        modelUsed: modelName,
        strategy
      };

    } catch (error) {
      logger.error("Model execution failed", { modelName, error });
      throw error;
    }
  }

  /**
   * Execute with Claude Code (Sonnet 4) - no API key needed
   */
  private async executeWithClaudeCode(
    context: PreparedContext
  ): Promise<TaskExecutionResult> {
    
    // This would integrate with Claude Code's internal mechanisms
    // For now, we'll simulate the execution
    logger.info("Executing with Claude Code (Sonnet 4)", { 
      taskId: context.taskId 
    });

    // In a real implementation, this would:
    // 1. Send the task to Claude Code
    // 2. Monitor the execution
    // 3. Capture the results
    // 4. Return structured output

    return {
      taskId: context.taskId,
      success: true,
      output: "Task executed with Claude Code",
      modelUsed: 'sonnet-4',
      executionTime: 0,
      strategy: 'full',
      tokensUsed: 0,
      qualityScore: 0.95
    };
  }

  /**
   * Prepare context for specific model
   */
  private async prepareModelContext(
    taskContext: TaskContext,
    decision: OrchestrationDecision
  ): Promise<PreparedContext> {
    
    const contextStrategy = decision.contextStrategy;
    
    let contextFiles: string[];
    let systemPrompt: string;
    
    switch (contextStrategy) {
      case 'minimal':
        contextFiles = taskContext.contextFiles.slice(0, 3);
        systemPrompt = this.generateMinimalPrompt(taskContext);
        break;
        
      case 'full':
        contextFiles = taskContext.contextFiles;
        systemPrompt = this.generateFullPrompt(taskContext);
        break;
        
      case 'incremental':
        contextFiles = await this.ccSessionsIntegration.getRelevantFiles(
          taskContext.taskId
        );
        systemPrompt = this.generateIncrementalPrompt(taskContext);
        break;
    }

    return {
      taskId: taskContext.taskId,
      description: taskContext.description,
      contextFiles,
      systemPrompt,
      projectState: taskContext.projectState,
      modelSpecific: this.getModelSpecificContext(decision.primaryModel)
    };
  }

  /**
   * Generate model-specific context and prompts
   */
  private getModelSpecificContext(modelName: string): any {
    const modelConfigs = {
      'qwen3-coder-480b': {
        specialties: ['architecture', 'complex_systems', 'code_review'],
        maxTokens: 262000,
        temperature: 0.1
      },
      'gpt-oss-120b': {
        specialties: ['rapid_prototyping', 'api_integration', 'debugging'],
        maxTokens: 128000,
        temperature: 0.3
      },
      'gemini-2.5-pro': {
        specialties: ['reasoning', 'multimodal', 'research'],
        maxTokens: 1000000,
        temperature: 0.2
      },
      'qwen2.5-coder-32b': {
        specialties: ['multi_language', 'maintenance', 'migration'],
        maxTokens: 32000,
        temperature: 0.2
      },
      'deepcoder-14b': {
        specialties: ['algorithms', 'optimization', 'competitive_programming'],
        maxTokens: 16000,
        temperature: 0.1
      }
    };

    return modelConfigs[modelName as keyof typeof modelConfigs] || modelConfigs['gpt-oss-120b'];
  }

  /**
   * Generate system prompts based on context strategy
   */
  private generateMinimalPrompt(taskContext: TaskContext): string {
    return `You are a specialized coding assistant. Focus on the core task: ${taskContext.description}`;
  }

  private generateFullPrompt(taskContext: TaskContext): string {
    return `You are an expert coding assistant with full project context. 
    Task: ${taskContext.description}
    Project: ${taskContext.projectState.currentBranch}
    Files: ${taskContext.contextFiles.join(', ')}`;
  }

  private generateIncrementalPrompt(taskContext: TaskContext): string {
    return `You are continuing work on: ${taskContext.description}
    Build upon previous context and maintain consistency.`;
  }

  /**
   * Utility methods
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private estimateTokenUsage(
    context: TaskContext, 
    classification: any
  ): number {
    // Simple estimation based on complexity and context size
    const baseTokens = 1000;
    const complexityMultiplier = classification.complexity * 2000;
    const contextMultiplier = context.contextFiles.length * 500;
    
    return Math.round(baseTokens + complexityMultiplier + contextMultiplier);
  }

  private determineContextStrategy(classification: any): 'minimal' | 'full' | 'incremental' {
    if (classification.complexity < 0.3) return 'minimal';
    if (classification.complexity > 0.7) return 'full';
    return 'incremental';
  }

  private getModelAvailability(): Map<string, boolean> {
    // This would check actual model availability
    const availability = new Map<string, boolean>();
    availability.set('sonnet-4', true); // Always available
    availability.set('qwen3-coder-480b', true);
    availability.set('gpt-oss-120b', true);
    availability.set('gemini-2.5-pro', true);
    availability.set('qwen2.5-coder-32b', true);
    availability.set('deepcoder-14b', true);
    return availability;
  }

  private async updateModelPerformance(
    modelName: string, 
    result: TaskExecutionResult
  ): Promise<void> {
    // Update performance metrics for model selection optimization
    const current = this.modelPerformance.get(modelName) || {
      totalExecutions: 0,
      successRate: 0,
      averageQuality: 0,
      averageExecutionTime: 0
    };

    current.totalExecutions++;
    current.successRate = (current.successRate + (result.success ? 1 : 0)) / 2;
    current.averageQuality = (current.averageQuality + result.qualityScore) / 2;
    current.averageExecutionTime = (current.averageExecutionTime + result.executionTime) / 2;

    this.modelPerformance.set(modelName, current);
  }

  private async executeWithFallback(
    taskId: string,
    fallbackModel: string,
    taskContext: TaskContext
  ): Promise<TaskExecutionResult> {
    logger.info("Executing with fallback model", { fallbackModel });
    
    const preparedContext = await this.prepareModelContext(
      taskContext,
      { primaryModel: fallbackModel, contextStrategy: 'minimal' } as OrchestrationDecision
    );

    return await this.executeWithModel(fallbackModel, preparedContext, 'minimal');
  }
}

// Supporting interfaces
export interface PreparedContext {
  taskId: string;
  description: string;
  contextFiles: string[];
  systemPrompt: string;
  projectState: ProjectState;
  modelSpecific: any;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output: string;
  modelUsed: string;
  executionTime: number;
  strategy: string;
  tokensUsed: number;
  qualityScore: number;
}

export interface ModelMetrics {
  totalExecutions: number;
  successRate: number;
  averageQuality: number;
  averageExecutionTime: number;
}
