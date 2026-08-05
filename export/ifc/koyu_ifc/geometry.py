"""Turn outlines that koyu already raised into IFC solids.

**There is no geometry rule in this file.** Where a wall's faces are, where an opening's band
sits, how a ramp tilts — all of that came out of koyu's own constructors on the way in. What is
left here is the IFC spelling: profiles, extrusions, shells.

koyu's coordinates are millimetres and the IFC project unit is set to millimetres, so the numbers
pass through unchanged. Nothing is converted and nothing is rounded.

Every placement is the identity relative to its storey, and the real coordinates sit in the
profile. Walls are often placed along their own local axis instead, but that carries opening
placements into wall-local coordinates too, which is one more chance to get an axis the wrong way
round. Writing everything in one coordinate system closes the boolean in that same system.
"""

from __future__ import annotations

from typing import Iterable, Sequence

Point = Sequence[float]

# A prism whose vertices all share one bottom and one top is a plain extrusion. Anything else —
# a ramp, an escalator truss — needs a shell. The comparison is exact because the numbers arrived
# from koyu unrounded.
FLAT = 1e-9


class Builder:
    """Makes points, profiles, extrusions and shells on one IfcFile."""

    def __init__(self, f, body_context):
        self.f = f
        self.body = body_context
        self._dir_z = f.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0))

    # ---- placement ----

    def placement(self, x: float = 0.0, y: float = 0.0, z: float = 0.0):
        return self.f.create_entity(
            "IfcAxis2Placement3D",
            Location=self.f.create_entity(
                "IfcCartesianPoint", Coordinates=(float(x), float(y), float(z))
            ),
        )

    def local_placement(self, parent=None, z: float = 0.0):
        return self.f.create_entity(
            "IfcLocalPlacement", PlacementRelTo=parent, RelativePlacement=self.placement(z=z)
        )

    # ---- solids ----

    def profile(self, points: Sequence[Point]):
        pts = [
            self.f.create_entity("IfcCartesianPoint", Coordinates=(float(p[0]), float(p[1])))
            for p in points
        ]
        polyline = self.f.create_entity("IfcPolyline", Points=pts + [pts[0]])
        return self.f.create_entity(
            "IfcArbitraryClosedProfileDef", ProfileType="AREA", OuterCurve=polyline
        )

    def extrude(self, points: Sequence[Point], z0: float, z1: float):
        """The outline raised from z0 to z1. None where the height is not positive."""
        z0, z1 = float(z0), float(z1)
        depth = z1 - z0
        if depth <= 0:
            return None
        return self.f.create_entity(
            "IfcExtrudedAreaSolid",
            SweptArea=self.profile(points),
            Position=self.placement(z=z0),
            ExtrudedDirection=self._dir_z,
            Depth=float(depth),
        )

    def prism(self, points: Sequence[Point], bottom: Sequence[float], top: Sequence[float]):
        """A prism carrying a bottom and a top z at every vertex.

        Flat ones become extrusions, which are lighter and what a reader expects of a wall or a
        tread. Tilted ones become a closed shell, the only honest spelling for a slab whose four
        corners sit at four heights.
        """
        if max(bottom) - min(bottom) < FLAT and max(top) - min(top) < FLAT:
            return self.extrude(points, bottom[0], top[0])
        if min(t - b for b, t in zip(bottom, top)) <= 0:
            return None
        return self._shell(points, bottom, top)

    def _shell(self, points: Sequence[Point], bottom: Sequence[float], top: Sequence[float]):
        n = len(points)
        low = [self._pt3(points[i], bottom[i]) for i in range(n)]
        high = [self._pt3(points[i], top[i]) for i in range(n)]
        faces = [
            self._face(list(reversed(low))),  # the underside looks down
            self._face(high),
            # An outline runs counter-clockwise, so walking it and standing the sides up on the
            # left of travel gives every side face an outward normal.
            *[self._face([low[i], low[(i + 1) % n], high[(i + 1) % n], high[i]]) for i in range(n)],
        ]
        shell = self.f.create_entity("IfcClosedShell", CfsFaces=faces)
        return self.f.create_entity("IfcFacetedBrep", Outer=shell)

    def _pt3(self, p: Point, z: float):
        return self.f.create_entity(
            "IfcCartesianPoint", Coordinates=(float(p[0]), float(p[1]), float(z))
        )

    def _face(self, points):
        loop = self.f.create_entity("IfcPolyLoop", Polygon=list(points))
        bound = self.f.create_entity("IfcFaceOuterBound", Bound=loop, Orientation=True)
        return self.f.create_entity("IfcFace", Bounds=[bound])

    # ---- representation ----

    def shape(self, items: Iterable):
        """One shape representation over a set of solids. None where the set is empty."""
        items = [i for i in items if i is not None]
        if not items:
            return None
        kinds = {i.is_a() for i in items}
        if kinds == {"IfcExtrudedAreaSolid"}:
            kind = "SweptSolid"
        elif kinds == {"IfcFacetedBrep"}:
            kind = "Brep"
        else:
            kind = "SolidModel"
        rep = self.f.create_entity(
            "IfcShapeRepresentation",
            ContextOfItems=self.body,
            RepresentationIdentifier="Body",
            RepresentationType=kind,
            Items=items,
        )
        return self.f.create_entity("IfcProductDefinitionShape", Representations=[rep])

    def footprint(self, points: Sequence[Point]):
        """A closed outline drawn as a curve rather than raised — the site boundary."""
        pts = [
            self.f.create_entity("IfcCartesianPoint", Coordinates=(float(p[0]), float(p[1]), 0.0))
            for p in points
        ]
        polyline = self.f.create_entity("IfcPolyline", Points=pts + [pts[0]])
        rep = self.f.create_entity(
            "IfcShapeRepresentation",
            ContextOfItems=self.body,
            RepresentationIdentifier="FootPrint",
            RepresentationType="Curve3D",
            Items=[polyline],
        )
        return self.f.create_entity("IfcProductDefinitionShape", Representations=[rep])
