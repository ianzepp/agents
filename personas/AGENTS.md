# Claude Agents - Development Instructions

## Project Overview

This repo contains specialized diagnostic agents for Claude Code. Each agent is a markdown file with a system prompt that defines role, constraints, and methodology.

**Core principle:** Separation of diagnosis from action. Analysts (augur, columbo, galen) report findings without making changes. Fixers (titus, cato) operate under strict guardrails.

## Agent Structure

Each agent is a markdown file with YAML frontmatter:

```markdown
---
name: agent-name
description: Brief one-line description
model: sonnet
---

You are [role]. Your job is to [specific task].

## Hard Constraints

**[Key constraint].** [Why it matters]

**Allowed actions:**
- [Specific allowed tool/action]

**Forbidden actions:**
- [Specific forbidden tool/action]

## [Process/Methodology sections]

## Output Format

[Structured output template]

## Principles

- [Key decision rule]
```

### Agent Naming

Use classical/historical names that reflect the role:
- **augur** — Roman diviner (predicts future consequences)
- **columbo** — Detective (investigates past causes)
- **cato** — Roman censor (judges quality)
- **galen** — Greek physician (diagnoses ailments)
- **titus** — Roman emperor (fixes/builds)

Names should be short (1-2 syllables), memorable, and evocative of the agent's function.

### Constraint Design

Every agent should have **Hard Constraints** that define:
1. What they can read/analyze
2. What they can/cannot modify
3. Time or resource limits
4. Escalation conditions

Read-only agents forbid editing. Active agents forbid suppressions/workarounds.

## Code Conventions

### agent.sh (Bash)

- Use `set -euo pipefail` for strict error handling
- Quote all variable expansions: `"$VARIABLE"`
- Use `[[ ]]` for conditionals (not `[ ]`)
- Prefer early returns over deep nesting
- Document complex sed/awk with inline comments
- Test both local and `--dispatch` execution paths

### Agent Prompts (Markdown)

- Use `##` for major sections, `###` for subsections
- Include tables for decision matrices or categorization
- Provide concrete examples in code blocks
- End with "You are [role summary]" to reinforce constraints
- Keep time estimates realistic (e.g., "2-3 minutes", not "5-10 minutes")

### Mode Instructions

The `--mode` flag injects additional instructions:
- **read**: "Do not modify any files or create issues"
- **update**: "Make the necessary changes directly"
- **issue**: "Create GitHub issues for your findings"

Agent prompts should work with all three modes. Don't assume mode in the base prompt.

## Testing Changes

Before committing changes to `agent.sh` or agent prompts:

1. Test dry-run: `./agent.sh <agent> -n "test goal"`
2. Test all modes: `--mode read`, `--mode update`, `--mode issue`
3. Test dispatch (in git repo): `./agent.sh <agent> --dispatch -n "test"`
4. Verify help text: `./agent.sh --help`
5. Test error cases: invalid mode, non-git repo with `--dispatch`, missing goal

## Creating New Agents

### Process

1. Identify a focused, well-scoped role
2. Choose a name (classical/historical figure matching the role)
3. Create `{name}.md` with frontmatter and prompt
4. Define hard constraints clearly
5. Specify output format
6. Test with `-n` flag first
7. Test all three modes
8. Update README.md with agent description and examples

### Questions to Answer

- What is this agent's single responsibility?
- What can it read? What can it modify?
- When should it escalate rather than decide?
- What output format helps users act on findings?
- What are 2-3 common use cases?

### Anti-patterns

- Agents that try to do too much
- Vague constraints ("avoid making unnecessary changes")
- Missing output format specification
- No escalation path for uncertainty
- Time estimates that encourage over-investigation

## Documentation

### README.md

When adding a new agent:
1. Add to "Agents" section with description and use cases
2. Add example usage in "Examples" section
3. Update "Project Structure" file listing

### Commit Messages

Follow conventional format:

```
<type>: <subject>

<body>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`

Example:
```
feat: add cato agent for pragmatic PR review

Cato reviews PRs with time-boxed pragmatism:
- Three verdicts: APPROVE, REQUEST CHANGES, NEEDS FURTHER REVIEW
- Focuses on security, correctness, breaking changes
- Escalates uncertainty rather than guessing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Integration with claude-workers

The `--dispatch` flag sends agent tasks to remote workers via [claude-workers](https://github.com/ianzepp/claude-workers).

**How it works:**
1. `agent.sh` detects repo from `.git/config`
2. Builds full prompt (agent + mode instructions + goal)
3. Calls `cw dispatch -r <repo> -m <model> -p "<prompt>"`
4. Remote worker clones repo, executes task in isolation

**When to use dispatch:**
- Agent needs to checkout PR branches (cato)
- Agent runs builds/tests that could break local state (columbo, galen)
- Multiple agents working in parallel on different branches
- Long-running analysis that shouldn't block local work

**Testing dispatch:**
```bash
# Dry-run shows what command will execute
cd ~/github/owner/repo
./agent.sh cato --dispatch -n "test"

# Verify repo detection
git config --get remote.origin.url
```

## Design Principles

### Focus Over Flexibility

Each agent should do one thing well. Resist adding features that blur the role.

### Constraints Are Features

Hard constraints aren't limitations—they're what make agents trustworthy. Users know exactly what an agent will/won't do.

### Escalate Uncertainty

"I don't know" is a valid agent output. Don't encourage guessing or exhaustive research when uncertain.

### Time-Box Everything

Agents operate under time/resource constraints. A 5-minute cato review beats a 2-hour deep dive that never finishes.

### Trust the User

Agents provide analysis and clear options. The human makes final decisions. Don't over-engineer certainty.
