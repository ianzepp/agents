import { spawn } from "child_process";
import { mkdirSync, writeFileSync, symlinkSync, copyFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

import { resolveModel } from "../lib/backend.ts";
import { ensureBareRepo, createWorktree } from "../lib/git.ts";
import { ensureDirs, runDir, runHome, runRepo, runLogPath } from "../lib/paths.ts";
import { loadPersona } from "../lib/persona.ts";
import { generateRunId, generateBranch, writeRun, type Run } from "../lib/run.ts";

export interface RunOptions {
  repo?: string;
  issue?: number;
  model: string;
  persona?: string;
  pr?: boolean;
}

export async function run(goal: string, options: RunOptions): Promise<string> {
  ensureDirs();

  const id = generateRunId();

  // Load persona if specified
  let personaContent: string | undefined;
  let modelToUse = options.model;

  if (options.persona) {
    const persona = loadPersona(options.persona);
    if (!persona) {
      console.error(`Error: persona '${options.persona}' not found`);
      process.exit(1);
    }
    personaContent = persona.content;
    // Use persona's model if user didn't specify one explicitly
    if (persona.model && options.model === "sonnet") {
      modelToUse = persona.model;
    }
  }

  const { backend, model } = resolveModel(modelToUse);
  const branch = options.repo ? generateBranch(options.issue, model, id) : undefined;

  console.log(`Creating run ${id}...`);
  if (options.persona) {
    console.log(`  Persona: ${options.persona}`);
  }
  if (options.repo) {
    console.log(`  Repo: ${options.repo}`);
    console.log(`  Branch: ${branch}`);
    if (options.pr) {
      console.log(`  PR: enabled`);
    }
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
  setupIsolatedHome(id, workDir, goal, !!options.repo, !!options.pr, personaContent);

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

function setupIsolatedHome(runId: string, workDir: string, prompt: string, hasRepo: boolean, submitPr: boolean, personaContent?: string): void {
  const home = runHome(runId);

  // Create .claude directory
  mkdirSync(join(home, ".claude"), { recursive: true });

  // Wrap prompt with persona and response instructions
  const wrappedPrompt = wrapPrompt(prompt, hasRepo, submitPr, personaContent);

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

function wrapPrompt(prompt: string, hasRepo: boolean, submitPr: boolean, personaContent?: string): string {
  const parts: string[] = [];

  // Persona instructions come first (sets the agent's role/constraints)
  if (personaContent) {
    parts.push(personaContent);
    parts.push("\n---\n");
  }

  // Then the task
  parts.push("## Task\n");
  parts.push(prompt);

  // Then git instructions
  if (hasRepo) {
    parts.push(`
## Git Instructions

When you have completed your work:
1. Commit your changes with a clear, descriptive message
2. Push the branch to origin: \`git push -u origin HEAD\``);

    if (submitPr) {
      parts.push(`3. Create a pull request using \`gh pr create\` with:
   - A clear title summarizing the change
   - A description explaining what was done and why`);
    }
  }

  return parts.join("\n");
}

function spawnAgent(runId: string, backend: string, model: string, goal: string, workDir: string): number {
  const home = runHome(runId);
  const logPath = runLogPath(runId);

  let agentCmd: string;
  let agentArgs: string[];

  if (backend === "claude") {
    agentCmd = "claude";
    agentArgs = ["--model", model, "-p", goal];
  }
  else {
    agentCmd = "opencode";
    agentArgs = ["run", "--model", model, `Follow AGENTS.md. Task: ${goal}`];
  }

  // Use script to force pseudo-terminal for unbuffered output
  // script -q <logfile> <command> runs command with pty, logging to file
  const child = spawn("script", ["-q", logPath, agentCmd, ...agentArgs], {
    cwd: workDir,
    env: { ...process.env, HOME: home },
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  return child.pid ?? 0;
}
