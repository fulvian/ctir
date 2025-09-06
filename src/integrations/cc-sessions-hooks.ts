import { logger } from "@/utils/logger";
import { execSync, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

export interface DAICState {
  mode: 'discussion' | 'implementation';
  lastToggle: Date;
  sessionId: string;
}

export interface TaskState {
  task: string | null;
  branch: string | null;
  services: string[];
  updated: string;
}

export interface CCSessionsConfig {
  trigger_phrases: string[];
  blocked_tools: string[];
  branch_enforcement: {
    enabled: boolean;
    task_prefixes: string[];
    branch_prefixes: Record<string, string>;
  };
  read_only_bash_commands: string[];
}

export class CCSessionsHooksManager {
  private projectRoot: string;
  private hooksPath: string;
  private statePath: string;
  private configPath: string;
  private pythonPath: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.hooksPath = path.join(this.projectRoot, '.claude', 'hooks');
    this.statePath = path.join(this.projectRoot, '.claude', 'state');
    this.configPath = path.join(this.projectRoot, 'sessions', 'sessions-config.json');
    
    // Find Python executable
    this.pythonPath = this.findPythonExecutable();
    
    this.initializeHooks();
    logger.info("CC-Sessions Hooks Manager initialized", { 
      projectRoot: this.projectRoot,
      hooksPath: this.hooksPath,
      pythonPath: this.pythonPath
    });
  }

  /**
   * Initialize hooks directory and copy Python scripts from cc-sessions
   */
  private async initializeHooks(): Promise<void> {
    try {
      // Create hooks directory
      await fs.mkdir(this.hooksPath, { recursive: true });
      await fs.mkdir(this.statePath, { recursive: true });

      // Copy Python hooks from cc-sessions submodule
      await this.copyHooksFromSubmodule();
      
      // Create default configuration
      await this.createDefaultConfig();
      
      logger.info("CC-Sessions hooks initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize cc-sessions hooks", { error });
    }
  }

  /**
   * Copy Python hooks from cc-sessions submodule
   */
  private async copyHooksFromSubmodule(): Promise<void> {
    const ccSessionsPath = path.join(this.projectRoot, 'submodules', 'cc-sessions', 'cc_sessions', 'hooks');
    
    try {
      // Check if cc-sessions submodule exists
      await fs.access(ccSessionsPath);
      
      // Copy hook files
      const hookFiles = [
        'shared_state.py',
        'sessions-enforce.py',
        'post-tool-use.py',
        'session-start.py',
        'task-transcript-link.py',
        'user-messages.py'
      ];

      for (const file of hookFiles) {
        const sourcePath = path.join(ccSessionsPath, file);
        const destPath = path.join(this.hooksPath, file);
        
        try {
          await fs.access(sourcePath);
          await fs.copyFile(sourcePath, destPath);
          logger.debug(`Copied hook file: ${file}`);
        } catch {
          logger.warn(`Hook file not found: ${file}`);
        }
      }

      // Copy DAIC script
      const daicSourcePath = path.join(this.projectRoot, 'submodules', 'cc-sessions', 'cc_sessions', 'scripts', 'daic');
      const daicDestPath = path.join(this.hooksPath, 'daic');
      
      try {
        await fs.access(daicSourcePath);
        await fs.copyFile(daicSourcePath, daicDestPath);
        await fs.chmod(daicDestPath, 0o755); // Make executable
        logger.debug("Copied DAIC script");
      } catch {
        logger.warn("DAIC script not found");
      }

    } catch (error) {
      logger.error("Failed to copy hooks from submodule", { error });
    }
  }

  /**
   * Create default configuration file
   */
  private async createDefaultConfig(): Promise<void> {
    const sessionsDir = path.join(this.projectRoot, 'sessions');
    await fs.mkdir(sessionsDir, { recursive: true });

    const defaultConfig: CCSessionsConfig = {
      trigger_phrases: ["make it so", "run that", "go ahead", "ship it"],
      blocked_tools: ["Edit", "Write", "MultiEdit", "NotebookEdit"],
      branch_enforcement: {
        enabled: true,
        task_prefixes: ["implement-", "fix-", "refactor-", "migrate-", "test-", "docs-"],
        branch_prefixes: {
          "implement-": "feature/",
          "fix-": "fix/",
          "refactor-": "feature/",
          "migrate-": "feature/",
          "test-": "feature/",
          "docs-": "feature/"
        }
      },
      read_only_bash_commands: [
        "ls", "ll", "pwd", "cd", "echo", "cat", "head", "tail", "less", "more",
        "grep", "rg", "find", "which", "whereis", "type", "file", "stat",
        "du", "df", "tree", "basename", "dirname", "realpath", "readlink",
        "whoami", "env", "printenv", "date", "cal", "uptime", "ps", "top",
        "wc", "cut", "sort", "uniq", "comm", "diff", "cmp", "md5sum", "sha256sum",
        "git status", "git log", "git diff", "git show", "git branch", 
        "git remote", "git fetch", "git describe", "git rev-parse", "git blame",
        "docker ps", "docker images", "docker logs", "npm list", "npm ls",
        "pip list", "pip show", "yarn list", "curl", "wget", "jq", "awk",
        "sed -n", "tar -t", "unzip -l"
      ]
    };

    try {
      await fs.access(this.configPath);
      logger.debug("Configuration file already exists");
    } catch {
      await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
      logger.info("Created default cc-sessions configuration");
    }
  }

  /**
   * Find Python executable
   */
  private findPythonExecutable(): string {
    try {
      // Try python3 first
      execSync('python3 --version', { stdio: 'pipe' });
      return 'python3';
    } catch {
      try {
        // Fallback to python
        execSync('python --version', { stdio: 'pipe' });
        return 'python';
      } catch {
        logger.warn("Python not found, hooks will not work");
        return 'python3'; // Default fallback
      }
    }
  }

  /**
   * Run a Python hook with JSON stdin and parse JSON stdout
   */
  private async runHook(scriptName: string, input: any): Promise<any> {
    return await new Promise((resolve, reject) => {
      try {
        const scriptPath = path.join(this.hooksPath, scriptName);
        const proc = spawn(this.pythonPath, [scriptPath], {
          cwd: this.projectRoot,
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: this.projectRoot
          }
        });
        let out = "";
        let err = "";
        proc.stdout.on('data', (d) => { out += d.toString(); });
        proc.stderr.on('data', (d) => { err += d.toString(); });
        proc.on('error', (e) => reject(e));
        proc.on('close', () => {
          if (out.trim().length === 0) return resolve(null);
          try {
            const parsed = JSON.parse(out);
            resolve(parsed);
          } catch (e) {
            logger.warn('cc-sessions hook did not return JSON', { scriptName, out, err });
            resolve(null);
          }
        });
        proc.stdin.write(JSON.stringify(input));
        proc.stdin.end();
      } catch (e) {
        logger.warn('cc-sessions hook execution failed', { scriptName, error: e instanceof Error ? e.message : String(e) });
        resolve(null);
      }
    });
  }

  async runUserMessageHook(prompt: string, transcriptPath?: string): Promise<string> {
    const input = { prompt, transcript_path: transcriptPath || "" };
    const result = await this.runHook('user-messages.py', input);
    const additional = result?.hookSpecificOutput?.additionalContext || '';
    return typeof additional === 'string' ? additional : '';
  }

  async runSessionStartHook(context: any): Promise<void> {
    await this.runHook('session-start.py', context);
  }

  /**
   * Get current DAIC mode
   */
  async getDAICMode(): Promise<DAICState> {
    try {
      const daicStateFile = path.join(this.statePath, 'daic-mode.json');
      const data = await fs.readFile(daicStateFile, 'utf-8');
      const state = JSON.parse(data);
      
      return {
        mode: state.mode || 'discussion',
        lastToggle: new Date(state.lastToggle || Date.now()),
        sessionId: state.sessionId || this.generateSessionId()
      };
    } catch (error) {
      // Default to discussion mode
      const defaultState: DAICState = {
        mode: 'discussion',
        lastToggle: new Date(),
        sessionId: this.generateSessionId()
      };
      
      await this.setDAICMode(defaultState);
      return defaultState;
    }
  }

  /**
   * Set DAIC mode
   */
  async setDAICMode(state: DAICState): Promise<void> {
    const daicStateFile = path.join(this.statePath, 'daic-mode.json');
    await fs.writeFile(daicStateFile, JSON.stringify({
      mode: state.mode,
      lastToggle: state.lastToggle.toISOString(),
      sessionId: state.sessionId
    }, null, 2));
    
    logger.info(`DAIC mode set to: ${state.mode}`);
  }

  /**
   * Toggle DAIC mode
   */
  async toggleDAICMode(): Promise<DAICState> {
    const currentState = await this.getDAICMode();
    const newMode = currentState.mode === 'discussion' ? 'implementation' : 'discussion';
    
    const newState: DAICState = {
      mode: newMode,
      lastToggle: new Date(),
      sessionId: currentState.sessionId
    };
    
    await this.setDAICMode(newState);
    return newState;
  }

  /**
   * Get current task state
   */
  async getTaskState(): Promise<TaskState> {
    try {
      const taskStateFile = path.join(this.statePath, 'current_task.json');
      const data = await fs.readFile(taskStateFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return {
        task: null,
        branch: null,
        services: [],
        updated: new Date().toISOString().split('T')[0]
      };
    }
  }

  /**
   * Set task state
   */
  async setTaskState(task: string, branch: string, services: string[]): Promise<void> {
    const taskState: TaskState = {
      task,
      branch,
      services,
      updated: new Date().toISOString().split('T')[0]
    };

    const taskStateFile = path.join(this.statePath, 'current_task.json');
    await fs.writeFile(taskStateFile, JSON.stringify(taskState, null, 2));
    
    logger.info(`Task state set: ${task} on branch ${branch}`);
  }

  /**
   * Execute DAIC command via Python
   */
  async executeDAICCommand(): Promise<string> {
    try {
      const daicScript = path.join(this.hooksPath, 'daic');
      const result = execSync(`bash "${daicScript}"`, { 
        encoding: 'utf-8',
        cwd: this.projectRoot
      });
      
      return result.trim();
    } catch (error) {
      logger.error("Failed to execute DAIC command", { error });
      throw error;
    }
  }

  /**
   * Check if tool should be blocked based on DAIC mode
   */
  async shouldBlockTool(toolName: string, toolInput: any): Promise<{ blocked: boolean; reason?: string }> {
    try {
      const daicState = await this.getDAICMode();
      const config = await this.loadConfig();
      
      // Block tools in discussion mode
      if (daicState.mode === 'discussion' && config.blocked_tools.includes(toolName)) {
        return {
          blocked: true,
          reason: `You're in discussion mode. The ${toolName} tool is not allowed. You need to seek alignment first.`
        };
      }

      // Block DAIC command in discussion mode
      if (daicState.mode === 'discussion' && toolName === 'Bash') {
        const command = toolInput.command || '';
        if (command.includes('daic')) {
          return {
            blocked: true,
            reason: "The 'daic' command is not allowed in discussion mode. You're already in discussion mode."
          };
        }
      }

      return { blocked: false };
    } catch (error) {
      logger.error("Failed to check tool blocking", { error });
      return { blocked: false };
    }
  }

  /**
   * Load configuration
   */
  private async loadConfig(): Promise<CCSessionsConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn("Failed to load config, using defaults");
      return {
        trigger_phrases: ["make it so", "run that"],
        blocked_tools: ["Edit", "Write", "MultiEdit", "NotebookEdit"],
        branch_enforcement: {
          enabled: true,
          task_prefixes: ["implement-", "fix-", "refactor-"],
          branch_prefixes: {
            "implement-": "feature/",
            "fix-": "fix/",
            "refactor-": "feature/"
          }
        },
        read_only_bash_commands: []
      };
    }
  }

  /**
   * Health check for hooks
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if hooks directory exists
      await fs.access(this.hooksPath);
      
      // Check if Python is available
      execSync(`${this.pythonPath} --version`, { stdio: 'pipe' });
      
      // Check if key files exist
      const keyFiles = ['shared_state.py', 'sessions-enforce.py'];
      for (const file of keyFiles) {
        await fs.access(path.join(this.hooksPath, file));
      }
      
      logger.debug("CC-Sessions hooks health check passed");
      return true;
    } catch (error) {
      logger.warn("CC-Sessions hooks health check failed", { error });
      return false;
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
