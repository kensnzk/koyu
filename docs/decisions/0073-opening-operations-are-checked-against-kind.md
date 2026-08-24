# 0073 — Opening operations are checked against kind

## Context

Doors and windows use one attribute ledger, so `style:` has one closed vocabulary. Some values in
that vocabulary apply only to doors and others only to windows. The value check could establish
that a word existed but could not establish that it applied to the opening kind. A door carrying
`style:fixed` therefore passed `check` and the plan silently replaced it with a hinged leaf. A
window carrying `style:rolling-shutter` passed and lost the requested operation from its plan.

## Decision

Keep one vocabulary because the shared operations retain one spelling. Partition its known values
into operations accepted by doors and operations accepted by windows. OPN09 rejects a known value
used on the wrong kind. ATT02 continues to own words outside the vocabulary, so one spelling error
does not produce two diagnostics.

An asset is checked at its declaration whether or not it is referenced. An opening that inherits
the same incompatible value from that asset is not reported a second time. An instance override is
checked at the instance.

The plan renderer no longer turns an unsupported door operation into a hinged leaf. It emits no
operation mark for an invalid combination; `check` supplies the reason.

## Consequences

The common hinged and sliding operations remain valid on both kinds. Door-only automatic,
entrance, gate, vertical-door and unequal-leaf operations cannot be written on windows. Window-only
fixed and projecting operations cannot be written on doors.

This adds a structural check without changing the canonical model or Form, so the muro version does
not move under the stability rule for diagnostics.
