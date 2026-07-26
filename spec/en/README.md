**English** · [日本語](../README.md)

# spec/ — the koyu specification (present tense)

> **This is a reference. If you are learning koyu, start at [guide/en/start.md](../../guide/en/start.md).** It is written to be consulted, not to be read through and absorbed.

This folder is the normative reference for **how koyu behaves right now**. It does not record how things came to be, or why — that is the job of [docs/decisions/](../../docs/decisions/) (the ADRs) and [docs/log/](../../docs/log/), and the spec keeps only **the present tense of the conclusions** once the decisions have settled. Where the two disagree, the implementation and its tests are the norm, and the spec is corrected.

## The map of the documents

| Document | Contents | Reader |
|---|---|---|
| [language.md](language.md) | **Language reference** — lexis, the grammar of every declaration, composition (import), defaults, and how position is written | People who write .muro; people who touch the parser |
| [semantics.md](semantics.md) | **Semantics reference** — the model; derivation (wall segments, vertical adjacency, semi-outdoor, height); the list of checks; the definitions of the queries (doors/stats/light/site) | People who touch derivation or check; people interpreting results |
| [vocabulary.md](vocabulary.md) | **The vocabulary ledger** — the contract for attributes (which words the tools interpret) and the rule for how an open vocabulary is opened | People adding attributes; everyone |
| [canonical-json.md](canonical-json.md) | **The machine format** — the schema of the canonical JSON and its stability rules | People building external connections, diffs, or composition |
| [tools.md](tools.md) | **Tool reference** — the CLI, the MCP server, the public API | Programs and agents that use koyu |
| [notation-v0.md](notation-v0.md) | **The record of how the notation came about** — the v0 comparison (DSL/YAML/JSON) and the addenda for each version. A historical document; language.md is the present tense | People who want the background |
| [../../guide/en/](../../guide/en/README.md) | **The companion book, for learning** — tutorial, the six concepts, how-to guides, the causes and fixes for every diagnostic, worked examples. It holds no norms and links here instead | People learning koyu; people looking things up by task |

## How this folder is updated

A change to behavior lands as three parts together: **an ADR (why) + a test (the guarantee) + the spec (the present tense)**. A change that writes an ADR without updating the spec is unfinished. The spec never accumulates dates or "addenda" — the body is rewritten in place, and git holds the versions. Adding to the vocabulary (an interpreted attribute) means putting it in the table in vocabulary.md; that listing is the contract, and an interpretation that is not listed must not be implemented (ADR-0008).

Translations follow the same discipline. Japanese is the default locale and `spec/en/` is its translation; the terminology contract is [docs/terminology.md](../../docs/terminology.md). A change to a normative statement is made in both locales in the same commit — `test/i18n.test.ts` fails if a page loses its counterpart, if the code in an example drifts apart, or if the heading structure diverges.

## The version this describes

This set of documents describes koyu v0.12.0. If it diverges from the package version, fix whatever diverged.
