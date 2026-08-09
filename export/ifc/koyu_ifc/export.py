"""Write one koyu building out as IFC4.

The input is the single JSON document `bin/koyu-form.mjs` produces. Every outline in it was
already raised by koyu's own constructors, so **this module holds no geometry rule at all** — it
decides which IFC entities exist and how they are related, and nothing about where a face is.

**The wall is built at full length and the opening is cut out of it.** koyu's `material.panels`
is already divided by the openings, so the panels alone would give correct geometry. But then no
`IfcOpeningElement` exists and **which wall hosts a door is nowhere in the file**. So the wall is
built whole, the opening box is removed by `IfcRelVoidsElement`, and the leaf is fitted by
`IfcRelFillsElement`. The panels become the check instead: the volume left after the boolean must
equal theirs, and the two derivations never met on the way in.

**There is no OwnerHistory.** IFC4 makes it optional, and koyu's position is that git holds the
history. Inventing a person, an organisation and a timestamp would also make the output different
on every run.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import ifcopenshell

from . import georeference, properties
from .geometry import Builder
from .identity import global_id, space_identity, wall_identity

LEAF_THICKNESS_MM = 40.0

# koyu's device names, and what IFC calls them.
RUN_ENTITY = {
    "stair": "IfcStair",
    "ramp": "IfcRamp",
    "escalator": "IfcTransportElement",
    "lift": "IfcTransportElement",
}
RUN_TYPE = {
    ("stair", "straight"): "STRAIGHT_RUN_STAIR",
    ("stair", "return"): "HALF_TURN_STAIR",
    ("ramp", "straight"): "STRAIGHT_RUN_RAMP",
    ("ramp", "return"): "HALF_TURN_RAMP",
    ("escalator", "straight"): "ESCALATOR",
    ("escalator", "return"): "ESCALATOR",
    ("lift", "straight"): "ELEVATOR",
    ("lift", "return"): "ELEVATOR",
}


# The canonical JSON spellings this exporter knows how to read.
#
# **Read the version, or do not carry one.** koyu stamps `format` on every document precisely
# so a reader can refuse a spelling it does not know; this exporter took the document apart
# without ever looking, so a key rename would have produced a wrong IFC rather than an error.
# It did: `koyu-canonical/1.2` became `1.3` when the language version key was renamed, and
# nothing here noticed.
#
# A minor bump adds keys and leaves the ones already there alone, so reading a newer minor is
# safe and stays listed. A major bump renames or reorders, and is not.
READS_CANONICAL = ("koyu-canonical/1.2", "koyu-canonical/1.3")


def export(data: dict) -> ifcopenshell.file:
    canonical = data["canonical"]
    declared = canonical.get("format")
    if declared not in READS_CANONICAL:
        raise ValueError(
            f"This is koyu-ifc, which reads {' / '.join(READS_CANONICAL)}. "
            f"The document says {declared!r}. Nothing is wrong with the document — "
            "the exporter has not learnt this spelling of the canonical form."
        )
    name = canonical.get("name") or "koyu"
    space_attrs = {p: s.get("attrs", {}) for p, s in canonical.get("spaces", {}).items()}
    boundary_attrs = _boundary_attrs(canonical)

    f = ifcopenshell.file(schema="IFC4")

    # ---- Units. koyu is millimetres, so the numbers pass through unchanged ----
    units = f.create_entity(
        "IfcUnitAssignment",
        Units=[
            f.create_entity("IfcSIUnit", UnitType="LENGTHUNIT", Prefix="MILLI", Name="METRE"),
            f.create_entity("IfcSIUnit", UnitType="AREAUNIT", Name="SQUARE_METRE"),
            f.create_entity("IfcSIUnit", UnitType="VOLUMEUNIT", Name="CUBIC_METRE"),
            f.create_entity("IfcSIUnit", UnitType="PLANEANGLEUNIT", Name="RADIAN"),
        ],
    )

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
        TrueNorth=_true_north(f, canonical.get("azimuth")),
    )
    body = f.create_entity(
        "IfcGeometricRepresentationSubContext",
        ContextIdentifier="Body",
        ContextType="Model",
        ParentContext=context,
        TargetView="MODEL_VIEW",
    )
    b = Builder(f, body)
    vocabulary = properties.Vocabulary(f)

    # ---- Georeferencing. Both halves of the frame or neither ----
    if "origin" in canonical and "azimuth" in canonical:
        georeference.write(f, context, canonical["origin"], float(canonical["azimuth"]))

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
        Name=data["site"][0]["path"] if data["site"] else "Site",
        ObjectPlacement=b.local_placement(),
        Representation=b.footprint(data["site"][0]["points"]) if data["site"] else None,
        CompositionType="ELEMENT",
        RefElevation=float(canonical["origin"]["elevation"])
        if "origin" in canonical and "elevation" in canonical["origin"]
        else None,
    )
    if data["site"]:
        properties.attach_quantities(
            f,
            site,
            f"site:{data['site'][0]['path']}",
            "Qto_SiteBaseQuantities",
            [properties.area(f, "GrossArea", data["site"][0]["areaM2"])],
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
    for level in data["levels"]:
        storeys[level["name"]] = f.create_entity(
            "IfcBuildingStorey",
            GlobalId=global_id("storey", level["name"]),
            Name=level["name"],
            ObjectPlacement=b.local_placement(z=float(level["z"])),
            CompositionType="ELEMENT",
            Elevation=float(level["z"]),
        )
    _aggregate(f, building, list(storeys.values()), "building-storeys")

    # **Every product is placed against the building, not against its storey.**
    #
    # koyu's Form carries absolute coordinates — a space on the fifth floor already has its real z
    # — so hanging a product off a storey placement that also carries the storey's elevation adds
    # the elevation twice and lifts the whole floor. The storey keeps its own placement and its
    # `Elevation` attribute, which is what a tool reads to know where the storey datum is; which
    # storey a product belongs to is stated by `IfcRelContainedInSpatialStructure`, which is the
    # normative way to say it and does not depend on the placement chain.
    #
    # The alternative — making every coordinate relative to its storey — is the more usual IFC
    # shape, but koyu spaces may span storeys (an entrance hall through two floors), so there is
    # no one storey to be relative to.
    def placed_in(_level_name):
        return b.local_placement(building.ObjectPlacement)

    elements = defaultdict(list)

    # ---- Spaces ----
    spaces = {}
    by_storey_spaces = defaultdict(list)
    for s in data["spaces"]:
        attrs = space_attrs.get(s["path"], {})
        product = f.create_entity(
            "IfcSpace",
            GlobalId=global_id("space", space_identity(s["path"], attrs)),
            Name=s["path"],
            LongName=attrs.get("name"),
            ObjectPlacement=placed_in(s.get("level")),
            Representation=b.shape(
                b.extrude(piece, float(s.get("z0", 0.0)), float(s.get("z1", 0.0)))
                for piece in s["outline"]
            ),
            CompositionType="ELEMENT",
            PredefinedType="INTERNAL" if s.get("indoor") else "EXTERNAL",
        )
        spaces[s["path"]] = product
        by_storey_spaces[s.get("level")].append(product)
        properties.space(f, product, s, attrs)
        if isinstance(attrs.get("use"), str):
            vocabulary.classify(product, "use", attrs["use"])
    for level_name, members in by_storey_spaces.items():
        if level_name in storeys:
            _aggregate(f, storeys[level_name], members, f"storey-spaces-{level_name}")

    # ---- The outside. A space with no region never reaches the Form, so it comes from the
    # canonical form. IFC4 has a type for exactly this, and without it every envelope boundary
    # would have nothing on its far side ----
    external = {}
    for path, s in sorted(canonical.get("spaces", {}).items()):
        if s.get("attrs", {}).get("outside") != 1 or path in spaces:
            continue
        external[path] = f.create_entity(
            "IfcExternalSpatialElement",
            GlobalId=global_id("external", space_identity(path, s.get("attrs", {}))),
            Name=path,
            LongName=s.get("attrs", {}).get("name"),
            ObjectPlacement=b.local_placement(),
            PredefinedType="EXTERNAL",
        )
    if external:
        f.create_entity(
            "IfcRelReferencedInSpatialStructure",
            GlobalId=global_id("references", "external"),
            RelatingStructure=site,
            RelatedElements=list(external.values()),
        )

    # ---- Walls. Cut the openings, fit the leaves ----
    seen_ref = defaultdict(int)
    walls = {}
    element_of_wall = []
    for w in data["walls"]:
        index = seen_ref[w["ref"]]
        seen_ref[w["ref"]] += 1
        identity = wall_identity(w["ref"], index)
        w["identity"] = identity
        attrs = boundary_attrs.get(w["ref"], {})
        is_external = w["a"] not in spaces or w["b"] not in spaces
        if not w.get("material"):
            # A boundary of kind `open` has a line and no matter. IFC keeps a type for exactly
            # this, and `IfcRelSpaceBoundary.RelatedBuildingElement` is not optional, so the
            # relation cannot be written without one.
            virtual = f.create_entity(
                "IfcVirtualElement",
                GlobalId=global_id("virtual", identity),
                Name=identity,
                ObjectPlacement=placed_in(w.get("level")),
            )
            element_of_wall.append(virtual)
            elements[w.get("level")].append(virtual)
            continue
        material = w["material"]
        product = f.create_entity(
            "IfcWall",
            GlobalId=global_id("wall", identity),
            Name=identity,
            ObjectPlacement=placed_in(w.get("level")),
            Representation=b.shape(
                [b.extrude(material["outline"], float(material["z0"]), float(material["z1"]))]
            ),
            PredefinedType="STANDARD",
        )
        walls[(w["ref"], index)] = (product, w["segment"])
        element_of_wall.append(product)
        elements[w.get("level")].append(product)
        properties.wall(f, product, w, attrs, is_external)
        if isinstance(attrs.get("spec"), str):
            vocabulary.associate_material(product, attrs["spec"])

    # ---- Door and window types. koyu's `asset` is IFC's type object, so it maps across whole ----
    types = {}
    for asset_name, asset in sorted(canonical.get("assets", {}).items()):
        style = asset.get("attrs", {}).get("style")
        is_door = asset["kind"] == "door"
        # IFC4 requires an operation on a door type and a partitioning on a window type. koyu's
        # `style` is a coarse word (`hinged` / `sliding` / `auto`) and IFC's enumerations name a
        # hand as well — so rather than inventing "sliding to the left", the koyu word goes in
        # under `USERDEFINED`, which is what that value is for. Nothing is claimed that the source
        # did not say.
        kind_args = (
            {
                "OperationType": "USERDEFINED" if isinstance(style, str) else "NOTDEFINED",
                **({"ElementType": style} if isinstance(style, str) else {}),
            }
            if is_door
            else {"PartitioningType": "NOTDEFINED"}
        )
        types[asset_name] = f.create_entity(
            "IfcDoorType" if is_door else "IfcWindowType",
            GlobalId=global_id("type", asset_name),
            Name=asset_name,
            PredefinedType="NOTDEFINED",
            **kind_args,
        )
        properties.attach_pset(
            f,
            types[asset_name],
            f"type:{asset_name}",
            "koyu",
            [properties.single(f, f"koyu.{k}", v) for k, v in sorted(asset.get("attrs", {}).items())],
        )
    by_type = defaultdict(list)

    # ---- Openings ----
    opening_attrs = _opening_attrs(canonical)
    for op in data["openings"]:
        wall = _wall_for_opening(walls, op)
        if wall is None:
            continue
        void = f.create_entity(
            "IfcOpeningElement",
            GlobalId=global_id("opening", op["ref"]),
            Name=op["ref"],
            ObjectPlacement=b.local_placement(wall.ObjectPlacement),
            Representation=b.shape(
                [b.extrude(op["cutOutline"], float(op["z0"]), float(op["z1"]))]
            ),
            PredefinedType="OPENING",
        )
        f.create_entity(
            "IfcRelVoidsElement",
            GlobalId=global_id("voids", op["ref"]),
            RelatingBuildingElement=wall,
            RelatedOpeningElement=void,
        )
        leaf = _leaf_outline(op)
        filler = f.create_entity(
            "IfcDoor" if op["kind"] == "door" else "IfcWindow",
            GlobalId=global_id("filler", op["ref"]),
            Name=op.get("name") or op["ref"],
            ObjectPlacement=b.local_placement(wall.ObjectPlacement),
            Representation=b.shape([b.extrude(leaf, float(op["z0"]), float(op["z1"]))]),
            OverallHeight=float(op["z1"]) - float(op["z0"]),
            OverallWidth=float(op["w"]),
        )
        f.create_entity(
            "IfcRelFillsElement",
            GlobalId=global_id("fills", op["ref"]),
            RelatingOpeningElement=void,
            RelatedBuildingElement=filler,
        )
        elements[op.get("level")].append(filler)
        attrs = opening_attrs.get(op["ref"], {})
        properties.opening(f, filler, op, attrs)
        ref = attrs.get("ref")
        if isinstance(ref, str) and ref in types:
            by_type[ref].append(filler)
    for asset_name, members in by_type.items():
        f.create_entity(
            "IfcRelDefinesByType",
            GlobalId=global_id("typed", asset_name),
            RelatedObjects=members,
            RelatingType=types[asset_name],
        )

    # ---- Slabs, columns, the uncounted segments ----
    # A space whose region is not convex is derived as several pieces, and each piece carries its
    # own floor. So the identity counts within (space, kind) exactly as a wall counts within a ref.
    seen_slab = defaultdict(int)
    for slab in data["slabs"]:
        key = f"{slab['space']}/{slab['kind']}"
        index = seen_slab[key]
        seen_slab[key] += 1
        elements[slab.get("level")].append(
            f.create_entity(
                "IfcSlab",
                GlobalId=global_id("slab", f"{key}#{index}"),
                Name=f"{slab['space']} {slab['kind']}",
                ObjectPlacement=placed_in(slab.get("level")),
                Representation=b.shape(
                    [b.extrude(slab["outline"], float(slab["z0"]), float(slab["z1"]))]
                ),
                PredefinedType="ROOF" if slab["kind"] == "roof" else "FLOOR",
            )
        )

    for col in data["columns"]:
        product = f.create_entity(
            "IfcColumn",
            GlobalId=global_id("column", col["ref"]),
            Name=col["ref"],
            ObjectPlacement=placed_in(col.get("level")),
            Representation=b.shape(
                [b.extrude(col["outline"], float(col["z0"]), float(col["z1"]))]
            ),
        )
        elements[col.get("level")].append(product)
        if isinstance(col.get("attrs", {}).get("spec"), str):
            vocabulary.associate_material(product, col["attrs"]["spec"])

    # A `seg` is an uncounted stretch of a boundary that carries its own attributes — a change of
    # finish partway along a wall. IFC has no first-class notion of "part of a wall with different
    # properties", so it becomes a covering on that stretch, which is what it describes.
    for s in data["segs"]:
        wall_ref = s["ref"].rsplit("/", 1)[0]
        host = next((w for (r, _i), (w, _seg) in walls.items() if r == wall_ref), None)
        product = f.create_entity(
            "IfcCovering",
            GlobalId=global_id("seg", s["ref"]),
            Name=s["ref"],
            ObjectPlacement=placed_in(s.get("level")),
            Representation=b.shape([b.extrude(s["outline"], 0.0, float(s["t"]))]),
            PredefinedType="CLADDING",
        )
        elements[s.get("level")].append(product)
        if host is not None:
            f.create_entity(
                "IfcRelCoversBldgElements",
                GlobalId=global_id("covers", s["ref"]),
                RelatingBuildingElement=host,
                RelatedCoverings=[product],
            )

    # ---- Vertical circulation ----
    for r in data["runs"]:
        tag = f"{r['path']}@{r['level']}"
        entity = RUN_ENTITY[r["device"]]
        product = f.create_entity(
            entity,
            GlobalId=global_id("run", tag),
            Name=tag,
            ObjectPlacement=placed_in(r.get("level")),
            Representation=b.shape(
                b.prism(s["outline"], s["bottom"], s["top"]) for s in r["solids"]
            ),
            PredefinedType=RUN_TYPE[(r["device"], r["form"])],
        )
        elements[r.get("level")].append(product)
        properties.run(f, product, r)

    for level_name, members in elements.items():
        if level_name in storeys and members:
            f.create_entity(
                "IfcRelContainedInSpatialStructure",
                GlobalId=global_id("contains", f"storey:{level_name}"),
                RelatingStructure=storeys[level_name],
                RelatedElements=members,
            )

    # ---- Zones. koyu's counted aggregation is IFC's group of spaces ----
    for path, zone in sorted(canonical.get("zones", {}).items()):
        members = [p for q, p in spaces.items() if q == path or q.startswith(path + "/")]
        if not members:
            continue
        attrs = zone.get("attrs", {})
        group = f.create_entity(
            "IfcZone",
            GlobalId=global_id("zone", space_identity(path, attrs)),
            Name=path,
            LongName=attrs.get("name"),
        )
        f.create_entity(
            "IfcRelAssignsToGroup",
            GlobalId=global_id("assigns", path),
            RelatedObjects=members,
            RelatingGroup=group,
        )
        if isinstance(attrs.get("use"), str):
            vocabulary.classify(group, "use", attrs["use"])

    # ---- Space boundaries. **What a working export drops first, koyu holds as a first-class
    # edge**, so it is written rather than inferred ----
    for w, element in zip(data["walls"], element_of_wall):
        physical = "VIRTUAL" if element.is_a("IfcVirtualElement") else "PHYSICAL"
        for side, other in (("a", "b"), ("b", "a")):
            subject = spaces.get(w[side]) or external.get(w[side])
            if subject is None:
                continue
            outside = w[other] not in spaces
            f.create_entity(
                "IfcRelSpaceBoundary",
                # The identity carries the wall's index, because one `boundary` declaration can
                # be realised as several segments and each gets its own relation.
                GlobalId=global_id("boundary", f"{w['identity']}/{side}/{w[other]}"),
                Name=w["ref"],
                RelatingSpace=subject,
                RelatedBuildingElement=element,
                PhysicalOrVirtualBoundary=physical,
                InternalOrExternalBoundary="EXTERNAL" if outside else "INTERNAL",
            )

    return f


# ---- Small parts ----


def _true_north(f, azimuth):
    """True north in the model's own coordinates.

    `azimuth` is the true bearing of the +Y axis, clockwise from north, so true north is +Y turned
    counter-clockwise by that much. At 0 it is (0,1) = +Y; at 90 it is (-1,0) = -X.
    """
    if azimuth is None:
        return None
    import math

    a = math.radians(float(azimuth))
    return f.create_entity("IfcDirection", DirectionRatios=(-math.sin(a), math.cos(a)))


def _aggregate(f, whole, parts, tag: str):
    if not parts:
        return
    f.create_entity(
        "IfcRelAggregates",
        GlobalId=global_id("aggregates", tag),
        RelatingObject=whole,
        RelatedObjects=parts,
    )


def _canonical_ref(bd: dict, index: int) -> str:
    """The ref the Form gives a boundary, rebuilt from the canonical spelling.

    A boundary is identified by its two ends plus its place in **canonical** order — `a|b@i`,
    where `i` indexes the canonical boundaries array. Declaration order is a thing the canonical
    form discards, so indexing by it would give a different spelling for the same building. Both
    sides therefore agree without either asking the other's implementation.
    """
    return f"{bd['between'][0]}|{bd['between'][1]}@{index}"


def _boundary_attrs(canonical: dict) -> dict:
    """Boundary attributes keyed by the ref the Form uses."""
    return {
        _canonical_ref(bd, i): bd.get("attrs", {})
        for i, bd in enumerate(canonical.get("boundaries", []))
    }


def _opening_attrs(canonical: dict) -> dict:
    """Opening attributes keyed by ref, with the asset name kept under `ref`."""
    out = {}
    for i, bd in enumerate(canonical.get("boundaries", [])):
        ref = _canonical_ref(bd, i)
        for j, op in enumerate(bd.get("openings", [])):
            attrs = dict(op.get("attrs", {}))
            if isinstance(op.get("ref"), str):
                attrs["ref"] = op["ref"]
            out[f"{ref}/{j}"] = attrs
    return out


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


def _leaf_outline(op: dict) -> list:
    """The leaf, centred in the opening and as thin as a leaf rather than as thick as the wall."""
    outline = op["outline"]
    cx = sum(p[0] for p in outline) / len(outline)
    cy = sum(p[1] for p in outline) / len(outline)
    scale = LEAF_THICKNESS_MM / max(1.0, float(op["t"]))
    # Shrink across the wall only: the band's long axis is the opening's width, which stays.
    return [
        [cx + (p[0] - cx) * (1.0 if _along(op, 0) else scale),
         cy + (p[1] - cy) * (1.0 if _along(op, 1) else scale)]
        for p in outline
    ]


def _along(op: dict, axis: int) -> bool:
    """Whether the opening's width runs along x (axis 0) or y (axis 1)."""
    seg = op["segment"]
    dx, dy = abs(seg["x2"] - seg["x1"]), abs(seg["y2"] - seg["y1"])
    return (dx >= dy) if axis == 0 else (dy > dx)


def main(argv: list) -> int:
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
