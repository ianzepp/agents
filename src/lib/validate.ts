import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

export interface ValidationResult {
  success: boolean;
  command?: string;
  output?: string;
  error?: string;
}

export interface ProjectType {
  name: string;
  detectFile: string;
  command: string;
}

const PROJECT_TYPES: ProjectType[] = [
  {
    name: "Node.js (package.json)",
    detectFile: "package.json",
    command: "npm test",
  },
  {
    name: "Bun (package.json)",
    detectFile: "package.json",
    command: "bun run typecheck || bun test",
  },
  {
    name: "Rust (Cargo.toml)",
    detectFile: "Cargo.toml",
    command: "cargo check",
  },
  {
    name: "Go (go.mod)",
    detectFile: "go.mod",
    command: "go test ./...",
  },
  {
    name: "Python (pyproject.toml)",
    detectFile: "pyproject.toml",
    command: "python -m pytest",
  },
  {
    name: "Python (requirements.txt)",
    detectFile: "requirements.txt",
    command: "python -m pytest",
  },
];

export function detectProjectType(workDir: string): ProjectType | null {
  // Check for package.json with scripts
  const pkgJsonPath = join(workDir, "package.json");
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      const scripts = pkg.scripts || {};

      // Prefer typecheck over test
      if (scripts.typecheck) {
        return {
          name: "Node.js/Bun (package.json)",
          detectFile: "package.json",
          command: "bun run typecheck || npm run typecheck",
        };
      }
      if (scripts.test) {
        return {
          name: "Node.js/Bun (package.json)",
          detectFile: "package.json",
          command: "bun test || npm test",
        };
      }
      if (scripts.check) {
        return {
          name: "Node.js/Bun (package.json)",
          detectFile: "package.json",
          command: "bun run check || npm run check",
        };
      }
    }
    catch {
      // Invalid package.json, skip
    }
  }

  // Check other project types
  for (const type of PROJECT_TYPES) {
    if (type.detectFile !== "package.json" && existsSync(join(workDir, type.detectFile))) {
      return type;
    }
  }

  return null;
}

export function runValidation(workDir: string, projectType: ProjectType): ValidationResult {
  try {
    const output = execSync(projectType.command, {
      cwd: workDir,
      encoding: "utf-8",
      timeout: 120000, // 2 minute timeout
      stdio: ["pipe", "pipe", "pipe"],
    });

    return {
      success: true,
      command: projectType.command,
      output: output.trim(),
    };
  }
  catch (error: any) {
    return {
      success: false,
      command: projectType.command,
      output: error.stdout?.trim(),
      error: error.stderr?.trim() || error.message,
    };
  }
}
