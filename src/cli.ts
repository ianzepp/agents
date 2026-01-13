#!/usr/bin/env bun

import { run } from "./commands/run.ts";
import { ps } from "./commands/ps.ts";
import { watch } from "./commands/watch.ts";
import { logs } from "./commands/logs.ts";
import { kill } from "./commands/kill.ts";
import { clean } from "./commands/clean.ts";
import { response } from "./commands/response.ts";
import { list } from "./commands/list.ts";
import { listModelShortcuts } from "./lib/backend.ts";

const args = process.argv.slice(2);
const command = args[0];

function usage(): void {
  console.log(`Usage: agent <command> [options]

Commands:
  run       Spawn an agent run
  ps        List runs
  watch     Follow run output
  logs      Show full run log
  response  Show final response (if completed)
  kill      Kill a running agent
  clean     Remove old runs
  list      List available personas
  models    List model shortcuts

Run Options:
  -r, --repo <owner/repo>   Repository (optional, for code tasks)
  -i, --issue <number>      Issue number
  -m, --model <model>       Model shortcut (default: sonnet)
  --persona <name>          Persona name
  --pr                      Instruct agent to submit a PR
  --timeout <minutes>       Kill agent after timeout (e.g., 30)
  --no-validate             Skip validation step before marking success

Clean Options:
  --older-than <age>        Remove runs older than (e.g., 7d, 24h)
  --all                     Remove all runs
  --branches                Also delete branches from bare repo

Examples:
  agent run -r owner/repo -i 42 "fix the bug"
  agent run -r owner/repo -m opus "analyze this codebase"
  agent ps
  agent watch abc123
  agent logs abc123
  agent kill abc123
  agent clean --older-than 7d
`);
}

async function parseRunArgs(args: string[]): Promise<{ goal: string; options: { repo?: string; issue?: number; model: string; persona?: string; pr?: boolean; timeout?: number; skipValidation?: boolean } }> {
  let repo: string | undefined;
  let issue: number | undefined;
  let model = "sonnet";
  let persona: string | undefined;
  let pr = false;
  let timeout: number | undefined;
  let skipValidation = false;
  const goalParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-r" || arg === "--repo") {
      repo = args[++i];
    }
    else if (arg === "-i" || arg === "--issue") {
      issue = parseInt(args[++i], 10);
    }
    else if (arg === "-m" || arg === "--model") {
      model = args[++i];
    }
    else if (arg === "--persona") {
      persona = args[++i];
    }
    else if (arg === "--pr") {
      pr = true;
    }
    else if (arg === "--timeout") {
      timeout = parseInt(args[++i], 10);
    }
    else if (arg === "--no-validate") {
      skipValidation = true;
    }
    else if (!arg.startsWith("-")) {
      goalParts.push(arg);
    }
  }


  let goal = goalParts.join(" ");

  // If no goal provided, read from stdin
  if (!goal) {
    goal = await Bun.stdin.text();
    goal = goal.trim();
  }

  if (!goal) {
    console.error("Error: goal is required (provide as argument or via stdin)");
    process.exit(1);
  }

  return { goal, options: { repo, issue, model, persona, pr, timeout, skipValidation } };
}

function parseCleanArgs(args: string[]): { olderThan?: string; all?: boolean; branches?: boolean } {
  let olderThan: string | undefined;
  let all = false;
  let branches = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--older-than") {
      olderThan = args[++i];
    }
    else if (arg === "--all") {
      all = true;
    }
    else if (arg === "--branches") {
      branches = true;
    }
  }

  return { olderThan, all, branches };
}

async function main(): Promise<void> {
  if (!command || command === "-h" || command === "--help") {
    usage();
    process.exit(0);
  }

  switch (command) {
    case "run": {
      const { goal, options } = await parseRunArgs(args.slice(1));
      await run(goal, options);
      break;
    }

    case "ps": {
      ps();
      break;
    }

    case "watch": {
      const id = args[1];
      if (!id) {
        console.error("Error: run ID required");
        process.exit(1);
      }
      watch(id);
      break;
    }

    case "logs": {
      const id = args[1];
      if (!id) {
        console.error("Error: run ID required");
        process.exit(1);
      }
      logs(id);
      break;
    }

    case "response": {
      const id = args[1];
      if (!id) {
        console.error("Error: run ID required");
        process.exit(1);
      }
      response(id);
      break;
    }

    case "kill": {
      const id = args[1];
      if (!id) {
        console.error("Error: run ID required");
        process.exit(1);
      }
      kill(id);
      break;
    }

    case "clean": {
      const options = parseCleanArgs(args.slice(1));
      clean(options);
      break;
    }

    case "list": {
      list();
      break;
    }

    case "models": {
      const shortcuts = listModelShortcuts();
      console.log("Model shortcuts:\n");
      for (const { shortcut, model, backend } of shortcuts) {
        console.log(`  ${shortcut.padEnd(12)} -> ${model.padEnd(40)} (${backend})`);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
