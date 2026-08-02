---
title: Verifying — check / validate
mode: reference
---

# Verifying — check / validate

The two you call after an edit. **They say different things.**

- [`check`](#check) — does what is written hold together as data. **The gatekeeper.**
- [`validate`](#validate) — is it sound as architecture. **A judgement, not a gate.**

They differ down to the type. `check`'s diagnostics carry `{code, severity}`; `validate`'s findings carry `{rule, level}`. The spellings differ and the two arrays cannot be concatenated. **Do not claim the building works because `check` is green.**

Every piece of output on this page was obtained by actually running it. Absolute paths are shortened to `<abs>`.

---

## check

> The gatekeeper of the build: composes the layers and checks structural consistency. Errors and warnings carry layer:line. Call it after every edit. **This says nothing about architectural soundness** — that is the validate tool

`file` only, required. **Call it after every edit.**

### When it is green

```text
{
 "ok": true,
 "spaces": 3,
 "boundaries": 3,
 "errors": [],
 "warnings": [],
 "diagnostics": []
}
```

| Field | Contents |
|---|---|
| `ok` | Whether `errors` is empty. **`warnings` do not make `ok` false** |
| `spaces` | How many spaces after composition |
| `boundaries` | How many boundaries **after derivation** |
| `errors` `warnings` | Arrays of strings carrying their provenance |
| `diagnostics` | The structured diagnostics. **The same count as `errors` plus `warnings`.** The order is scan order, and `errors` / `warnings` are that list split in two by severity — so **never concatenate them and match by index** |

**If you want to stop on warnings, look yourself.** There is no flag here corresponding to the CLI's `--strict`. Read `warnings.length` and decide.

### When there are warnings

```muro-warn
koyu 1.0
name 警告
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
```

```text
{
 "ok": true,
 "spaces": 3,
 "boundaries": 1,
 "errors": [],
 "warnings": [
  "<abs>/warn.muro:line 6: Level L1 has no slab:, so not one floor is generated on this storey"
 ],
 "diagnostics": [
  {
   "code": "SUF03",
   "severity": "warning",
   "message": "Level L1 has no slab:, so not one floor is generated on this storey",
   "line": 6,
   "file": "<abs>/warn.muro"
  }
 ]
}
```

`ok` stays `true`.

### When there are errors

```muro-bad
koyu 1.0
name 二重宣言
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
boundary /L1/a /L1/b t:120
boundary /L1/a /L1/b t:150
```

```text
{
 "ok": false,
 "spaces": 3,
 "boundaries": 2,
 "errors": [
  "<abs>/dup.muro:line 11: Duplicate boundary: /L1/a | /L1/b (first seen at <abs>/dup.muro:line 10)"
 ],
 "warnings": [],
 "diagnostics": [
  {
   "code": "BND02",
   "severity": "error",
   "message": "Duplicate boundary: /L1/a | /L1/b (first seen at <abs>/dup.muro:line 10)",
   "line": 11,
   "file": "<abs>/dup.muro",
   "path": [
    "/L1/a",
    "/L1/b"
   ],
   "related": [
    {
     "line": 10,
     "file": "<abs>/dup.muro"
    }
   ]
  }
 ]
}
```

**The strings in `errors` and the entries in `diagnostics` point at the same things.** The first is the human form with the position glued onto the front of the message; the second is the machine form. `errors` plus `warnings` has the same count as `diagnostics`, which comes out in scan order — so only when there are no warnings, as here, does the order of `errors` match the order of `diagnostics`. **An agent reads `diagnostics`.**

### The shape of a diagnostic

| Field | When it appears | Contents |
|---|---|---|
| `code` | always | Three letters plus two digits. There are 65 of them |
| `severity` | always | `"error"` or `"warning"` |
| `message` | always | The message alone. **No position prefix** |
| `line` | when the provenance is known | 1-based line number |
| `file` | when the provenance is known | Absolute path of the layer the declaration is in |
| `path` | when the subject is a space or zone | The subject paths |
| `related` | when the diagnostic has a counterpart | `{line, file}` for the other end |

**`severity` is an attribute of the code.** The same code is never an `error` sometimes and a `warning` other times. The table from a code to its cause and its fix is on [Diagnostic codes](../diagnostics/index.md).

**The order is scan order.** Nothing regroups them by code family. The same model always yields the same order.

### Syntax and composition errors do not arrive here

**When a file cannot be read, the syntax is broken, or the composition does not hold, no `check` result comes back at all.** The tool is treated as having thrown: the response carries `isError: true` and the message alone.

```text
<abs>/bad.muro:line 8: The region has zero width
```

**This is where it differs from [`koyu check --json`](../cli/check.md).** The CLI maps this onto a single `SYN01` diagnostic and still returns valid JSON; over MCP no `diagnostics` array comes back. The agent notices `isError`, reads the one line, and fixes it. The details are on [The protocol](protocol.md).

### What check does not say

`check` guarantees only that what is written holds together as data. **It has not looked at whether the building is usable.**

The default between touching spaces is a wall, and a wall is impassable without a door. So a building with no door written at all stays sealed and green.

```muro-fail
koyu 1.0
name 密封
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
```

```text
{
 "ok": true,
 "spaces": 3,
 "boundaries": 1,
 "errors": [],
 "warnings": [],
 "diagnostics": []
}
```

Hand the same file to `validate` and three violations come out.

---

## validate

> Architectural verdicts: daylight, envelope continuity, stair proportions, slopes, reachability, column/door collisions, and the site. **This is a different surface from the check guarantee** — findings carry rule/level, never code/severity. The surface grows and is not frozen

`file` only, required. Against the sealed building above:

```text
{
 "findings": [
  {
   "rule": "daylight.ratio",
   "level": "violation",
   "message": "Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)",
   "line": 7,
   "file": "<abs>/sealed.muro",
   "path": [
    "/L1/a"
   ]
  },
  {
   "rule": "access.unreachable",
   "level": "violation",
   "message": "Cannot reach the exterior: /L1/a (no passable boundary leads out — write a door)",
   "line": 7,
   "file": "<abs>/sealed.muro",
   "path": [
    "/L1/a"
   ]
  },
  {
   "rule": "access.unreachable",
   "level": "violation",
   "message": "Cannot reach the exterior: /L1/b (no passable boundary leads out — write a door)",
   "line": 8,
   "file": "<abs>/sealed.muro",
   "path": [
    "/L1/b"
   ]
  }
 ],
 "violations": 3,
 "cautions": 0,
 "note": "These are verdicts, not the structural-consistency guarantee of koyu check"
}
```

| Field | Contents |
|---|---|
| `findings` | The findings |
| `violations` | How many have `level` `"violation"` |
| `cautions` | How many have `level` `"caution"` |
| `note` | A fixed sentence saying this is not what `check` guarantees |

**No `ok` comes back.** This tool declares no pass or fail. Reading the counts and deciding is the caller's job.

### The shape of a finding

| Field | When it appears | Contents |
|---|---|---|
| `rule` | always | The rule name, spelled `family.name` — `daylight.ratio`, say |
| `level` | always | `"violation"` (it was not met) or `"caution"` (it is suspect) |
| `message` | always | The message alone; no position prefix |
| `line` `file` | when the provenance is known | The declaring line and layer |
| `path` | when the subject is known | The subject paths |

**`level` is an attribute of the rule.** The same rule never gets heavier or lighter with circumstance.

Violations and cautions mix freely in one response.

```muro-caution
koyu 1.0
name 窓の高さ
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 name:居室A daylight:1
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out name:外部 outside:1
boundary /L1/a /L1/b t:120
  door w:780 h:2000
boundary /L1/a /out t:150
  window w:2600 edge:S name:腰窓
boundary /L1/b /out t:150
  door w:900 h:2100 edge:S name:玄関
```

```text
{
 "findings": [
  {
   "rule": "daylight.ratio",
   "level": "violation",
   "message": "Insufficient daylight: /L1/a — effective window 0.00 m2 < required 2.31 m2 (1/7 of the 16.20 m2 floor)",
   "line": 7,
   "file": "<abs>/win.muro",
   "path": [
    "/L1/a"
   ]
  },
  {
   "rule": "daylight.unknown",
   "level": "caution",
   "message": "Window area is not fully counted: /L1/a has a window without h: (write h: on it)",
   "line": 7,
   "file": "<abs>/win.muro",
   "path": [
    "/L1/a"
   ]
  }
 ],
 "violations": 1,
 "cautions": 1,
 "note": "These are verdicts, not the structural-consistency guarantee of koyu check"
}
```

The window has no `h:`, so the effective window area could not be fully counted (`caution`), and what could be counted does not reach 1/7 (`violation`). **Both come out at once.**

### The rules that can come back

There are 15. `level` is fixed per rule.

| Rule | `level` | What it looks at |
|---|---|---|
| `daylight.ratio` | violation | Effective window area below one seventh of the floor |
| `daylight.unknown` | caution | A window with no `h:`, so the window area is not fully counted |
| `envelope.gap` | caution | A hole in the envelope — perimeter facing nothing |
| `stair.proportion` | caution | The derived steps are cramped |
| `run.slope` | caution | The derived slope is too steep, or outside normal use |
| `run.disconnected` | caution | A vertical run exists but no vertical boundary connects the storeys |
| `access.unreachable` | violation | A room with a region cannot reach the exterior |
| `access.voidonly` | violation | A door opens only onto a void |
| `access.throughtenant` | caution | Escape from a stair core passes through a tenancy |
| `access.parking` | violation | A car cannot get out of the parking |
| `access.backofhouse` | caution | A vertical run cannot be reached from the common corridor without crossing back-of-house |
| `column.blocksdoor` | violation | A derived column collides with a derived door |
| `site.escape` | violation | The building escapes the site shape |
| `site.area` | caution | The declared and derived site areas disagree |
| `site.frontage` | violation | Road frontage under 2 m |

Each one, read closely with its fix, is on [Judgement — koyu validate](../validate/index.md).

### This surface grows

**`validate`'s rules are not frozen.** Rules get added, and rules can be dropped. That is a different footing from `check`'s 65 diagnostic codes, which are a frozen surface.

So if you gate CI on a finding count, either **accept going red when a rule is added**, or filter by rule name.

## See also

- [Writing — write_layer / new_uids](tools-write.md) — the `check` carried in a `write_layer` result
- [Asking — doors / light / site / plan_svg](tools-ask.md) — the surface that returns numbers, not verdicts
- [The protocol](protocol.md) — why a syntax error comes back as `isError`
- [Diagnostic codes](../diagnostics/index.md) — 65 codes, their causes and their fixes
- [Judgement — koyu validate](../validate/index.md) — the 15 rules read closely
- [koyu check](../cli/check.md) — the CLI's `--json` and `--strict`
