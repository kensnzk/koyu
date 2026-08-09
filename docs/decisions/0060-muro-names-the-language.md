# ADR-0060: muro names the language — the version line, the correspondence ledger, and the rule that a version is carried only where something checks it

- Status: adopted
- Date: 2026-08-09
- Ships in: koyu 0.20.0, language version muro 1.2
- Supersedes nothing. [ADR-0042](0042-two-version-lines.md) split the two version lines and recorded, as its own cost, that nothing checked the relation between them. **This decision closes that cost.**

## Context

Three failures had stacked on each other, and every previous attempt to fix this had reached only the top one.

**One word had two referents.** `docs/index.md` defined koyu as "a notation for writing architecture as text (`.muro`) and the toolchain that reads it", while `docs/reference/stability.md` — also normative — said muro was the language and koyu the implementation. Both pages were authoritative and they disagreed, so every surface downstream took whichever reading it met first. That is how the version line inside a `.muro` file came to be spelled with the name of the processor.

**The correspondence between the two version lines was recorded nowhere.** `stability.md` said the koyu version "declares which muro it implements". No such declaration existed on any surface — not in `package.json`, not in `CITATION.cff`, not in canonical JSON, not in the MCP `serverInfo`. `koyu --version` did not exist at all: the flag fell through to the usage text and exited 0. Which koyu first read which muro was answerable only by reading git, and one row of that answer is not in git either (below).

**Because nothing recorded it, the version line failed badly.** A file declaring a version newer than the build could read printed the same sentence as a version that never existed, so nothing could tell a stale reader from a corrupt file. A file with no version line was silently re-read under new semantics on every language bump — which had already lost data: the 1.0 → 1.1 move stopped reading `exterior` out of the type position, and undeclared files written in the old dialect lost their outside spaces without a word. The downstream product recorded that incident in a code comment and called the remedy an open design call.

## Decision

### 1. Three referents, not two

- **muro** — the language: its words, its semantics, the rules of composition. What a `.muro` file declares and what `conformance/` defines.
- **koyu** — the implementation that reads muro: the CLI, the API, the MCP server, the canonical JSON writer, the drawings, the validation face. What npm installs.
- **koyu, the undertaking** — the repository, the citation, the published documentation: the project that develops both. **Unversioned.** This is the one place the bare word may keep both meanings, because it genuinely contains both.

The third is not a loophole. It is why the confusion was stable enough to survive six versions: the sentence on the front page was a project-level sentence, using the project-level name, sitting where a reader takes it as the definition of the language.

### 2. The version line is spelled `muro`, from 1.2

**One spelling per version, and never both.**

| Version | The line is written |
|---|---|
| `1.2` and later | `muro 1.2` |
| `1.1` and earlier | `koyu 1.1` |

Writing the wrong word for the version is an error in both directions, and the message names the word that version wants.

**Nothing migrates.** A file written `koyu 1.1` still parses, still means what it meant, and will forever. Ten or so tests in this repository, and every conformance case written before the cut, deliberately keep the old spelling — they are the standing proof that it still reads.

### 3. `MURO_SUPPORT` is the correspondence, and it is the only record of it

One ledger in `src/core/model.ts`: for each muro version, the koyu version that first read it (`since`) and, once a version is retired, the last that does (`until`, empty on every row).

`SUPPORTED_LANGUAGE_VERSIONS` and `DEFAULT_LANGUAGE_VERSION` are **derived from it**, not declared beside it. Two lists of one fact is how the correspondence drifted in the first place.

Every surface that answers "which muro does this build speak" reads that ledger: `koyu --version`, the `muro` field on `package.json`, the MCP `serverInfo`, and `requireMuro` for a consumer that wants to state its requirement as a language version rather than guess a package range.

### 4. The undeclared reading is frozen at 1.1

A file with no version line is read as 1.1, and always will be. Newer semantics are opt-in; the way to opt in is to name the version. The cost, stated from the other side: an undeclared file never gets new notation.

### 5. A version is carried only where something checks it

**Emit a version, or check one — never emit one nobody checks.**

`koyu-context/1` is the model: `validate` reads it on arrival and refuses an input that does not match. It stays, and is now documented among the version lines.

`koyu-analysis/1` and `koyu-assessment/1` were written by `assess` and read by nobody, on the face this project declares unfrozen. They lose the suffix and keep the name. The IFC exporter was consuming canonical JSON without ever reading `format`; it now refuses a spelling it does not know.

## Alternatives rejected

**Keep `koyu` as the keyword and let `koyu` mean the language.** Least code, most renaming: the `.muro` extension, `docs/reference/muro/`, `conformance/README.md` and `stability.md`'s own table would all become wrong instead. Rejected.

**Spell the line `version 1.2`, with no name at all.** The version line is the only declaration in the notation that names the language, which is structurally why it was the one that carried the wrong name — nothing else had to have an opinion. Removing the name would make the class of mistake impossible. **Rejected on one ground:** a `.muro` fragment travels as pasted text far more often than as a file, and a fragment that opens `version 1.2` says nothing about what it is. This was close, and it is recorded as the runner-up rather than as an unconsidered option.

**Accept both spellings for every version.** One declaration would have two forms, and the canonical form would stop being unique — which every byte expectation in `conformance/` rests on. Refusing the wrong pairing costs an error message; allowing it would cost the guarantee.

**Warn on a missing version line, instead of freezing the default.** Measured first: 68 of 135 conformance cases declared no version, and 60 of those carry an exact diagnostics expectation. Each would have grown an entry about a risk that does not apply to it, permanently, in the definition of the language. And the warning would only have *reported* the danger. Freezing removes it.

**Retire the old language versions (0.1–0.5) while cutting 1.2.** No building in this repository declares them, but the product's own legacy set shows the team expected stored plans that old, and only the database can say. Absent evidence is not negative evidence, and shipping two breaking changes in one release makes any resulting failure unattributable. The mechanism was built (`until`) and left unused.

## Consequences and accepted costs

- **The canonical JSON key is `muro`, whatever word the source used.** A document written `koyu 1.1` says `"muro": "1.1"` — the key names the thing being versioned, not the author's spelling. That is a change of spelling, so the format went to `koyu-canonical/1.3` and 57 conformance expectations were regenerated. Every diff was checked to be the format line or the renamed key and nothing else, and the fingerprint baseline confirmed it from the other side: all fifteen canonical hashes moved and no Form hash did.
- **The editor grammar's scope is `source.muro`.** Anyone with a theme rule targeting `source.koyu` loses it. Accepted deliberately rather than swept in silently.
- **Files written before 1.2 keep the old keyword forever**, so both spellings have to be read for as long as the old versions are accepted.
- **`DEFAULT_LANGUAGE_VERSION` was doing two jobs** — the undeclared reading and the newest version — which looked like one only because they coincided. Splitting them exposed two gates that demanded examples declare the *frozen* version where the law wants the newest: they would have blocked the very bump they exist to police.

## What this changes about how the norm is written

Two of the false statements this decision removes were not merely stale. They were **unverifiable from inside the repository and stated as law**, so everyone who read them repeated them as fact — `stability.md` describing a declaration that had never been built, and `AGENTS.md` describing who creates a release. A norm that asserts something no reader can check produces recitation, and recitation is indistinguishable from knowledge.

The counts are the same defect in miniature. A count restated in prose has to stay true and has no reader; fifteen places said the diagnostic ledger held 65 when it held 67, and one sentence in `README.md` was wrong twice in a single line. They were removed rather than corrected, and law 13 now says why.
