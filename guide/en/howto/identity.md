**English** · [日本語](../../howto/identity.md)

# Making something pointable across a rename (uid and name)

Paths change. Rename, reorganise the hierarchy, split or merge, and every sensor, BEMS, or register that used the path as a foreign key loses its correspondence. **Add identity only where a reference has to outlive the path.**

The file paths in the sample output below are absolute in reality; the leading directories are shortened here for readability.

The norm is [spec/en/scope.md §5](../../../spec/en/scope.md); the reasons behind the decisions are [ADR-0015](../../../docs/decisions/0015-identity-uid.md) and [ADR-0039](../../../docs/decisions/0039-identity-generation.md).

## Before you start

- A `.muro` that passes `check` with zero errors.
- **It is not required.** A space without one corresponds by path. Write one only on the spaces that must be pointed at across time.

## Steps

### 1. Know where it can be written

`uid:` may be written on **`space` and `zone`, and nothing else**. That list is closed.

```muro
koyu 1.0
name 事務所
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2700 slab:150

space /L1/office room X1..X2 Y1..Y2 uid:u-7f3k9m2qx4b8dhtv
space /L1/meeting room X2..X3 Y1..Y2
space /out exterior

boundary /L1/office /L1/meeting t:120
  door w:900 h:2000 name:D1
boundary /L1/office /out t:150
  door w:900 h:2100 edge:S name:ENT
```

Writing `uid:` on a boundary, an opening, a `seg`, an `area`, a column, or an asset is an error. **It is never silently ignored.**

```muro-bad
grid X 0 3600
grid Y 0 4500
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out exterior
boundary /L1/a /out t:150 uid:bd-1
  door w:900 h:2100 edge:S
```

```text
✖ …/bad.muro:line 6: boundary /L1/a | /out carries uid:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.uid:bd-1)
```

The identity of a relation is derived from the spaces at its two ends, so a boundary needs no uid. The identity of an opening or a column is carried by `name:` ([step 5](#5-openings-and-columns-are-pointed-at-by-name)).

### 2. Make a token

**You may write one yourself.** Only digits-only tokens and whitespace are forbidden (UID01 / UID02), so a readable spelling such as `sp-ldk-north` is fine.

**To have a machine make one, take a random token.** From an agent (MCP), call `new_uids`.

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"new_uids","arguments":{"file":"main.muro","count":2}}}
```

```text
{
 "uids": [
  "u-0qf4x7f0j0kzm8yq",
  "u-c4aa7yn1ew091p9f"
 ],
 "note": "Write these as uid: on a space or zone. …"
}
```

The same thing is on the public API for programs.

```ts
import { newUids } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const model = parseFile("main.muro");
const [uid] = newUids(model);
```

**The tokens that come back collide with nothing in that model.** Non-collision with layers not composed here, or with another repository, is a probabilistic guarantee resting on 80 bits of randomness — so run `check` after writing them in. UID03 is the only thing that actually proves uniqueness ([spec/en/scope.md §5.2](../../../spec/en/scope.md)).

**No tool assigns a uid on its own.** Not even `write_layer`. Assignment is an explicit act.

### 3. Rename it, and confirm the correspondence survives

Rename `/L1/office` to `/L1/studio` and take a `koyu diff`.

```text
renamed /L1/office → /L1/studio (uid:u-7f3k9m2qx4b8dhtv)
```

**It is reported as a rename of the same space.** Without the uid, the same edit reads like this.

```text
+ space /L1/studio (room 16.20 m2)
− space /L1/office (room 16.20 m2)
+ boundary /L1/meeting | /L1/studio (wall t:120)
+ boundary /L1/studio | /out (wall t:150)
− boundary /L1/meeting | /L1/office
− boundary /L1/office | /out
```

A space disappears and another grows, and the boundaries disappear and grow with it. If an outside register held `/L1/office`, that row is now dangling.

### 4. A uid never moves by itself

**Do not rewrite the uid when you rename.** Whether it is still the same space after the rename is a design decision that no geometry and no name determines mechanically, and the act of carrying the uid across is the record of that decision.

- **Split** — the main part keeps it; the other receives a new uid
- **Merge** — the surviving side keeps it

Be responsible for identity, not for content.

### 5. Openings and columns are pointed at by `name:`

An opening, a `seg`, an `area`, and a column cannot carry a uid. Their identity is derived from **the containing subject plus a name unique within it**.

```muro-part
boundary /L1/office /L1/meeting t:120
  door w:900 h:2000 name:D1
```

That name is what the set edits of composition point at.

```muro-part
over /L1/office /L1/meeting
  = door D1 w:1000
```

The name has to be unique **within the containing subject**. If it points at two things, UID04 fails the build ([diagnostics.md](../diagnostics.md#uid04)).

A name inherited from an asset does not count. The `name` in `asset W1 window … name:掃き出し窓` is the type's name, so putting the same product twice on one wall is not a collision.

### 6. Move a named opening and it shows up as a move

Move `door D1` to `at:X2-1200` and take a `koyu diff`.

```text
± boundary /L1/meeting | /L1/office: door D1 at 0.5 → X2-1200
```

Without the name, the same edit reads as one thing disappearing and another growing. **Writing the name is the declaration of identity.**

## Where it trips

| Symptom | Cause |
|---|---|
| `uid:0123` is an error | An attribute value shaped like a number becomes a number, which loses the distinction between the tokens written (UID01). Mix in something that is not a digit, as in `uid:sp-0123` |
| `uid:` is written but it errors | It can only be written on `space` and `zone` (ATT03). On `level` it is a syntax error |
| `acme.uid:` passes but `diff` detects no rename | A namespaced key is the carried tier, and core never looks at it ([spec/en/scope.md §7](../../../spec/en/scope.md)) |
| `= window W1` fails with "not unique" | One boundary holds two openings of the same name. UID04 under `check` says the same thing |
| A uid collides with another layer under `import` (UID03) | Decide a prefix per layer, or let `new_uids` make them |

---

See also: [split-into-files.md](split-into-files.md) (splitting into layers) · [agent-mcp.md](agent-mcp.md) (using MCP) · [concepts.md §4](../concepts.md) (a path playing three roles)
