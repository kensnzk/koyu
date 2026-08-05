"""Read the written IFC back and require it to answer as koyu does.

**Producing an output is not the claim being made. Keeping the meaning is.** So none of these
tests looks at the file's spelling: each one asks the IFC a question koyu can also answer, and
requires the two answers to agree.

Areas come out of the geometry engine rather than off the profile that was written, so a wrong
extrusion, a reversed winding or a lost placement all fail here. The engine reports SI metres
whatever the project unit says, which is why nothing is divided by a million.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import ifcopenshell
import ifcopenshell.geom
import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from koyu_ifc.export import export  # noqa: E402

EXAMPLES = ["examples/two-rooms.muro", "examples/house/main.muro"]


def read_koyu(entry: str) -> dict:
    out = subprocess.run(
        ["node", str(ROOT / "export/ifc/bin/koyu-form.mjs"), str(ROOT / entry)],
        capture_output=True,
        check=True,
    )
    return json.loads(out.stdout)


@pytest.fixture(scope="module", params=EXAMPLES)
def pair(request, tmp_path_factory):
    """One koyu model and the IFC written from it."""
    data = read_koyu(request.param)
    path = tmp_path_factory.mktemp("ifc") / "model.ifc"
    export(data).write(str(path))
    return data, ifcopenshell.open(str(path))


def volume_m3(product) -> float:
    """The volume of a product's built shape, by the divergence theorem."""
    shape = ifcopenshell.geom.create_shape(ifcopenshell.geom.settings(), product)
    verts = np.array(shape.geometry.verts).reshape(-1, 3)
    faces = np.array(shape.geometry.faces).reshape(-1, 3)
    a, b, c = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
    return float(abs(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0))


def test_every_shape_builds(pair):
    """Every product carrying a representation resolves to a solid.

    A file can be schema-valid and still fail to build. This is the test that a viewer would
    otherwise be the first to run.
    """
    _, f = pair
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


def test_space_area_agrees(pair):
    """Each space's floor area, measured off the built solid, equals koyu's own figure."""
    data, f = pair
    koyu_area = {s["path"]: s["areaM2"] for s in data["form"]["spaces"]}
    heights = {s["path"]: (s["z1"] - s["z0"]) / 1000.0 for s in data["form"]["spaces"]}
    checked = 0
    for space in f.by_type("IfcSpace"):
        path = space.Name
        if koyu_area.get(path) is None or not heights.get(path):
            continue
        got = volume_m3(space) / heights[path]
        assert got == pytest.approx(koyu_area[path], abs=0.01), path
        checked += 1
    assert checked == len([p for p, a in koyu_area.items() if a is not None])


def test_adjacency_agrees(pair):
    """The pairs of spaces that share a boundary are the same on both sides.

    `IfcRelSpaceBoundary` is what a working IFC export drops first. koyu holds the relation as a
    first-class edge, so it is exported rather than inferred — and this test is what makes that
    claim checkable rather than asserted.
    """
    data, f = pair
    spaces = {s["path"] for s in data["form"]["spaces"]}
    koyu_pairs = {
        frozenset((b["a"], b["b"]))
        for b in data["form"]["boundaries"]
        if b["a"] in spaces and b["b"] in spaces
    }
    by_space = {}
    for rel in f.by_type("IfcRelSpaceBoundary"):
        by_space.setdefault(rel.Name, set()).add(rel.RelatingSpace.Name)
    ifc_pairs = {frozenset(names) for names in by_space.values() if len(names) == 2}
    assert ifc_pairs == koyu_pairs


def test_door_count_agrees(pair):
    """The number of doors between two spaces, walked through the IFC relations.

    The walk is the one a consumer has to make: door -> IfcRelFillsElement -> opening ->
    IfcRelVoidsElement -> wall -> IfcRelSpaceBoundary -> space. If any link is missing the count
    comes out short, so this holds the relation graph and not just the objects.
    """
    data, f = pair
    koyu_doors = {}
    for op in data["form"]["openings"]:
        if op["kind"] != "door":
            continue
        koyu_doors[frozenset((op["a"], op["b"]))] = koyu_doors.get(frozenset((op["a"], op["b"])), 0) + 1

    wall_of_opening = {r.RelatedOpeningElement: r.RelatingBuildingElement for r in f.by_type("IfcRelVoidsElement")}
    spaces_of_wall = {}
    for rel in f.by_type("IfcRelSpaceBoundary"):
        if rel.RelatedBuildingElement is not None:
            spaces_of_wall.setdefault(rel.RelatedBuildingElement, set()).add(rel.RelatingSpace.Name)

    ifc_doors = {}
    for fills in f.by_type("IfcRelFillsElement"):
        if not fills.RelatedBuildingElement.is_a("IfcDoor"):
            continue
        wall = wall_of_opening.get(fills.RelatingOpeningElement)
        pair_names = spaces_of_wall.get(wall, set())
        if len(pair_names) != 2:
            continue
        key = frozenset(pair_names)
        ifc_doors[key] = ifc_doors.get(key, 0) + 1

    internal = {k: v for k, v in koyu_doors.items() if len(k) == 2 and all(
        any(s["path"] == n for s in data["form"]["spaces"]) for n in k
    )}
    assert ifc_doors == internal


def test_boolean_result_equals_the_panels(pair):
    """A wall's volume after the openings are cut equals the volume of koyu's panels.

    `FormBoundary.material.panels` is koyu's own answer for what is left of a wall once the
    openings are taken out. It was not used to build the geometry — the wall was built whole and
    the openings were subtracted — so agreeing here means the two derivations met independently.
    """
    data, f = pair
    walls = {w.Name: w for w in f.by_type("IfcWall")}
    seen = {}
    checked = 0
    for bd in data["form"]["boundaries"]:
        index = seen.get(bd["ref"], 0)
        seen[bd["ref"]] = index + 1
        material = bd.get("material")
        if not material:
            continue
        wall = walls.get(f"{bd['ref']}#{index}")
        assert wall is not None, f"no wall for {bd['ref']}#{index}"
        panels = sum(
            abs(p["x2"] - p["x1"] or p["y2"] - p["y1"])
            * ((p["x2"] - p["x1"]) ** 2 + (p["y2"] - p["y1"]) ** 2) ** 0
            for p in material["panels"]
        )
        expected = sum(
            (((p["x2"] - p["x1"]) ** 2 + (p["y2"] - p["y1"]) ** 2) ** 0.5)
            * material["t"]
            * (p["z1"] - p["z0"])
            for p in material["panels"]
        ) / 1e9
        assert volume_m3(wall) == pytest.approx(expected, rel=0.02), wall.Name
        checked += 1
        del panels
    assert checked > 0
