import sqlite3 from "sqlite3";
import ollama from "ollama";

export async function checkNodeVersion(minMajor = 18): Promise<boolean> {
  const major = Number(process.versions.node.split(".")[0]);
  return major >= minMajor;
}

export async function checkDatabase(dbPath: string): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    try {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) return resolve(false);
        db.get("SELECT 1 as ok", [], (err2) => {
          db.close();
          resolve(!err2);
        });
      });
    } catch {
      resolve(false);
    }
  });
}

export async function checkOllama(timeoutMs = 4000): Promise<boolean> {
  try {
    await Promise.race([
      (async () => {
        await ollama.list();
      })(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}

