# Analysis: Issue #3 - Persist run status to run.json

> **Note**: GitHub API was unreachable during this analysis. This document contains the analysis that would have been posted as a comment.

## Summary

The proposal is to persist run status updates to `run.json` when runs complete or fail, rather than recalculating status on every query. Currently, `getRunStatus()` computes status dynamically by checking process state and file existence. This is a low-impact change with localized modifications to `src/lib/run.ts`, affecting primarily the `ps` and `clean` commands that consume status data.

## Consequence Chain

1. **Modify `getRunStatus()` to persist status** — When status changes from "running" to "completed" or "failed", write the update back to `run.json`
   → 2. **`completedAt` timestamp gets populated** — Currently only set by `kill` command; needs to be set when runs complete naturally
     → 3. **`ps` and `clean` commands show more accurate elapsed times** — `formatElapsed()` in `ps.ts` uses `completedAt` which is currently null for non-killed runs

## Impact Assessment

| Area | Impact | Notes |
|------|--------|-------|
| Data layer | Low | Only `run.json` schema; no new fields needed |
| API | None | No external APIs affected |
| Business logic | Medium | `getRunStatus()` gains a side effect; callers remain unchanged |
| UI | None | No UI components |
| Tests | Low | No existing tests; should add tests for status persistence |
| Dependencies | None | Uses existing `writeRun()` function |
| Config | None | No configuration changes |

## Concerns

1. **Side effect in a getter** — `getRunStatus()` is named like a pure query but would now mutate state. Consider renaming to `resolveRunStatus()` or splitting into `getRunStatus()` + `persistRunStatus()`.

2. **Race condition on concurrent reads** — Multiple `ps` calls could simultaneously detect completion and try to write. Low risk in practice (single user), but `writeRun()` isn't atomic.

3. **Auto-creation of `response.md` is coupled** — Lines 63-67 in `run.ts` auto-create `response.md` from `output.log` as a side effect. This behavior should either stay in `getRunStatus()` or be explicitly separated; mixing file creation and status calculation is already somewhat tangled.

4. **`error` field never populated on natural completion** — When a run fails naturally (process dies without output), `run.error` isn't set. The `kill` command sets it to "Killed by user" or "Process not found". Natural failures should set an appropriate message.

## Questions

- Should status persistence happen eagerly (on every status check) or lazily (only when status actually changes)?
- Should failed runs distinguish between "crashed", "timed out", and "killed"?
- Is there any need to preserve the "running" → "completed" transition history, or just the final state?

## Recommendations

1. **Rename `getRunStatus()` to `resolveRunStatus()`** to signal it may have side effects.

2. **Extract a dedicated `finalizeRun()` function** that handles:
   - Setting `completedAt`
   - Setting `status`
   - Optionally setting `error`
   - Writing to `run.json`
   - Auto-creating `response.md` if warranted

3. **Call pattern**: `resolveRunStatus()` detects state, calls `finalizeRun()` when transitioning from "running", returns status. Subsequent calls to `resolveRunStatus()` short-circuit because `run.status !== "running"`.

4. **Implementation location**: All changes in `src/lib/run.ts`. No changes needed to consumers (`ps.ts`, `clean.ts`, `watch.ts`).

## Files Examined

- `src/lib/run.ts` — Core run management, `getRunStatus()`, `writeRun()`
- `src/lib/paths.ts` — Path utilities including `runMetaPath()`
- `src/commands/run.ts` — Creates initial run metadata with status "running"
- `src/commands/ps.ts` — Lists runs, calls `getRunStatus()` for each
- `src/commands/kill.ts` — Only place that updates status to "failed" with `completedAt`
- `src/commands/clean.ts` — Uses `getRunStatus()` to filter runs
- `src/commands/watch.ts` — Uses `getRunStatus()` for display only
