import fs from "fs";
import path from "path";
import crypto from "crypto";
import type {
  CCSessionsAdapter,
  CCSessTask,
  CreateTaskInput,
  ISODateString,
  SessionMemorySnapshot,
  TaskWeight,
  UpdateTaskInput,
} from "@/integrations/contracts/cc-sessions";

interface FileSchema {
  tasks: CCSessTask[];
}

const DATA_DIR = path.resolve(process.cwd(), "local-development", "session-data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const SNAPSHOT_FILE = path.join(DATA_DIR, "latest-session-snapshot.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function nowIso(): ISODateString {
  return new Date().toISOString();
}

function readTasks(): FileSchema {
  ensureDataDir();
  if (!fs.existsSync(TASKS_FILE)) {
    const initial: FileSchema = { tasks: [] };
    fs.writeFileSync(TASKS_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(TASKS_FILE, "utf-8");
  const parsed = JSON.parse(raw) as FileSchema;
  if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
    throw new Error("Corrupted tasks.json: missing tasks array");
  }
  return parsed;
}

function writeTasks(state: FileSchema): void {
  ensureDataDir();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export class FileCCSessionsAdapter implements CCSessionsAdapter {
  async createTask(input: CreateTaskInput): Promise<CCSessTask> {
    const state = readTasks();
    const id = crypto.randomUUID();
    const createdAt = nowIso();
    const defaultWeight: TaskWeight = {
      complexityScore: input.initialWeight?.complexityScore ?? 0.3,
      estimatedTokens: input.initialWeight?.estimatedTokens ?? 500,
      priority: input.initialWeight?.priority ?? 1,
    };
    const task: CCSessTask = {
      id,
      description: input.description,
      createdAt,
      updatedAt: createdAt,
      weight: defaultWeight,
      status: "open",
      metadata: input.metadata ?? {},
    };
    state.tasks.push(task);
    writeTasks(state);
    return task;
  }

  async getTaskById(taskId: string): Promise<CCSessTask | null> {
    const state = readTasks();
    return state.tasks.find(t => t.id === taskId) ?? null;
  }

  async listOpenTasks(): Promise<CCSessTask[]> {
    const state = readTasks();
    return state.tasks.filter(t => t.status === "open" || t.status === "in_progress");
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<CCSessTask> {
    const state = readTasks();
    const idx = state.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error(`Task not found: ${taskId}`);
    const current = state.tasks[idx];
    const updated: CCSessTask = {
      ...current,
      description: input.description ?? current.description,
      weight: {
        complexityScore: input.weight?.complexityScore ?? current.weight.complexityScore,
        estimatedTokens: input.weight?.estimatedTokens ?? current.weight.estimatedTokens,
        priority: input.weight?.priority ?? current.weight.priority,
      },
      status: input.status ?? current.status,
      metadata: input.metadata ?? current.metadata,
      updatedAt: nowIso(),
    };
    state.tasks[idx] = updated;
    writeTasks(state);
    return updated;
  }

  async recalculateWeight(taskId: string): Promise<TaskWeight> {
    const state = readTasks();
    const idx = state.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error(`Task not found: ${taskId}`);
    const task = state.tasks[idx];
    // Heuristics: complexity up if description longer; tokens estimate from length; priority from status
    const len = task.description.length;
    const complexity = Math.min(1, Math.max(0.1, len / 400));
    const estimatedTokens = Math.max(200, Math.min(5000, Math.round(len * 6)));
    const priority = task.status === "open" ? 1 : task.status === "in_progress" ? 2 : 0;
    const weight: TaskWeight = { complexityScore: complexity, estimatedTokens, priority };
    // persist immutably
    state.tasks[idx] = { ...task, weight, updatedAt: nowIso() };
    writeTasks(state);
    return weight;
  }

  async saveSessionSnapshot(snapshot: SessionMemorySnapshot): Promise<void> {
    ensureDataDir();
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), "utf-8");
  }

  async loadLatestSessionSnapshot(): Promise<SessionMemorySnapshot | null> {
    ensureDataDir();
    if (!fs.existsSync(SNAPSHOT_FILE)) return null;
    const raw = fs.readFileSync(SNAPSHOT_FILE, "utf-8");
    const parsed = JSON.parse(raw) as SessionMemorySnapshot;
    if (!parsed.sessionId || !parsed.lastActive) {
      throw new Error("Corrupted latest-session-snapshot.json: missing required fields");
    }
    return parsed;
  }
}


