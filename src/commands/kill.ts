import { readRun, writeRun, isProcessRunning } from "../lib/run.ts";

export function kill(id: string): void {
  const run = readRun(id);
  if (!run) {
    console.error(`Error: run ${id} not found`);
    process.exit(1);
  }

  if (run.status !== "running") {
    console.log(`Run ${id} is not running (status: ${run.status})`);
    return;
  }

  if (!run.pid || !isProcessRunning(run.pid)) {
    console.log(`Run ${id} process not found (PID ${run.pid})`);
    run.status = "failed";
    run.completedAt = new Date().toISOString();
    run.error = "Process not found";
    writeRun(run);
    return;
  }

  console.log(`Killing run ${id} (PID ${run.pid})...`);

  try {
    process.kill(run.pid, "SIGTERM");

    // Give it a moment to terminate gracefully
    setTimeout(() => {
      if (isProcessRunning(run.pid)) {
        console.log(`Process didn't terminate, sending SIGKILL...`);
        process.kill(run.pid, "SIGKILL");
      }
    }, 2000);
  }
  catch (err) {
    console.error(`Failed to kill process: ${err}`);
  }

  run.status = "failed";
  run.completedAt = new Date().toISOString();
  run.error = "Killed by user";
  writeRun(run);

  console.log(`Run ${id} killed`);
}
