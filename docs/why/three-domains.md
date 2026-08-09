---
title: Separating language, checks and drawing
mode: explanation
---

# Separating language, checks and drawing

koyu is made of three domains. **They are kept apart because the quality demanded of each is different.**

| Domain | What it holds | Size | Quality | Version |
|---|---|---|---|---|
| **core** | the language, its semantics, composition, identity, derivation, structural diagnostics, questions, canonical JSON | small | **must be clean** | **freezes** |
| **validation** | architectural judgement — sixteen rules, under a profile you name | grows | may be messy | does not freeze |
| **presentation and build** | SVG generation and outside viewers | grows | may be messy | does not freeze |

**The dependency runs one way.** Validation and presentation depend on core; core depends on neither. Core runs complete on its own. That one-wayness is enforced **by a test, not by prose**.

> **koyu does not make coordinates. Drawing does not make meaning.**

## What happens if you do not separate them

**Two things happen at once.**

**Mess seeps into core and freezes there.** Let a coarse judgement rule into core's diagnostics and that coarseness becomes part of what is frozen. The moment "1/7" becomes a core invariant, it has to be 1/7 in every jurisdiction and for every building use.

**Core's caution stops validation and presentation from growing.** If adding a judgement means considering a language version bump, judgements stop being added. If changing a line weight means checking a frozen surface, drawings stop improving.

**The separation itself is what makes it acceptable for the other two to be messy.** Mess in a domain that does not freeze can be rewritten at any time, so it is cheap. Mess in a domain that freezes is permanent. **The prices differ by orders of magnitude.**

## core — small, clean, frozen

core holds this and no more.

- **the grammar and semantics of the notation** — what may be written and what it means
- **composition** — layer strength order, single-value resolution, set editing, provenance
- **identity** — uid and path, the identity of relations
- **derivation** — the rules that make **a unique form** out of the written composition, and their reference implementation
- **structural diagnostics** — the 68 codes `check` returns
- **questions** — area, graph, routes, opening area. **Never pass or fail**
- **the machine format** — canonical JSON

**There are zero runtime dependencies.** That this domain depends on no outside package is what makes the promise to freeze possible at all.

Adding to core is expensive: parsing, composition, machine format, spec and documentation all move at once, and after the freeze the change may be breaking. **Hence the five-question gate** ([Extending attributes](open-vocabulary.md)).

## Validation — may be messy; grows

Daylight, coverage ratio, height consistency, envelope continuity, whether a door can be installed, egress, reachability, and everything not yet thought of.

**Add it even if the rule is coarse, even if it covers only one jurisdiction, even if the precision is short. Try it and throw it away. It is cheap because it does not freeze.**

**It is not made a separate package.** The right moment to cut a package boundary is when the versions need to move independently, and that need has not arrived. Judgement is also a domain where what is correct is not settled, and giving it a boundary before it settles **freezes the wrong boundary**. It gets extracted when one of three things happens: a second jurisdiction is needed, a consumer appears who wants judgement alone, or the judgement version needs to move independently.

**Every judgement must be callable by a machine.** A judgement that cannot be called does not exist as far as a machine is concerned ([MCP server](../reference/mcp/index.md)).

## Presentation and build — may be messy; gets more precise

Form generation, drawing, and the human-facing surface. 2D and 3D, drawing conventions, presenting diagnostics, presenting judgements, authoring support.

**Dimension lines, grid bubbles, door and window conventions, scale, pitched roofs, complicated junctions — the precision can be raised a bit at a time. It is cheap because it does not freeze.**

**There is one condition on being allowed to be messy: what cannot be drawn must never be mistaken for what cannot be written.** What is drawn and what is not is enumerated and held. Without that, the limits of the drawing side get imported as limits of the description side, and **the source starts being dragged around by its presentation.**

And this domain **must not change the form**. What may change is the appearance, not the form ([Determinism of derivation](form-must-be-unique.md)). That line is machine-enforced too — the drawing code is checked to import none of the form-assembling parts, and the derivation constants are checked not to be spelled out on the drawing side.

## The direction of dependency and of growth

```text
        ┌─────────────┐
        │  koyu core  │  small · clean · freezes
        └──────┬──────┘
               │ one way
        ┌──────┴──────┐
        │             │
   ┌────▼─────┐  ┌────▼──────────┐
   │validation│  │ presentation  │  grows · may be messy · does not freeze
   └──────────┘  └───────────────┘
```

> **The language does not grow. Validation and presentation do.**

New judgements, reconciliation against outside data, new questions, better drawings — **this is where they all go.** The language version does not move.

## There are two version lines

- **the notation's version** — the language, its semantics and the rules of composition. It promises **"a file written this way will keep meaning this"**
- **the implementation's version** — which notation it implements. It promises **"this implementation's surfaces will not break"**

**They are separate promises, so they need not arrive together.** As it stands the notation has reached 1.0 while the implementation is still 0.x — the language is settled, and the implementation has promised to freeze nothing yet.

The machine format carries neither of those but **a spelling version** of its own. The semantics belong to the notation's version, but the same semantics may be re-spelled under different keys, so the spelling is counted separately.

Versions as a whole are covered in [Stability](../reference/stability.md).

## Next

- [check and validate](two-kinds-of-green.md) — how core's and validation's diagnostics are split
- [Determinism of derivation](form-must-be-unique.md) — how core and drawing are split
- [Scope](../reference/scope.md)
- [What koyu does not hold](../reference/not-held.md)
