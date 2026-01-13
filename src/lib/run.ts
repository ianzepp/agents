import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { runMetaPath, runDir, runLogPath } from "./paths.ts";

export type RunStatus = "running" | "completed" | "failed";

export interface Run {
  id: string;
  repo?: string;
  issue?: number;
  persona?: string;
  model: string;
  branch?: string;
  status: RunStatus;
  pid: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
}

export function readRun(id: string): Run | null {
  const path = runMetaPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Run;
  }
  catch {
    return null;
  }
}

export function writeRun(run: Run): void {
  writeFileSync(runMetaPath(run.id), JSON.stringify(run, null, 2));
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  }
  catch {
    return false;
  }
}

export function getRunStatus(run: Run): RunStatus {
  if (run.status !== "running") return run.status;

  const responsePath = join(runDir(run.id), "response.md");

  // Check if response.md exists (successful completion)
  if (existsSync(responsePath)) {
    return "completed";
  }

  // Check if process is still alive
  if (run.pid && !isProcessRunning(run.pid)) {
    // Process exited - check if there's output to promote to response
    const logPath = runLogPath(run.id);
    try {
      const stat = statSync(logPath);
      if (stat.size > 1) {
        // Auto-create response.md from output.log
        const output = readFileSync(logPath, "utf-8").trim();
        if (output) {
          // Try parsing as Claude -p mode JSON output
          const parsed = parseClaudeOutput(output);
          if (parsed) {
            writeFileSync(responsePath, parsed.result);
            // Update run metadata with usage and errors
            if (parsed.usage || parsed.errors) {
              const updatedRun: Run = { ...run, completedAt: new Date().toISOString() };
              if (parsed.usage) {
                updatedRun.usage = parsed.usage;
              }
              if (parsed.errors && parsed.errors.length > 0) {
                updatedRun.error = parsed.errors.join("; ");
              }
              writeRun(updatedRun);
            }
            return "completed";
          }
          // Fall back to raw output if not JSON
          writeFileSync(responsePath, output);
          return "completed";
        }
      }
    }
    catch {
      // Fall through to failed
    }
    return "failed"; // Process died without output
  }
  return "running";
}

export function generateRunId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function generateBranch(issue: number | undefined, model: string, id: string): string {
  const issueStr = issue ? `issue-${issue}` : "task";
  const modelShort = model.split("/").pop()?.split("-")[0] ?? model;
  return `${issueStr}-${modelShort}-${id}`;
}

interface ClaudeParsedOutput {
  result: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  errors?: string[];
}

function parseClaudeOutput(output: string): ClaudeParsedOutput | null {
  try {
    const parsed = JSON.parse(output);
    // Check if it's Claude -p mode JSON structure
    if (parsed.type === "result" && parsed.result !== undefined) {
      return {
        result: parsed.result,
        usage: parsed.usage,
        errors: parsed.errors,
      };
    }
  }
  catch {
    // Not JSON or invalid - return null to use raw output
  }
  return null;
}
