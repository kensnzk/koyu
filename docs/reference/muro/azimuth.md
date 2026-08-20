---
title: azimuth — which way the model faces
mode: reference
---

# azimuth — which way the model faces

```text
azimuth Y <degrees>
```

`azimuth` gives the **true bearing of the model's +Y axis**: degrees clockwise from true north, `0 ≤ v < 360`.

```muro-part
azimuth Y 347.5
```

It is optional, and it is the half of the frame that is available first. A north arrow is on the survey drawing from the beginning of a project, long before there are coordinates to write in [`origin`](origin.md).

## It is a bearing, not a rotation

A bearing is read the way every bearing is read: clockwise, **from north to the thing**. `azimuth Y 347.5` says the +Y axis bears 347.5° — that is, 12.5° west of true north.

The alternative spelling, "the angle from +Y round to north", is a bearing measured backwards, and its natural reading is the negative of its definition. There is no sign here to get the wrong way round, and the bearing of every face falls out without one:

| Word | Face | True bearing |
|---|---|---|
| `N` | +Y | *a* |
| `E` | +X | (*a* + 90) mod 360 |
| `S` | −Y | (*a* + 180) mod 360 |
| `W` | −X | (*a* + 270) mod 360 |

The positional `Y` names what is being given a bearing, in the notation's own vocabulary — the same `Y` as [`grid Y`](grid.md). It is the only axis accepted; `azimuth X` would be a second spelling of one fact.

## `N` `E` `S` `W` do not change

They are still words about axes, exactly as [orientation](orientation.md) describes. `edge:N` selects the +Y face whether or not an `azimuth` is written, and it goes on doing so at any bearing.

**There is one place in koyu that holds a compass direction, and this is it.** The table above is arithmetic for whoever needs it, not a second meaning grafted onto the four letters.

Daylight does not read it either. The daylight coefficient turns on what lies beyond the window, not on which way the window looks — so writing an `azimuth` changes no number that [`koyu light`](../cli/light.md) reports.

## Out of range is refused, not folded

```text
azimuth is a bearing clockwise from true north, 0 <= v < 360: -12.5 (write 347.5)
```

`370` is not quietly read as `10`, and `-12.5` is not quietly read as `347.5` — the message says what to write instead and stops. Folding hides the mistake that produced the number. `360` is refused as well: it is a second spelling of `0`.

## Absent is not zero

A model with no `azimuth` does not have a bearing of zero. It **has no bearing**, and anything that needs one has to say the input is missing rather than assume.

`azimuth Y 0` is a claim: that +Y is true north. Files written before this line existed make no such claim, and they do not acquire one.

## What the value cannot protect you from

Magnetic declination in Japan runs from about 5° to 9.5° west — two orders of magnitude larger than any of the subtleties in [`origin`](origin.md). A bearing copied off a drawing whose arrow was magnetic north is a well-formed number in range, and no grammar catches it.

So the value is read back to you in words rather than left as a bare number, by `koyu site` and by the model summary, and the plan draws a north arrow when a bearing is declared. **A wrong quadrant or a reversed sign is caught by the drawing, and by nothing else.** The arrow is presentation and may change its look freely; the bearing it draws is what is written here.

## Declared once, in the layer that holds the survey

`azimuth` may be written in any layer, but only once across all of them.

```text
Duplicate azimuth: a model has one frame (first seen in site-geometry.muro at line 5)
```

**A model has one frame.** It belongs beside the site shape and the origin, in the file that holds what the survey gave.

It is neither overridable nor removable, and the tension there is real: which way is north is a survey given, but which way the building sits on the site is a design decision, so studying two rotations is a normal thing to want. Write two entry files carrying different `azimuth` lines and importing the same design layer. Comparing them is then comparing two files, which is what [`koyu diff`](../cli/diff.md) is for.

## In full

```muro
muro 1.4
name 方位の最小例
unit mm
grid X 0 3600 7200
grid Y 0 4500
level L1 0 h:2400 slab:150
azimuth Y 347.5
space /L1/a room X1..X2 Y1..Y2 daylight:1
space /L1/b room X2..X3 Y1..Y2 daylight:1
space /out name:外部 outside:1
boundary /L1/a /L1/b
  door w:800
boundary /L1/a /out edge:S
  window w:1600 h:1200
boundary /L1/a /out edge:N
boundary /L1/a /out edge:W
boundary /L1/b /out
```

`/L1/a`'s window is on the `S` face — the −Y side — so at a bearing of 347.5° it looks out along 167.5°, a little east of due south.

## Neighbouring pages

- [origin](origin.md) — the other half of the frame, and the meridian convergence
- [orientation](orientation.md) — `N` `E` `S` `W` and the `a` side
- [grid](grid.md) — the axes this bearing is about
- [koyu plan](../cli/plan.md) — draws the north arrow
- [koyu site](../cli/site.md) — reads the bearing back in words
