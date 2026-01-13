import { spawn } from "child_process";
import { mkdirSync, writeFileSync, symlinkSync, copyFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { resolveModel } from "../lib/backend.ts";
import { ensureBareRepo, createWorktree } from "../lib/git.ts";
import { ensureDirs, runDir, runHome, runRepo, runLogPath } from "../lib/paths.ts";
import { generateRunId, generateBranch, writeRun, type Run } from "../lib/run.ts";
import { openSync } from "fs";

export interface RunOptions {
  repo?: string;
  issue?: number;
  model: string;
  persona?: string;
}

export async function run(goal: string, options: RunOptions): Promise<string> {
  ensureDirs();

  const id = generateRunId();
  const { backend, model } = resolveModel(options.model);
  const branch = options.repo ? generateBranch(options.issue, model, id) : undefined;

  console.log(`Creating run ${id}...`);
  if (options.repo) {
    console.log(`  Repo: ${options.repo}`);
    console.log(`  Branch: ${branch}`);
  }
  console.log(`  Model: ${model} (${backend})`);

  let workDir: string;

  if (options.repo) {
    // Ensure bare repo exists and is up to date
    console.log(`Ensuring bare repo...`);
    ensureBareRepo(options.repo);

    // Create worktree
    console.log(`Creating worktree...`);
    createWorktree(id, options.repo, branch!);
    workDir = runRepo(id);
  }
  else {
    // No repo - just use a simple work directory
    workDir = runDir(id);
    mkdirSync(workDir, { recursive: true });
  }

  // Set up isolated HOME
  console.log(`Setting up isolated HOME...`);
  setupIsolatedHome(id, workDir, goal);

  // Create run metadata
  const runMeta: Run = {
    id,
    repo: options.repo,
    issue: options.issue,
    persona: options.persona,
    model,
    branch,
    status: "running",
    pid: 0, // Will be set after spawn
    startedAt: new Date().toISOString(),
  };

  // Spawn the agent
  console.log(`Spawning ${backend}...`);
  const pid = spawnAgent(id, backend, model, goal, workDir);
  runMeta.pid = pid;

  writeRun(runMeta);

  console.log(`\nRun ${id} started (PID ${pid})`);
  console.log(`  Watch:    agent watch ${id}`);
  console.log(`  Logs:     agent logs ${id}`);
  console.log(`  Response: agent response ${id}`);

  return id;
}

function setupIsolatedHome(runId: string, workDir: string, prompt: string): void {
  const home = runHome(runId);

  // Create .claude directory
  mkdirSync(join(home, ".claude"), { recursive: true });

  // Wrap prompt with response instructions
  const wrappedPrompt = wrapPrompt(prompt);

  // Write AGENTS.md to work directory
  writeFileSync(join(workDir, "AGENTS.md"), wrappedPrompt);

  // Symlink .claude/CLAUDE.md -> workDir/AGENTS.md
  symlinkSync(join(workDir, "AGENTS.md"), join(home, ".claude", "CLAUDE.md"));

  // Copy credentials from real HOME
  copyCredentials(home);

  // Write settings.json for sandbox mode with bypassed permissions
  writeFileSync(
    join(home, ".claude", "settings.json"),
    JSON.stringify(
      {
        sandbox: {
          enabled: true,
        },
        permissions: {
          allow: ["Edit", "Write", "Bash", "Read", "Glob", "Grep"],
          defaultMode: "bypassPermissions",
        },
      },
      null,
      2
    )
  );
}

function copyCredentials(targetHome: string): void {
  const realHome = homedir();

  // Copy .gitconfig if exists
  const gitconfig = join(realHome, ".gitconfig");
  if (existsSync(gitconfig)) {
    copyFileSync(gitconfig, join(targetHome, ".gitconfig"));
  }

  // Copy .ssh directory (for git auth)
  const sshDir = join(realHome, ".ssh");
  const targetSsh = join(targetHome, ".ssh");
  if (existsSync(sshDir)) {
    mkdirSync(targetSsh, { recursive: true });
    for (const file of ["id_rsa", "id_ed25519", "config", "known_hosts"]) {
      const src = join(sshDir, file);
      if (existsSync(src)) {
        copyFileSync(src, join(targetSsh, file));
      }
    }
  }

  // Symlink opencode config directories (auth, storage)
  const opencodeDataDir = join(realHome, ".local", "share", "opencode");
  if (existsSync(opencodeDataDir)) {
    const targetLocal = join(targetHome, ".local", "share");
    mkdirSync(targetLocal, { recursive: true });
    const targetOpencode = join(targetLocal, "opencode");
    if (!existsSync(targetOpencode)) {
      symlinkSync(opencodeDataDir, targetOpencode);
    }
  }

  // Create .zshenv with tokens from environment
  const tokens: string[] = [];
  if (process.env.GH_TOKEN) {
    tokens.push(`export GH_TOKEN="${process.env.GH_TOKEN}"`);
  }
  if (process.env.GITHUB_TOKEN) {
    tokens.push(`export GITHUB_TOKEN="${process.env.GITHUB_TOKEN}"`);
  }
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    tokens.push(`export CLAUDE_CODE_OAUTH_TOKEN="${process.env.CLAUDE_CODE_OAUTH_TOKEN}"`);
  }
  if (tokens.length > 0) {
    writeFileSync(join(targetHome, ".zshenv"), tokens.join("\n") + "\n");
  }
}

function wrapPrompt(prompt: string): string {
  return prompt;
}

function spawnAgent(runId: string, backend: string, model: string, goal: string, workDir: string): number {
  const home = runHome(runId);
  const logPath = runLogPath(runId);

  const logFd = openSync(logPath, "w");

  let cmd: string;
  let args: string[];

  if (backend === "claude") {
    cmd = "claude";
    args = ["--model", model, "-p", goal];
  }
  else {
    cmd = "opencode";
    args = ["run", "--model", model, `Follow AGENTS.md. Task: ${goal}`];
  }

  const child = spawn(cmd, args, {
    cwd: workDir,
    env: { ...process.env, HOME: home },
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });

  child.unref();

  return child.pid ?? 0;
}
