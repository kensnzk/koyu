"""Write one koyu building out as IFC4.

The input is the single JSON document `bin/koyu-form.mjs` produces: the Form (shape) paired with
the canonical JSON (attributes).

**The wall is built at full length and the opening is cut out of it.**
`FormBoundary.material.panels` is already divided by the openings, so taking the panels as the
material would give correct geometry on its own. But then there is no `IfcOpeningElement`, and
**which wall a door is hosted in is nowhere in the IFC**. So the wall is built whole, the opening
box is removed by `IfcRelVoidsElement`, and the leaf is fitted by `IfcRelFillsElement`. The panels
are not thrown away — they are the check: the result of the boolean should equal their union.

**There is no OwnerHistory.** IFC4 makes it optional, and koyu's position is that git holds the
history. Inventing a person, an organisation and a timestamp here would also make the output
different on every run.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import ifcopenshell

from .geometry import Builder, box_across, rectangle_along
from .identity import global_id, space_identity, wall_identity

# The cutting box is made slightly thicker than the wall. Exactly coplanar faces make the
# boolean unstable.
OPENING_OVERSHOOT_MM = 2.0
# The leaf's own thickness — the door, not the wall it sits in.
LEAF_THICKNESS_MM = 40.0


def _direction_of_true_north(f, azimuth_deg: float):
    """True north, expressed in the model's own coordinates.

    `azimuth` is the true bearing of the +Y axis, clockwise from north, so true north is +Y turned
    counter-clockwise by that much. At 0 it is (0,1) = +Y; at 90 it is (-1,0) = -X.
    """
    import math

    a = math.radians(azimuth_deg)
    return f.create_entity("IfcDirection", DirectionRatios=(-math.sin(a), math.cos(a)))


def export(data: dict) -> ifcopenshell.file:
    form = data["form"]
    canonical = data["canonical"]
    name = canonical.get("name") or "koyu"

    f = ifcopenshell.file(schema="IFC4")

    # ---- Units. koyu is millimetres, so the numbers pass through unchanged ----
    mm = f.create_entity("IfcSIUnit", UnitType="LENGTHUNIT", Prefix="MILLI", Name="METRE")
    m2 = f.create_entity("IfcSIUnit", UnitType="AREAUNIT", Name="SQUARE_METRE")
    m3 = f.create_entity("IfcSIUnit", UnitType="VOLUMEUNIT", Name="CUBIC_METRE")
    units = f.create_entity("IfcUnitAssignment", Units=[mm, m2, m3])

    # ---- The representation context. True north rides here ----
    context = f.create_entity(
        "IfcGeometricRepresentationContext",
        ContextType="Model",
        CoordinateSpaceDimension=3,
        Precision=1e-5,
        WorldCoordinateSystem=f.create_entity(
            "IfcAxis2Placement3D",
            Location=f.create_entity("IfcCartesianPoint", Coordinates=(0.0, 0.0, 0.0)),
        ),
        TrueNorth=(
            _direction_of_true_north(f, canonical["azimuth"]) if "azimuth" in canonical else None
        ),
    )
    body = f.create_entity(
        "IfcGeometricRepresentationSubContext",
        ContextIdentifier="Body",
        ContextType="Model",
        ParentContext=context,
        TargetView="MODEL_VIEW",
    )
    b = Builder(f, body)

    # ---- Spatial structure ----
    project = f.create_entity(
        "IfcProject",
        GlobalId=global_id("project", name),
        Name=name,
        UnitsInContext=units,
        RepresentationContexts=[context],
    )
    site = f.create_entity(
        "IfcSite",
        GlobalId=global_id("site", name),
        Name="Site",
        ObjectPlacement=b.local_placement(),
        CompositionType="ELEMENT",
    )
    building = f.create_entity(
        "IfcBuilding",
        GlobalId=global_id("building", name),
        Name=name,
        ObjectPlacement=b.local_placement(),
        CompositionType="ELEMENT",
    )
    _aggregate(f, project, [site], "project-site")
    _aggregate(f, site, [building], "site-building")

    storeys = {}
    for level in form["levels"]:
        storeys[level["name"]] = f.create_entity(
            "IfcBuildingStorey",
            GlobalId=global_id("storey", level["name"]),
            Name=level["name"],
            ObjectPlacement=b.local_placement(z=float(level["z"])),
            CompositionType="ELEMENT",
            Elevation=float(level["z"]),
        )
    _aggregate(f, building, list(storeys.values()), "building-storeys")

    # ---- Spaces ----
    spaces = {}
    by_storey_spaces = defaultdict(list)
    for s in form["spaces"]:
        attrs = canonical["spaces"].get(s["path"], {}).get("attrs", {})
        solid = b.shape(
            b.extrude(piece, float(s.get("z0", 0.0)), float(s.get("z1", 0.0)))
            for piece in _pieces(s["outline"])
        )
        space = f.create_entity(
            "IfcSpace",
            GlobalId=global_id("space", space_identity(s["path"], attrs)),
            Name=s["path"],
            LongName=attrs.get("name"),
            ObjectPlacement=b.local_placement(storeys.get(s.get("level"), building).ObjectPlacement),
            Representation=solid,
            CompositionType="ELEMENT",
            PredefinedType="INTERNAL" if s.get("indoor") else "EXTERNAL",
        )
        spaces[s["path"]] = space
        by_storey_spaces[s.get("level")].append(space)
        _koyu_pset(f, space, s, attrs)
    for level_name, members in by_storey_spaces.items():
        if level_name in storeys:
            _aggregate(f, storeys[level_name], members, f"storey-spaces-{level_name}")

    # ---- Walls. Cut the openings, fit the leaves ----
    seen_ref = defaultdict(int)
    walls = {}  # (ref, index) -> IfcWall
    wall_of_boundary = []  # in the Form's own order
    by_storey_elements = defaultdict(list)
    for bd in form["boundaries"]:
        index = seen_ref[bd["ref"]]
        seen_ref[bd["ref"]] += 1
        material = bd.get("material")
        seg = bd["segment"]
        if not material:
            # A boundary of kind `open` has a line and no matter. IFC keeps a type for exactly
            # this, and `IfcRelSpaceBoundary.RelatedBuildingElement` is not optional, so the
            # relation cannot be written without one.
            identity = wall_identity(bd["ref"], index)
            virtual = f.create_entity(
                "IfcVirtualElement",
                GlobalId=global_id("virtual", identity),
                Name=identity,
                ObjectPlacement=b.local_placement(
                    storeys.get(bd.get("level"), building).ObjectPlacement
                ),
            )
            wall_of_boundary.append(virtual)
            by_storey_elements[bd.get("level")].append(virtual)
            continue
        outline = rectangle_along(seg["x1"], seg["y1"], seg["x2"], seg["y2"], float(material["t"]))
        identity = wall_identity(bd["ref"], index)
        wall = f.create_entity(
            "IfcWall",
            GlobalId=global_id("wall", identity),
            Name=identity,
            ObjectPlacement=b.local_placement(storeys.get(bd.get("level"), building).ObjectPlacement),
            Representation=b.shape(
                [b.extrude(outline, float(material["z0"]), float(material["z1"]))]
            ),
            PredefinedType="STANDARD",
        )
        walls[(bd["ref"], index)] = (wall, seg)
        wall_of_boundary.append(wall)
        by_storey_elements[bd.get("level")].append(wall)

    # An opening finds its wall through the boundary ref; where one ref gave several walls, the
    # segment the opening sits on decides which.
    for op in form["openings"]:
        wall = _wall_for_opening(walls, op)
        if wall is None:
            continue
        seg = op["segment"]
        depth = float(op["t"]) + OPENING_OVERSHOOT_MM
        void = f.create_entity(
            "IfcOpeningElement",
            GlobalId=global_id("opening", op["ref"]),
            Name=op["ref"],
            ObjectPlacement=b.local_placement(wall.ObjectPlacement),
            Representation=b.shape(
                [
                    b.extrude(
                        box_across(
                            op["cx"], op["cy"], seg["x1"], seg["y1"], seg["x2"], seg["y2"],
                            float(op["w"]), depth,
                        ),
                        float(op["z0"]),
                        float(op["z1"]),
                    )
                ]
            ),
            PredefinedType="OPENING",
        )
        f.create_entity(
            "IfcRelVoidsElement",
            GlobalId=global_id("voids", op["ref"]),
            RelatingBuildingElement=wall,
            RelatedOpeningElement=void,
        )
        filler = f.create_entity(
            "IfcDoor" if op["kind"] == "door" else "IfcWindow",
            GlobalId=global_id("filler", op["ref"]),
            Name=op.get("name") or op["ref"],
            ObjectPlacement=b.local_placement(wall.ObjectPlacement),
            Representation=b.shape(
                [
                    b.extrude(
                        box_across(
                            op["cx"], op["cy"], seg["x1"], seg["y1"], seg["x2"], seg["y2"],
                            float(op["w"]), LEAF_THICKNESS_MM,
                        ),
                        float(op["z0"]),
                        float(op["z1"]),
                    )
                ]
            ),
            OverallHeight=float(op["z1"]) - float(op["z0"]),
            OverallWidth=float(op["w"]),
        )
        f.create_entity(
            "IfcRelFillsElement",
            GlobalId=global_id("fills", op["ref"]),
            RelatingOpeningElement=void,
            RelatedBuildingElement=filler,
        )
        by_storey_elements[op.get("level")].append(filler)

    # ---- Slabs and columns ----
    for slab in form["slabs"]:
        element = f.create_entity(
            "IfcSlab",
            GlobalId=global_id("slab", f"{slab['space']}/{slab['kind']}"),
            Name=f"{slab['space']} {slab['kind']}",
            ObjectPlacement=b.local_placement(
                storeys.get(slab.get("level"), building).ObjectPlacement
            ),
            Representation=b.shape(
                [b.extrude(_ring(slab["outline"]), float(slab["z0"]), float(slab["z1"]))]
            ),
            PredefinedType="ROOF" if slab["kind"] == "roof" else "FLOOR",
        )
        by_storey_elements[slab.get("level")].append(element)

    for col in form["columns"]:
        half_w, half_d = float(col["w"]) / 2.0, float(col["d"]) / 2.0
        x, y = float(col["x"]), float(col["y"])
        element = f.create_entity(
            "IfcColumn",
            GlobalId=global_id("column", col["ref"]),
            Name=col["ref"],
            ObjectPlacement=b.local_placement(
                storeys.get(col.get("level"), building).ObjectPlacement
            ),
            Representation=b.shape(
                [
                    b.extrude(
                        [
                            (x - half_w, y - half_d),
                            (x + half_w, y - half_d),
                            (x + half_w, y + half_d),
                            (x - half_w, y + half_d),
                        ],
                        float(col["z0"]),
                        float(col["z1"]),
                    )
                ]
            ),
        )
        by_storey_elements[col.get("level")].append(element)

    for level_name, members in by_storey_elements.items():
        if level_name in storeys and members:
            f.create_entity(
                "IfcRelContainedInSpatialStructure",
                GlobalId=global_id("contains", f"storey:{level_name}"),
                RelatingStructure=storeys[level_name],
                RelatedElements=members,
            )

    # ---- Space boundaries. **What a working export drops first, koyu holds as a first-class
    # edge.** ----
    for bd, element in zip(form["boundaries"], wall_of_boundary):
        physical = "VIRTUAL" if element.is_a("IfcVirtualElement") else "PHYSICAL"
        for side, other in (("a", "b"), ("b", "a")):
            space = spaces.get(bd[side])
            if space is None:
                continue
            external = bd[other] not in spaces
            f.create_entity(
                "IfcRelSpaceBoundary",
                GlobalId=global_id("boundary", f"{bd['ref']}/{side}/{bd[other]}"),
                Name=bd["ref"],
                RelatingSpace=space,
                RelatedBuildingElement=element,
                PhysicalOrVirtualBoundary=physical,
                InternalOrExternalBoundary="EXTERNAL" if external else "INTERNAL",
            )

    return f


# ---- Small parts ----


def _pieces(outline) -> list:
    """FormSpace.outline is a list of convex pieces. One ring of points per piece."""
    return [_ring(piece) for piece in outline]


def _ring(points) -> list:
    return [(float(p["x"]), float(p["y"])) for p in points]


def _aggregate(f, whole, parts, tag: str):
    if not parts:
        return
    f.create_entity(
        "IfcRelAggregates",
        GlobalId=global_id("aggregates", tag),
        RelatingObject=whole,
        RelatedObjects=parts,
    )


def _wall_for_opening(walls: dict, op: dict):
    """The wall an opening is hosted in.

    One `boundary` declaration splits into several segments, so the ref alone does not pick a
    wall. **An opening already knows which segment it sits on**, so the segment decides.
    """
    boundary_ref = op["ref"].rsplit("/", 1)[0]
    seg = op["segment"]
    key = (seg["x1"], seg["y1"], seg["x2"], seg["y2"])
    fallback = None
    for (ref, _index), (wall, wall_seg) in walls.items():
        if ref != boundary_ref:
            continue
        if (wall_seg["x1"], wall_seg["y1"], wall_seg["x2"], wall_seg["y2"]) == key:
            return wall
        fallback = fallback or wall
    return fallback


def _koyu_pset(f, product, form_space: dict, attrs: dict):
    """Carry koyu's own facts into the IFC. **The path travels, so the IFC leads back to koyu.**"""
    values = [("koyu.path", form_space["path"])]
    if isinstance(attrs.get("uid"), str):
        values.append(("koyu.uid", attrs["uid"]))
    for key in ("indoor", "semiOutdoor", "outside", "void", "covered"):
        values.append((f"koyu.{key}", "true" if form_space.get(key) else "false"))
    if form_space.get("areaM2") is not None:
        values.append(("koyu.areaM2", str(form_space["areaM2"])))
    props = [
        f.create_entity(
            "IfcPropertySingleValue",
            Name=k,
            NominalValue=f.create_entity("IfcText", wrappedValue=v),
        )
        for k, v in values
    ]
    pset = f.create_entity(
        "IfcPropertySet",
        GlobalId=global_id("pset", form_space["path"]),
        Name="koyu",
        HasProperties=props,
    )
    f.create_entity(
        "IfcRelDefinesByProperties",
        GlobalId=global_id("defines", form_space["path"]),
        RelatedObjects=[product],
        RelatingPropertyDefinition=pset,
    )


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print("Usage: python -m koyu_ifc.export <form.json> <out.ifc>")
        return 2
    data = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    f = export(data)
    f.write(argv[2])
    print(f"Wrote {argv[2]}")
    return 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main(sys.argv))
