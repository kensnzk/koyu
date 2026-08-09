---
title: Look up a diagnostic by symptom
mode: howto
---

# Look up a diagnostic by symptom

**Human-readable `check` output carries no diagnostic codes.** All you get is `file:line: message`. When what you have in hand is that message — or nothing but a feeling that something is off — start here.

If you already have a code, the [diagnostic code index](../reference/diagnostics/index.md) is faster.

## Get the code

`--json` prints the same diagnostics with their codes.

```sh
koyu check bad.muro --json
```

```text
[
 {
  "code": "SUF01",
  "severity": "error",
  "message": "The ceiling height of /L1/a cannot be determined (neither the space's h: nor level L1's h: is there)",
  "line": 4,
  "file": "<absolute path>/noh.muro",
  "path": [
   "/L1/a"
  ]
 }
]
```

`message` is **the body only** — no position prefix. The position lives in `line` and `file`. The full reading procedure is on [Reading a diagnostic](../reference/diagnostics/reading.md).

**There are only two severities.** `error` means the composition does not stand (exit code 1); `warning` means it stands but is suspect (exit code 0, or 1 under `--strict`). Severity is an invariant property of the code and never varies by case.

## 1. check stops with an error

Message bodies can be searched for verbatim. Below are fragments of them.

| What you see | Cause | Fix | Code |
|---|---|---|---|
| `Undefined grid line name: X1` | No `grid`, or it sits **after** the line that uses the grid reference | Write `grid X` and `grid Y` before the first line that uses them → [Common traps](troubleshooting.md#1-undefined-grid-line-name) | composition error |
| `A region is given as two ranges, X?..X? and Y?..Y?` | A region needs **two** ranges, one on X and one on Y; only one is written | Write both axes: `space <path> [type] X?..X? Y?..Y?` → [Common traps](troubleshooting.md#4-a-region-is-given-as-two-ranges) | composition error |
| `has a region, but its level cannot be determined` | There is no `level` line. **Writing `/L1/` in the path does not declare a level.** | Write `level L1 0 h:2400 slab:150` before the lines that use it | [SUF02](../reference/diagnostics/suf.md) |
| `The ceiling height of … cannot be determined` | Neither the space's `h:` nor the level's `h:` exists | Write `h:` on one of them | [SUF01](../reference/diagnostics/suf.md) |
| `The spaces do not touch, so no boundary can be derived` | They meet only at a corner. Touching requires **a shared edge with length** | Extend one rectangle so an edge is shared, or delete the `boundary` line → [Common traps](troubleshooting.md#2-the-spaces-do-not-touch) | [BND04](../reference/diagnostics/bnd.md#bnd04) |
| `There is more than one boundary segment; pick an edge with edge:N/E/S/W` | The boundary to the exterior falls on several edges of the room's perimeter | Pick the edge on the opening with `edge:`. `N`=+Y / `S`=−Y / `E`=+X / `W`=−X | [OPN05](../reference/diagnostics/opn.md#opn05), or [SEG05](../reference/diagnostics/seg.md) for `seg` |
| `No boundary segment can hold the door` | That pair of spaces has no boundary segment at all | Check with `koyu graph` whether they really touch | [OPN04](../reference/diagnostics/opn.md#opn04) |
| `Space regions overlap:` | A space with a region has a child space with a region | Make the parent a `zone` → [Counted and uncounted divisions](uncounted-divisions.md) | [GEO02](../reference/diagnostics/geo.md#geo02) |
| `Regions within … overlap:` | Rectangles unioned with `+` inside one space overlap each other | Split them so they do not | [GEO01](../reference/diagnostics/geo.md#geo01) |
| `References an undefined space:` | A misspelled path, or the layer declaring that space is not imported | Fix the path or add the `import` | [REF01](../reference/diagnostics/ref.md) |
| `Duplicate boundary:` | Two boundaries on the same pair of spaces | Merge them into one, or give both an `edge:` limiting them to different edges | [BND02](../reference/diagnostics/bnd.md#bnd02) |
| `A wall boundary cannot be written to a space on a different level` | A relation across storeys written as a wall | Use `type:stair` / `type:shaft` / `type:void` | [BND03](../reference/diagnostics/bnd.md#bnd03) |
| `Openings overlap` | A door and a window sit too close on the same boundary segment | Move one with `at:` | [OPN02](../reference/diagnostics/opn.md#opn02) |
| `The door width … exceeds the boundary segment length` | The opening is longer than the wall | Narrow it, or lengthen the wall | [OPN06](../reference/diagnostics/opn.md#opn06) |
| `is written as a positive number:` | An interpreted attribute's value does not read as a number (`h:24OO` has letters in it) | Fix the spelling | [ATT01](../reference/diagnostics/att.md) |
| `A boundary type is wall / open / stair / shaft / void:` | A value outside the ledger on an attribute with a fixed vocabulary | Use a word from the ledger | [ATT02](../reference/diagnostics/att.md) |
| `which is not in the ledger (check the spelling, or add a namespace…)` | **An attribute key not in the ledger, with no namespace.** `nmae:` does not pass silently | Fix the spelling, or add a namespace such as `acme.note:` if the value is only carried | [ATT03](../reference/diagnostics/att.md) |
| `daylight is either 1 … or 0` | Something other than 0 or 1 on `daylight:` | Write `daylight:1` or `daylight:0` | [DAY01](../reference/diagnostics/day.md) |
| `Duplicate uid:` | The same `uid` on two targets | Replace one with a fresh value from `new_uids` → [Identity](../reference/identity.md) | [UID03](../reference/diagnostics/uid.md) |
| `A koyu 0.5 file uses a 1.0 word:` | A newer word (`over`, `drop`, set editing) in a file declaring an older version | Raise it to `koyu 1.0` | [VER04](../reference/diagnostics/ver.md) |
| `One layer holds two opinions about …` | One layer holds two opinions about one attribute | Override from another layer → [Lay measurements over the plan](write-as-built.md) | composition error |
| `No such target for over:` | The target of `over` was never composed | Fix the spelling, or place it after the layer that defines it | composition error |
| `Duplicate space path:` | Two layers define the same path | Turn one into an `over`, or split the paths | composition error |

## 2. check emits warnings only

The exit code stays 0 unless you pass `--strict`. **Some of these mean nothing gets generated.**

| What you see | What it means | What to do | Code |
|---|---|---|---|
| `has no slab:, so not one floor is generated on this storey` | No floor is produced on that level | Write `slab:`, as in `level L1 0 h:2400 slab:150` | [SUF03](../reference/diagnostics/suf.md) |
| `There are no spaces beneath zone …` | The zone has no members; the path prefix does not line up | Fix either the zone path or the space paths | [ZON01](../reference/diagnostics/zon.md) |
| `A space shares its path with a zone` | Both a space and a zone occupy the same path | Settle on one of them | [ZON02](../reference/diagnostics/zon.md) |
| `A door on a vertical boundary is not interpreted` | An opening written on a stair, shaft or void boundary. It has no effect on passage | Delete it. Passage is carried by the vertical boundary itself | [VRT05](../reference/diagnostics/vrt.md#vrt05) |
| `A door on an open boundary has no effect on passage` | `type:open` is already passable | Delete the opening, or make the boundary a `wall` again | [OPN03](../reference/diagnostics/opn.md#opn03) |
| `cuts nothing` | The drawn line matches the default adjacency line, or falls outside the allocation | Redraw it, or delete it | [LIN03](../reference/diagnostics/lin.md) |
| `The area spills outside the region of` | An `area` runs past its parent space | Shrink its extent → [Counted and uncounted divisions](uncounted-divisions.md) | [SEG02](../reference/diagnostics/seg.md) |
| No column stands for a column declaration | There is no floor at that grid crossing, or the space is semi-outdoor with no floor above | Revisit the declared grid lines, or the extent with a floor | [COL01](../reference/diagnostics/col.md) |

## 3. check is green and it is still wrong

**There is no diagnostic here.** `check` speaks only to whether what is written contradicts itself as data. Whether it works as a building is not its subject.

| Symptom | Cause | Tool to confirm with |
|---|---|---|
| A room cannot reach the outside | The default between touching spaces is **a wall with no door**. Doors are never added automatically | `koyu doors` / `koyu graph` → [Common traps](troubleshooting.md#9-green-and-no-way-out) |
| No envelope at all | Nothing is derived against a space with no region (`/out`) | `koyu.schematic.envelope.gap` from `koyu validate` → [Common traps](troubleshooting.md#10-green-and-no-envelope) |
| An empty file is green | A composition with nothing written in it stands | Look inside with `koyu stats` / `koyu graph` |
| A room you want in the area schedule is missing | `area` is an uncounted division. It appears in neither area nor room count | [Counted and uncounted divisions](uncounted-divisions.md) |
| The boundary count from `check` and `boundaries` in the canonical JSON disagree | `check` counts the composed model; canonical JSON carries **only what was written** | Not a contradiction → [Common traps](troubleshooting.md#13-two-places-give-different-boundary-counts) |
| An attribute has no effect | An unknown key is an error, but **a misspelled value is carried** | Trace the origin with `koyu layers --attrs` |
| Changing the type does not change the daylight verdict | Daylight scope is decided by `daylight:1`, not by the type | `koyu light` |

## 4. check says nothing — validate does

Architectural judgement comes back separately from `koyu validate`. **It carries `chapter.rule` spellings, not `check` codes.**

| Symptom | Rule |
|---|---|
| Part of the perimeter faces nothing | [`koyu.schematic.envelope.gap`](../reference/validate/envelope.md) |
| Window area falls short of 1/7 of the floor | [`koyu.schematic.daylight.ratio`](../reference/validate/daylight.md) |
| A window has no `h:`, so the window area is incomplete | [`koyu.schematic.daylight.unknown`](../reference/validate/daylight.md) |
| Stair treads are cramped, or riser and tread fall outside the usual band | [`koyu.schematic.stair.proportion`](../reference/validate/runs.md) |
| A ramp is steeper than declared | [`koyu.schematic.ramp.declared-slope` / `koyu.schematic.escalator.usual-slope`](../reference/validate/runs.md) |
| A vertical run has form but nothing connects the storeys | [`koyu.schematic.run.disconnected`](../reference/validate/runs.md) |
| A room cannot reach the exterior | [`koyu.schematic.access.unreachable`](../reference/validate/access.md) |
| A door opens only onto a void | [`koyu.schematic.access.voidonly`](../reference/validate/access.md) |
| A column stands in a door | [`koyu.schematic.column.blocksdoor`](../reference/validate/column.md) |
| The building escapes the site shape | [`koyu.schematic.site.escape`](../reference/validate/site.md) |
| Declared and derived site area disagree | [`koyu.schematic.site.area`](../reference/validate/site.md) |
| Road frontage is too short | [`koyu.schematic.site.frontage`](../reference/validate/site.md) |

Every rule is on [Judgement — koyu validate](../reference/validate/index.md).

## 5. The command itself fails

| What you see | Exit code | Cause |
|---|---|---|
| `Undeclared level: l2 (declared: L1 L2 R)` | 2 | A wrong level name after `-l`. **Case matters.** Confirm with `koyu levels` |
| The `Usage: koyu …` line | 2 | Missing arguments. `--help` goes down the same path |
| `Error: No level is defined` with a stack trace | 1 | There is no `level` line at all. `check` can be green while drawing fails |
| `Error: There is no space with a region on level R` with a stack trace | 1 | No space on that level has a region |
| `Cannot reach /out from /L1/nope` | 1 | Unreachable. **The same wording appears when the start or end path does not exist.** Confirm the spelling with `koyu graph` |

**A problem with how you called it exits 2; a problem with the composition exits 1.** The two are never mixed, so CI can treat them differently.

## Related

- [Common traps](troubleshooting.md) — the entries above that need a worked fix
- [Diagnostic code index](../reference/diagnostics/index.md) — all 68, looked up by code
- [Reading a diagnostic](../reference/diagnostics/reading.md) — the structure of the `--json` return
- [Judgement — koyu validate](../reference/validate/index.md) — the sixteen rules
- [The scope of the promise](../reference/scope.md) — what a green `check` means
