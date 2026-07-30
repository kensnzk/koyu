# The control group — answering "isn't that just a bespoke JSON Schema?"

The objection arrives from every direction and it deserves an answer that cannot be argued with. The
theoretical reply — *JSON Schema defines neither equivalence nor composition; muro defines both* — is
a claim, and a claim can be disputed. An experiment cannot.

So the same building is held two ways and the same editing task is given to the same model under the
same conditions:

- **muro** — the notation. Positions, areas and circulation are derived.
- **control** — a naive JSON model carrying coordinates, plus a JSON Schema and a validator. Every
  fact muro derives is **stored**.

If muro loses, the language's central claim is dead. Knowing that is worth the experiment.

## Why the control is exported by machine

A hand-written control would be quicker. It would also be worthless. Four criteria decide it, in the
order they bite.

1. **It must carry the same information.** If the control holds less, the outcome measures missing
   information rather than derivation. An export from the same source guarantees equality by
   construction — attributes, room names and groupings are all carried across, including the ones
   that never reach the `Form` (`floor:オーク` lives in the model, not in the shape).
2. **A third party must be able to re-run it.** A hand-written file cannot be regenerated. This one
   is `export.ts`, so anyone can produce it again and compare.
3. **It must not be dismissible as a strawman.** An objection to the shape has to point at
   `export.ts` and say what is unfair about it. That is a conversation worth having; "you wrote a bad
   JSON on purpose" is not.
4. **Only the thing under test may differ.** The export carries none of muro's relational machinery:
   a wall is not "the boundary between two spaces" but a thing with endpoints and a thickness, there
   are no default walls, and every wall is listed. Coordinate pairs are folded onto one line so that
   verbosity is not mistaken for difficulty.

## What the export looks like

```
building.json     the whole building — levels, rooms, walls, openings, columns, groups, site
schema.json       the contract, standard JSON Schema (draft 2020-12)
```

Rooms hold `pieces` (the convex pieces of the floor) and a stored `areaM2`. Walls hold `start`,
`end`, `thickness` and the two rooms they separate. Openings hold absolute coordinates. Groups hold a
stored total area. Room identifiers keep muro's paths verbatim — mangling them would handicap the
control for no reason, and prefix conventions are what JSON practice actually uses for grouping.

**A level range expands.** `space /L3..L10/A/ldk` is one line in muro and eight rooms here. That is
not an artefact of the export; it is what "no derivation" means.

## The oracles

`eval/score.ts` scores the muro side against the composed model. The control has no model, so
`oracle.ts` scores the JSON. Four oracles are generic and one is per task.

| Oracle | What it asks | Why it is separate |
|---|---|---|
| `schema` | structure and types | `schema.json`, applied by `validate.ts` |
| `refs` | does every reference name something that exists | **JSON Schema cannot express referential integrity** |
| `geometry` | do rooms overlap, does each opening sit on its wall | JSON Schema cannot reach geometry either |
| `agreement` | **do the stored derived values still agree with the geometry** | the headline number — see below |
| `assert` | the task's own claim | written over the JSON in the task file's `control` section |

### `agreement` is why the experiment exists

Stored areas, stored group totals and stored storey heights are facts an edit can leave behind. When
one is left behind, the document still validates, every reference still resolves, the geometry is
still consistent — and the building says something false about itself. Nothing in the JSON stack
says so. That is the mechanism the plan predicted, and `agreement` is what turns the silence into a
count:

```text
pass  schema    the document satisfies schema.json — no violation
pass  refs      every reference names something that exists — no dangling reference
pass  geometry  rooms do not overlap and every opening sits on its wall — geometrically consistent
FAIL  agreement 2 silent disagreement(s): the room /home/bed1 stores 26.5m2 but its pieces
                measure 22.13m2; the group /home stores 92.75m2 but its members measure 88.38m2
3/4 passed  (SILENTLY WRONG)
```

In muro the same mistake is unavailable: no area is stored, so nothing can fall out of step.

### What `agreement` deliberately does not ask

It does not ask whether a wall's height equals the storey height of its level. That is a muro
derivation rule (a wall rises to the storey height unless `h:` or `air:` says otherwise) and the
control was never told it. Holding the control to a rule it does not know is precisely the
unfairness this design set out to avoid — and it showed up immediately: with that rule in place,
four of the six bundled examples failed on an **untouched** export, because walls carrying `h:` and
`air:1` are correctly shorter. An oracle that fails on an untouched document measures nothing.

What remains are three questions about the document's agreement with itself: room area against its
pieces, group total against its members, storey height against the gap to the level above.

## The instruction differs by condition, and it has to

Every muro instruction ends with "finish by passing `koyu check --strict`". The control has no such
command, so leaving the instruction unchanged would deny the control any way to check its own work —
an asymmetry with nothing to do with derivation. `control.instruction` is therefore **required**, not
optional: it repeats the same architectural task, drops the `koyu check` line, adds a sentence naming
where the relevant things live in the JSON, and ends with

```sh
npx tsx eval/control/validate.ts building.json
```

That is exactly the control the plan specifies — naive JSON, a JSON Schema, and a validator. The
control is not given a consistency checker, because that is the labour under measurement.

## An assertion must ask the geometry, not the stored number

A `control.asserts` entry that reads `room(id).areaM2` would pass on a document whose stored areas
are stale — the very failure being measured. Ask `areaOf(room(id))` instead, which measures the
pieces. `loadTask` rejects an assertion that reads `.areaM2`.

## Running it

The full protocol — how to sanitise the sandbox so the subject cannot read the answers, what counts
as a run, and what must never enter the records — is in [PROTOCOL.md](PROTOCOL.md). The short version:

```sh
# muro condition
WORK=$(npx tsx eval/run.ts prepare T01-floor-material)
# … the agent edits $WORK …
npx tsx eval/run.ts score T01-floor-material "$WORK"

# control condition — the .muro sources are deliberately absent from $WORK
WORK=$(npx tsx eval/run.ts prepare T01-floor-material --condition json)
# … the agent edits $WORK/building.json …
npx tsx eval/run.ts score T01-floor-material "$WORK"
```

`prepare` records the condition, so `score` needs no flag. A task without a `control` section can
only be run in the muro condition.

Both conditions write to `eval/results/records.jsonl` with a `condition` field. Records written
before the control existed carry none; a missing value reads as `muro`, which is what those runs
were.

## Which tasks run in both conditions

| Task | op / kind | fixture | muro oracles | control oracles |
|---|---|---|---|---|
| T01-floor-material | update / direct | tower | 6 | 10 |
| T02-widen-bed1 | update / spatial | tower | 7 | 9 |
| T03-split-B | create / topological | tower | 10 | 10 |
| T04-remove-balcony | delete / direct | tower | 6 | 9 |
| T05-rename-A | update / direct | tower-uid | 8 | 10 |
| T06-generate-two-rooms | create / direct | (none) | 5 | 8 |

All six, so the experiment is 6 tasks × 2 conditions × 3 attempts = **36 runs**. Every control
section was verified against a reference solution: the untouched export fails exactly the assertions
that ask for the change, and the reference passes all of them.

**T03 is the heaviest task in the control by a wide margin.** Splitting one dwelling into two adds 40
rooms, 16 groupings and **104 walls**, and moves three windows and a balcony door onto new walls —
each needing a fresh identifier. On the muro side the same change is 15 declarations. Its reference
solution had to be designed and verified first (it did not exist); it is recorded in the task's
`notes`.

**T06 is where the control is strongest.** Written from nothing, there is no existing fact to
propagate, so no stored derived value can go stale. muro's only advantage there is concision. The
task is kept in the set precisely so the result can say *where* muro wins rather than asserting that
it always does.

## What is already measured

Reference solutions pass in both conditions, so the task is achievable either way and the comparison
is not rigged. What differs is the cost of the same semantic change:

| | edits | changed lines | oracles |
|---|---|---|---|
| muro | 1 line | 2 | 6/6 |
| control | 8 lines (one per level) | 16 | 10/10 |

Size of the same building, exported:

| Example | muro | control | ratio | control tokens |
|---|---|---|---|---|
| house | 5,292 B | 14,933 B | 2.8× | ≈3,700 |
| office | 5,060 B | 26,676 B | 5.3× | ≈6,700 |
| tower | 21,227 B | 322,261 B | 15.2× | ≈80,600 |
| complex | 33,284 B | 822,407 B | 24.7× | ≈205,600 |

The ratio grows with repetition, which is where level ranges pay off. **`complex` does not fit a
200K context in the control condition at all** — that is a finding, not a bug, but it is why the
experiment runs on `tower`.

## Status of the measurement

The apparatus is complete: all six tasks have reference solutions that pass in both conditions, and
the whole path (prepare → a real agent → score) has been exercised end to end.

**The 36 runs have not been executed.** Opus 5 was unavailable for subagents when the apparatus
landed — `529 Overloaded` on every attempt, sequential and parallel alike — and a run killed by
capacity is not a run. Nothing about the outcome is known yet, and the numbers below are the *cost of
the reference solutions*, not measured success rates.

## Honesty about what a bespoke checker would change

A competent engineer could write a consistency checker for this JSON and close part of the gap. That
is true, and it is the point: the labour of writing and maintaining that checker is what muro
removes. The plan specifies the control as "naive JSON + JSON Schema + validator", so that is what
is measured — and this paragraph is here so nobody has to discover the caveat for themselves.
