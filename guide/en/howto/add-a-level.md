**English** · [日本語](../../howto/add-a-level.md)

# Add a level

Put an upper storey on a single-storey description, connect it with a stair, and confirm it with the section and with reachability.

The file paths in the output below are actually absolute; they are shortened to the file name for readability.

## Before you begin

- One storey of `.muro` passes `check` with zero errors.
- You know which file is the base layer (the entry) that declares `grid` and `level`. If you have split across several files, see [split-into-files.md](split-into-files.md).

## Steps

### 1. Add a `level` to the base layer

`level` is a consistency of the whole building, declared once by the base layer (the entry file). The positional `z` is millimeters from the datum, `h:` is the base ceiling height, and `slab:` is that level's floor-construction thickness.

```muro-part
level L1 0    h:2400
level L2 2900 h:2400 slab:500
level R  5800 slab:500
```

To bring the topmost storey into the height check as well, declare a topmost level that holds no space (`R`, say). Without it the top storey has no upper bound and passes with neither an error nor a warning.

For the exact definition see [spec/language.md §2](../../../spec/en/language.md).

### 2. Write the upper storey's spaces

If the first segment of the path is a level name, the space belongs to that level.

```muro-part
space /L2/bed  bedroom X1..X2 Y1..Y3 name:主寝室
space /L2/hall hall    X2..X3 Y2..Y3 name:2階ホール
```

When you use the idiom that does not put a level name in the path (writing the dwelling at the root, as in `/home/bed1`), state it with `level:`.

```muro-part
space /home/bed1 bedroom X1..X2 Y1..Y3 level:L2 name:主寝室
```

With neither `level:` written nor a level name at the head of the path, you get a warning.

```text
⚠ nolevel.muro:line 6: /home/a has a region, but its level cannot be determined (give it at the head of the path or with level:)
```

`check` still passes green (exit code 0) with this warning left in place, but `plan` cannot draw that storey and dies with a Node stack trace. Fix it while it is still a warning. Writing a path like `/L1/…` is not itself a declaration of a level — a separate `level L1 0` line is required.

### 3. Write a void with `void`

Where the ceiling of the lower storey is open, put a space of type `void` on the upper storey and write a `type:void` vertical boundary between it and the lower space.

```muro-part
space /L2/void void X2..X3 Y1..Y2 name:リビング上部

boundary /L1/ldk /L2/void type:void
```

A `void` is excluded from floor area and cannot be passed through.

### 4. Declare the stair as a vertical boundary

Vertical adjacency is derived from overlap in plan, and the default is "there is a floor". A stair is an exception to that, so it is declared — put a space on each storey and join them with a `type:stair` boundary.

```muro-part
boundary /L1/hall /L2/hall type:stair
```

When there are many storeys, declare them all at once with `stack`, which draws vertical boundaries across every consecutive level pair.

```muro-part
stack hall L1..L2 type:stair
```

A relation that spans levels belongs to no single storey's layer. If you have split across several files, put it in the base layer ([split-into-files.md](split-into-files.md)).

### 5. Write a door from each upstairs room to the stair space

The default between touching spaces is a wall, and a default wall carries no door, so it cannot be passed ([ADR-0014](../../../docs/decisions/0014-default-boundaries.md)). Merely adding a room upstairs leaves that room connected to nothing.

```muro-part
boundary /L2/bed /L2/hall t:120
  door w:800
```

## Confirming it

The following file is a two-storey building containing every step above.

```muro
koyu 0.4
name 二階建ての稽古
unit mm

grid X 0 3640 7280
grid Y 0 3640 7280

level L1 0 h:2400 slab:500
level L2 2900 h:2400 slab:500
level R  5800 slab:500

space /L1/ldk  ldk     X1..X2 Y1..Y3 + X2..X3 Y1..Y2 name:LDK
space /L1/hall hall    X2..X3 Y2..Y3 name:玄関・階段
space /L2/bed  bedroom X1..X2 Y1..Y3 name:主寝室
space /L2/hall hall    X2..X3 Y2..Y3 name:2階ホール
space /L2/void void    X2..X3 Y1..Y2 name:リビング上部
space /out exterior name:外部

boundary /L1/ldk /L1/hall t:120
  door w:800 edge:E
boundary /L1/hall /out edge:E t:150 spec:EW
  door w:900 name:玄関
boundary /L2/bed /L2/hall t:120
  door w:800

boundary /L1/hall /L2/hall type:stair
boundary /L1/ldk /L2/void type:void
```

`levels` returns how the floor heights stack up, as a section in text.

```text
$ npx tsx src/cli.ts levels two.muro
R	z:5800	slab:500
L2	z:2900	h:2400	slab:500
  ↑ storey height 2900 = ceiling 2400 + slab 500
L1	z:0	h:2400
  ↑ storey height 2900 = ceiling 2400 + slab 500
```

(`階高 … = 天井… + slab…` is "floor-to-floor = ceiling + slab".)

Whether the upper storey can be reached is answered by `doors`, which gives the fewest doors and the route from an upstairs room to the outside.

```text
$ npx tsx src/cli.ts doors two.muro /L2/bed /out
2 doors — /L2/bed → /L2/hall → /L1/hall → /out
```

## check can be green while the upper storey is unreachable

Forget to declare the vertical boundary and the upper storey passes `check` while floating free. What follows is the output of the same file with only the one line from step 4 removed.

```text
$ npx tsx src/cli.ts check two-sealed.muro
✔ Consistent — 6 spaces / 6 boundaries

$ npx tsx src/cli.ts doors two-sealed.muro /L2/bed /out
Cannot reach /out from /L2/bed
```

`check` looks at whether the composition stands up, not at whether the building can be used. Whenever you add a level, put it through `doors`.

Note that `doors` returns the same wording when the destination path does not exist. Suspect the spelling of the path first.

## When it collides with the storey above

When the ceiling height plus the slab thickness above exceeds the floor-to-floor height, it touches the height invariant (HGT01). Raise just the entrance hall's ceiling, for instance,

```muro-part
space /L1/hall hall X2..X3 Y2..Y3 name:玄関・階段 h:2600
```

and `check` says this.

```text
✖ /L1/hall collides into the floor above: ceiling height 2600 + L2's slab 500 = 3100 > storey height 2900
```

Lower the ceiling height, raise the `z` of `level L2` to make room, or thin the `slab:`. Only a lower storey under a full-height void (a coverage ratio of 99% or more) may declare a ceiling height that spans levels.

Forget the `slab:` on the upper level and not one floor is generated on that storey (the SUF03 warning). Drop its `h:` as well and the ceiling height cannot be determined, so neither ceiling nor roof is made (the SUF01 error). **The rules are deterministic and invent no default where a value is missing** — the sufficiency checks exist so that a shape coming out thin is never silent.

```text
⚠ house/main.muro:line 15: Level L2 has no slab:, so not one floor is generated on this storey
✖ house/L2.muro:line 3: The ceiling height of /home/bed1 cannot be determined (neither the space's h: nor level L2's h: is there)
```

## Related

- [The how-to index](README.md)
- [Doors and egress](doors-and-escape.md) — the check to run whenever you add a level
- [Six ideas](../concepts.md) — that the vertical default is a floor and the horizontal default is a wall
- [The diagnostic index](../diagnostics.md) — causes and fixes for HGT01/HGT02 (the height invariant) and SUF01–SUF04 (sufficiency)
- [spec/semantics.md](../../../spec/en/semantics.md) §3, vertical derivation and the height invariant — the normative definition
- [spec/language.md](../../../spec/en/language.md) §2 foundation declarations, §4 boundary — the grammar of `level`, `stack`, and vertical boundaries
- A worked two-storey building — `examples/house/` ([the gallery](../gallery.md))
