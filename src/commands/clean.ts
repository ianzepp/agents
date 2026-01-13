import { rmSync } from "fs";
import { getRunIds, runDir } from "../lib/paths.ts";
import { readRun, getRunStatus, isProcessRunning } from "../lib/run.ts";
import { removeWorktree, deleteBranch } from "../lib/git.ts";

export interface CleanOptions {
  olderThan?: string; // e.g., "7d", "24h"
  all?: boolean;
  branches?: boolean;
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

    // Never clean actually running processes
    if (status === "running" && run.pid && isProcessRunning(run.pid)) {
      console.log(`Skipping ${id}: still running (PID ${run.pid})`);
      continue;
    }

    const startTime = new Date(run.startedAt).getTime();
    const age = now - startTime;

    if (age < maxAge && !options.all) {
      continue;
    }

    console.log(`Cleaning ${id} (${run.repo ?? "no repo"}, ${status})...`);

    // Remove worktree from bare repo (if repo was specified)
    if (run.repo) {
      try {
        removeWorktree(id, run.repo);
      }
      catch {
        // Worktree may already be removed
      }

      // Delete branch if --branches flag is set and branch is tracked
      if (options.branches && run.branch) {
        try {
          deleteBranch(run.branch, run.repo);
          console.log(`  Deleted branch: ${run.branch}`);
        }
        catch {
          // Branch may already be deleted or merged
        }
      }
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
