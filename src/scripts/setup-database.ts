/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

const DB_PATH = process.env.DB_PATH || "./local-development/ctir.db";

function ensureDir(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  ensureDir(DB_PATH);
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS work_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        state_data TEXT NOT NULL
      )`
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS session_windows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        window_id TEXT,
        start_time TEXT,
        end_time TEXT,
        token_used INTEGER,
        token_limit INTEGER,
        status TEXT
      )`
    );
  });
  db.close();
  console.log(`✅ Database initialized at ${DB_PATH}`);
}

main();

