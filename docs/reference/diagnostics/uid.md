---
title: UID — identity
mode: reference
---

# UID — identity

There are four UID codes. All are errors.

| Code | Severity | What it says |
|---|---|---|
| UID01 | error | The `uid` is a token of digits alone |
| UID02 | error | The `uid` contains whitespace (or is empty) |
| UID03 | error | The `uid` is duplicated |
| UID04 | error | A `name` is duplicated within one container |

**There are two kinds of identity here**, and once you see that, the four codes split into two.

- **`uid`** — an **opaque token** written on a `space` or a `zone`. It is unique across the whole model and exists so you can say "this is the same thing" after changing a path. `koyu diff`'s rename detection reads it. UID01–UID03 guard it.
- **`name`** — the identity of an opening, a `seg`, an `area` or a column. None of these has a path of its own, so their identity is **the container plus a name unique inside it**. UID04 guards that.

## UID01 — a uid cannot be a token of digits alone

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:0123
```

```text
A uid cannot be a token of digits alone: uid:123 (write something like sp-123)
```

**Cause** — an attribute value shaped like a number is kept as a number. Write `0123` and you get `123` — which is exactly what the message is showing you; the leading zero is already gone. A token that has lost the distinctions you wrote into it cannot carry identity.

**Fix** — mix in something that is not a digit. A prefix is the easy way.

```muro
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:sp-0123
```

## UID02 — a uid cannot contain whitespace

`error`

```muro-bad
grid X 0 3600
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:"sp 1"
```

```text
A uid cannot contain whitespace: "sp 1"
```

**Cause** — quoting lets a value contain whitespace, but a `uid` is an opaque token and does not allow it. An empty value (`uid:""`) is refused on the same line.

**Fix** — replace the whitespace with a hyphen or an underscore (`uid:sp-1`).

## UID03 — a duplicate uid

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2 uid:sp-1
space /L1/b room X2..X3 Y1..Y2 uid:sp-1
```

```text
Duplicate uid: sp-1 (space /L1/a — <absolute path>/bad.muro:line 4, space /L1/b — <absolute path>/bad.muro:line 5)
```

**Cause** — the same `uid` appears twice. **Uniqueness spans `space` and `zone`**: a space and a zone carrying the same token is also a duplicate. Copying a line and forgetting to change the `uid` is how this arrives.

The message lists every origin with its kind, and `related` carries the same positions.

**Fix** — change one of them to another token.

If you compose several files with `import`, deciding a prefix per layer prevents most of these (`sp-` / `w2-` / `ext-`). If a machine is writing them, `koyu-mcp`'s `new_uids` and the API's `newUids` return tokens that do not collide.

## UID04 — a duplicate name within one container

`error`

```muro-bad
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
space /L1/a room X1..X2 Y1..Y2
space /out outside:1
boundary /L1/a /out t:150
  window w:1200 h:1100 edge:S at:0.25 name:W1
  window w:1200 h:1100 edge:S at:0.75 name:W1
```

```text
Duplicate opening name within boundary /L1/a | /out: W1 (<absolute path>/bad.muro:line 7, <absolute path>/bad.muro:line 8) — the name is what identifies it inside its container
```

**Cause** — an opening, a `seg`, an `area` and a column all lack a path of their own, so their identity can only be "a name unique inside the container". If one name points at two elements, `= window W1` cannot say which to replace and `- window W1` cannot say which to delete. **koyu does not guess; it refuses on the spot.**

Four things are checked, each with a different container.

| Element | Container | How the message names it |
|---|---|---|
| Opening (`door` / `window`) | its boundary | `within boundary /L1/a \| /out` |
| `seg` | its boundary | `within boundary /L1/a \| /out` |
| `area` | its space | `within space /L1/a` |
| `column` | the whole model | `within the model` |

Only columns take the whole model as their scope. A column belongs to neither a boundary nor a space; it is declared with a size, storeys and grid lines alone.

**Elements with no name are not in the population.** They assert no identity, so any number of them can sit side by side.

**A name inherited from an asset does not count.**

```muro
grid X 0 3600 7200
grid Y 0 4000
level L1 0 h:2400 slab:150
asset W1 window w:1200 h:1100 name:掃き出し窓
space /L1/a room X1..X3 Y1..Y2
space /out outside:1
boundary /L1/a /out t:150
  window W1 edge:S at:0.25
  window W1 edge:S at:0.75
```

The `name` on `asset W1 … name:掃き出し窓` is **the name of a type**, not a claim made by either opening. Putting the same unit twice in one wall is no collision. The file above is green.

**Fix** — change one of the names (`name:W1-e` / `name:W1-w`). If you never need to point at them individually, do not write `name:` at all.

## Related

- [ATT — attributes](./att.md) — the key and value checks that cover `uid` and `name`
- [ZON — zones](./zon.md) — the other thing that can carry a `uid`
- [koyu check](../cli/check.md)
