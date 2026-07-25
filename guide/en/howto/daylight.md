**English** · [日本語](../../howto/daylight.md)

# Cut windows and pass the daylight test

Write windows into habitable rooms and pass the 1/7 test in `light` (effective window area ≥ floor area / 7).

The file paths in the output below are actually absolute; they are shortened to the file name for readability.

## Before you begin

- `check` passes with zero errors.
- You know the type (the second positional of `space`) of the space you want to cut a window into.

## Steps

### 1. Confirm that the space is in scope

What `light` looks at are spaces whose type is `unit`, `room`, `ldk`, `bedroom`, or `living`. The type is an open vocabulary, and any other word (`wet`, `hall`, `corridor`, `shop`, …) silently falls out of scope. Write a bathroom as `room` and it enters the test; write it as `wet` and it does not — neither is an error.

To add to or remove from the scope without changing the type, use `hab:`. `hab:1` adds, `hab:0` excludes.

```muro-part
space /L1/a room X1..X2 Y1..Y2 name:居室A hab:0        # type stays room, out of scope
space /L1/b wet  X2..X3 Y1..Y2 name:洗面脱衣 hab:1     # type stays wet, in scope
```

### 2. Write a `window` on a boundary facing outside

A window is counted only when the other side of its boundary is the outside (`type:exterior`) or a semi-outdoor space. A window between two rooms is not counted toward daylight (it is treated as 0).

```muro-part
boundary /L1/a /out t:150 spec:EW
  window w:2600 h:2200 edge:S name:掃き出し窓
```

### 3. Write both `w:` and `h:`

The width `w:` is grammatically required; without it the file stops at load time.

```text
✖ daylight.muro:16行目: window には幅 w:(mm) が要ります (アセット側でも可)
```

("A window needs a width w:(mm) — it may come from the asset.")

The height `h:` is grammatically optional, but `light` counts only windows that carry `h:`. A window that has lost its `h:` is treated as an area of 0 without erroring.

When a window has no `h:`, `light` puts a note at the end of the line.

```text
✖ /L1/a	居室A	窓 0.00㎡ / 床 16.20㎡ = 窓なし (必要 1/7 ≈ 2.31㎡) ⚠ h未指定の窓は数えていません
```

(`窓なし` is "no windows"; the note reads "windows with no h: were not counted".)

If you reference an opening asset, the `h:` may live on the asset ([spec/language.md §6](../../../spec/en/language.md)).

### 4. When the perimeter splits into several segments, select the side with `edge:`

A boundary with a space that has no region (`/out` and the like) is what remains of the room's perimeter once the intervals shared with other spaces are removed, and it usually splits across several edges. Which edge to place on is specified with `edge:N/E/S/W`. The compass is N = +Y (north), S = −Y (south), E = +X (east), W = −X (west), read from the rectangle of the a side (the space written first on the boundary line).

Place an opening on a multi-segment boundary without writing `edge:` and `check` says this.

```text
✖ daylight.muro:16行目: 境界線分が複数あります。edge:N/E/S/W で辺を指定してください (/L1/a | /out)
```

## Confirming it

Run `light`. The exit code is 0 if every room passes and 1 if even one falls short.

Both rooms in the following file pass.

```muro
koyu 0.3
name 採光の稽古
unit mm

grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400

space /L1/a room X1..X2 Y1..Y2 name:居室A
space /L1/b room X2..X3 Y1..Y2 name:居室B
space /out exterior name:外部

boundary /L1/a /L1/b t:120
  door w:780 h:2000
boundary /L1/a /out t:150 spec:EW
  window w:2600 h:2200 edge:S name:掃き出し窓
boundary /L1/b /out t:150 spec:EW
  door w:900 h:2100 edge:S at:X2+900 name:玄関
  window w:2600 h:1100 edge:E name:腰窓
```

```text
$ npx tsx src/cli.ts light daylight.muro
✔ /L1/a	居室A	窓 5.72㎡ / 床 16.20㎡ = 1/2.8 (必要 1/7 ≈ 2.31㎡)
✔ /L1/b	居室B	窓 2.86㎡ / 床 16.20㎡ = 1/5.7 (必要 1/7 ≈ 2.31㎡)
✔ 全2室が 1/7 を満たします (補正係数なしの粗い判定)
```

Read a line from the left: the verdict (✔/✖), the space path, the name, the effective window area **after the coefficient**, the floor area, their ratio, and the required area. A room with no windows at all shows `窓なし` ("no windows"). The last line reads "all 2 rooms satisfy 1/7 — a coarse test with no correction factors".

The same two rooms with their windows dropped look like this.

```text
✖ /L1/a	居室A	窓 0.00㎡ / 床 16.20㎡ = 窓なし (必要 1/7 ≈ 2.31㎡)
✖ /L1/b	居室B	窓 0.00㎡ / 床 16.20㎡ = 窓なし (必要 1/7 ≈ 2.31㎡)
✖ 2室中 2室が不足しています
```

("2 of 2 rooms fall short.")

## Taking light through a semi-outdoor space

A window that borrows light across a balcony, a terrace, or a garden takes a coefficient. **It is 0.7 if a space overlaps that semi-outdoor space from above**, and 1.0 if it is open above. Even the presence of a roof is derived rather than declared, so the moment you add a balcony upstairs the coefficient downstairs drops.

A full-height window (2600×2200 = 5.72 m²) across a terrace that is open above is counted at the full 5.72 m².

```muro
koyu 0.3
name 半屋外越しの採光
unit mm

grid X 0 4000
grid Y 0 4000
level L1 0 h:2400

space /L1/liv living  X1..X2 Y1..Y2      name:居間
space /L1/bal balcony X1..X2 Y1-1500..Y1 name:テラス
space /out exterior name:外部

boundary /L1/liv /L1/bal t:100 spec:サッシ
  window w:2600 h:2200
boundary /L1/bal /out edge:S t:120 spec:手すり air:1 h:1100
```

```text
✔ /L1/liv	居間	窓 5.72㎡ / 床 16.00㎡ = 1/2.8 (必要 1/7 ≈ 2.29㎡)
```

Add an upstairs balcony in the same position and the terrace becomes covered above, taking the 0.7. Neither the window nor the floor has been changed at all.

```muro
koyu 0.3
name 半屋外越しの採光
unit mm

grid X 0 4000
grid Y 0 4000
level L1 0 h:2400
level L2 2900 h:2400 slab:500
level R 5800 slab:500

space /L1/liv living  X1..X2 Y1..Y2      name:居間
space /L1/bal balcony X1..X2 Y1-1500..Y1 name:テラス
space /L2/bal balcony X1..X2 Y1-1500..Y1 name:上階バルコニー
space /out exterior name:外部

boundary /L1/liv /L1/bal t:100 spec:サッシ
  window w:2600 h:2200
boundary /L1/bal /out edge:S t:120 spec:手すり air:1 h:1100
boundary /L2/bal /out edge:S t:120 spec:手すり air:1 h:1100
```

```text
✔ /L1/liv	居間	窓 4.00㎡ / 床 16.00㎡ = 1/4.0 (必要 1/7 ≈ 2.29㎡)
```

Note that a space is judged semi-outdoor when it has a region and carries an `open` or `air:1` boundary with the outside. A balcony whose railing (`air:1`) was forgotten is not semi-outdoor, and a window taken across it counts as 0.

## When it falls short

A `✖` line prints the required area outright (`必要 1/7 ≈ …㎡`, "requires 1/7 ≈ … m²"). Until the effective window area reaches it, take one of the following.

- Make the window larger, or add more of them. The effective window area is the sum over the windows on every boundary touching that space.
- If it is across a semi-outdoor space, move the window onto a boundary that faces the outside directly (the coefficient becomes 1.0).
- If the room is not a habitable room, correct the type or attach `hab:0`.

`light` is a coarse early warning that applies no correction factors, not a verdict of regulatory compliance ([spec/semantics.md §6](../../../spec/en/semantics.md)). The 1/7 ratio comes from the Japanese Building Standards Act.

## Related

- [The how-to index](README.md)
- [Six ideas](../concepts.md) — that the type is an open vocabulary, and that semi-outdoor is derived
- [The cheat sheet](../cheatsheet.md) — the attributes a `window` may carry
- [spec/semantics.md](../../../spec/en/semantics.md) §4 derived properties, §6 light — the normative definitions
- [spec/vocabulary.md](../../../spec/en/vocabulary.md) — the attribute contract for `window` and `space`
- [ADR-0007](../../../docs/decisions/0007-semi-outdoor-air.md) — why semi-outdoor is derived from `air:1`
- Worked examples — `examples/house/` (across a garden, coefficient 1.0) and `examples/tower/` (across a balcony, coefficient 0.7); see [the gallery](../gallery.md)
