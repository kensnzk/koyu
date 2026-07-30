---
title: Identity — uid
mode: reference
---

# Identity — uid

Being able to point, today, at the same space a sensor bound three years ago. **That is what a uid is for.**

```muro-part
space /L5/A/ldk ldk X1..X2 Y1..Y2 name:LDK uid:u-7f3k9m2qx4b8dhtv
```

## What carries identity

| Subject | Where identity comes from |
|---|---|
| **A space or zone with a uid** | **the uid is authoritative.** Rename the path and it is still the same thing |
| **A space or zone without one** | matched by path. Rename it and the correspondence is cut |
| **A relation (boundary)** | **derived from its two ends.** A relation cannot carry a uid |
| **Openings, `seg`s, `area`s, columns** | derived from their container plus a name unique inside it ([UID04](diagnostics/uid.md) rejects duplicates). The container is the boundary for openings and `seg`s, the space for `area`s, and the whole model for columns |

**A relation cannot carry a uid because a relation always lies between two spaces.** Fix both ends and the relation is fixed. Writing a uid per relation would make relations outnumber spaces, which cuts away the very goal — that one building fits in a machine's field of view.

> **Take responsibility for identity, not for content.**

## A uid is not required

**It is optional so that the writer can choose the strength of the guarantee.** Attach one only to the spaces that must be pointed at across time. Inside the repository, paths are enough. A uid is what you need when binding to a ledger or a sensor outside.

## The set of things that may carry one is closed

**Only `space` and `zone` may carry `uid`, and that list is closed.**

- On any other element it is [ATT03](diagnostics/att.md) — a key not in the ledger
- On a `level` it is a syntax error

**There is no path by which it is silently ignored.**

Namespaced, `acme.uid:` can be written — but that is the [carried tier](scope.md), which core does not read. **It does not amount to having given the thing identity.**

## Spelling

```text
u-7f3k9m2qx4b8dhtv
```

The prefix `u-` plus 16 characters, 18 in all. The alphabet is lowercase Crockford base32, which omits the confusable `i`, `l`, `o` and `u`. **The `u` of the prefix is not in the alphabet**, so a generated uid contains exactly one `u` and it is the first character.

16 characters × 5 bits = **80 bits**.

The prefix exists to make an all-digit spelling **structurally impossible** (numeric coercion would lose the distinction between tokens, so an all-digit uid is rejected by [UID01](diagnostics/uid.md)). Whitespace cannot be written either.

**The kind is not encoded in the spelling.** A uid is opaque; nothing should be readable from it.

## Generated at random, attached deliberately

**A uid is derived neither from the path nor from the content of the model.** Derive it and a rename changes the token, which destroys the very meaning of a uid — surviving renames. When a machine makes one, it is **random**.

```ts
import { newUids } from "@kensnzk/koyu";
const [a, b] = newUids(model, 2);
```

Over MCP, `new_uids`.

**Attaching one is a deliberate act.** Until the writer writes it or calls `newUids` / `new_uids`, **no tool writes a uid.** `write_layer` does not either. Nothing attaches one on its own, so you call it exactly when the need to point across a rename arises.

## How far "no collision" reaches

**The guarantee has two tiers.** They must not be conflated.

| Against | Guarantee |
|---|---|
| **A composed model** | **no collision.** The generator checks as it builds, and `check`'s [UID03](diagnostics/uid.md) proves it |
| **Layers not yet composed, other repositories** | **probabilistic only.** At 80 bits, a million tokens still collide with probability below 10⁻¹² |

**If you need certainty, compose and run `check`.** UID03 is the only thing that actually proves uniqueness.

## A name must point at one thing

Since identity is "container plus a name unique inside it", **one name pointing at two things is a break in identity.** A set edit during composition (`= window W1` / `- column C1`) has no way to decide which one it means.

This is checked ([UID04](diagnostics/uid.md)) and also refused on the composition side. A `drop` or `=` aimed at an ambiguous name **refuses** rather than silently picking one.

**A name inherited from an asset is not a claim of identity.**

```muro-part
asset W1 window w:2600 h:2200 sill:0 name:掃き出し窓
```

That `name` names a type, and putting two of the same unit into one wall is ordinary design. **The only claim of identity is a name written on the opening's own line.**

## Neighbouring pages

- [Scope](scope.md) — why uniqueness of identity is one of the guarantees
- [Stability](stability.md) — identity is one of the frozen surfaces
- [name](muro/name.md) — how names are written
- [space](muro/space.md) / [zone](muro/zone.md) — the two that may carry a uid
- [UID diagnostics](diagnostics/uid.md) — UID01–04
- [over / drop](muro/over-drop.md) — composition that targets by name
