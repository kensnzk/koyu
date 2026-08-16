# Checklists for changes that ripple

Some changes touch one file. Some change a fact that is restated in dozens, and those are the ones
that rot: the restatement stays true-looking long after the source moved. Raising the language
version from `1.0` to `1.1` left twelve places saying what had been true before it, in two trees,
and the only correct copy of one list was in a downstream product that had fixed it for itself.

**This page exists to be short.** Every line the machine already holds is named here so you do not
read it twice — the work is the second list in each section, which is what no test can reach.

Unpublished, like the rest of the loose material at the top of `docs/`.

---

## Raising the language version

**The source is `MURO_SUPPORT` in `src/core/model.ts`, and cutting a version is adding a row
to it.** `SUPPORTED_LANGUAGE_VERSIONS` and `DEFAULT_LANGUAGE_VERSION` are derived from that
ledger, so **the newest version cannot move without a row** — that half of the job is now
true by construction rather than by discipline. Everything below is downstream of the row.

A row names the koyu version the language version ships in, so **the release bump and the
language bump are one change**. Adding the row without raising `package.json` fails three
gates at once (the ledger check, `package.json`'s `muro` field, and the examples), which is
the point: there is no half-cut state that stays green.

### Held by machine — do not hand-check

| What | Which gate |
|---|---|
| **The row in `MURO_SUPPORT` naming the koyu version the new muro ships in** | `test/release.test.ts` |
| **The word a version line is written with, in every muro block in `docs/` and `skills/`** | `test/restatements.test.ts` |
| **A count written beside the diagnostics or the rules** | `test/restatements.test.ts` |
| **`package.json`'s `muro` field** (`reads` / `newest` / `undeclared`) | `test/release.test.ts` |
| Every version list, count and stated default in `docs/` and `skills/` | `test/restatements.test.ts` |
| Every muro example in `skills/` and `docs/reference/muro/` declares the newest version | `test/restatements.test.ts` |
| `docs/reference/muro/version.md` lists the versions in order and names the default | `test/release.test.ts` |
| Every `.muro` under `examples/` that declares a version declares the newest one | `test/release.test.ts` (walks — not a list) |
| The canonical JSON fixture still matches the implementation byte for byte | `test/release.test.ts` |
| Every ` ```muro ` block still composes and checks green | `test/guide.test.ts` |

Adding the row with nothing else changed turns several of those gates red at once. Work down
the failures and the mechanical half of the bump is done.

**Two of them will point at the wrong constant unless you look.** `DEFAULT_LANGUAGE_VERSION` is
the *undeclared* reading, frozen; the newest version is `NEWEST_LANGUAGE_VERSION`. A check that
means "examples are written in the newest version" and reads the first one passes for as long
as the two agree, and blocks the bump on the day they stop.

### Not held — check these by hand

- **The version guards in `src/core/diagnose.ts`.** `olderThan(model.version, "1.1")`,
  `"1.0"`, `"0.5"` — three of them, each deciding what an older file loses. A new version does not
  move them by itself. Decide per guard whether the new version joins the branch, and expect a new
  `VER` code with its page and its worked example if the new version retires or introduces a word.
- **Prose that says which version a word arrived in.** Nothing machine-readable maps a word to the
  version that introduced it, so `version.md` claimed the composition words arrived in `1.1` when
  `VER04` is about `1.0` words — with its own pasted output saying so four lines below. Read the
  `VER` sections whole.
- **`conformance/cases/`.** Most declare the version current when they were written, and a few
  deliberately declare an old one to pin version-gated behaviour. **Do not bulk-bump.** A
  conformance case is a pinned expectation, not an example, and the old ones are the point —
  after the 1.2 cut the cases still spelled `koyu 1.1` are the standing proof that the old
  spelling still reads.
- **`eval/fixtures/`.** Carries version lines and no gate reads them.
- **Anything vendored downstream.** A product that embeds a copy of the skill or the reference
  holds its own version list, and this repository cannot see it. Last time the downstream copy was
  the only correct one; that is luck, not a system.
- **Downstream that *writes* a version line.** A stale reader is a nuisance; a stale writer keeps
  minting files in the old spelling, so the migration never converges. Three generators and one
  prompt that teaches a model the notation are named in the project issues; none is visible from
  here.

---

## Changing a rule of derivation

The shape moves for every building the rule reaches, so every pinned shape moves with it — and
**the canonical form does not move at all**, because no source is read differently. That pair,
the Form column moving while the canonical column stands still, is the signature to check the
change by; anything else means something was changed that was not meant to be.

### Held by machine

| What | Which gate |
|---|---|
| The `Form` golden of the sampled examples | `test/derive.test.ts` |
| The `Form` hash of every bundled entry, against the canonical hash beside it | `test/fingerprints.test.ts` |
| The whole `Form` of every conformance case that pins one | `test/conformance.test.ts` |
| That the drawing side did not grow a rule of its own to compensate | `test/draw.test.ts` |

### Not held

- **`docs/img/`.** The plans are generated output kept as files, and nothing regenerates them or
  compares them with what the processor now produces. Regenerate every one the rule reaches
  (`npx tsx src/cli.ts plan <entry> -l <level> -o docs/img/<name>.svg`, default scale and cut) —
  four of them are not plain examples: `start-05-L2-sealed` is `examples/steps/05` with the
  upstairs door taken out, and the two `start-index-*` are the snippets written on `docs/index.md`.
- **The IFC export.** It builds a wall from the segment on its own toolchain, so a rule that
  changes bodies does not reach it and its agreement test keeps passing either way.
- **Downstream viewers.** They derive their own shape from the same rules and this repository
  cannot see them.

---

## Adding or retiring a diagnostic code

### Held by machine

| What | Which gate |
|---|---|
| Every code in `DIAGNOSTIC_CODES` has a heading under `docs/reference/diagnostics/` | `test/docs-ledger.test.ts` |
| A retired code is not explained as a live one | `test/docs-ledger.test.ts` |
| Each family page carries an example producing exactly its own code | `test/guide.test.ts` |
| A code named in a skill is a live code | `test/restatements.test.ts` |

### Not held

- **The severity in prose.** The gate checks the code has a heading, not that the page says the
  same severity the ledger does.
- **`docs/howto/by-symptom.md`.** Reaching a code from a symptom is prose, and a new code is
  reachable only if someone adds the row.

---

## Adding or removing a CLI subcommand, an MCP tool, or a public export

### Held by machine

| What | Which gate |
|---|---|
| Every subcommand has a page under `docs/reference/cli/` | `test/docs-ledger.test.ts` |
| Every MCP tool has a heading under `docs/reference/mcp/` | `test/docs-ledger.test.ts` |
| Every name exported from `src/index.ts` appears in `docs/reference/api/` | `test/docs-ledger.test.ts` |
| Every CLI invocation shown in the documentation names a real subcommand | `test/guide.test.ts` |
| A retired spelling is not still being taught | `test/restatements.test.ts` |

### Not held

- **`AGENTS.md`'s own lists.** It names the subcommands and the MCP tools in prose, and no test
  reads `AGENTS.md`.
- **The usage lines in `src/cli.ts`** against the pages, beyond the subcommand's name existing.
- **A removed name is only retired when the old spelling is gone.** Add it to `RETIRED_SPELLINGS`
  in `test/restatements.test.ts` so prose cannot go on teaching it.

---

## Changing the attribute ledger

### Held by machine

| What | Which gate |
|---|---|
| Every attribute key written in a muro block anywhere in `docs/` or `skills/` is in `ATTR_LEDGER` | `test/restatements.test.ts` |
| The editor grammar matches the implementation and the ledger | `test/grammar.test.ts` |

### Not held

- **`docs/reference/muro/attributes.md` is a copy of the ledger** and is checked for the keys that
  appear in examples, not for being complete.
- **A removed key** disappears from the ledger silently as far as prose is concerned. Retire the
  spelling explicitly (see above).

### Retiring a key

**The row stays.** `checkAttrValues` reads `attrSpec` and never sees `model.version`, so deleting a
row makes the key unknown at *every* version at once — a file declaring an older version starts
failing `ATT03` for a word that version legitimately has. Mark it `retired: { after, instead }`
instead, and let `VER07` stop it from the version after `after`.

**The guard runs the other way round from the three in `checkLanguageVersion`.** They ask
`olderThan(model.version, X)`, with the file's version on the left. A retirement asks
`olderThan(spec.retired.after, model.version)`, with the ledger's version on the left. Written the
familiar way it fires on every file that is not exactly the retiring version.

**`retired.after` must be a version the ledger knows.** `olderThan` compares by index, and
`indexOf` returns `-1` for a version it has never heard of, which makes the guard true everywhere.
`test/vocabulary.test.ts` holds this.

**Two conformance cases, not one.** The case that proves the new error is the easy half. The two
that matter are the ones that prove the *old* reading survives — one file declaring the last
version that may write the key, and one declaring no version at all. Both write the retired key and
both must stay green forever. They are the cases that go red if someone later deletes the row.

**Not held anywhere:** whether the value the key held has somewhere to go. Say it in the diagnostic
(`instead`), not only in the documentation — the message is what the author reads.

---

## Adding an example, or a skill

### Held by machine

| What | Which gate |
|---|---|
| Every `.muro` under `examples/` composes, checks `--strict`, and answers nine architectural questions | `npm run gate:examples` (walks) |
| Every muro block in a skill is held to what its fence tag claims | `test/guide.test.ts` |
| The version line of every example entry file | `test/release.test.ts` (walks) |

### Not held

- **`npm run check:examples` names its twelve files by hand.** `gate:examples` walks `examples/`,
  so a new example there is still checked — but the two files under
  `skills/koyu-author/examples/` are in that hand-written list and nowhere else. A third one added
  beside them is checked by nothing.
- **Whether a skill helps.** `eval/` runs six tasks, five of them revisions of an existing
  description, and does not know `skills/` exists.

---

## When you add a gate

Two rules, both learned the hard way on this page's own subject.

**Watch it fail first.** A gate that has never been red is a gate you have not tested. The
restatement checks were written against twelve real drifts and every one was read before it was
fixed — one of them, a pasted `VER04` message, turned out to be correct and the prose beside it
wrong.

**Narrow beats thorough.** An early draft of the version-count check read "Three" in
`stability.md` and "two" in `three-domains.md` as counts of accepted versions; both count kinds of
version line. A gate that cries wolf gets switched off, and then it holds nothing at all.
