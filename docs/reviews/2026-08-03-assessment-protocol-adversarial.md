# Assessment protocol adversarial review

- Date: 2026-08-03
- Status: internal implementation review
- Decision under review: `docs/decisions/0054-assessment-protocol.md`
- Implementation scope: `src/analysis/{json,contracts}.ts`, `src/validate/{contracts,assessment}.ts`
- Executable evidence: `test/assessment-contract.test.ts`, `test/assessment-acceptance.test.ts`
- Review discipline: production and test sources were not edited by this review; this file is the only review output

## Verdict

No P0 issue was found. The adversarial pass found contract-breaking P1 and P2 boundary defects while
the generic engine was being assembled. Every confirmed defect listed below is resolved in the
current tree and has either a direct regression assertion or a source-level invariant. The focused
contract test and TypeScript typecheck are green at the end of the review.

This verdict is deliberately narrower than “ADR-0054 is complete.” The generic, in-memory TypeScript
protocol is ready to be the foundation of the API plan. Built-in provider mutation checks, the
built-in rule migration, public subpath/package smoke tests, operation adapters, CLI/MCP equality,
and the documentation/distribution gates belong to later phases and remain acceptance conditions.

## Findings and disposition

Line references describe the reviewed tree at the end of this pass. “Repro at discovery” records the
smallest input that failed before the corresponding fix; it is not a claim that the current tree
still fails.

| ID | Severity | Repro at discovery | ADR mismatch | Current disposition |
|---|---:|---|---|---|
| AP-01 | P1 | Call `runAnalysis` for an unknown or profile-unreachable analysis with a `Model` proxy whose first property read throws `MODEL_TOUCHED`. The proxy was touched before the configuration error. | Sections 6 and 9 require complete preflight before work; section 10 permits one diagnostic scan only for an executable call. | Resolved. `runAnalysis` resolves the profile, exact target, and transitive reachability before `diagnoseModel` (`src/validate/assessment.ts:141`, `:287`). The zero-model-read regression begins at `test/assessment-contract.test.ts:376`. |
| AP-02 | P1 | Supply a context entry with `source` but no own `value`; the decoder could fabricate a value and the provider ran. | `ContextEntry.value` is required, and malformed public context is a configuration error (sections 1-2). | Resolved. Snapshot, entry and source shapes require exact enumerable data properties and an own `value` (`src/validate/assessment.ts:886`, `:939`, `:968`). Covered at `test/assessment-contract.test.ts:548`. |
| AP-03 | P1 | Add `token: "TOP_SECRET"` to a context source or another unknown snapshot field. It was copied into the report trace. | A report may reflect only used entries in the declared shape; unrelated or secret input must not be reflected (section 2). | Resolved by exact snapshot/entry/source validation before canonical copying. The leak regression is in the test beginning at line 548. |
| AP-04 | P1 | Return `{state:"unavailable", value:99, missing:[...], issues:[...]}` or a `not-applicable` evaluation with an `outcomes` member. The engine silently selected one union arm and discarded the forbidden field. | Artifact and evaluation discriminants are a machine contract; malformed protocol results must become analysis-unavailable or rule-error, never be sanitized into a valid result (sections 3, 4 and 7). | Resolved. `normalizeArtifact` and `normalizeEvaluation` enforce exact and required fields for every arm (`src/validate/assessment.ts:1311`, `:1356`). Regressions begin at test lines 901 and 1153. |
| AP-05 | P1 | Omit or corrupt nested subjects, sources, quantities, `producedBy`, authority citations, or the identity inside `MissingInput.analysis`; extra nested `secret` fields survived earlier shallow checks. | Subject, source, producer identity and machine-readable evidence are the traceability boundary (section 5); non-JSON or malformed evidence is an execution error (section 7). | Resolved. Outcome, evidence, source, missing-input, issue, quantity, authority and exact-identity validators run recursively (`src/validate/assessment.ts:1399-1720`). Covered by the tests at lines 901, 1153 and 1251. |
| AP-06 | P1 | Return `partial` or `unavailable` with `missing: []`, or `unavailable` with `issues: []`. | ADR-0054 requires non-empty `missing` on both non-complete artifact states and a meaningful execution issue for unavailable results (section 3). | Resolved in `normalizeArtifact` and in the engine-owned `unavailable` constructor. Runtime regressions begin at line 982. |
| AP-07 | P1 | A required context decoder returned `{ok:false}`, threw, returned a malformed arm, returned a `Map`, or hid a function under a symbol/non-enumerable property. These cases were previously conflated or incompletely checked. | Decoder rejection is invalid project input; decoder exception/malformed output is implementation failure. Non-JSON executable state may not cross the boundary (sections 1, 2 and 7). | Resolved. Rejection becomes `invalid`, while exceptions, malformed arms, non-JSON values and hidden state become `execution-error`; provider/rule code is not invoked (`src/validate/assessment.ts:1191`, `:1245`). Covered at line 739. |
| AP-08 | P1 | Throw a proxy-wrapped `Error` whose `name`, `message` or prototype inspection throws, or throw a raw string such as `TOP_SECRET`. Error handling itself threw or could echo the arbitrary value. | Provider/rule failure must not abort the call, expose stack data, or serialize arbitrary thrown objects (section 7). | Resolved by defensive `safeErrorMessage` (`src/validate/assessment.ts:1806`) and configuration wrappers. Hostile and non-`Error` fixtures begin at test line 1023. |
| AP-09 | P1 | Copy the old registry's discoverable symbol brand onto a forged structural object containing duplicates. The forged value passed the runtime gate. | A call must accept only a validated local immutable registry; a structural copy may not bypass preflight (section 6). | Resolved. `LocalAssessmentRegistry` uses an unexported private-field brand (`src/validate/assessment.ts:75`). The forged-symbol regression begins at line 306. |
| AP-10 | P1 | Reach the registry class through `validRegistry.constructor` and instantiate it directly with duplicate definitions. The constructor originally skipped validation. | Every construction path must perform full registry preflight (section 6). | Resolved. The constructor performs preflight, snapshots, and preflights the snapshot again. Direct-constructor coverage is at line 306. |
| AP-11 | P1 | Override the caller array's own `.map()` so the first validation saw one analysis while the snapshot contained two duplicate IDs. | Registry content must be a stable snapshot, independent of caller mutation or method replacement (sections 6 and 10). | Resolved. Copying uses indexed `snapshotMap`, not a caller method, and validates both sides of the copy (`src/validate/assessment.ts:75`, `:1916`). Covered at line 306. |
| AP-12 | P1 | Pass `null` as the snapshot, `null`/`undefined` as options, `[undefined]` as an analysis/context requirement, or falsy non-object jurisdiction/effective values. Raw `TypeError`s escaped or optional fields were silently dropped. | Malformed registry/public protocol data must fail as `AssessmentConfigError` before execution (sections 2, 6, 7 and 9). | Resolved by outer configuration conversion, exact options validation, element-shape guards and explicit `!== undefined` checks (`src/validate/assessment.ts:244-285`, `:296-450`, `:741-968`). Covered at lines 376, 548 and 1312. |
| AP-13 | P1 | Put an extra field in `EffectiveRange`, omit `AuthorityCitation.jurisdiction`, or use symbol, non-enumerable or accessor state in effective/jurisdiction. A branded registry could retain data or functions that preflight never saw. | The registry is a validated immutable catalog, and only declared execution functions are exempt from the JSON boundary (sections 1 and 6). | Resolved. Catalog/component shapes are checked before reads; effective and jurisdiction are plain JSON with exact data fields; getters are rejected without execution (`src/validate/assessment.ts:296-450`, `:741-852`, `:968`). Covered at lines 1312 and 1498. |
| AP-14 | P1 | A required analysis/context or direct `runAnalysis` reference used malformed fields or an accessor identity. Some paths read the reference before checking its exact shape. | Exact identity and revision resolution are preflight requirements, and untrusted getters must not become hidden work (sections 1, 6 and 9). | Resolved. `validateReferenceIdentity` checks the two own data fields before identity access (`src/validate/assessment.ts:632`). Registry component shapes are likewise checked before `uniqueMap` reads them. |
| AP-15 | P2 | Canonicalize `JSON.parse('{"__proto__":{"polluted":true}}')`. Ordinary assignment lost the own key and changed the clone prototype. | JSON values must round-trip without changing shape or contaminating object semantics (sections 1 and 10). | Resolved with `Object.defineProperty` in `canonicalJsonValue` (`src/analysis/json.ts:82`). Covered at test line 160. |
| AP-16 | P2 | Canonicalize `-0`; JSON serialization changed it to `0` only after the canonical object had been produced. | The canonical in-memory value and its JSON bytes should not disagree. | Resolved by normalizing `-0` to `0` in `canonicalJsonValue`. Covered at line 160. |
| AP-17 | P2 | Compare `"\uE000"` and `"😀"` with JavaScript string comparison. UTF-16 unit order placed the astral character first, contrary to Unicode scalar-value order. | Outcome, evidence and context keys use code-point order, not locale or UTF-16 order (section 10). | Resolved by iterator/code-point comparison (`src/analysis/json.ts:106`). Boundary and report-order regressions begin at lines 160 and 1117. |
| AP-18 | P2 | Validate `0001-01-01` through `Date.UTC`; JavaScript remapped years 0-99 and rejected real four-digit dates. | `asOf` is a spelled calendar date and may not depend on host date APIs (sections 2 and 10). | Resolved by explicit Gregorian month/leap-day validation (`src/validate/assessment.ts:874`). Covered at line 1459. |
| AP-19 | P2 | Attempt to force code-point enumeration of object keys `"10"` and `"2"`. ECMAScript always enumerates integer-index keys numerically. | The broad byte-determinism requirement needs an implementable statement. | Resolved as a language constraint, not a runtime defect: `canonicalJsonValue` documents integer-index ordering and still guarantees insertion-order-independent bytes. Protocol collection keys are namespaced IDs, not integer indices. Covered at line 160. |

## Minimal adversarial fixtures

The following shapes capture the high-risk boundaries without depending on built-in analyses or
rules. They are useful when the engine is moved or rewritten.

```ts
// Configuration must fail without touching model.
const untouched = new Proxy(model, { get() { throw new Error("MODEL_TOUCHED"); } });
runAnalysis(untouched, unreachableRef, { registry, profile, context });

// This is malformed; `value` may not be inherited or fabricated by a decoder.
const context = {
  schema: "koyu-context/1",
  asOf: "2026-08-03",
  values: { "test.context.height": { source: { kind: "user", ref: "input" } } },
};

// A discriminated union may not carry fields from another arm.
const badArtifact = {
  state: "unavailable",
  value: 99,
  missing: [{ kind: "test.missing", data: {} }],
  issues: [{ kind: "execution-error", message: "bad provider" }],
};

// Hidden executable state is not JSON and must not survive registry/decoder preflight.
const effective: Record<PropertyKey, unknown> = { from: "2026-01-01" };
effective[Symbol("secret")] = () => "TOP_SECRET";
```

Expected contracts are, respectively: `AssessmentConfigError` with zero model reads; an
`AssessmentConfigError(invalid-context)`; an engine-owned unavailable/execution-error artifact; and a
configuration or decoder execution error with no secret in the DTO.

## Acceptance coverage at the generic-engine boundary

| ADR-0054 acceptance family | Current evidence | Review result |
|---|---|---|
| Identity, registry and preflight | Invalid IDs/revisions, same/different-revision duplicates, missing refs, exact mismatch, direct/indirect cycles, selected duplicate rules, hidden analyses, local immutable snapshot, structural forgery, constructor re-entry and hostile copy are exercised at test lines 198 and 306. | Generic engine covered. |
| Context and JSON | Non-JSON values, cycles, sparse/symbol values, `__proto__`, `-0`, real dates, exact snapshot/source shape, required present/missing/invalid, optional present/missing/invalid, provenance, unused filtering, shared-key normalization and insertion-order independence are covered by both suites. | Generic engine covered. |
| Analysis | Deep-readonly compile-time capability, complete/partial/unavailable, non-empty missing, partial acceptance, transitive reachability, undeclared reads, per-call cache, consistency preconditions, malformed/throwing providers and safe errors are covered at lines 152-158 and 376-1058. | Generic engine covered. Built-in before/after model snapshot tests remain deferred until built-ins exist on this protocol. |
| Rules and report | All four run states, mixed fail/indeterminate outcomes, non-applicable population, malformed/duplicate/empty outcomes and evidence, subject/source/quantity validation, finding projection, summary semantics, JSON round-trip and no `ok` are covered at lines 470 and 1059-1311. | Generic engine covered. |
| Determinism and isolation | Repeated byte equality, context insertion order, Unicode scalar order, declaration order, one diagnostic call site, per-call cache and a source negative scan for globals/I/O/time are covered in the contract suite. The acceptance suite adds alternating and reverse registry/profile execution, re-entry, separate model/call caches, reversed pack composition, a branched shared-dependency post-order fixture, two rule-set ordering and diagnostic-order expectations. | Generic engine covered. Cross-process locale and module-import-order checks remain distribution/integration evidence. |
| Three entry points | Not in the reviewed source set. | Deferred: direct operation DTO = CLI parsed JSON = MCP `structuredContent` for assessment and analysis, plus missing-profile and incomplete-report transport semantics. |
| Domain and distribution | Type-level Model capability is checked here; repository domain/package gates are separate. | Deferred: built-in rule source boundary, public external fixture, packed subpath imports, zero-runtime-dependency/package smoke, examples, docs and conformance gates. |

## Source invariants confirmed

- `checkDiagnostics(model)` has one engine call site, in `diagnoseModel`; configuration and the direct
  analysis reachability check occur first.
- The module has no registration/unregistration API, mutable global registry/catalog, package scan,
  filesystem/path/environment access, machine-clock read, or `localeCompare` ordering.
- Analysis cache and used-context state are constructed per call.
- Rules receive `RuleRunContext`, which has no `Model`; only analysis providers receive
  `DeepReadonly<Model>`.
- Report arrays preserve diagnostic scan order, profile/rule declaration order and dependency
  post-order; only outcome, evidence and context-key collections use code-point sorting.

## Verification commands

The final command results are recorded after the implementation stopped changing:

```text
npm run typecheck
  exit 0

node --import tsx --test test/assessment-contract.test.ts test/assessment-acceptance.test.ts
  32 tests, 32 pass, 0 fail
```

The negative source scan returned no forbidden registration, discovery, I/O, current-time or locale
match, and `rg -n "checkDiagnostics\\(" src/validate/assessment.ts` returned the single call at line
289.

The post-fix spot checks also confirmed that symbol/accessor effective data is rejected, context
decoder hidden state becomes execution-error, forged registries are rejected, unreachable analyses
do not touch the model, `0001-01-01` is accepted, and `__proto__` round-trips as an own data property.

## Handoff

The API architecture plan may treat this protocol as the protected execution kernel, with three
conditions:

1. extension catalogs remain explicit values and never become process-global registration;
2. adapters return the same DTO rather than reimplementing analysis or judgement; and
3. the deferred built-in, transport, package and documentation gates are completed before declaring
   the whole ADR shipped.
