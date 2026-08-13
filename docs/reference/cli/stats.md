---
title: koyu stats
mode: reference
---

# koyu stats

Gives floor areas by level, reports semi-outdoor and outdoor separately, and totals by zone and by type — and, when you name one with `--by`, by any attribute key.

## Arguments

```text
koyu stats <entry.muro> [--by <key>]...
```

Takes one entry path.

## Flags

| Flag | Meaning |
|---|---|
| `--by <key>` | Add a line totalling floor area by the effective value of `<key>`. Repeatable, and there is no default — see [Totalling by an attribute key](#by). |

## Output

```sh
npx tsx src/cli.ts stats examples/house/main.muro
```

```text
L1
  /site/garden	南庭	garden	41.12 m2 (semi-outdoor, reported separately)
  /site/west	西側通路	yard	12.42 m2 (semi-outdoor, reported separately)
  /site/east	東側通路	yard	12.42 m2 (semi-outdoor, reported separately)
  /site/north	北側通路	yard	7.28 m2 (semi-outdoor, reported separately)
  /home/ldk	LDK	ldk	39.75 m2
  /home/hall1	玄関・階段	hall	13.25 m2
  Subtotal 53.00 m2
L2
  /home/bed1	主寝室	bedroom	26.50 m2
  /home/void	リビング上部	void (not counted as floor area)
  /home/hall2	2階ホール	hall	13.25 m2
  Subtotal 39.75 m2
Total 92.75 m2 (indoor floor area)
Semi-outdoor 73.24 m2 (balconies, external stairs and the like — whether they count is a matter of regulatory detail, so it is reported separately)
By zone (counted aggregation):
  /home	住戸	92.75 m2
  ldk: 39.75 m2
  hall: 26.50 m2
  bedroom: 26.50 m2
```

## Reading it

Levels come out in ascending `z`. A level with no space that has a region gets no section at all.

A space's line is tab-separated: `path / name / type / area`. **Areas are measured to wall centrelines.**

Four kinds are handled differently.

| Kind | Treatment |
|---|---|
| An indoor space | Counted into `Subtotal` and `Total` |
| `void:1` | No area is given; it prints `void (not counted as floor area)` and is not counted |
| `outside:1` | Prints `(outdoor, not counted)` and is reported at the end as `Outdoor` |
| Semi-outdoor | Prints `(semi-outdoor, reported separately)` and is reported at the end as `Semi-outdoor` |

**Semi-outdoor is derived, not declared.** A space that meets an `exterior` across an `open` boundary or a wall with `air:1` is semi-outdoor. Whether a balcony or an external stair counts toward floor area is a matter of regulatory detail, so it is reported separately rather than counted.

The `Outdoor` line only appears when there are outdoor spaces.

```sh
npx tsx src/cli.ts stats examples/complex/main.muro
```

```text
Total 31606.24 m2 (indoor floor area)
Outdoor 736.00 m2 (plazas, open ground and the like — not counted as floor area)
```

(An excerpt from the end of this building's full output.)

## By zone, and by type

`By zone` totals per zone. **A zone carrying `site:1` does not appear here** — the site is not a floor-area aggregation, and the site numbers are answered separately by [`koyu site`](site.md).

The `<type>: <area>` lines that follow total by the type given as `space`'s second positional argument. **Types are an open vocabulary, so a misspelling is quietly counted as a different type.** A line that says `bedrom` instead of `bedroom` does not error; it adds a row.

The type lines print on every run. **A type is a positional token, not an attribute**, so it is not a `--by` key.

## Totalling by an attribute key {#by}

`--by <key>` adds one line per key, in the order the flags were written.

```sh
npx tsx src/cli.ts stats examples/office.muro --by lease.category --by fire.compartment
```

```text
Total 419.84 m2 (indoor floor area)
  hall: 40.96 m2
  office: 184.32 m2
  corridor: 40.96 m2
  stair: 25.60 m2
  ev: 25.60 m2
  wc: 51.20 m2
  machine: 51.20 m2
By lease.category: common 235.52 m2 (56.1%) / rentable 184.32 m2 (43.9%)
By fire.compartment: (unspecified) 419.84 m2 (100.0%)
```

(An excerpt from the end of this building's full output. Nothing in it writes `fire.compartment`, so that line has one bucket.)

**There is no default key, and without `--by` there is no such line.** No one division of a building is privileged: a floor is split by tenancy, by fire compartment and by department at the same time, and `stats` totals by whichever you name. The key may be any attribute key, including a namespaced carried one like `lease.category`; `stats` adds up the areas and forms no opinion about what the value means.

A space's value for `<key>` is its own declaration if it has one, and otherwise the value from the deepest zone that carries `<key>` and whose path is a prefix of the space's path.

**A space carrying no value goes into `(unspecified)` rather than being dropped**, so the buckets add up to `Total`.

```sh
npx tsx src/cli.ts stats examples/complex/main.muro --by lease.category
```

```text
By lease.category: common 12809.44 m2 (40.5%) / (unspecified) 2385.60 m2 (7.5%) / rentable 16411.20 m2 (51.9%)
```

(The last line of this building's full output.)

Each percentage is rounded on its own, so the printed percentages need not come to 100.0%. It is the areas that add up.

`--by` with no key after it is a mistake in the call, not a grouping by nothing.

```sh
npx tsx src/cli.ts stats examples/office.muro --by
```

```text
--by takes an attribute key: --by lease.category
```

## Exit codes

| Exit code | Meaning |
|---|---|
| 0 | Always (even with no spaces at all) |
| 1 | It could not be read because of a syntax or composition error |
| 2 | `--by` was given no key / no file path was given (usage is printed) |

**`stats` never passes judgement.** Whether the area is too large or too small, it returns 0. The floor area ratio comes out as a number from [`koyu site`](site.md), and the verdict from [`koyu validate`](validate.md).

## See also

- [koyu site](site.md) — site area, coverage, floor area ratio
- [koyu levels](levels.md) — how the heights stack up
- [.muro reference](../muro/index.md) — a `space`'s type position, and the attribute ledger
- [The koyu command](index.md) — the shared promises about exit codes
