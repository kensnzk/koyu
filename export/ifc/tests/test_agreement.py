"""Read the written IFC back and require it to answer as koyu does.

**Producing an output is not the claim being made. Keeping the meaning is.** So none of these
tests looks at the file's spelling: each asks the IFC a question koyu can also answer, and
requires the two answers to agree.

Where an area is measured it comes out of the geometry engine rather than off the profile that
was written, so a wrong extrusion, a reversed winding or a lost placement all fail here. The
engine reports SI metres whatever the project unit says, which is why nothing is divided by a
million.
"""

from __future__ import annotations

import ifcopenshell.geom
import numpy as np
import pytest


def volume_m3(product) -> float:
    """The volume of a product's built shape, by the divergence theorem."""
    shape = ifcopenshell.geom.create_shape(ifcopenshell.geom.settings(), product)
    verts = np.array(shape.geometry.verts).reshape(-1, 3)
    faces = np.array(shape.geometry.faces).reshape(-1, 3)
    a, b, c = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
    return float(abs(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0))


def test_every_shape_builds(small_pair):
    """Every product carrying a representation resolves to a solid.

    A file can be schema-valid and still fail to build. This is the test a viewer would otherwise
    be the first to run.
    """
    _, f = small_pair
    failed = []
    built = 0
    for product in f.by_type("IfcProduct"):
        if not getattr(product, "Representation", None):
            continue
        try:
            volume_m3(product)
            built += 1
        except Exception as error:  # noqa: BLE001 - the message is the finding
            failed.append(f"{product.is_a()} {product.Name}: {error}")
    assert not failed, "\n".join(failed)
    assert built > 0


def test_space_area_agrees(small_pair):
    """Each space's floor area, measured off the built solid, equals koyu's own figure."""
    data, f = small_pair
    koyu_area = {s["path"]: s["areaM2"] for s in data["spaces"]}
    heights = {s["path"]: (s["z1"] - s["z0"]) / 1000.0 for s in data["spaces"] if s.get("z1")}
    checked = 0
    for space in f.by_type("IfcSpace"):
        path = space.Name
        if koyu_area.get(path) is None or not heights.get(path):
            continue
        assert volume_m3(space) / heights[path] == pytest.approx(koyu_area[path], abs=0.01), path
        checked += 1
    assert checked > 0


def test_every_space_is_present(pair):
    """No space is lost on the way out, at any size."""
    data, f = pair
    assert {s.Name for s in f.by_type("IfcSpace")} == {s["path"] for s in data["spaces"]}


def test_adjacency_agrees(pair):
    """The pairs of spaces that share a boundary are the same on both sides.

    `IfcRelSpaceBoundary` is what a working IFC export drops first. koyu holds the relation as a
    first-class edge, so it is exported rather than inferred — and this test makes that claim
    checkable rather than asserted.
    """
    data, f = pair
    spaces = {s["path"] for s in data["spaces"]}
    koyu_pairs = {
        frozenset((w["a"], w["b"]))
        for w in data["walls"]
        if w["a"] in spaces and w["b"] in spaces
    }
    by_boundary = {}
    for rel in f.by_type("IfcRelSpaceBoundary"):
        if rel.RelatingSpace.is_a("IfcSpace"):
            by_boundary.setdefault(rel.RelatedBuildingElement, set()).add(rel.RelatingSpace.Name)
    ifc_pairs = {frozenset(names) for names in by_boundary.values() if len(names) == 2}
    assert ifc_pairs == koyu_pairs


def test_door_count_agrees(pair):
    """The number of doors between two spaces, walked through the IFC relations.

    The walk is the one a consumer has to make: door -> IfcRelFillsElement -> opening ->
    IfcRelVoidsElement -> wall -> IfcRelSpaceBoundary -> space. A missing link shows up as a short
    count, so this holds the relation graph and not just the objects.
    """
    data, f = pair
    spaces = {s["path"] for s in data["spaces"]}
    koyu_doors = {}
    for op in data["openings"]:
        if op["kind"] != "door" or op["a"] not in spaces or op["b"] not in spaces:
            continue
        key = frozenset((op["a"], op["b"]))
        koyu_doors[key] = koyu_doors.get(key, 0) + 1

    wall_of_opening = {
        r.RelatedOpeningElement: r.RelatingBuildingElement for r in f.by_type("IfcRelVoidsElement")
    }
    spaces_of_wall = {}
    for rel in f.by_type("IfcRelSpaceBoundary"):
        if rel.RelatedBuildingElement is not None and rel.RelatingSpace.is_a("IfcSpace"):
            spaces_of_wall.setdefault(rel.RelatedBuildingElement, set()).add(rel.RelatingSpace.Name)

    ifc_doors = {}
    for fills in f.by_type("IfcRelFillsElement"):
        if not fills.RelatedBuildingElement.is_a("IfcDoor"):
            continue
        names = spaces_of_wall.get(wall_of_opening.get(fills.RelatingOpeningElement), set())
        if len(names) != 2:
            continue
        key = frozenset(names)
        ifc_doors[key] = ifc_doors.get(key, 0) + 1

    assert ifc_doors == koyu_doors


def test_boolean_result_equals_the_panels(small_pair):
    """A wall's volume after the openings are cut equals the volume of koyu's panels.

    `material.panels` is koyu's own answer for what is left of a wall once the openings are taken
    out. It was not used to build the geometry — the wall was built whole and the openings were
    subtracted — so agreeing here means two derivations met that never met on the way in.
    """
    data, f = small_pair
    walls = {w.Name: w for w in f.by_type("IfcWall")}
    seen = {}
    checked = 0
    for w in data["walls"]:
        index = seen.get(w["ref"], 0)
        seen[w["ref"]] = index + 1
        material = w.get("material")
        if not material:
            continue
        wall = walls.get(f"{w['ref']}#{index}")
        assert wall is not None, f"no wall for {w['ref']}#{index}"
        expected = sum(
            (((p["x2"] - p["x1"]) ** 2 + (p["y2"] - p["y1"]) ** 2) ** 0.5)
            * material["t"]
            * (p["z1"] - p["z0"])
            for p in material["panels"]
        ) / 1e9
        assert volume_m3(wall) == pytest.approx(expected, rel=0.02), wall.Name
        checked += 1
    assert checked > 0


def test_nothing_koyu_holds_is_dropped(pair):
    """Every block koyu produced reaches the file. A silent omission is the failure mode here."""
    data, f = pair
    expected = {
        "IfcSpace": len(data["spaces"]),
        "IfcSlab": len(data["slabs"]),
        "IfcColumn": len(data["columns"]),
        "IfcCovering": len(data["segs"]),
        "IfcOpeningElement": len(data["openings"]),
    }
    for kind, n in expected.items():
        assert len(f.by_type(kind)) == n, kind
    # A run becomes a stair, a ramp or a transport element depending on the device.
    runs = len(f.by_type("IfcStair")) + len(f.by_type("IfcRamp")) + len(f.by_type("IfcTransportElement"))
    assert runs == len(data["runs"])
    # A boundary becomes a wall where it has matter and a virtual element where it does not.
    assert len(f.by_type("IfcWall")) + len(f.by_type("IfcVirtualElement")) == len(data["walls"])
