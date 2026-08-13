# ADR-0062: The skills teach the notation — `koyu-design` becomes `koyu-author`, and architectural guidance leaves the repository

- Status: adopted
- Date: 2026-08-13
- Ships in: nothing. `skills/` is outside the npm package, so this lands when it lands on `main` and reaches a reader only when they install it again. The language does not move.

## Context

[ADR-0059](0059-skills-are-a-governed-tree.md) put `skills/` under machine gates because a skill is a restatement and a restatement drifts. It held the parts that have a source in `src/`: the muro blocks, the attribute keys, the accepted version list, the diagnostic codes, the rule names. It said nothing about the sentences that have no source at all, and by koyu 0.21 there were several of them.

`skills/koyu-design/SKILL.md` and `skills/koyu-revise/SKILL.md` each carried a rule about where circulation goes and what a new room should open onto. `skills/koyu-validate/SKILL.md` carried a judgement about which cautions a finished plan is allowed to be carrying, and where the interesting part of the conversation with the architect sits.

**Every one of those is Japanese practice written as though it were part of the language.** That is the first reason to move them, and it is the one that matters to a reader.

A notation travels. `boundary` is a relation between two spaces in Tokyo and in Lisbon; a derived wall has no door in both places; the area koyu computes does not depend on who is reading. Architectural knowledge does not travel at all — a corridor width, a lift count, the workable size of an escape stair, the storey height a use wants, and what rooms a building of a given kind needs before anyone asks are all a country's regulations and building culture. This repository has known that about its own numbers for some time and said so on the page: [docs/howto/choose-dimensions.md](../howto/choose-dimensions.md) opens by declaring that it is not koyu semantics and telling a reader who designs against other conventions to replace the whole table, and [docs/reference/validate/index.md](../reference/validate/index.md) calls its thresholds a coarse copy of Japanese practice. What was never done is the obvious consequence: **a skill that hands an agent those conventions with no such warning exports one country's habits under the name of a notation**, and the reader who most needs muro is exactly the reader those habits fit worst.

The second reason is internal, and it is the one this repository can act on. Law 3 requires a change to land as an ADR plus a test plus the documentation, and the test is what keeps the other two true. There is no declaration anywhere in `src/` to consult about whether a corridor should reach every room. `npm test` cannot go red on it, `conformance/` cannot sit an exam on it, and `test/restatements.test.ts` cannot compare it against a ledger, because there is no ledger. Those sentences were the only claims in the published tree with that property — they could stop being true and nothing here would ever notice.

There is a third, smaller cost. `koyu-design`'s name promised a job the repository does not do. [docs/roadmap.md](../roadmap.md) has said for two versions that an authoring tool is not being taken on, and [docs/reference/scope.md](../reference/scope.md) says what the promise covers. A skill named "design" sat against both, and its body was already two skills bolted together: how to write muro, and how to decide a building.

## Decision

**`skills/` teaches the notation and the processor. Deciding what building to write is out of scope.** Written as law 14 of AGENTS.md, with both reasons and the two questions that settle a borderline case: would somebody building their own koyu application need it, and would leaving it out still let koyu work while only making an agent's buildings worse.

Three consequences.

**`koyu-design` is renamed `koyu-author`,** and its body is cut to the notation — spaces, bands, boundaries, openings, storeys, the check loop, the error table. The trigger surface is deliberately unchanged: it still fires on "間取りを考えて" and "design a floor plan", because an agent asked for a plan should write valid muro rather than fall back to no skill at all and produce something that does not parse. What changed is what the skill claims to supply. It now says outright that which rooms, how big, and what opens onto what stay with the reader — who is in a better position to know the local answer than this repository is.

**`koyu-revise` keeps everything about composition and loses one step.** Where it named the room a new space should open onto, it now says to decide that and write the boundary. The notation fact stays: a space is reachable only through a boundary somebody declared.

**`koyu-validate` judges and explains; it does not decide.** The rule table stays in full, because naming which muro expression caused a finding is exactly this repository's job. What goes is the guidance about which findings are worth acting on. A caution is now described as an inventory of what nobody has declared, with the decision handed back rather than made — which is also the honest position, since whether a face wants declaring depends on conventions koyu does not know.

### Why not keep the guidance and mark it as advice

Considered and rejected. A sentence marked "advice" is still a sentence an agent follows, and it is still unenforceable and still Japanese. Marking it changes who is blamed when it misleads somebody, not whether it does.

### Why the constants stay

`t:100` between rooms, `w:900` for a door, `h:2400` for a dwelling: these stay in `koyu-author`. They are what makes a worked example read as a building rather than as a diagram, and an example that checks green is the most useful thing in the file. The line is between a constant that makes an example plausible and a system that decides a building — a structural span ledger, a lettable depth, a lift-car count. The first is kept and the second was never in a skill, though it is elsewhere in the tree and this ADR does not settle those pages.

## Consequences

`test/skills-boundary.test.ts` holds three things: the roster is exactly `koyu-author`, `koyu-revise`, `koyu-validate`; each `SKILL.md` declares its own directory as its `name`, because a client keys the skill by the frontmatter rather than the folder; and the six removed sentences stay removed. They are listed in that file, which is the only place in the tree they still appear in full, and matched against whitespace-normalised text — one of them lived across a line break, and a raw substring search for it found nothing.

The rename breaks installed copies. A skill is installed by copy or zip, so an existing `~/.claude/skills/koyu-design` goes on working and goes on teaching what this ADR removed. `skills/README.md` says to delete it. Nothing can enforce that from here.

`npm run check:examples` names the two skill examples by hand, so its paths moved with the directory. `docs/checklists.md` already recorded that hand-written list as *Not held*, and the rename is the first time that mattered.

`eval/` is untouched. It measures whether an agent can write and edit muro correctly, which is this repository's subject; it has never scored whether a building is any good.

**This ADR settles `skills/` only.** Law 14 is written for the whole repository, and the same material is in `docs/` — `howto/choose-dimensions.md` most of all, and a smaller ledger in `why/resolution.md`. Those pages are a separate change, because unlike a skill they carry real derivation material worth keeping and four inbound links that would rot silently if a page went away: `website/scripts/check-navigation.mjs` compares published ids against sidebar ids and never parses a markdown link, so nothing here would catch it.
