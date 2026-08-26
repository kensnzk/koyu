# ADR-0076: The notation has no compass

Date: 2026-08-27 / Status: adopted (muro 1.6, koyu 0.29.0) / Origin: `N` was read as a bearing by people and by the machines that consume the notation, and it never was one

## Context

`edge:`, `hinge:` and the direction a vertical run rises were spelled `N` / `E` / `S` / `W`. The
published norm has always had to say, on eight separate pages, that these are *not* a compass —
that `N` means +Y in the coordinate system `grid X` and `grid Y` set up, and nothing about where
the building points. `azimuth` is the one statement that holds a true bearing.

A word that needs the same disclaimer everywhere it appears is the wrong word. The cost was not
only prose. A consumer reading canonical JSON sees `"edge": "N"` and has no way to know from the
value itself that a rotation of the site changes nothing about it; every downstream product
re-derived the same four-row mapping table, and each copy was another place for +Y and north to be
confused.

## Decision

**1. The four faces are named by the axis they look along: `x+`, `x-`, `y+`, `y-`.**

`y+` is +Y, `y-` is −Y, `x+` is +X, `x-` is −X. The sign is written after the axis letter, not
before it, so no value begins with `-` — a leading minus would collide with option parsing on the
command line, where `--look` and `--face` take these same words.

**2. It applies to every carrier of a direction in the notation.** `edge:` on a boundary, an
opening or a `seg`; `hinge:` on an opening; and the value of `stair:`, `ramp:` and `escalator:`,
which is the direction of ascent. `swing:` is unaffected — `a`/`b` names the relation, never an
axis. The CLI and MCP views take the same words: `--face`, `--look`, and `-d x+y+ | x-y+ | x+y- | x-y-`.

**3. The compass words are gone at every version, not only from 1.6.** This is the second
version-blind change in the language, after the exterior default. Accepting `N` under a `muro 1.4`
declaration would leave the old spelling readable, and a readable spelling is a spelling that gets
copied forward — the point is that one axis has one word. Files that carry the old words are
converted, not read.

**4. `azimuth` keeps the only bearing.** It gives the true bearing of +Y, and it is now the only
place in koyu where a compass direction exists at all. The north arrow on a plan is drawn from it
and stays: it is a drawing convention reading real data, not a word in the notation.

## Alternatives

**Gate the new spelling to muro 1.6 and keep the old one readable below it.** Rejected under (3).

**Write `+x` / `-y` instead.** Rejected: a value starting with `-` cannot be told from an option on
the command line, and `-` is already the offset operator inside a value (`at:X3-600`).

**Keep the compass and document harder.** Rejected — eight pages of disclaimer is the evidence
that the word was wrong, not that the reader was careless.

## Consequences

The language version moves to muro 1.6 and the implementation to koyu 0.29.0. Canonical JSON
carries the new values, so **the byte order of canonical output changes wherever declarations sort
on an edge**: `x+` `x-` `y+` `y-` do not sort as `E` `N` `S` `W` did. Every bundled example, every
conformance expectation and every pinned fingerprint moved for that reason and for no other — the
buildings are unchanged.

Consumers holding the four letters in a type stop compiling, which is intended. `Edge` keeps its
name: it still names the edge of a rectangle, and `edge:` is not a compass word.
