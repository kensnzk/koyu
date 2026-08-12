---
name: koyu-validate
description: Judge a building written in muro and repair what is wrong with it — rooms nobody can reach, bedrooms with no daylight, missing exterior walls, stairs at impossible proportions, a building that escapes its site. Use this skill whenever someone asks whether a plan works, wants it reviewed or checked over, hands you koyu validate output or a `.muro` file to look at, or says something like "この間取り大丈夫？", "review this plan", "何か問題ある？", "fix the findings", "なぜ届かないの". Use it after koyu-design produces a plan and before anyone is shown it. Do NOT use it for writing a new building from a brief (that is koyu-design), for building-code compliance certification, or for structural, energy or cost analysis, none of which koyu performs.
---

# Judging a building, and repairing it

`koyu check` proves the description is *consistent* — that one form derives from
it. It deliberately says nothing about whether the building works. A two-storey
building that declares not one door contradicts nothing and checks green while
being completely sealed.

`koyu validate` is the separate judgement. It returns findings, each with a rule
name, a level, and the line that caused it:

```sh
# In the koyu repository:
node dist/cli.js validate main.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
# Anywhere else:
npx -p @kensnzk/koyu koyu validate main.muro --profile koyu.profile.schematic-screen --as-of 2026-08-03
```

**The profile and the date are required.** koyu never guesses which rules to
apply or what date to apply them on; a call without them stops at exit 2 before
judging anything. koyu ships one profile, `koyu.profile.schematic-screen`.

**Violations block; cautions inform.** Exit is 0 only when the whole set ran and
nothing was violated — so a clean exit still leaves cautions worth reading, and
a rule that could not run exits 1 rather than passing quietly. Add `--json` for
the whole `AssessmentReport` when you are feeding another program.

**An empty `findings` is not by itself a pass.** Read `summary.state`: it is
`complete` only when nothing was left indeterminate and nothing errored.

This judgement is **coarse and early**, at the resolution of a scheme design.
It is not a compliance verdict, and passing it is not permission to build.

## Read the finding, then repair it

Findings name their own repair once you know the vocabulary. Work down the
violations first, re-run, and stop when they are gone — cautions are advice you
raise with the architect rather than silently design around.

| Rule | Level | What it means | The repair |
|---|---|---|---|
| `koyu.schematic.access.unreachable` | violation | a space with a region cannot reach any `outside:1` space along passable boundaries | declare the boundary to the circulation space and put a `door` on it |
| `koyu.schematic.access.voidonly` | violation | its only way out is through a `void` or a `shaft` — a door onto a floorless hole | give it a boundary to a space people can stand in |
| `koyu.schematic.access.parking` | violation | a car cannot get out: a stair is a step to a car, and a door narrower than 2400 is a wall | a `type:open` boundary, a door ≥ 2400 wide, or a space carrying `ramp:` |
| `koyu.schematic.access.throughtenant` | caution | escape from a stair reaches the outside only through rentable space — if the tenant locks up, there is no way out | route it through common space, or accept it deliberately |
| `koyu.schematic.access.backofhouse` | caution | a common stair or escalator is reachable from the common corridor only by passing through back-of-house, so visitors cannot use it | open a route from the corridor that avoids the back-of-house space |
| `koyu.schematic.daylight.ratio` | violation | effective window area is under a seventh of the floor, on a space you marked `daylight:1` | add a `window` on a boundary to `/out`, or drop `daylight:1` if the room is not habitable |
| `koyu.schematic.daylight.unknown` | caution | `daylight:1` on a space whose openings cannot be evaluated | give the boundary a real opening, or say the room is out of scope |
| `koyu.schematic.envelope.gap` | caution | part of the outline faces nothing — a silently missing exterior wall | write `boundary /L1/room /out edge:N t:120` for the named side |
| `koyu.schematic.stair.proportion` | caution | riser and tread fall outside workable proportions | change the storey height, the run length, or the number of flights |
| `koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope` | caution | a ramp is too steep | lengthen the run or reduce the rise |
| `koyu.schematic.run.disconnected` | caution | a stair or ramp does not land in a space at one end | check the `type:stair` boundary joins the right two spaces, overlapping in plan |
| `koyu.schematic.column.blocksdoor` | violation | a column stands in a doorway | move the column, move the door with `at:`, or narrow the opening |
| `koyu.schematic.site.escape` | violation | a space with a region lies outside the site polygon | move the space inside, or correct the `polygon` |
| `koyu.schematic.site.frontage` | violation | the site does not meet a road across enough width | widen the frontage, or declare the road that is actually there |
| `koyu.schematic.site.area` | caution | the declared `area:` disagrees with the polygon | fix whichever is wrong; the polygon is the derived truth |

**Not every rule looks at every space.** `access.parking` judges only the spaces
whose TYPE is `parking` or `ramp`. `access.throughtenant` judges only the spaces
typed `stair`, and the route it wants is one to the outside that never enters a
space whose `lease.category` is `rentable`. `access.backofhouse` judges only the
spaces carrying `stair:` or `escalator:` and `lease.category:common`, and the
route it wants starts at a `corridor` also carrying `lease.category:common` and
never enters a space typed `backyard`. Write neither the type nor the key and the
rule reports itself not applicable — which is not a pass: it produces no finding
and is counted in `summary.rules.notApplicable`.

## What passable means

Every access rule stands on what counts as passable, and misreading that is the
usual reason a repair does not take.

**Passable by a person** — a `type:open` boundary, a `type:stair` boundary
joining two levels, and a wall carrying a `door`. **A derived wall has no door,
so it is not passable**, and neither is a window. `type:shaft` and `type:void` boundaries
are never passable, and you cannot walk *through* a `void:1` space or a space
typed `shaft` to somewhere beyond it.

**Passable by a car** — `type:open`, a `door` at least 2400 wide, or a vertical
link on a space carrying `ramp:`. A stair is, to a car, a step.

Note where the spelling is guarded and where it is not. `void:1` is a ledger key,
so `voi:1` is an error (ATT03). `shaft` sits in the type position, which is open
vocabulary — write `shaftt` and this rule quietly stops applying. Core reads no
type word at all; the judging face does, and that face does not freeze.
`lease.category` is guarded no better: it is a carried namespaced key, and a
namespace is precisely the statement that koyu has not looked at the word, so
`lease.categry:common` is accepted in silence while the tenancy rules stop
applying to that space. When a finding you expected is missing, check the
spelling of the type and of the key before you look at the geometry — `koyu stats
--by lease.category` prints the buckets, and a misspelling lands in
`(unspecified)`.

So the commonest violation in a new building is not a mistake in the drawing: it
is a boundary nobody wrote. `koyu doors <file> <from> <to>` shows the route it
did find, or nothing, which is faster than reading the plan.

## Daylight, exactly

Only spaces you wrote `daylight:1` on are in scope — `room` does not imply
habitable, and the grain of the question (a whole dwelling, or each room) is
decided by where you write it. Effective area is `w × h × factor` summed over
the windows on that space's boundaries, against a threshold of floor ÷ 7:

| what the window faces | factor |
|---|---|
| an `outside:1` space | 1.0 |
| a semi-outdoor space open to the sky — a garden, a top-floor balcony | 1.0 |
| a semi-outdoor space with something above it — under an eave or a balcony | 0.7 |
| an indoor neighbour | 0 — it does not count at all |

`koyu light <file>` returns the numbers without the threshold, which is what to
read when a finding looks wrong: it shows whether the window is small or simply
facing the wrong thing.

Two things bite while writing the repair itself: an opening on a boundary to
`/out` needs `edge:N|E|S|W`, because that boundary always has several segments;
and a `name:` value containing a space must be quoted (`name:"West window"`) or
the parser reads the second word as a broken attribute.

## Cautions are a conversation, not a task list

`koyu.schematic.envelope.gap` is the one to understand rather than obey. A wall between two
touching spaces is derived whether or not you write it — but **a boundary to the
outside is never derived**, because naming what is on the other side is itself
information. So a forgotten exterior boundary is a wall that silently does not
exist. The finding names the sides (`S 4000mm / N 4000mm`), which is what tells
you which edge to write.

That said, a compact plan with a few `koyu.schematic.envelope.gap` cautions is often finished
work: the architect decided those faces later. Report them; do not invent walls
to silence them.

## The loop

1. `check` first — `validate` on a description that does not parse tells you
   nothing.
2. `validate`, and read every violation with its line.
3. Repair the violations in one edit, using the table above.
4. `validate` again. Stop when violations are zero.
5. Tell the person what you fixed, and list the cautions you left standing and
   why. The cautions are usually where the design conversation actually is.

The reference for every rule, with a failing example each, is
[docs/reference/validate](../../docs/reference/validate/index.md) in this
repository. Read the page for a rule when the table is not enough — `access.md`
in particular, which explains why these five rules exist.
