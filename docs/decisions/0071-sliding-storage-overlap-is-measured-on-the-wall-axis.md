# ADR-0071 — Sliding storage and apertures are compared on the wall axis

Date: 2026-08-24 / Status: adopted / Origin: a parked sliding leaf could cover a second opening
without either written aperture overlapping the other

## Context

The first opening-operation rule measures a parked leaf on the room face of its wall. Another
opening is represented on the wall axis. Comparing those two drawn lines in two dimensions would
always miss: they are intentionally parallel and separated by half the wall thickness plus the
shape probe. Thickening a presentation line would introduce an arbitrary width and make the result
depend on drawing scale.

An overlap also has a vertical condition. A low door and a high window may share the same interval
in plan without occupying the same height. A plan-only rectangle test would report them as a
collision.

## Decision

1. Every horizontal storage observation carries both its room-face display segment and the same
   parked interval on the wall axis.
2. A storage interval covers another aperture only when their wall-axis segments are collinear,
   their intervals overlap by more than the common length tolerance, and their `z0..z1` ranges
   overlap.
3. `koyu.schematic.opening.storage-overlaps-opening@1` reports the measured overlap as a violation.
   The analysis records the opening references and overlap length without a verdict.
4. Parallel lines on different wall axes, endpoint contact and vertically separated openings do
   not overlap.

## Consequences

The result is independent of wall thickness, the 60mm drawing gap and stroke width. It also applies
across collinear boundary segments, so splitting one physical wall into several space relations
does not hide a covered aperture.
