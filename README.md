# agents

CLI for spawning isolated AI agent runs against GitHub repositories.

## Features

- **Isolated execution** - Each agent runs in its own HOME directory with copied credentials
- **Git worktrees** - Automatic branch creation from bare repo clones
- **Multiple backends** - Claude and OpenCode (for open-source models)
- **Personas** - Pre-configured agent personalities for different tasks
- **Async by design** - Fire and forget, monitor progress, collect results

## Installation

```bash
# Clone and build
git clone git@github.com:ianzepp/agents.git
cd agents
bun install
bun run build

# Add to PATH
ln -s $(pwd)/bin/agent ~/.local/bin/agent
```

## Quick Start

```bash
# Run an agent on a GitHub issue
agent run -r owner/repo -i 42 --pr "Fix the bug described in the issue"

# Run with a specific persona
agent run -r owner/repo -i 42 --persona opifex --pr "Fix issue #42"

# Run without a repo (for research/analysis tasks)
agent run "What are the best practices for error handling in TypeScript?"

# Monitor runs
agent ps
agent watch <run-id>
agent logs <run-id>

# Get results
agent response <run-id>

# Cleanup
agent clean --all
agent clean --older-than 7d
```

## Commands

| Command | Description |
|---------|-------------|
| `run` | Spawn a new agent run |
| `ps` | List all runs with status |
| `watch` | Follow run output in real-time |
| `logs` | Show full run log |
| `response` | Show final response (if completed) |
| `kill` | Kill a running agent |
| `clean` | Remove old runs |
| `list` | List available personas |
| `models` | List model shortcuts |

## Run Options

```
-r, --repo <owner/repo>   GitHub repository (optional)
-i, --issue <number>      Issue number (for branch naming)
-m, --model <model>       Model shortcut or full name (default: sonnet)
--persona <name>          Load persona instructions
--pr                      Instruct agent to create a PR
```

## Model Shortcuts

| Shortcut | Model | Backend |
|----------|-------|---------|
| `sonnet` | claude-sonnet-4-5 | claude |
| `opus` | claude-opus-4-5 | claude |
| `haiku` | claude-haiku-4-5 | claude |
| `qwen3` | opencode/qwen3-coder | opencode |
| `deepseek` | openrouter/deepseek/deepseek-chat-v3.1 | opencode |

## Personas

Personas are pre-configured agent personalities stored in `~/.agents/personas/`. Each persona defines:

- Role and constraints
- Allowed/forbidden actions
- Output format
- Default model (can be overridden with `--model`)

| Persona | Description | Default Model |
|---------|-------------|---------------|
| `ego` | Direct model access, no constraints | (inherit) |
| `opifex` | Issue worker - fixes issues and creates PRs | sonnet |
| `columbo` | Root-cause investigator - diagnoses bugs | opus |
| `augur` | Forward-consequence analyst - predicts impact | opus |
| `titus` | TypeScript error fixer | qwen3 |
| `cato` | PR reviewer | sonnet |
| `galen` | Test failure diagnostician | deepseek |
| `diogenes` | Free-spirit codebase explorer | sonnet |
| `seneca` | Advisory document reviewer | gpt-5.2 |
| `manager` | Coordinates other agents | sonnet |

## Architecture

```
~/.agents/
├── runs/           # Run data
│   └── <run-id>/
│       ├── run.json      # Metadata
│       ├── output.log    # Raw output
│       ├── response.md   # Final response
│       ├── home/         # Isolated HOME
│       └── repo/         # Git worktree (if repo specified)
├── repos/          # Bare repo clones
│   └── owner-repo.git
└── personas/       # Persona definitions
    └── *.md
```

## How It Works

1. **Run creation** - Generates unique ID, creates isolated HOME directory
2. **Repo setup** (if specified) - Clones/fetches bare repo, creates worktree with new branch
3. **Credential copying** - Symlinks SSH keys, gitconfig, gh auth to isolated HOME
4. **Prompt assembly** - Combines persona + task + git instructions into `AGENTS.md`
5. **Agent spawn** - Launches Claude/OpenCode in detached mode with pseudo-terminal
6. **Monitoring** - Output captured to `output.log`, viewable via `watch`/`logs`
7. **Completion** - Output promoted to `response.md`, status updated

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude CLI](https://github.com/anthropics/claude-code) or [OpenCode](https://github.com/opencode-ai/opencode)
- Git
- GitHub CLI (`gh`) for PR creation

## License

MIT
