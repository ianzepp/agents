import { rmSync } from "fs";
import { getRunIds, runDir } from "../lib/paths.ts";
import { readRun, getRunStatus, isProcessRunning } from "../lib/run.ts";
import { removeWorktree } from "../lib/git.ts";

export interface CleanOptions {
  olderThan?: string; // e.g., "7d", "24h"
  all?: boolean;
}

export function clean(options: CleanOptions): void {
  const ids = getRunIds();

  if (ids.length === 0) {
    console.log("No runs to clean.");
    return;
  }

  const maxAge = options.all ? Infinity : parseAge(options.olderThan ?? "7d");
  const now = Date.now();
  let cleaned = 0;

  for (const id of ids) {
    const run = readRun(id);
    if (!run) continue;

    const status = getRunStatus(run);

    // Don't clean running processes unless --all
    if (status === "running" && !options.all) {
      if (run.pid && isProcessRunning(run.pid)) {
        console.log(`Skipping ${id}: still running`);
        continue;
      }
    }

    const startTime = new Date(run.startedAt).getTime();
    const age = now - startTime;

    if (age < maxAge && !options.all) {
      continue;
    }

    console.log(`Cleaning ${id} (${run.repo}, ${status})...`);

    // Remove worktree from bare repo
    try {
      removeWorktree(id, run.repo);
    }
    catch {
      // Worktree may already be removed
    }

    // Remove run directory
    rmSync(runDir(id), { recursive: true, force: true });
    cleaned++;
  }

  console.log(`Cleaned ${cleaned} run(s)`);
}

function parseAge(age: string): number {
  const match = age.match(/^(\d+)([dhm])$/);
  if (!match) {
    throw new Error(`Invalid age format: ${age} (use e.g., "7d", "24h", "30m")`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    default:
      throw new Error(`Unknown unit: ${unit}`);
  }
}
