"""Decide an IFC GlobalId from a koyu identity.

**The same model yields the same GlobalIds, on any machine, on every run.** No lookup table and
no state file: a GlobalId is a function of koyu's identity, not a random number drawn per export.

So editing one room and exporting again leaves **every untouched object holding its GlobalId**.

Where identity comes from is already settled by `docs/reference/identity.md`.

    space or zone with a uid     the uid          survives a rename
    space or zone without one    the path         a rename cuts the correspondence
    boundary                     its ref (both ends plus the position among declarations)
    opening, seg, column         its ref (the container plus a name unique inside it)

So only a space carrying `uid:` keeps its IFC identity across a rename. That is koyu's own uid
contract, surfacing on the IFC face.
"""

from __future__ import annotations

import uuid

import ifcopenshell.guid

# Derived once as uuid5(NAMESPACE_URL, "https://github.com/kensnzk/koyu#ifc").
# **This value must not change.** Change it and the same building yields different GlobalIds,
# cutting the correspondence with every IFC file already written.
NAMESPACE = uuid.UUID("fb2ab0b6-b032-5b19-a7c9-377840b94073")


def global_id(kind: str, identity: str) -> str:
    """The GlobalId for `identity` within `kind`, in IFC's 22-character form.

    `kind` is a prefix. A space and its floor slab stand on the same path, so without it the two
    would take the same GlobalId.
    """
    return ifcopenshell.guid.compress(uuid.uuid5(NAMESPACE, f"{kind}:{identity}").hex)


def space_identity(path: str, attrs: dict) -> str:
    """A space or zone's identity — the uid where one is written, otherwise the path.

    A uid exists to survive a rename, so where one is written it outranks the path.
    """
    uid = attrs.get("uid")
    return str(uid) if isinstance(uid, str) and uid else path


def wall_identity(ref: str, index_within_ref: int) -> str:
    """A wall's identity.

    **A `ref` is not unique across FormBoundary entries.** One `boundary` declaration can be
    realised as several segments: in two-rooms, `/L1/a|/out@1` comes out three times, because the
    perimeter splits into three faces. So the index in derivation order is added.

    The index was chosen over the segment's endpoints to follow the doctrine in identity.md —
    **a relation is identified by its two ends**, so a wall that moves is still the same wall.
    Derivation order is deterministic, and `test/fingerprints.test.ts` pins it by machine as part
    of the Form's hash.
    """
    return f"{ref}#{index_within_ref}"
