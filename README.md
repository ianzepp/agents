# agents

CLI for spawning isolated AI agent runs against GitHub repositories.

Written in [faber](https://github.com/ianzepp/faber), a Latin-themed programming language that compiles to TypeScript.

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
agent jobs list
agent jobs watch <id>
agent jobs logs <id>

# Get results
agent jobs response <id>

# Cleanup
agent jobs clean --all
agent jobs clean --older-than 7d
```

## Commands

```
agent run <goal>              Spawn a new agent job
agent jobs list               List all jobs with status
agent jobs watch <id>         Follow job output in real-time
agent jobs logs <id>          Show full job log
agent jobs response <id>      Show final response (if completed)
agent jobs kill <id>          Stop a running job
agent jobs clean              Remove old jobs
agent personas list           List available personas
agent personas show <name>    Show persona details
agent models list             List model shortcuts
```

## Run Options

```
-r, --repo <owner/repo>   GitHub repository (optional)
-i, --issue <number>      Issue number (for branch naming)
-m, --model <model>       Model shortcut or full name (default: sonnet)
--persona <name>          Load persona instructions
--pr                      Instruct agent to create a PR
--timeout <minutes>       Timeout in minutes
--no-validate             Skip validation step
```

## Model Shortcuts

| Shortcut | Model | Backend |
|----------|-------|---------|
| `sonnet` | claude-sonnet-4-5 | claude |
| `opus` | claude-opus-4-5 | claude |
| `haiku` | claude-haiku-4-5 | claude |
| `qwen3` | opencode/qwen3-coder | opencode |
| `deepseek` | openrouter/deepseek/deepseek-chat-v3.1 | opencode |
| `gpt4mini` | openrouter/openai/gpt-4o-mini | opencode |

## Personas

Personas are pre-configured agent personalities stored in `~/.agents/personas/`. Each persona defines:

- Role and constraints
- Allowed/forbidden actions
- Output format
- Default model (can be overridden with `--model`)

## Architecture

```
~/.agents/
├── runs/           # Job directories (one per run)
│   └── <id>/
│       ├── run.json      # Metadata (status, pid, model, etc.)
│       ├── output.log    # PTY output capture
│       ├── response.md   # Final response (if completed)
│       ├── home/         # Isolated HOME directory
│       └── repo/         # Git worktree (if --repo specified)
├── repos/          # Bare git repos (shared across runs)
│   └── owner-repo.git
└── personas/       # Persona markdown files
    └── *.md
```

### Isolated HOME Structure

Each run gets its own HOME directory to isolate the agent's environment:

```
home/
├── .gitconfig                      # Copied from real ~/.gitconfig
├── .zshenv                         # Generated with GH_TOKEN, GITHUB_TOKEN, etc.
├── .ssh/
│   ├── config                      # Copied from real ~/.ssh/
│   ├── known_hosts
│   └── id_*                        # SSH keys for git auth
├── .config/
│   └── gh -> ~/.config/gh          # Symlink to real gh CLI auth
├── .local/
│   └── share/
│       └── opencode -> ~/.local/share/opencode  # Symlink (if exists)
└── .claude/
    ├── CLAUDE.md -> ../AGENTS.md   # Symlink to assembled prompt
    ├── settings.json               # Generated (bypassPermissions)
    └── ...                         # Runtime state (projects, debug, etc.)
```

Credentials are copied/symlinked so agents can push to git and create PRs, but all Claude state stays isolated per-run.

## How It Works

1. **Job creation** - Generates unique ID (`generaIdentem`), creates isolated HOME
2. **Repo setup** (if specified) - Clones/fetches bare repo (`assecuraNudumRepositorium`), creates worktree (`creaArborem`)
3. **Credential copying** - Copies SSH keys, gitconfig, symlinks gh auth (`copiaMandata`)
4. **Prompt assembly** - Combines persona + task + git instructions (`componePromptum`)
5. **Agent spawn** - Launches Claude/OpenCode with PTY via `script` (`generaAgentem`)
6. **Monitoring** - Output captured to `output.log`, viewable via `jobs watch`/`jobs logs`
7. **Completion** - Output promoted to `response.md`, status updated in `run.json`

## Development

Source is in `src/*.fab` (faber language). Build with:

```bash
bun run build    # faber compile + bun compile to bin/agent
```

## Requirements

- [Bun](https://bun.sh) runtime
- [faber](https://github.com/ianzepp/faber) compiler
- [Claude CLI](https://github.com/anthropics/claude-code) or [OpenCode](https://github.com/opencode-ai/opencode)
- Git
- GitHub CLI (`gh`) for PR creation

## License

MIT
