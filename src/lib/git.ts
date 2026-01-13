import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { bareRepoPath, runRepo } from "./paths.ts";

export function ensureBareRepo(repo: string): string {
  const barePath = bareRepoPath(repo);

  if (!existsSync(barePath)) {
    const url = `git@github.com:${repo}.git`;
    const result = spawnSync("git", ["clone", "--bare", url, barePath], {
      encoding: "utf-8",
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`Failed to clone ${repo}`);
    }
  }
  else {
    // Fetch latest
    const result = spawnSync("git", ["fetch", "--all"], {
      cwd: barePath,
      encoding: "utf-8",
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`Failed to fetch ${repo}`);
    }
  }

  return barePath;
}

export function createWorktree(runId: string, repo: string, branch: string): string {
  const barePath = bareRepoPath(repo);
  const worktreePath = runRepo(runId);

  // Create worktree with new branch based on main or master
  // In bare repos, branches are refs/heads/*, not refs/remotes/origin/*
  const defaultBranch = getDefaultBranch(barePath);
  const result = spawnSync(
    "git",
    ["worktree", "add", "-b", branch, worktreePath, defaultBranch],
    {
      cwd: barePath,
      encoding: "utf-8",
      stdio: "inherit",
    }
  );

  if (result.status !== 0) {
    throw new Error(`Failed to create worktree for ${repo}`);
  }

  // Set up remote for pushing (SSH for auth)
  spawnSync("git", ["remote", "add", "origin", `git@github.com:${repo}.git`], {
    cwd: worktreePath,
    encoding: "utf-8",
  });

  return worktreePath;
}

function getDefaultBranch(barePath: string): string {
  // Check if main exists, otherwise fall back to master
  const result = spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/heads/main"], {
    cwd: barePath,
    encoding: "utf-8",
  });
  return result.status === 0 ? "main" : "master";
}

export function removeWorktree(runId: string, repo: string): void {
  const barePath = bareRepoPath(repo);
  const worktreePath = runRepo(runId);

  spawnSync("git", ["worktree", "remove", "--force", worktreePath], {
    cwd: barePath,
    encoding: "utf-8",
  });
}
