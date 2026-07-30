# The W3 run protocol — how to execute the 36 runs

W3's acceptance criterion is that a third party can re-run the experiment. This page is that
criterion: everything needed to execute it, and nothing that would contaminate it.

## Design

6 tasks × 2 conditions × 3 attempts = **36 runs**. Held equal across conditions: the task, the
instruction (except the sentences that name the format and the verification command), the model, the
number of attempts, and the scoring. The only thing that varies is how the building is held.

| | Condition `muro` | Condition `json` |
|---|---|---|
| What the agent edits | the `.muro` layers | one `building.json` |
| The contract it may read | `docs/reference/muro/` | `schema.json` |
| How it verifies its own work | `koyu check --strict` | `eval/control/validate.ts` |
| What is derived | positions, areas, walls, circulation | nothing |

Model: **Opus 5**, 3 attempts per task per condition. A fresh agent context per run — an agent that
has seen the task once is no longer a blind subject.

## The subject must not be able to read the answers

A run is worthless if the agent can read the oracles, the reference solutions, or (in the control)
the `.muro` source of the same building. Instructing it not to is not enough; make it impossible.

Build a sanitised worktree and point the agent at that as its koyu installation:

```sh
SANDBOX=/tmp/koyu-sandbox
git worktree add -q "$SANDBOX" HEAD
cd "$SANDBOX"
rm -rf eval/tasks eval/results eval/fixtures eval/run.ts eval/score.ts eval/README.md \
       eval/control/oracle.ts eval/control/export.ts eval/control/README.md eval/control/PROTOCOL.md \
       test docs/decisions docs/log docs/reviews conformance \
       examples/tower examples/twin examples/complex
ln -s <repo>/node_modules node_modules
```

What each removal is for:

| Removed | Why |
|---|---|
| `eval/tasks/` | the oracles, and the reference solutions written into `notes` |
| `eval/control/oracle.ts` | the scorer, including which stored values are checked |
| `eval/control/README.md`, `PROTOCOL.md` | they describe the oracles and this protocol |
| `eval/results/`, `eval/fixtures/` | previous runs and the frozen fixture |
| `test/`, `conformance/` | expectations that name the same buildings |
| `docs/decisions/`, `docs/log/`, `docs/reviews/` | ADRs and notes discussing the tasks |
| `examples/tower`, `twin`, `complex` | **the muro source of the building the control is editing** |

What survives is what the task instruction legitimately offers: `docs/reference/` and `docs/en/`,
`src/`, and the small examples (`two-rooms.muro` and friends) that T06 names as a model.

Verify the sandbox before running:

```sh
grep -rl "参照解\|oracles\|groupAreaOf" "$SANDBOX" --exclude-dir=node_modules   # must print nothing
cd "$SANDBOX" && npx tsx src/cli.ts check examples/two-rooms.muro               # must print ✔
```

## One run

```sh
# 1. prepare — a fresh work directory outside the repository
WORK=$(npx tsx eval/run.ts prepare <task-id> [--condition json])

# 2. drive the agent. Give it exactly three things:
#      - the instruction (task.instruction, or task.control.instruction for the control)
#      - $WORK, with "edit only files inside this directory"
#      - $SANDBOX, with the verification command for the condition
#    Nothing else. No hints, no mention of the oracles, no reference solution.

# 3. score — appends one record to eval/results/records.jsonl
npx tsx eval/run.ts score <task-id> "$WORK" \
  --agent "<subject>" --tool-calls <n> --tokens <n> --turns <n>
```

`prepare` records the condition, so `score` needs no flag. Tool calls, tokens and turns are invisible
to the harness — they come from whoever drove the agent.

## The report

```sh
npx tsx eval/run.ts report <label>                  # from eval/results/records.jsonl
npx tsx eval/run.ts report <label> --records <file> # from your own records
```

The report's first table is the per-condition comparison: runs, full passes, oracle totals, **silently
wrong**, median changed lines, median tool calls. `silently wrong` is structurally zero in the muro
condition.

## Rules that keep the numbers honest

**A run killed by infrastructure is not a run.** An API error, a timeout, an overloaded server — none
of those are the task failing. Discard the work directory, prepare a fresh one, and run again. Never
score a directory an interrupted agent touched: it holds a half-finished edit that no subject
actually chose to leave there.

**Never score the same work directory twice.** `prepare` is cheap; reuse is not worth the ambiguity.

**Never edit a work directory yourself.** Not to fix a path, not to tidy formatting. If the agent
left it broken, broken is the measurement.

**A reference solution is not a run.** It proves the task is achievable and it belongs in the task's
`notes`; it never enters `records.jsonl`.

**A different model is not the measurement.** Running a cheaper model to check that the apparatus
works end to end is useful, and it must be scored with `--dry-run` so it never reaches the records.

## Discarded runs are counted

`eval/results/discarded.log` records every attempt thrown away before scoring, with its cause. A
measurement that quietly drops attempts is not reproducible: without the count, a reader cannot tell
whether the recorded runs are all of them or the survivors of a selection.

## Status

The apparatus is complete and verified: every task has a reference solution that passes in both
conditions, and the whole path (prepare → a real agent → score) has been exercised end to end.

**1 of the 36 runs is recorded** — T01, condition `muro`: 6/6 oracles, 2 changed lines, 12 tool
calls. Opus 5 capacity for subagents is intermittent: parallel attempts fail reliably and sequential
ones fail often, and 4 attempts have been discarded to `529 Overloaded`. **Nothing about the
comparison can be said from one run.** The runs resume when capacity does.

`eval/results/records.jsonl` also holds the 2026-07-26 baseline, which predates the control and reads
as condition `muro`. Filter on `agent` to separate the two measurements.
