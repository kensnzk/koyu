---
title: Generating identity
mode: reference
---

# Generating identity

```ts
import { newUids } from "@kensnzk/koyu";

function newUids(model: Model, count?: number): string[]
```

Makes identity tokens (`uid`) that survive a rename.

## The path is identity; the uid is persistent identity

**A space's identity is its path.** Write `/L1/a` and that is the name, the reference and the hierarchy of aggregation. For most purposes that is enough.

A `uid` is needed **only when you want identity to survive a rename.** Renaming `/L1/a` to `/L1/study` looks, by path alone, like one space disappearing and another appearing. With the same `uid` on both sides, [`semanticDiff`](diff.md) reads it as a **rename**.

**Only `space` and `zone` may carry one.** Neither boundaries nor openings can: a boundary inherits its correspondence from the spaces at its ends, and an opening's identity comes from its container plus a name unique within it.

## The spelling

**The prefix `u-` plus 16 characters — 18 in all.**

The alphabet is lowercase Crockford base32 — `0123456789abcdefghjkmnpqrstvwxyz` — which has no `i`, `l`, `o` or `u`. **The `u` in the prefix is not in the alphabet**, so a generated uid contains exactly one `u`, at the front.

16 characters × 5 bits is **80 bits** of randomness.

The prefix exists to make **a token of digits alone structurally impossible**: an all-digit uid loses its distinctness the moment something converts it to a number (which is what `UID01` objects to). **The kind is not in the spelling** — a uid is opaque, and nothing should be readable from it.

## It is not derived

**Not from the path, and not from the contents of the model.** Derive it and a rename changes the token, which destroys the one thing a uid is for.

```ts
import { newUids } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/two-rooms.muro");
const [uid] = newUids(m);
console.log(uid, uid.length);
console.log(newUids(m, 3));
```

```text
u-8f46209ddmchp1s3 18
[ 'u-bhg27d8dj7t99yem', 'u-nx4qx6byyffnjn25', 'u-07ezg6wz054k33tk' ]
```

**They are random, so every run gives different tokens.** The output above is one such run.

`count` has to be a positive integer.

```ts
try { newUids(m, 0); } catch (e) { console.log((e as Error).name + ": " + (e as Error).message); }
```

```text
RangeError: count is a positive integer: 0
```

## The guarantee has two tiers

1. **No collision with this composed model.** Every existing `uid` in it (spaces and zones alike) is collected and checked before a token is returned, so this is certain.
2. **Collision with a layer not yet composed, or another repository, is only improbable.** With 80 bits of randomness, a million tokens collide with probability below 10⁻¹².

**When you need certainty, compose and check.** `UID03` is the only thing that actually proves uniqueness.

## Assigning one is a deliberate act

**No tool writes a uid unless this function is called.** Nothing is assigned automatically. You add one to the elements whose identity has to survive a rename, and to no others.

## Checking

Three diagnostics guard `uid`.

| Code | What it objects to |
|---|---|
| `UID01` | a uid of digits alone |
| `UID02` | a uid containing whitespace |
| `UID03` | a duplicate uid |

```ts
import { checkDiagnostics, parse } from "@kensnzk/koyu";

const bad = parse(`grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:12345
space /L1/b room X2..X3 Y1..Y2 uid:u-abc uid2:x`);
for (const d of checkDiagnostics(bad)) console.log(d.code, d.severity, d.message);
```

```text
ATT03 error /L1/b carries uid2:, which is not in the ledger (check the spelling, or add a namespace if the value is only carried — e.g. acme.uid2:x)
UID01 error A uid cannot be a token of digits alone: uid:12345 (write something like sp-12345)
```

**`u-abc` is not objected to.** The spelling `newUids` produces is a rule of generation, not a condition of acceptance — a short token written by hand passes as long as it is not all digits, contains no whitespace, and is not duplicated.

## Using it

```ts
import { newUids } from "@kensnzk/koyu";
import { parseFile } from "@kensnzk/koyu/node";

const m = parseFile("examples/house/main.muro");
const targets = ["/home/ldk", "/home/bed1"];
const uids = newUids(m, targets.length);

for (const [i, path] of targets.entries()) {
  console.log(`${path} → uid:${uids[i]}`);
}
```

Once the lines are written into the `.muro`, **compose and check** — that is where `UID03` proves uniqueness for the first time.

## See also

- [Semantic diff](diff.md) — where a uid is read as a rename
- [Writing spaces](../muro/space.md) — how to write `uid:`
- [Diagnostics reference](../diagnostics/uid.md) — fixing `UID01` through `UID04`
