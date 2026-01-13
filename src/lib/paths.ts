import { homedir } from "os";
import { join } from "path";
import { mkdirSync, readdirSync } from "fs";

export const AGENTS_ROOT = join(homedir(), ".agents");
export const RUNS_DIR = join(AGENTS_ROOT, "runs");
export const REPOS_DIR = join(AGENTS_ROOT, "repos");
export const PERSONAS_DIR = join(import.meta.dir, "../../personas");

export function ensureDirs(): void {
  mkdirSync(RUNS_DIR, { recursive: true });
  mkdirSync(REPOS_DIR, { recursive: true });
}

export function runDir(id: string): string {
  return join(RUNS_DIR, id);
}

export function runHome(id: string): string {
  return join(runDir(id), "home");
}

export function runRepo(id: string): string {
  return join(runDir(id), "repo");
}

export function runMetaPath(id: string): string {
  return join(runDir(id), "run.json");
}

export function runLogPath(id: string): string {
  return join(runDir(id), "output.log");
}

export function bareRepoPath(repo: string): string {
  // owner/repo -> owner-repo.git
  return join(REPOS_DIR, `${repo.replace("/", "-")}.git`);
}

export function getRunIds(): string[] {
  try {
    return readdirSync(RUNS_DIR).filter((name) => !name.startsWith("."));
  }
  catch {
    return [];
  }
}
