---
title: Survive a rename (uid and name)
mode: howto
---

# Survive a rename (uid and name)

Paths change. Rename, restructure, split or merge, and every sensor, BMS point or register keyed on the old path is orphaned. **Add identity only where a reference has to outlive the path.**

File paths in the output below are absolute when you actually run these commands. They are shortened to bare filenames here for readability.

## Before you start

- A `.muro` that passes [`koyu check`](../reference/cli/check.md) with zero errors.
- **This is not required.** Spaces without it are matched by path. Write it only on the spaces you need to point at across time.

## 1. Know where it may be written

`uid:` may be written on **`space` and `zone`, and nothing else**. That list is closed.

```muro
koyu 1.0
name Office
unit mm

grid X 0 6400 12800
grid Y 0 8400
level L1 0 h:2800 slab:400
level R 3200 slab:400

space /L1/office room X1..X2 Y1..Y2 name:Office uid:u-7f3k9m2qx4b8dhtv
space /L1/meeting room X2..X3 Y1..Y2 name:Meeting-room
space /out name:Outside outside:1

boundary /L1/office /L1/meeting t:120 spec:LGS
  door w:900 h:2000 name:D1
boundary /L1/office /out edge:W t:200 spec:RC
  window w:2400 h:1800 name:W1
boundary /L1/meeting /out edge:E t:200 spec:RC
  door w:1800 h:2100 name:Front-entrance
```

Write `uid:` on a boundary, an opening, a `seg`, an `area`, a column or an asset and it errors. **It is never silently ignored.**

```text
✖ bad-uid.muro:line 14: boundary /L1/office | /L1/meeting carries uid:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.uid:bd-1)
```

**A relation's identity comes from the spaces at its two ends, so a boundary needs no uid.** Openings and columns are identified by `name:` ([step 5](#5-point-at-openings-and-columns-with-name)).

## 2. Make the token

**You may write it yourself.** Only two shapes are forbidden — all digits, and whitespace — so a readable token like `sp-ldk-north` is fine.

```text
✖ numeric.muro:line 10: A uid cannot be a token of digits alone: uid:123 (write something like sp-123)
```

An attribute value shaped like a number becomes a number, and the token you typed loses its distinctness. Mix in something that is not a digit.

**To have a machine make them, take random tokens.** From an agent, call the MCP tool `new_uids` ([write tools](../reference/mcp/tools-write.md)).

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"new_uids","arguments":{"file":"main.muro","count":2}}}
```

```json
{
 "uids": [
  "u-92r9rzs4r9sqgv42",
  "u-j2dnk4pmg2z6f8dq"
 ],
 "note": "Write these as uid: on a space or zone. No other element accepts uid (the ledger rejects it). A uid is carried across renames by hand — that act is the record of the design decision that it is still the same space"
}
```

The same thing is on the public API ([identity API](../reference/api/identity.md)).

```ts
import { newUids } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("main.muro");
const [uid] = newUids(model);
```

**The tokens that come back do not collide inside that model.** Not colliding with a layer that has not been composed yet, or with another repository, is a probabilistic guarantee from 80 bits of randomness — so run `check` after writing them. UID03 is the only thing that actually proves uniqueness.

```text
✖ Duplicate uid: u-7f3k9m2qx4b8dhtv (space /L1/office — dup.muro:line 10, space /L1/meeting — dup.muro:line 11)
```

**No tool assigns a uid on its own.** The MCP `write_layer` tool does not either. Assignment is an explicit act.

## 3. Rename, and see that the correspondence held

Rename `/L1/office` to `/L1/studio`, change its name too, and take a [`koyu diff`](../reference/cli/diff.md).

```text
$ npx tsx src/cli.ts diff a.muro b.muro
renamed /L1/office → /L1/studio (uid:u-7f3k9m2qx4b8dhtv)
± /L1/studio: name Office → Studio
```

**It is reported as one space being renamed.** Without the uid, the same edit reads:

```text
+ space /L1/studio (room 53.76 m2)
− space /L1/office (room 53.76 m2)
+ boundary /L1/meeting | /L1/studio (wall t:120)
+ boundary /L1/studio | /out edge:W (wall t:200)
− boundary /L1/meeting | /L1/office
− boundary /L1/office | /out edge:W
```

The space dies and is reborn, and its boundaries with it. Any external register holding `/L1/office` is now pointing at nothing.

## 4. A uid never moves by itself

**Renaming does not rewrite the uid.** Whether the thing after the rename is still the same space is a design judgement that no geometry or spelling settles mechanically, and **carrying the uid across is itself the record of that judgement.**

- **Split** — the main part keeps it; the other part takes a new one.
- **Merge** — the surviving space keeps it.

It is responsible for identity, never for content.

## 5. Point at openings and columns with `name:`

Openings, `seg`, `area` and columns take no uid. Their identity is derived from **the container plus a name unique within it**.

```muro-part
boundary /L1/office /L1/meeting t:120 spec:LGS
  door w:900 h:2000 name:D1
```

**That name is what a set edit in composition points at.**

```muro-part
over /L1/office /L1/meeting
  = door D1 w:1000
```

A name must be unique **within its container**. Pointing at two things fails.

```text
✖ twoname.muro:line 18: Duplicate opening name within boundary /L1/office | /out: W1 (twoname.muro:line 17, twoname.muro:line 18) — the name is what identifies it inside its container
```

A name inherited from an asset does not count. The `name` on `asset W1 window … name:Sliding-window` is the name of a type, so two of the same unit in one wall do not collide.

## 6. Move a named opening and it reads as a move

Move `door D1` to `at:X2-1200` and take a `diff`.

```text
± boundary /L1/meeting | /L1/office: door D1 at 0.5 → X2-1200
```

Without a name the same edit reads as a deletion and an insertion. **Writing the name is the declaration of identity.**

## Where it goes wrong

| Symptom | Cause |
|---|---|
| `uid:0123` errors | an attribute value shaped like a number becomes a number and loses the token's distinctness; write `uid:sp-0123` |
| `uid:` errors even though it looks right | only `space` and `zone` accept it; on a `level` it stops at read time |
| `acme.uid:` passes but `diff` sees no rename | a namespaced key is only carried; `diff` does not read it as identity |
| `= window W1` fails as "not unique" | two openings share a name on one boundary; `check`'s UID04 says the same |
| uids collide with another layer at `import` | choose a prefix per layer, or let `new_uids` mint them |

A namespaced key passes `check` and does no identity work.

```text
$ npx tsx src/cli.ts check ns.muro
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately

$ npx tsx src/cli.ts diff ns.muro ns2.muro
+ space /L1/studio (room 53.76 m2)
− space /L1/office (room 53.76 m2)
```

The three tiers of attribute — structural, interpreted and carried — are set out in [attributes](../reference/muro/attributes.md).

## Next

- [Split a building into layers](split-into-layers.md) — names are what set edits point at
- [Write a typical floor once](typical-floors.md) — pointing at the same element from another layer
