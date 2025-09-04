type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function currentLevel(): Level {
  const lvl = (process.env.LOG_LEVEL || "info").toLowerCase() as Level;
  return (Object.keys(LEVELS) as Level[]).includes(lvl) ? lvl : "info";
}

function shouldLog(level: Level) {
  return LEVELS[level] >= LEVELS[currentLevel()];
}

export const logger = {
  debug: (...args: unknown[]) => shouldLog("debug") && console.debug("[DEBUG]", ...args),
  info: (...args: unknown[]) => shouldLog("info") && console.info("[INFO]", ...args),
  warn: (...args: unknown[]) => shouldLog("warn") && console.warn("[WARN]", ...args),
  error: (...args: unknown[]) => shouldLog("error") && console.error("[ERROR]", ...args),
};

