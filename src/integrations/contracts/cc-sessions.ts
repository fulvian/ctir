/**
 * CTIR — cc-sessions contract
 * Concrete, production-ready interfaces for task management, weighting and session memory.
 * No stubs/mocks: these contracts are intended to be implemented by a real adapter.
 */

export type ISODateString = string; // e.g., 2025-09-05T08:30:40.286Z

export interface TaskWeight {
  readonly complexityScore: number; // 0..1
  readonly estimatedTokens: number; // absolute token estimate
  readonly priority: number; // higher means more urgent/important
}

export interface SessionMemorySnapshot {
  readonly sessionId: string;
  readonly lastActive: ISODateString;
  readonly currentTaskId?: string;
  readonly conversationContext: unknown; // opaque payload (structured by cc-sessions)
  readonly projectState: unknown; // files/branches/metadata snapshot
}

export interface CCSessTaskBase {
  readonly id: string;
  readonly description: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface CCSessTask extends CCSessTaskBase {
  readonly weight: TaskWeight;
  readonly status: 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  readonly metadata?: Record<string, unknown>;
}

export interface CreateTaskInput {
  readonly description: string;
  readonly initialWeight?: Partial<TaskWeight>;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  readonly description?: string;
  readonly weight?: Partial<TaskWeight>;
  readonly status?: CCSessTask['status'];
  readonly metadata?: Record<string, unknown>;
}

export interface CCSessionsAdapter {
  // Task lifecycle
  createTask(input: CreateTaskInput): Promise<CCSessTask>;
  getTaskById(taskId: string): Promise<CCSessTask | null>;
  listOpenTasks(): Promise<CCSessTask[]>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<CCSessTask>;

  // Weighting utilities
  recalculateWeight(taskId: string): Promise<TaskWeight>;

  // Session memory
  saveSessionSnapshot(snapshot: SessionMemorySnapshot): Promise<void>;
  loadLatestSessionSnapshot(): Promise<SessionMemorySnapshot | null>;
}


