# ADR-0059: skills/ is a governed tree, not prose

- Status: accepted
- Date: 2026-08-08
- Subject: `skills/`, `test/guide.test.ts`, `test/restatements.test.ts`

## Context

`skills/README.md` states three disciplines for this directory: the bundled examples are gated,
a skill's restatement of the notation must be fixed in the same change as the behaviour it
restates, and **every muro fragment shown in a skill must be one that actually checks green**. It
gives the reason for the third itself — "A worked example is the most-copied thing in a skill, so
a defect in one propagates into every building an agent writes."

Only the first had a gate, and only for two files. `npm run check:examples` named
`skills/koyu-design/examples/flat-1ldk.muro` and `skills/koyu-design/examples/office/main.muro` in
a hand-written list. Nothing else in the repository read `skills/` at all — `grep -rln skills
scripts/ test/` returned nothing. The muro written into the prose of a `SKILL.md`, which is the
part an agent actually reads, was held by nobody.

What that cost is measurable, and it is not small.

**One constant drifted into twelve places.** `SUPPORTED_LANGUAGE_VERSIONS` gained `1.1`. Four
version lists went on omitting it — one in `skills/koyu-design/REFERENCE.md`, three in `docs/`.
Two prose counts still said "six versions are accepted". Three pages stated the default as `1.0`
while `docs/reference/muro/version.md`, four files away, correctly said `1.1`; the reference tree
disagreed with itself. The pasted output in `docs/howto/embed-in-a-program.md` had been true when
it was pasted, which is exactly what law 10 asks for and exactly why it went stale unnoticed. And
`test/docs-ledger.test.ts` — the gatekeeper written to stop hand-written ledgers drifting — asserted
the default was `1.0` by writing `1.0` into itself.

The only correct copy of that list in existence was one a downstream product had fixed for its own
use, and never sent back.

**A dead spelling survived only in a skill.** `muro_site` appears in
`skills/koyu-design/REFERENCE.md` and nowhere in `src/`. The prefix is gone; the skill went on
teaching it. A reader searching the source for it finds nothing, which is worse than not naming it.

**A worked example did not parse.** `space /out/road name:South road road:6000 outside:1` has an
unquoted value with a space in it. The same file tells the reader to quote such values;
`docs/howto/describe-a-site.md` writes the same line correctly. Eleven of the seventeen muro
blocks in `skills/` were tagged as whole files while being fragments, which is how it stayed
hidden — the tag claimed something no gate was reading.

## Decision

**`skills/` joins the trees the gatekeepers read.**

`test/guide.test.ts` already held `docs/` to exactly this: a ` ```muro ` block composes and checks
green, a ` ```muro-bad ` fails, a ` ```muro-warn ` warns and nothing more, and the set of fence
tags is itself compared to a ledger so a misspelled tag cannot let a block through unchecked. Its
corpus was widened to include `skills/`. Nothing about the checks changed; they had simply never
been pointed here.

`test/restatements.test.ts` is new, and holds the half `docs-ledger.test.ts` does not.
`docs-ledger` checks the *shape* of the published tree — which headings must exist. This checks
the *values* written into prose: that a list of accepted versions equals `SUPPORTED_LANGUAGE_VERSIONS`,
that a count of them equals its length, that a stated default equals `DEFAULT_LANGUAGE_VERSION`,
that a diagnostic code named in a skill is live, that a validation rule id is real, that an
attribute key is in `ATTR_LEDGER`, and that a retired spelling is not still being taught. It reads
`docs/` and `skills/` alike, because the drift was never skills-only.

The version assertions were removed from `docs-ledger.test.ts` rather than fixed in place. Two
gates asserting the same fact in two spellings is the disease, not the cure.

## Alternatives

**Leave it to discipline, and write the rule more firmly.** Rejected because the rule was already
written, with its reason, in the file that governs the directory — and the directory still shipped
a version list a release out of date, a dead identifier, and an example that does not parse. A
rule nothing checks is a rule that has already been broken somewhere nobody has looked.

**Generate the skills from `docs/`.** Tempting, because the duplication is real: "a derived wall
has no door" is written in three places, and the `edge:` requirement in four. Rejected because a
skill ships as a folder you copy or zip, detached from this repository — self-containment is the
format, not an accident of it. Generation would add a build step to a directory whose whole
virtue is that it has none. Machine-checking the copies keeps the duplication honest without
making the copies stop existing.

**Delete `REFERENCE.md` and point at `docs/reference/muro`.** Rejected for the same reason: a link
into a repository is not followable from a skill installed by zip, and a host that injects the
skill into a prompt cannot follow it at all.

## Consequences and costs

The three disciplines in `skills/README.md` are now written as the gates that keep them, and that
section says which test to read. Editing a skill is no longer a prose edit — a fragment has to be
tagged as one, and a spelling has to exist.

**Fragments stay unparsed, and this is deliberate.** Measured over the corpus, 133 of 191
` ```muro-part ` blocks throw when parsed, and the causes are what makes them fragments: an
undefined grid line, an undeclared level, an `import`, an `over` whose base layer is elsewhere.
Handing them a synthetic preamble makes it worse, because the fragment's own `grid` and `level`
then collide with it. So they get the one check that needs no context — every attribute key is in
the ledger — and nothing more. A fragment can still be wrong in a way no machine here will catch.

**Prose facts stay ungated.** `version.md` attributed the composition words to `1.1` where VER04
is about `1.0` words, and its own pasted output said so four lines below. Nothing machine-readable
records which word arrived in which version, so that one was found by reading. The gates cover
ledgers, not explanations.

The checks are narrower than they could be, on purpose. An earlier draft read "Three" in
`stability.md` and "two" in `three-domains.md` as counts of accepted versions; those count kinds of
version line. A gate that cries wolf gets switched off, so what survives reads
"N versions are accepted" and nothing else, and where a count is phrased some other way the list
on the same line is what catches the drift.

Two things this does not reach. `check:examples` still names its files in a hand-written list, so
an example added to `examples/` or to a skill is checked only if someone remembers to add it —
the same class of defect as the ones above, in the gate that catches them. And whether the skills
help an agent at all remains unmeasured: `eval/` runs six tasks, five of which are revisions of an
existing description, and it does not know `skills/` exists.
