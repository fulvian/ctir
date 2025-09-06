import { logger } from "@/utils/logger";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { CCSessionsHooksManager } from "./cc-sessions-hooks";
import { CCSessionsStatusline } from "./cc-sessions-statusline";

export interface CCSession {
  sessionId: string;
  projectRoot: string;
  currentTask?: string;
  contextManifest: ContextManifest;
  taskHistory: TaskHistory[];
  sessionState: SessionState;
}

export interface ContextManifest {
  projectOverview: string;
  techStack: string[];
  keyFiles: string[];
  dependencies: string[];
  recentChanges: string[];
  contextRules: string[];
}

export interface TaskHistory {
  taskId: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  modelUsed?: string;
  qualityScore?: number;
  contextFiles: string[];
}

export interface SessionState {
  currentBranch: string;
  modifiedFiles: string[];
  lastCommit: string;
  dependencies: string[];
  testStatus: 'passing' | 'failing' | 'unknown';
  activeAgents: string[];
  contextWindow: {
    size: number;
    utilization: number;
  };
}

export interface TaskFile {
  taskId: string;
  description: string;
  successCriteria: string[];
  servicesInvolved: string[];
  routingMetadata: {
    complexityScore: number;
    estimatedTokens: number;
    recommendedStrategy: string;
    fallbackStrategy: string;
    specializedModel: string;
  };
  contextFiles: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class CCSessionsIntegration {
  private projectRoot: string;
  private sessionsPath: string;
  private tasksPath: string;
  private contextPath: string;
  private hooksManager: CCSessionsHooksManager;
  private statusline: CCSessionsStatusline;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.sessionsPath = path.join(this.projectRoot, '.claude', 'sessions');
    this.tasksPath = path.join(this.sessionsPath, 'tasks');
    this.contextPath = path.join(this.sessionsPath, 'context');
    
    // Initialize hooks and statusline managers
    this.hooksManager = new CCSessionsHooksManager(this.projectRoot);
    this.statusline = new CCSessionsStatusline(this.projectRoot);
    
    this.initializeDirectories();
    logger.info("CC-Sessions integration initialized", { 
      projectRoot: this.projectRoot,
      sessionsPath: this.sessionsPath 
    });
  }

  /**
   * Initialize cc-sessions directory structure
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsPath, { recursive: true });
      await fs.mkdir(this.tasksPath, { recursive: true });
      await fs.mkdir(this.contextPath, { recursive: true });
      
      // Create initial session file if it doesn't exist
      const sessionFile = path.join(this.sessionsPath, 'current-session.json');
      try {
        await fs.access(sessionFile);
      } catch {
        await this.createInitialSession();
      }
    } catch (error) {
      logger.error("Failed to initialize cc-sessions directories", { error });
    }
  }

  /**
   * Create initial session file
   */
  private async createInitialSession(): Promise<void> {
    const initialSession: CCSession = {
      sessionId: this.generateSessionId(),
      projectRoot: this.projectRoot,
      contextManifest: await this.buildInitialContextManifest(),
      taskHistory: [],
      sessionState: await this.getProjectState()
    };

    const sessionFile = path.join(this.sessionsPath, 'current-session.json');
    await fs.writeFile(sessionFile, JSON.stringify(initialSession, null, 2));
    
    logger.info("Created initial cc-sessions session", { 
      sessionId: initialSession.sessionId 
    });
  }

  /**
   * Bootstrap project structure and config if missing
   * - Ensures .claude/{hooks,state,sessions} and sessions/{tasks,context}
   * - Copies statusline and daic from submodule when available
   * - Creates sessions/sessions-config.json if missing
   * - Adds sessions/tasks/TEMPLATE.md and CLAUDE.sessions.md from templates when available
   */
  async bootstrapProjectIfNeeded(): Promise<void> {
    try {
      // Ensure base directories
      await this.initializeDirectories();

      // Ensure hooks (statusline + daic)
      await this.hooksManager["initializeHooks" as keyof CCSessionsHooksManager]?.call(this.hooksManager);

      // Ensure sessions-config.json exists
      const cfgPath = path.join(this.projectRoot, 'sessions', 'sessions-config.json');
      try {
        await fs.access(cfgPath);
      } catch {
        await this.hooksManager["createDefaultConfig" as keyof CCSessionsHooksManager]?.call(this.hooksManager);
      }

      // Copy templates when available
      const subRoot = path.join(this.projectRoot, 'submodules', 'cc-sessions', 'cc_sessions', 'templates');
      const tasksDir = path.join(this.projectRoot, 'sessions', 'tasks');
      await fs.mkdir(tasksDir, { recursive: true });

      // Task TEMPLATE.md
      try {
        const templateSrc = path.join(subRoot, 'TEMPLATE.md');
        const templateDst = path.join(tasksDir, 'TEMPLATE.md');
        try { await fs.access(templateDst); } catch {
          await fs.copyFile(templateSrc, templateDst);
        }
      } catch { /* template optional */ }

      // CLAUDE.sessions.md in project root
      try {
        const sessionsTpl = path.join(subRoot, 'CLAUDE.sessions.md');
        const sessionsMd = path.join(this.projectRoot, 'CLAUDE.sessions.md');
        try { await fs.access(sessionsMd); } catch {
          await fs.copyFile(sessionsTpl, sessionsMd);
        }
      } catch { /* optional */ }

      logger.info("cc-sessions bootstrap completed", {
        projectRoot: this.projectRoot
      });
    } catch (error) {
      logger.warn("cc-sessions bootstrap encountered issues (continuing)", { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Build initial context manifest from project
   */
  private async buildInitialContextManifest(): Promise<ContextManifest> {
    try {
      // Read package.json for tech stack
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      let techStack: string[] = [];
      let dependencies: string[] = [];

      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        techStack = Object.keys(packageJson.dependencies || {});
        dependencies = Object.keys(packageJson.devDependencies || {});
      } catch {
        // No package.json found
      }

      // Read README for project overview
      let projectOverview = "No README found";
      try {
        const readmePath = path.join(this.projectRoot, 'README.md');
        projectOverview = await fs.readFile(readmePath, 'utf-8');
      } catch {
        // No README found
      }

      // Get key files
      const keyFiles = await this.getKeyProjectFiles();

      return {
        projectOverview: projectOverview.substring(0, 500), // Limit size
        techStack,
        keyFiles,
        dependencies,
        recentChanges: [],
        contextRules: this.getDefaultContextRules()
      };
    } catch (error) {
      logger.error("Failed to build context manifest", { error });
      return this.getDefaultContextManifest();
    }
  }

  /**
   * Get current project state
   */
  async getProjectState(): Promise<SessionState> {
    try {
      // Get current git branch
      let currentBranch = 'main';
      try {
        const { execSync } = await import('child_process');
        currentBranch = execSync('git branch --show-current', { 
          encoding: 'utf-8',
          cwd: this.projectRoot 
        }).trim();
      } catch {
        // Git not available or not a git repo
      }

      // Get modified files
      const modifiedFiles = await this.getModifiedFiles();

      // Get last commit
      let lastCommit = 'unknown';
      try {
        const { execSync } = await import('child_process');
        lastCommit = execSync('git log -1 --oneline', { 
          encoding: 'utf-8',
          cwd: this.projectRoot 
        }).trim();
      } catch {
        // Git not available
      }

      // Get test status
      const testStatus = await this.getTestStatus();

      return {
        currentBranch,
        modifiedFiles,
        lastCommit,
        dependencies: [], // Will be populated from package.json
        testStatus,
        activeAgents: [],
        contextWindow: {
          size: 160000, // Default context window
          utilization: 0
        }
      };
    } catch (error) {
      logger.error("Failed to get project state", { error });
      return this.getDefaultSessionState();
    }
  }

  /**
   * Create a new task file with cc-sessions format
   */
  async createTaskFile(
    description: string,
    routingMetadata: any,
    contextFiles: string[] = []
  ): Promise<TaskFile> {
    
    const taskId = this.generateTaskId();
    const now = new Date();

    const taskFile: TaskFile = {
      taskId,
      description,
      successCriteria: this.extractSuccessCriteria(description),
      servicesInvolved: this.extractServicesInvolved(description),
      routingMetadata,
      contextFiles,
      createdAt: now,
      updatedAt: now
    };

    // Save task file
    const taskFilePath = path.join(this.tasksPath, `${taskId}.json`);
    await fs.writeFile(taskFilePath, JSON.stringify(taskFile, null, 2));

    // Update current session
    await this.updateCurrentTask(taskId);

    logger.info("Created task file", { taskId, description });
    return taskFile;
  }

  /**
   * Save task context for memory preservation
   */
  async saveTaskContext(taskContext: any): Promise<void> {
    try {
      const contextFile = path.join(this.contextPath, `${taskContext.taskId}-context.json`);
      await fs.writeFile(contextFile, JSON.stringify(taskContext, null, 2));
      
      // Update session with task history
      await this.addToTaskHistory(taskContext);
      
      logger.debug("Saved task context", { taskId: taskContext.taskId });
    } catch (error) {
      logger.error("Failed to save task context", { error });
    }
  }

  /**
   * Save execution context for continuity
   */
  async saveExecutionContext(taskId: string, result: any): Promise<void> {
    try {
      const executionFile = path.join(this.contextPath, `${taskId}-execution.json`);
      await fs.writeFile(executionFile, JSON.stringify(result, null, 2));
      
      // Update task history with execution result
      await this.updateTaskHistory(taskId, result);
      
      logger.debug("Saved execution context", { taskId });
    } catch (error) {
      logger.error("Failed to save execution context", { error });
    }
  }

  /**
   * Get relevant files for incremental context
   */
  async getRelevantFiles(taskId: string): Promise<string[]> {
    try {
      const contextFile = path.join(this.contextPath, `${taskId}-context.json`);
      const context = JSON.parse(await fs.readFile(contextFile, 'utf-8'));
      return context.contextFiles || [];
    } catch (error) {
      logger.error("Failed to get relevant files", { taskId, error });
      return [];
    }
  }

  /**
   * Update current task in session
   */
  private async updateCurrentTask(taskId: string): Promise<void> {
    try {
      const sessionFile = path.join(this.sessionsPath, 'current-session.json');
      const session: CCSession = JSON.parse(await fs.readFile(sessionFile, 'utf-8'));
      
      session.currentTask = taskId;
      session.sessionState = await this.getProjectState();
      
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    } catch (error) {
      logger.error("Failed to update current task", { error });
    }
  }

  /**
   * Add task to history
   */
  private async addToTaskHistory(taskContext: any): Promise<void> {
    try {
      const sessionFile = path.join(this.sessionsPath, 'current-session.json');
      const session: CCSession = JSON.parse(await fs.readFile(sessionFile, 'utf-8'));
      
      const taskHistory: TaskHistory = {
        taskId: taskContext.taskId,
        description: taskContext.description,
        status: 'pending',
        startTime: new Date(),
        contextFiles: taskContext.contextFiles || []
      };
      
      session.taskHistory.push(taskHistory);
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    } catch (error) {
      logger.error("Failed to add task to history", { error });
    }
  }

  /**
   * Update task history with execution result
   */
  private async updateTaskHistory(taskId: string, result: any): Promise<void> {
    try {
      const sessionFile = path.join(this.sessionsPath, 'current-session.json');
      const session: CCSession = JSON.parse(await fs.readFile(sessionFile, 'utf-8'));
      
      const taskIndex = session.taskHistory.findIndex(t => t.taskId === taskId);
      if (taskIndex !== -1) {
        session.taskHistory[taskIndex].status = result.success ? 'completed' : 'failed';
        session.taskHistory[taskIndex].endTime = new Date();
        session.taskHistory[taskIndex].modelUsed = result.modelUsed;
        session.taskHistory[taskIndex].qualityScore = result.qualityScore;
        
        await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
      }
    } catch (error) {
      logger.error("Failed to update task history", { error });
    }
  }

  /**
   * Utility methods
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getKeyProjectFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.projectRoot);
      return files.filter(file => 
        file.endsWith('.json') || 
        file.endsWith('.md') || 
        file.endsWith('.ts') || 
        file.endsWith('.js')
      ).slice(0, 10); // Limit to 10 key files
    } catch {
      return [];
    }
  }

  private async getModifiedFiles(): Promise<string[]> {
    try {
      const { execSync } = await import('child_process');
      const output = execSync('git status --porcelain', { 
        encoding: 'utf-8',
        cwd: this.projectRoot 
      });
      
      return output.split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3)) // Remove git status prefix
        .slice(0, 20); // Limit to 20 files
    } catch {
      return [];
    }
  }

  private async getTestStatus(): Promise<'passing' | 'failing' | 'unknown'> {
    try {
      const { execSync } = await import('child_process');
      execSync('npm test', { 
        encoding: 'utf-8',
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      return 'passing';
    } catch {
      return 'unknown';
    }
  }

  private extractSuccessCriteria(description: string): string[] {
    // Simple extraction of success criteria from description
    const criteria: string[] = [];
    
    if (description.includes('test')) {
      criteria.push('All tests pass');
    }
    if (description.includes('bug') || description.includes('fix')) {
      criteria.push('Bug is resolved');
    }
    if (description.includes('feature')) {
      criteria.push('Feature works as expected');
    }
    
    return criteria.length > 0 ? criteria : ['Task completed successfully'];
  }

  private extractServicesInvolved(description: string): string[] {
    // Extract service names from description
    const services: string[] = [];
    const serviceKeywords = ['api', 'service', 'database', 'auth', 'user', 'payment'];
    
    serviceKeywords.forEach(keyword => {
      if (description.toLowerCase().includes(keyword)) {
        services.push(`${keyword}-service`);
      }
    });
    
    return services;
  }

  private getDefaultContextRules(): string[] {
    return [
      'Follow existing code patterns',
      'Maintain test coverage',
      'Use TypeScript strict mode',
      'Follow project naming conventions',
      'Document complex logic'
    ];
  }

  private getDefaultContextManifest(): ContextManifest {
    return {
      projectOverview: 'CTIR Project - Claude Task Intelligence Router',
      techStack: ['TypeScript', 'Node.js'],
      keyFiles: ['package.json', 'README.md'],
      dependencies: [],
      recentChanges: [],
      contextRules: this.getDefaultContextRules()
    };
  }

  private getDefaultSessionState(): SessionState {
    return {
      currentBranch: 'main',
      modifiedFiles: [],
      lastCommit: 'unknown',
      dependencies: [],
      testStatus: 'unknown',
      activeAgents: [],
      contextWindow: {
        size: 160000,
        utilization: 0
      }
    };
  }

  /**
   * Get hooks manager instance
   */
  getHooksManager(): CCSessionsHooksManager {
    return this.hooksManager;
  }

  /**
   * Get statusline instance
   */
  getStatusline(): CCSessionsStatusline {
    return this.statusline;
  }

  /**
   * Toggle DAIC mode
   */
  async toggleDAICMode(): Promise<string> {
    const newState = await this.hooksManager.toggleDAICMode();
    return newState.mode === 'discussion' ? 'Discussion Mode' : 'Implementation Mode';
  }

  /**
   * Get current DAIC mode
   */
  async getDAICMode(): Promise<string> {
    const state = await this.hooksManager.getDAICMode();
    return state.mode === 'discussion' ? 'Discussion Mode' : 'Implementation Mode';
  }

  /**
   * Check if tool should be blocked
   */
  async shouldBlockTool(toolName: string, toolInput: any): Promise<{ blocked: boolean; reason?: string }> {
    return await this.hooksManager.shouldBlockTool(toolName, toolInput);
  }

  /**
   * Generate statusline data
   */
  async generateStatusline(context: any): Promise<string> {
    const data = await this.statusline.generateStatusline(context);
    return this.statusline.formatStatusline(data);
  }

  /**
   * Set current task with branch enforcement
   */
  async setCurrentTask(taskName: string, branchName: string, services: string[] = []): Promise<void> {
    await this.hooksManager.setTaskState(taskName, branchName, services);
    
    // Update current session
    await this.updateCurrentTask(taskName);
    
    logger.info(`Current task set: ${taskName} on branch ${branchName}`);
  }

  /**
   * Create a markdown task file from TEMPLATE.md
   */
  async createMarkdownTaskFile(taskFileName: string, description?: string): Promise<string> {
    const templatePath = path.join(this.projectRoot, 'submodules', 'cc-sessions', 'cc_sessions', 'templates', 'TEMPLATE.md');
    const tasksDir = path.join(this.projectRoot, 'sessions', 'tasks');
    await fs.mkdir(tasksDir, { recursive: true });
    const dest = path.join(tasksDir, `${taskFileName}.md`);
    try {
      const tpl = await fs.readFile(templatePath, 'utf-8');
      const content = description ? tpl.replace(/\[\[TASK_DESCRIPTION\]\]/g, description) : tpl;
      await fs.writeFile(dest, content);
    } catch {
      // Fallback to basic file
      await fs.writeFile(dest, `# ${taskFileName}\n\n${description || ''}\n`);
    }
    return dest;
  }

  /**
   * Link transcript path to current session (lightweight helper)
   */
  async linkTranscript(transcriptPath: string): Promise<void> {
    try {
      const sessionFile = path.join(this.sessionsPath, 'current-session.json');
      const session: CCSession = JSON.parse(await fs.readFile(sessionFile, 'utf-8'));
      // attach as recentChanges entry
      session.contextManifest.recentChanges = [
        ...(session.contextManifest.recentChanges || []),
        `transcript: ${transcriptPath}`
      ].slice(-20);
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    } catch (e) {
      logger.warn('Failed to link transcript', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Session start hook pass-through
   */
  async onSessionStart(context: any): Promise<void> {
    await this.hooksManager.runSessionStartHook(context);
  }

  /**
   * Health check per verificare se cc-sessions è disponibile
   */
  async healthCheck(): Promise<boolean> {
    try {
      await fs.access(this.sessionsPath);
      
      // Check hooks health
      const hooksHealthy = await this.hooksManager.healthCheck();
      
      // Check statusline health
      const statuslineHealthy = await this.statusline.healthCheck();
      
      const overallHealthy = hooksHealthy && statuslineHealthy;
      
      logger.debug(`cc-sessions health check ${overallHealthy ? 'passed' : 'failed'}: ${this.sessionsPath}`, {
        hooks: hooksHealthy,
        statusline: statuslineHealthy
      });
      
      return overallHealthy;
    } catch (error) {
      logger.warn(`cc-sessions health check failed: ${this.sessionsPath}`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
}
