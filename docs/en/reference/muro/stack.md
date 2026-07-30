---
title: stack — carrying a vertical boundary across storeys
mode: reference
---

# stack — carrying a vertical boundary across storeys

A space that runs vertically through a building — a stair enclosure, a lift shaft, a void — otherwise forces the same relation to be written once per storey. `stack` **writes it once and carries it across every storey**.

```text
stack <name> <level range> type:stair|shaft|void [attributes...]
```

`<name>` is the **last segment of the path** and does not begin with `/`. The level range takes the form `L1..L11`, and `type:` is required.

```muro-part
stack st1 L1..L11 type:stair
stack st2 L1..L11 type:stair
stack ev  L1..L11 type:shaft
```

This says "draw one vertical boundary for every consecutive pair of levels". `stack ev L1..L3 type:shaft` is the same as these two lines.

```muro-part
boundary /L1/ev /L2/ev type:shaft
boundary /L2/ev /L3/ev type:shaft
```

## The type says topology and nothing else

Vertical adjacency defaults to a **floor**. Unless something is written, spaces stacked above one another have a slab between them. `stack` declares the exception, and there are only three.

| Type | Meaning |
|---|---|
| `stair` | Passable. Stairs, ramps and escalators all sit here |
| `shaft` | Continuous but not passable (a lift shaft, a duct) |
| `void` | No floor (a double-height void) |

**Vertical passability is carried by the single word `stair`.** A stair, a ramp and an escalator have the same topology, so the set of types does not grow. The difference between the devices lives on the space instead — `stair:`, `ramp:`, `escalator:`, `lift:` — as a rule for generating form ([vertical circulation](vertical-circulation.md)).

```text
✖ c.muro:line 13: A stack type is stair / shaft / void: undefined
✖ b.muro:line 11: A stack type is stair / shaft / void: floor
```

## Attributes are handed to every pair

Every `key:value` other than `type:` rides on all of the generated boundaries with the same value.

```muro-part
stack a L1..L3 type:stair spec:RC name:主階段
```

```json
{
  "between": ["/L1/a", "/L2/a"],
  "a": "/L1/a",
  "kind": "stair",
  "attrs": { "name": "主階段", "spec": "RC" }
}
```

A boundary's `name:` and `stack`'s first argument are different things: the first is the boundary's display name, the second is a segment of a space path.

## The spaces have to be there

`stack` makes boundaries, not spaces. If any level in the range lacks a `/Lk/<name>` space, `check` stops on the undefined space.

```text
✖ b.muro:line 11: References an undefined space: /L3/st
```

The spaces themselves fit on one line through [span expansion](#span-expansion), so the pair reads like this.

```muro-part
space /L1..L3/st stair X1..X2 Y1..Y2 name:stair use:common stair:N form:return
stack st L1..L3 type:stair
```

## stack does not survive

`stack` is expanded into ordinary `boundary` declarations while the file is parsed. **Neither the model nor the canonical JSON contains `stack`.** The one-line version and the hand-written pairs yield the same canonical JSON.

---

## Span expansion

The same level-range spelling `stack` uses also works as the **first segment** of a path on `space`, `zone` and `boundary`.

```muro-part
space /L2..L9/B unit X2..X3 Y1..Y2 name:"type B" use:exclusive
zone /L3..L10/A name:"type A" use:exclusive
boundary /L2..L9/A/ldk /L2..L9/A/hall t:100 spec:LGS
  door w:800 name:D
```

It exists so a typical floor is written once. **Only the first segment expands**; a `..` written further along the path stays literal.

### The order is by z, not by numbering

`L1..L2` expands to "every declared level whose z lies between the two ends, inclusive, in ascending z order". **Whether the names form a sequence is not consulted.**

```muro-part
level L1 0  h:2000 slab:200
level M1 2200 h:2000 slab:200
level L2 4400 h:2700 slab:300
space /L1..L2/a room X1..X2 Y1..Y2 name:room
```

That one line becomes **three** spaces: `/L1/a`, `/M1/a`, `/L2/a`. To leave the mezzanine out, split the range into two lines.

### How a range may be spelled

A level name must be letters followed by digits to take part in a span. A name with no digits — `R`, `PH` — cannot be an end of a range.

```text
✖ b.muro:line 11: Cannot read the level range: L1..R
```

Both ends must already be declared, and a backwards range is refused.

```text
✖ b.muro:line 11: The range includes an undeclared level (declare level first): L1..L9
✖ b.muro:line 11: The range runs backwards: L2..L1
```

### One line, one range

When a line takes two paths, as `boundary` does, both spans must be the same. "The A of floors 2 to 9 joined to the B of the ground floor" cannot be written.

```text
✖ b.muro:line 12: Level ranges on one line must agree: L1..L3, L1..L2
```

### Indented lines ride on every expansion

A `door`, `window`, `seg` or `area` indented under an expanded line attaches to **every expansion**. Write the door once and it rides on every storey.

```muro-part
boundary /L1..L3/a /L1..L3/b t:100 spec:LGS
  door w:800 name:D
```

Over three storeys, those two lines produce three boundaries and three doors.

### Spans do not survive either

Span expansion also happens while the file is parsed. The expanded paths are what appear in the canonical JSON; the `..` spelling does not.

---

## The two lines that make a vertical run

A space that runs vertically needs **both** a column of spaces and a column of relations. One without the other is not a way through.

```muro-part
space /L1..L3/st stair X1..X2 Y1..Y2 name:stair use:common stair:N form:return
space /L1..L3/ev shaft X2..X3 Y1..Y2 name:lift use:common lift:1

stack st L1..L3 type:stair
stack ev L1..L3 type:shaft
```

`stair:` and `lift:` on the space decide the form; `type:stair` and `type:shaft` on the `stack` decide the topology. **A form is no proof that the graph connects** — write only the form and leave out the `stack`, and `koyu validate` says so as `run.disconnected`.

Relations that cross storeys belong to no single storey's layer, so when the building is split across files they naturally sit in the entry ([import](import.md)).

## See also

- [Vertical circulation](vertical-circulation.md) — `stair:` `ramp:` `escalator:` `lift:` and how form is derived
- [boundary](boundary.md) — declaring boundaries, horizontal and vertical types
- [space](space.md) — declaring spaces and paths
- [import](import.md) — which layer the cross-storey relations belong in
