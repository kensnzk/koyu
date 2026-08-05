"""Small tools for assembling IFC geometry.

koyu's coordinates are millimetres and the IFC project unit is set to millimetres too, so
**the numbers pass through unchanged**. Nothing is converted and nothing is rounded.

Every placement is the identity relative to its storey, and the real coordinates sit in the
profile. Walls are often placed along their own local axis instead, but that carries opening
placements into wall-local coordinates as well, which is one more chance to get an axis the wrong
way round. Writing everything in one coordinate system closes the boolean in that same system.
"""

from __future__ import annotations

from typing import Iterable, Sequence

Point = Sequence[float]


def signed_area(points: Sequence[Point]) -> float:
    total = 0.0
    for i, p in enumerate(points):
        q = points[(i + 1) % len(points)]
        total += p[0] * q[1] - q[0] * p[1]
    return total / 2.0


def ccw(points: Sequence[Point]) -> list:
    """An outer boundary runs counter-clockwise (IFC's rule for a profile)."""
    return list(points) if signed_area(points) >= 0 else list(reversed(points))


def rectangle_along(x1: float, y1: float, x2: float, y2: float, width: float) -> list:
    """The rectangle got by spreading `width` evenly to either side of a segment.

    A koyu wall is measured from its centreline (see the glossary on wall centrelines), so raising
    the material from a boundary's segment takes exactly this one move.
    """
    dx, dy = x2 - x1, y2 - y1
    length = (dx * dx + dy * dy) ** 0.5
    if length == 0:
        raise ValueError("a boundary segment of zero length has no material")
    nx, ny = -dy / length * width / 2.0, dx / length * width / 2.0
    return ccw([(x1 + nx, y1 + ny), (x2 + nx, y2 + ny), (x2 - nx, y2 - ny), (x1 - nx, y1 - ny)])


def box_across(
    cx: float, cy: float, x1: float, y1: float, x2: float, y2: float, w: float, depth: float
) -> list:
    """A rectangle centred on a point of a segment: `w` along it, `depth` across it.

    This is the shape an opening cuts. The segment is passed as well as the centre, because the
    direction is what decides which way `w` runs.
    """
    dx, dy = x2 - x1, y2 - y1
    length = (dx * dx + dy * dy) ** 0.5
    ux, uy = dx / length, dy / length
    vx, vy = -uy, ux
    hw, hd = w / 2.0, depth / 2.0
    return ccw(
        [
            (cx - ux * hw - vx * hd, cy - uy * hw - vy * hd),
            (cx + ux * hw - vx * hd, cy + uy * hw - vy * hd),
            (cx + ux * hw + vx * hd, cy + uy * hw + vy * hd),
            (cx - ux * hw + vx * hd, cy - uy * hw + vy * hd),
        ]
    )


class Builder:
    """Makes points, profiles and extrusions on one IfcFile."""

    def __init__(self, f, body_context):
        self.f = f
        self.body = body_context
        self._dir_z = f.create_entity("IfcDirection", DirectionRatios=(0.0, 0.0, 1.0))

    def placement(self, x: float = 0.0, y: float = 0.0, z: float = 0.0):
        return self.f.create_entity(
            "IfcAxis2Placement3D",
            Location=self.f.create_entity("IfcCartesianPoint", Coordinates=(x, y, z)),
        )

    def local_placement(self, parent=None, z: float = 0.0):
        return self.f.create_entity(
            "IfcLocalPlacement", PlacementRelTo=parent, RelativePlacement=self.placement(z=z)
        )

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
        """The profile raised from z0 to z1. None where the height is not positive."""
        depth = z1 - z0
        if depth <= 0:
            return None
        return self.f.create_entity(
            "IfcExtrudedAreaSolid",
            SweptArea=self.profile(points),
            Position=self.placement(z=z0),
            ExtrudedDirection=self._dir_z,
            Depth=depth,
        )

    def shape(self, items: Iterable):
        """One shape representation over a set of solids. None where the set is empty."""
        items = [i for i in items if i is not None]
        if not items:
            return None
        rep = self.f.create_entity(
            "IfcShapeRepresentation",
            ContextOfItems=self.body,
            RepresentationIdentifier="Body",
            RepresentationType="SweptSolid",
            Items=items,
        )
        return self.f.create_entity("IfcProductDefinitionShape", Representations=[rep])
