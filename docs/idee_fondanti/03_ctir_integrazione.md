## Problema Critico Identificato

Hai ragione - **perdere anche solo 1 minuto** delle finestre di 5 ore significa sprecare token preziosi. Il sistema CTIR deve includere un **Auto-Resume Manager** che:

- Traccia esattamente quando scade ogni finestra
- Salva automaticamente lo stato del lavoro
- Riprende istantaneamente allo scadere della pausa
- Massimizza l'utilizzo di ogni secondo disponibile


## Auto-Resume Manager Architecture

### Core Components da Aggiungere al Piano CTIR

#### 1. Session Timing Tracker

```typescript
interface ClaudeSessionWindow {
  windowId: string;
  startTime: Date;
  endTime: Date;
  tokenUsed: number;
  tokenLimit: number;
  status: 'active' | 'exhausted' | 'waiting' | 'resuming';
  nextWindowStart: Date;
}

class SessionTimingTracker {
  private currentWindow: ClaudeSessionWindow;
  private resumeTimer: NodeJS.Timeout | null = null;
  
  async trackSessionStart(firstMessage: Date): Promise<void> {
    this.currentWindow = {
      windowId: generateWindowId(),
      startTime: firstMessage,
      endTime: new Date(firstMessage.getTime() + (5 * 60 * 60 * 1000)), // +5 hours
      tokenUsed: 0,
      tokenLimit: 100000, // Example limit
      status: 'active',
      nextWindowStart: new Date(firstMessage.getTime() + (5 * 60 * 60 * 1000))
    };
    
    this.scheduleAutoResume();
  }
  
  private scheduleAutoResume(): void {
    const msUntilResume = this.currentWindow.nextWindowStart.getTime() - Date.now();
    
    this.resumeTimer = setTimeout(async () => {
      await this.autoResumeSession();
    }, msUntilResume);
    
    console.log(`🕐 Auto-resume scheduled for: ${this.currentWindow.nextWindowStart}`);
  }
}
```


#### 2. Work State Persistence Manager

```typescript
interface WorkState {
  sessionId: string;
  lastActiveTimestamp: Date;
  currentTask: CTIRTask;
  conversationContext: ConversationSnapshot;
  pendingOperations: PendingOperation[];
  projectState: ProjectStateSnapshot;
  nextActions: PlannedAction[];
}

class WorkStatePersistence {
  async saveWorkState(state: WorkState): Promise<void> {
    // Save to SQLite with timestamp
    await this.db.run(`
      INSERT OR REPLACE INTO work_states 
      (session_id, timestamp, state_data) 
      VALUES (?, ?, ?)
    `, [state.sessionId, new Date(), JSON.stringify(state)]);
    
    // Also backup to file system
    await writeFile(
      `./local-development/backups/work-state-${state.sessionId}.json`,
      JSON.stringify(state, null, 2)
    );
  }
  
  async loadLastWorkState(): Promise<WorkState | null> {
    const result = await this.db.get(`
      SELECT state_data FROM work_states 
      ORDER BY timestamp DESC LIMIT 1
    `);
    
    return result ? JSON.parse(result.state_data) : null;
  }
}
```


#### 3. Auto-Resume Engine

```typescript
class AutoResumeEngine {
  private persistenceManager: WorkStatePersistence;
  private sessionTracker: SessionTimingTracker;
  private notificationManager: NotificationManager;
  
  async autoResumeSession(): Promise<void> {
    console.log('🔄 Auto-resuming session...');
    
    try {
      // 1. Load last work state
      const lastState = await this.persistenceManager.loadLastWorkState();
      if (!lastState) {
        console.log('❌ No previous state found');
        return;
      }
      
      // 2. Restore context
      await this.restoreWorkContext(lastState);
      
      // 3. Send resume message to Claude Code
      await this.sendResumeMessage(lastState);
      
      // 4. Start new session tracking
      await this.sessionTracker.trackSessionStart(new Date());
      
      console.log('✅ Session resumed successfully');
      
    } catch (error) {
      console.error('❌ Auto-resume failed:', error);
      await this.notificationManager.alertFailedResume(error);
    }
  }
  
  private async restoreWorkContext(state: WorkState): Promise<void> {
    // Restore cc-sessions context
    await this.ccSessionsIntegration.restoreSession(state.currentTask);
    
    // Restore project files state
    await this.restoreProjectState(state.projectState);
    
    // Prepare context for Claude
    await this.prepareClaudeContext(state.conversationContext);
  }
  
  private async sendResumeMessage(state: WorkState): Promise<void> {
    const resumePrompt = this.generateResumePrompt(state);
    
    // Send to Claude Code via API or clipboard
    await this.claudeIntegration.sendMessage(resumePrompt);
  }
}
```


#### 4. Smart Resume Prompt Generator

```typescript
class ResumePromptGenerator {
  generateResumePrompt(state: WorkState): string {
    return `
🔄 **AUTO-RESUME SESSION** (CTIR v1.0)

**Session Context Recovery:**
- Last active: ${state.lastActiveTimestamp}
- Session ID: ${state.sessionId}
- Current task: ${state.currentTask.description}

**Progress Summary:**
${this.summarizeProgress(state.currentTask)}

**Next Planned Actions:**
${state.nextActions.map(action => `- ${action.description}`).join('\n')}

**Project State:**
- Files modified: ${state.projectState.modifiedFiles.length}
- Last commit: ${state.projectState.lastCommit}
- Branch: ${state.projectState.currentBranch}

**Pending Operations:**
${state.pendingOperations.map(op => `- ${op.description} (${op.status})`).join('\n')}

Please continue from where we left off. The CTIR system has automatically restored the session context.
`;
  }
}
```


### 5. Advanced Timing Optimization

#### Pre-Expiration Preparation

```typescript
class SessionOptimizer {
  async prepareForExpiration(minutesRemaining: number): Promise<void> {
    if (minutesRemaining <= 10) {
      // Save current state
      await this.saveCurrentWorkState();
      
      // Prepare resume context
      await this.prepareResumeContext();
      
      // Switch to local models for non-critical tasks
      await this.ctirRouter.forceLocalMode();
      
      console.log(`⏰ Preparing for session expiration in ${minutesRemaining} minutes`);
    }
    
    if (minutesRemaining <= 2) {
      // Final save and cleanup
      await this.finalStateSnapshot();
      await this.prepareInstantResume();
    }
  }
}
```


### 6. Notification e Alerting System

#### Desktop Notifications

```typescript
class NotificationManager {
  async scheduleResumeNotification(resumeTime: Date): Promise<void> {
    const osNotify = await import('node-notifier');
    
    // Schedule notification 1 minute before resume
    const notifyTime = new Date(resumeTime.getTime() - 60000);
    const delay = notifyTime.getTime() - Date.now();
    
    setTimeout(() => {
      osNotify.notify({
        title: 'CTIR Auto-Resume',
        message: 'Claude Code session will resume in 1 minute',
        icon: './assets/ctir-icon.png',
        sound: true
      });
    }, delay);
  }
  
  async alertFailedResume(error: Error): Promise<void> {
    // Desktop notification
    // Slack/Discord webhook if configured  
    // Email alert if configured
  }
}
```


## Integrazione nel Setup Environment

### Aggiunte al Package.json

```json
{
  "dependencies": {
    "node-notifier": "^10.0.1",
    "node-cron": "^3.0.2",
    "moment-timezone": "^0.5.43"
  },
  "scripts": {
    "auto-resume": "node dist/auto-resume.js",
    "schedule-resume": "node dist/scripts/schedule-resume.js"
  }
}
```


### Sistema di Persistence Directories

```bash
ctir/
├── local-development/
│   ├── backups/                    # Work state backups
│   │   ├── work-state-*.json
│   │   └── session-snapshots/
│   ├── session-data/               # Session tracking
│   │   ├── current-window.json
│   │   └── session-history.db
│   └── auto-resume/                # Resume logic
│       ├── resume-queue.json
│       └── failed-resumes.log
```


### Configuration per Auto-Resume

```json
{
  "autoResume": {
    "enabled": true,
    "sessionDuration": "5h",
    "preparationTime": "10m",
    "notificationsEnabled": true,
    "backupInterval": "30s",
    "maxResumeAttempts": 3,
    "resumePromptTemplate": "templates/auto-resume.md"
  }
}
```


## Workflow Completo Auto-Resume

### Sequenza Automatica

1. **Session Start**: CTIR traccia l'inizio della finestra
2. **Continuous Backup**: Salva stato ogni 30 secondi
3. **Pre-Expiration** (10 min prima): Switch a modalità conservativa
4. **Final Backup** (2 min prima): Snapshot finale
5. **Session End**: Spegnimento graceful
6. **Wait Period**: Timer di attesa preciso
7. **Auto-Resume**: Riattivazione automatica esatta
8. **Context Restore**: Ripristino completo del contesto

### Benefits del Sistema

- ✅ **Zero tempo perso** tra finestre
- ✅ **Context continuity** perfetto
- ✅ **Automatic state recovery**
- ✅ **Failover resilience**
- ✅ **Smart preparation** per expiration
- ✅ **Desktop notifications** per monitoring

Questo auto-resume system diventa un componente **core** del progetto CTIR, assicurando che ogni minuto delle finestre di 5 ore sia utilizzato al massimo!

