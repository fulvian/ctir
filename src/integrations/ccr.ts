import fs from "fs";
import path from "path";

// Placeholder for Claude Code Router (CCR) integration
export class CCRIntegration {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async switchModel(_model: string): Promise<void> {
    // TODO: call CCR to switch model and prepare context for local models
  }

  async healthCheck(): Promise<boolean> {
    const base = process.env.CCR_PATH || path.join(process.cwd(), "submodules", "claude-code-router");
    try {
      const pkgPath = path.join(base, "package.json");
      if (!fs.existsSync(base) || !fs.existsSync(pkgPath)) return false;
      // light parse to ensure repo looks valid
      const raw = fs.readFileSync(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      return Boolean(pkg.name) && typeof pkg.name === "string";
    } catch {
      return false;
    }
  }
}
