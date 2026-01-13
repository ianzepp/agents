import { getRunIds } from "../lib/paths.ts";
import { readRun, getRunStatus, type RunStatus } from "../lib/run.ts";

interface RunInfo {
  id: string;
  repo?: string;
  issue?: number;
  model: string;
  status: RunStatus;
  elapsed: string;
  error?: string;
  timeout?: number;
}

const STATUS_COLORS: Record<RunStatus, string> = {
  running: "\x1b[33m", // yellow
  completed: "\x1b[32m", // green
  failed: "\x1b[31m", // red
};
const RESET = "\x1b[0m";

export function ps(): void {
  const ids = getRunIds();

  if (ids.length === 0) {
    console.log("No runs found.");
    return;
  }

  const runs: RunInfo[] = [];

  for (const id of ids) {
    const run = readRun(id);
    if (!run) continue;

    const status = getRunStatus(run);
    const elapsed = formatElapsed(run.startedAt, run.completedAt, run.timeout);

    runs.push({
      id,
      repo: run.repo,
      issue: run.issue,
      model: run.model.split("/").pop() ?? run.model,
      status,
      elapsed,
      error: run.error,
      timeout: run.timeout,
    });
  }

  // Sort: running first, then by start time descending
  runs.sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return 0;
  });

  // Print header
  console.log(
    `${"ID".padEnd(10)} ${"REPO".padEnd(30)} ${"ISSUE".padEnd(7)} ${"MODEL".padEnd(12)} ${"STATUS".padEnd(12)} ${"ELAPSED"}`
  );

  for (const run of runs) {
    const color = STATUS_COLORS[run.status];
    const repo = run.repo ?? "(no repo)";
    const issue = run.issue ? `#${run.issue}` : "-";
    console.log(
      `${run.id.padEnd(10)} ${repo.padEnd(30)} ${issue.padEnd(7)} ${run.model.padEnd(12)} ${color}${run.status.padEnd(12)}${RESET} ${run.elapsed}`
    );
    // Show error on next line if present
    if (run.error) {
      console.log(`           ${"\x1b[31m"}Error: ${run.error}${RESET}`);
    }
  }
}

function formatElapsed(startedAt: string, completedAt?: string, timeout?: number): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const seconds = Math.floor((end - start) / 1000);

  let elapsed: string;
  if (seconds < 60) {
    elapsed = `${seconds}s`;
  }
  else {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      elapsed = `${minutes}m`;
    }
    else {
      const hours = Math.floor(minutes / 60);
      elapsed = `${hours}h ${minutes % 60}m`;
    }
  }

  if (timeout) {
    return `${elapsed} / ${timeout}m`;
  }
  return elapsed;
}
