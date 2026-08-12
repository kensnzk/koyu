---
name: koyu-revise
description: Change a building that already exists in muro without breaking what was already right — add a room, subdivide a dwelling, widen a corridor, add a storey, record what the site actually built, rename a space without orphaning references. Use this skill whenever someone hands you an existing `.muro` file and asks for a change — "この間取りに書斎を足して", "add a room to this plan", "部屋を分けたい", "make the corridor wider", "as-built を反映して", "rename this space" — and whenever a revision must keep the rest of the description intact. Do NOT use it for writing a building from scratch (that is koyu-design) or for judging whether a plan works (that is koyu-validate).
---

# Changing a description that already exists

A revision has a second obligation a new drawing does not: **everything you did
not mean to change must still mean what it meant before.** muro makes that
obligation checkable, because the difference between two descriptions can be
read in the language of composition rather than as text.

So the loop is not write-then-check. It is **write, then prove**:

```sh
# In the koyu repository:
node dist/cli.js check revised.muro && node dist/cli.js diff original.muro revised.muro
# Anywhere else:
npx -p @kensnzk/koyu koyu check revised.muro && npx -p @kensnzk/koyu koyu diff original.muro revised.muro
```

`diff` exits 0 when there is no difference, 1 when there is one, 2 when the
input is broken. Read its output as the summary you will give the person: if a
line appears there that you did not intend, the revision is wrong even though
`check` is green.

## The trap that makes this skill necessary

Grid indices are positional. `grid X 0 3600 7200` names X1, X2, X3 — so
**inserting a coordinate renumbers every index above it**, and every existing
line that mentions one silently comes to mean something else. Run against a
two-room plan where a coordinate was inserted at 1800 and nothing else was
touched:

```text
✔ Consistent — 3 spaces / 2 boundaries        ← check is perfectly happy
```
```text
± grid X X2 3600 → 1800
± grid X X3 7200 → 3600
+ grid X X4 7200
± /L1/bed: area 14.40 m2 → 7.20 m2            ← both rooms silently halved
± /L1/living: area 14.40 m2 → 7.20 m2
```

**Reach for an offset instead.** `X1+2700`, `Y2..Y2+1800` — offsets are legal
wherever a grid reference is, they extend past the last grid line, and they
renumber nothing. The same addition written with offsets diffs as exactly what
was asked for:

```text
+ space /L1/study (room 4.86 m2)
+ boundary /L1/living | /L1/study (wall t:100)
```

Add a grid coordinate only when the new line is genuinely a reference line the
building is organised on — and then expect to fix every existing reference above
it, and to say so.

## The version line is not a tidy-up

A file that declares an older `muro` version, or declares none at all, is read at
that version and goes on meaning exactly what it meant. **Raising the line
changes the file**: a key the newer version retired becomes a `VER07` error the
moment the line moves, and nothing migrates on its own.

```text
A muro 1.3 file carries use: on /L1/a — use is retired after muro 1.2. Write a namespaced
key of your own (lease.category:, fire.compartment:, dept.name:) instead, or keep the file
at muro 1.2
```

So raise it only when the revision genuinely needs newer notation, and then
rewrite what was retired in the same edit — with `use:`, a room's purpose belongs
in the type position, and every other division of the building (tenancy, fire
compartment, department) is a namespaced key you choose. Either way the `diff`
must show only what was asked for.

## Adding a room

1. Put it where it can be reached. Hang it off the circulation hub — the space
   the entrance and the other rooms already open onto — not off a bedroom.
2. Write its region with offsets from an existing grid reference.
3. **Declare the boundary and put a door on it.** A wall is derived from two
   spaces touching; a door never is. Without the door the room is sealed, and
   `check` will not say a word about it.
4. `check`, then `diff`. The diff should show the space, its boundary, and
   nothing else.

## Subdividing a space

A parent space with a region cannot hold children with regions — they overlap,
and that is `GEO02`. Convert the parent to a `zone`, which has no geometry, and
give the children the regions:

```muro-part
zone  /home name:Dwelling
space /home/ldk ldk  X1..X2 Y1..Y2 name:LDK
space /home/bed room X2..X3 Y1..Y2 name:Bedroom
```

The zone still totals the area of everything beneath it, so the figure for the
dwelling as a whole survives the split. Where the old space is referenced by
boundaries, those references must move to the children — `REF01` tells you which
ones you missed.

**Is it one room or two?** Two questions decide, and only two: does it need its
own row in the area schedule, and does it matter whether you can walk through
it? If either is yes, write two spaces. If both are no, it is an uncounted
division — write it as an `area` inside the one space, and the area schedule
stays as it was.

## Adding a storey

Copy the pattern already in the file rather than inventing one. A level, a layer
for it, the import, and a boundary joining the stair spaces, which must overlap
in plan:

```muro-part
level L3 6000 h:2700 slab:150
import ./L3.muro
```
```muro-part
boundary /L2/stair /L3/stair type:stair
```

If the storeys repeat, a level range says so in one line: `level L4..L10 11000
pitch:3000 h:2500 slab:450`.

## Renaming, and what outlives a path

A path is identity. Rename a space and every reference keyed to the old path —
a sensor, a BMS point, another layer — is orphaned. `uid:` is the escape hatch,
and it may be written on **`space` and `zone`, and nothing else**. Write it only
where a reference genuinely has to outlive the path; spaces without it are
matched by path, which is usually what you want.

When you rename, `diff` is the proof: a rename done properly shows as a rename,
not as a deletion and an unrelated addition.

## As-built: lay measurements over the plan, never into it

The partition drew at 120 and measured 150 on site. **Do not edit the plan.**
The moment you do, "what the design decided" and "what the site did" become one
undated fact with nobody responsible for it.

Composition is what this is for. Leave the plan alone and stack a stronger layer
on top:

```text
main.muro         ← the entry: grid, levels, and the order the layers stack in
  plan.muro       ← the design
  as-built.muro   ← the measurements, later and stronger
```

The same applies to any revision that is a *different kind of fact* from the one
already written — a survey, a tenant fit-out, a phase. Reach for a new layer
before reaching for an edit.

## Before you hand it back

- `check` green.
- `diff` showing only what was asked for, and you have read every line of it.
- Say what changed in the language of the diff — "a 4.86 m² study off the living
  room, reached by an 800 door" — and name anything the change forced you to
  touch that the person did not ask about.

The procedures behind each section, with worked runs, are in
[docs/howto](../../docs/howto/index.md): `subdivide-a-unit`, `add-a-storey`,
`connect-storeys`, `survive-a-rename`, `uncounted-divisions`, `write-as-built`.
