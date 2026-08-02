---
title: How this documentation is written
mode: howto
---

# How this documentation is written

The procedure for adding to, or changing, a page here. **This page is for writers, not readers.**

## One rule

**This documentation is the canon.** For a reader, what is written here is the whole of what koyu is. Therefore:

> **A page states its facts in its own words. It hands them to nobody else.**

A sentence that sends the reader elsewhere — a sentence that reads as "the real answer lives somewhere else" — points at a door the reader cannot open. That is a defect in the page.

The only thing a page may point at is **another page of this documentation**, linked relatively.

```markdown
[space](../reference/muro/space.md) · [koyu check](../reference/cli/check.md)
```

A build gate checks this mechanically.

## One page, one job

**If you cannot say in one sentence what a page is for, split it in two.** If you find yourself writing about something else, that is another page's job — link to it instead of growing the body.

There are four kinds of job, and the `mode` in the front matter declares which.

| `mode` | The job | The reader's state |
|---|---|---|
| `tutorial` | Take them once round with their hands on it | They know nothing yet |
| `howto` | Give the procedure that reaches a goal | They have a goal |
| `reference` | Lay out facts so they can be looked up | They are hunting an answer |
| `explanation` | Say why it is the way it is | They want to be convinced |

**Do not mix them.** A long justification in the middle of a procedure makes the procedure unreadable, and a procedure inside an explanation dilutes the argument.

## The shape of a page

The front matter has exactly two fields.

```text
---
title: <the page title>
mode: tutorial | howto | reference | explanation
---
```

Follow it with an H1 carrying the same sentence as `title`, then the body. **Do not write a language switcher line** — the rendering side handles the locale.

## One tree, one language

**There is one set of pages, and it is written in English.** A page lives at exactly one path
under `docs/`.

```text
docs/howto/write-as-built.md
```

There used to be a Japanese tree and an English mirror of it, and every change had to be made
twice. That is not a discipline anybody keeps: one semantic change to the notation moved 95
Japanese pages and 93 English ones, and the halves still came apart — the Japanese side was
corrected while the English side went on stating the retired rule.

The reason it can go is that **the reader is a machine.** The processor already answers in
English everywhere it speaks — diagnostics, `validate` findings, the MCP surface, the canonical
form. A translation of the prose around them bought nothing an agent could not already read, and
cost a doubling of every page.

Japanese survives where the reader is a person and the page is not published: the decision
records under `docs/decisions/`, and the working notes at the top of `docs/`.

## Code fences

**Never write a bare fence with no tag.** Dropping the tag is the likeliest way for verification to be skipped.

Six fences wrap `.muro`.

| Tag | Contents | What is verified |
|---|---|---|
| ` ```muro ` | **A complete file that passes** | Zero `check` errors |
| ` ```muro-part ` | A fragment | Nothing |
| ` ```muro-bad ` | Something `check` stops with an error | At least one error diagnostic |
| ` ```muro-warn ` | Something `check` passes and `--strict` fails | Zero errors, at least one warning |
| ` ```muro-fail ` | Something `validate` reports as a `violation` | Zero errors, at least one violation |
| ` ```muro-caution ` | Something `validate` reports as a `caution` | Zero errors, at least one caution |

**A file containing `import` cannot be ` ```muro `.** Read as a single text, the `import` cannot be resolved. Write composition examples as ` ```muro-part `.

Everything else uses these four.

| Tag | Contents |
|---|---|
| ` ```text ` | **Pasted output**, and diagrams drawn by hand |
| ` ```sh ` | Commands to run |
| ` ```ts ` | TypeScript |
| ` ```json ` | JSON |

## Paste only output you actually ran

**Never paste guessed output.** This is not page-level etiquette; it is the condition on which this documentation is the canon.

```sh
npx tsx src/cli.ts check examples/two-rooms.muro
```

```text
✔ Consistent — 3 spaces / 3 boundaries
  Structural consistency only — architectural validity is what koyu validate says, separately
```

Where an absolute path appears, it may be shortened to `<absolute path>` or `<dir>/`. **Say once, somewhere on the page, that you shortened it.** Change nothing else — do not round numbers, do not reorder, do not drop the inconvenient line.

When the output is too long, **take the leading lines you need**, as with `✔ Consistent — 3 spaces / 3 boundaries`. Excerpting is fine. Rewriting is not.

## Never hand-write a count

Diagnostic codes, validation rules, CLI subcommands, MCP tools, the public API — **those counts come from the ledgers in the implementation, so they are not copied into prose.** The moment one is copied, the ledger can move and the sentence cannot.

Move a ledger and the number moves. So **whenever you write a number, count it again from the implementation on the spot.** A number that was right when it was written, quietly going stale, is the lie this documentation is most prone to.

That **every** code, rule, tool name and subcommand name appears on a published page is checked by a test against the ledgers. Add one without writing it up and the build fails.

## Do not hand-write what is generated

**The sidebar is derived from the published tree.** It is not a hand-kept list, so **a page that exists is a page in the sidebar.** There is no registration step.

For the same reason, do not edit the generated tree (`website/.generated/`). The next build erases it. The original is in `docs/`.

## Checklist for a new page

1. Is it at one path under `docs/`, in English?
2. Does the front matter carry only `title` and `mode`? Does the H1 match `title`?
3. Do the links point at pages of this documentation, and do the relative paths reach them?
4. Does every fence carry a tag? Does the ` ```muro ` block really pass?
5. Was every pasted output actually run?
6. Are there hand-written counts?
7. **Is there a sentence left that hands the facts to somewhere else?**

## Voice

- **Write in the present tense.** No "this will be", no "in v0.9 it was". Versions are git's business.
- **Assert.** No "it seems", no "it might". If you do not know, do not write it.
- **Bold the load-bearing claim** of the section. One or two per section; more and none of them land.
- **Never state the same fact twice.** Write it twice and one of the two will eventually be fixed alone.
- **Do not sell.** The reader is already here.

## Related

- [The scope of the promise](../reference/scope.md) — what a green `check` means; the source of facts pages draw on
- [Diagnostic code index](../reference/diagnostics/index.md) — an example of taking counts from a ledger
- [.muro reference](../reference/muro/index.md) — how the notation pages are ordered
- [Look up a diagnostic by symptom](by-symptom.md) — what it means to keep one index, not two
