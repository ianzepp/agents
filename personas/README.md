# Diagnostic Agents

Specialized diagnostic agents with multi-provider LLM support. Each agent has a focused role with clear constraints—analysts report findings, fixers make targeted changes.

## Design Philosophy

**Separation of diagnosis from action.** Read-only agents (augur, columbo, galen) analyze and report. Active agents (titus, cato) make changes within strict guardrails. This split prevents premature fixes and enables better review workflows.

**Time-boxed pragmatism.** Agents work within resource constraints—they're not exhaustive auditors. When uncertain, they escalate rather than guess.

**Mode-controlled behavior.** The `--mode` flag determines what happens after analysis: output a report, make changes, or create GitHub issues.

## Agents

### augur
**Forward-consequence analyst.** Traces what will break *when* changes are made.

Use for: Impact analysis on proposed changes, design reviews, refactoring plans

```bash
agent run augur "analyze impact of switching from JWT to sessions"
agent run augur --mode issue "what breaks if we remove the cache layer?"
```

### columbo
**Root-cause investigator.** Traces failures *backward* from symptom to source.

Use for: Debugging production issues, understanding test failures, analyzing error reports

```bash
agent run columbo "why does the login test fail on CI?"
agent run columbo --mode update "investigate and document the memory leak"
```

### galen
**Test diagnostician.** Classifies test failures (CODE BUG vs TEST BUG vs FIXTURE BUG vs ENVIRONMENT).

Use for: Triaging test suite failures, understanding CI breakage

```bash
agent run galen "diagnose all failing tests in the auth module"
agent run galen --mode issue "classify test failures and create issues"
```

### titus
**TypeScript error fixer.** Resolves type errors by fixing root causes, never suppressions.

Hard constraints: No `as any`, no `@ts-ignore`, no deleting code to silence errors. Escalates when proper fixes require design decisions.

Use for: Cleaning up type errors after refactoring, fixing inference issues

```bash
agent run titus --mode update "fix all type errors in src/api/"
agent run titus "analyze type errors and recommend fixes"
```

### cato
**Pragmatic PR reviewer.** Makes accept/reject decisions without deep research.

Time-boxed to 5 minutes. Three verdicts: APPROVE, REQUEST CHANGES, or NEEDS FURTHER REVIEW. Focuses on security, correctness, breaking changes, tests, and egregious quality issues.

Use for: First-pass PR review, gate-checking before human review

```bash
agent run cato --mode update "review PR #42"
```

### diogenes
**Free-spirit explorer.** Roams codebases with fresh eyes and suggests 2-3 unexpected improvements.

Unconstrained blue-sky thinking. Examines code, architecture, git history, issues, PRs—anything that catches attention. Questions assumptions, identifies opportunities others miss.

Use for: Fresh perspective on mature projects, finding hidden technical debt, discovering simplification opportunities

```bash
agent run diogenes "explore this project and suggest improvements"
agent run diogenes --mode issue "find 2-3 things worth changing"
```

### passthrough
**Minimal wrapper.** No special instructions. Works with any model.

Use for ad-hoc tasks, exploration, or when you want full model control.

```bash
agent run passthrough "explain how the authentication flow works"
agent run passthrough -m gpt4o "analyze this code"
agent run passthrough -m deepseek "what does this function do?"
```

## Usage

```bash
agent run <name> [options] <goal>
```

### Options

- `-m, --model <model>` — Model to use (default from agent or sonnet)
- `-b, --backend <backend>` — Backend: claude (default) or opencode
- `-d, --dir <path>` — Working directory (default: cwd)
- `--mode <mode>` — Action mode: read (default), update, issue
- `-n, --dry-run` — Show prompt without executing
- `-h, --help` — Show help

### Modes

**read (default)** — Analyze and output report to stdout. No modifications.

```bash
agent run columbo "why does the build fail?"
```

**update** — Make changes directly after analysis (fix issues, update docs).

```bash
agent run titus --mode update "fix type errors"
agent run cato --mode update "review PR #42"
```

**issue** — Create GitHub issues for each finding.

```bash
agent run augur --mode issue "analyze impact of removing user.email field"
agent run galen --mode issue "classify test failures"
```

## Backends

### Claude (default)

Uses [Claude Code](https://claude.com/claude-code) CLI. Anthropic models only (Sonnet, Opus, Haiku).

**Use for:**
- Agents requiring extended context (columbo, diogenes)
- Complex reasoning (cato PR reviews)
- Default if no backend specified

```bash
agent run columbo "why does the build fail?"
agent run cato -m opus "review PR #42"
```

### OpenCode

Uses [OpenCode](https://github.com/stackblitz-labs/opencode) CLI. Multi-provider support: OpenAI, Anthropic, DeepSeek, Qwen, Google, etc.

**Use for:**
- Cost optimization (qwen3-coder at 1/10th the price of Sonnet)
- Bulk tasks (fixing 100 type errors with deepseek-v3.1)
- Experimentation with different models

```bash
# Use cheap coding models for type fixing (96% accuracy, $0.0002/fix)
agent run titus --backend opencode --model qwen/qwen3-coder "fix all type errors"

# Or use shortcuts that auto-translate
agent run titus -b opencode -m qwen3 "fix all type errors"

# DeepSeek for test diagnostics (95% accuracy, $0.0001/correct)
agent run galen -b opencode -m deepseek "diagnose test failures"
```

**Model shortcuts** (auto-translated for opencode):
- `sonnet` → `anthropic/claude-sonnet-4-5`
- `opus` → `anthropic/claude-opus-4-5`
- `haiku` → `anthropic/claude-haiku-4-5`
- `qwen3` → `qwen/qwen3-coder`
- `deepseek` → `deepseek/deepseek-chat-v3.1`
- `gpt4o` → `openai/gpt-4o`
- `gpt4mini` → `openai/gpt-4o-mini`

Or use full `provider/model` format directly (auto-selects opencode backend):

```bash
agent run titus -m qwen/qwen3-coder "fix types"  # backend auto-detected
```

**Agent defaults**: Agents can specify preferred backend/model in frontmatter:

```yaml
---
name: titus
backend: opencode
model: qwen/qwen3-coder  # 96% accuracy, 10x cheaper than Sonnet
mode: update
---
```

### Cost Comparison

From [faber-trials](https://github.com/ianzepp/faber-trials) (grammar-only context, read/write tasks):

| Model | Accuracy | Cost/Correct | Speed |
|-------|----------|--------------|-------|
| qwen/qwen3-coder | 96% | $0.0002 | 179s |
| deepseek/deepseek-chat-v3.1 | 95% | $0.0001 | 166s |
| openai/gpt-4o-mini | 93% | $0.0001 | 119s |
| anthropic/claude-sonnet-4-5 | 98% | $0.0031 | 289s |

**Best value**: qwen3-coder and deepseek-v3.1 achieve 95-96% accuracy at <$0.0002 per correct response.

## Examples

### Diagnose and fix

```bash
# Step 1: Diagnose (read-only)
agent run columbo "why does test X fail?"

# Step 2: Review findings, then fix
agent run titus --mode update "fix the type errors identified in columbo report"
```

### Impact analysis with issue creation

```bash
agent run augur --mode issue "what breaks if we change the API response format?"
# Creates GitHub issues for each identified impact area
```

### PR review workflow

```bash
# First-pass review (uses Claude Sonnet by default)
agent run cato --mode update "review PR #42"

# If verdict is NEEDS FURTHER REVIEW, deep dive with Opus
agent run columbo -m opus "investigate the auth flow changes in PR #42"
```

### Test failure triage

```bash
# Classify failures
agent run galen --mode issue "diagnose all test failures"

# Fix code bugs (not test bugs)
agent run titus --mode update "fix code bugs identified by galen"
```

## Adding New Agents

Create `{name}.md` with YAML frontmatter:

```markdown
---
name: your-agent
description: One-line description
backend: claude         # or opencode (optional, auto-detected if omitted)
model: sonnet           # or qwen/qwen3-coder, etc.
mode: read              # or update, issue
---

You are [role description]. Your job is to [specific task].

## Hard Constraints

**[Key limitation].** [Explanation of what's forbidden/required]

...
```

**Frontmatter fields:**
- `name`: Agent identifier (matches filename)
- `description`: One-line summary for help text
- `backend`: `claude` or `opencode` (optional, defaults based on model format)
- `model`: Model shortcut or `provider/model` format
- `mode`: Default action mode (`read`, `update`, or `issue`)

Agents should:
- Have clear, focused roles
- Define hard constraints upfront
- Specify allowed/forbidden actions
- Include output format examples
- State principles/decision criteria

## Installation

Clone and add to PATH:

```bash
git clone https://github.com/ianzepp/claude-agents.git
export PATH="$PATH:/path/to/claude-agents"
```

Or symlink into your bin:

```bash
ln -s /path/to/claude-agents/agent.sh /usr/local/bin/agent
```

Requires:
- [Claude Code](https://claude.com/claude-code) CLI (for claude backend)
- [OpenCode](https://github.com/stackblitz-labs/opencode) CLI (for opencode backend, optional)
- `gh` (GitHub CLI) for issue mode

## Project Structure

```
agents/
  agent.sh          # Launcher script
  augur.md          # Forward-consequence analyst
  cato.md           # PR reviewer
  columbo.md        # Root-cause investigator
  diogenes.md       # Free-spirit explorer
  galen.md          # Test diagnostician
  passthrough.md    # Minimal wrapper (model-agnostic)
  titus.md          # TypeScript fixer
```

## License

MIT
