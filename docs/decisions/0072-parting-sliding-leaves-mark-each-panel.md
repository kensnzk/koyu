# 0072 — Parting sliding leaves mark each panel

## Context

A single sliding leaf and a pair of leaves that part at the opening centre both had one short mark
at the centre of the opening. The pair was stored on both sides, but its solid closed position read
as the same uninterrupted line as the single leaf whenever the dashed storage guides were obscured
by nearby wall graphics.

## Decision

The closed position marks the centre of every sliding leaf. A single leaf therefore has one short
perpendicular mark. A parting pair has two, at the centre of each half-width leaf. Its two dashed
storage guides remain unchanged. Bypass leaves continue to use parallel overlapping lines.

The same distinction is used for doors and windows.

## Consequences

The number of leaves and the opening operation remain legible without relying on labels or on the
visibility of storage guides. The marks describe the panels already selected by `style`; no model
or language meaning changes.
