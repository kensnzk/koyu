"""Two things that are not about geometry: is the file legal, and is it in the right place.

The schema check is the cheap one and it catches a whole class of mistake that a viewer would
otherwise report as "the file opened but is empty".

The georeference check exists because of one specific way to be wrong. A projected coordinate
system's axes follow **grid** north, and koyu's `azimuth` is measured from **true** north; the two
differ by the meridian convergence, which koyu's own reference page warns will be dropped. This
asserts that it was not — by measuring the rotation actually written into the file against the
naive one, and requiring the difference to be γ.
"""

from __future__ import annotations

import io
import logging
import math

import ifcopenshell.validate
import pytest

from koyu_ifc.georeference import meridian_convergence_deg

GEOREFERENCED = "examples/tower/main.muro"


def test_the_file_passes_the_schema(pair):
    """No express-rule violation and no attribute of the wrong type."""
    _, f = pair
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    logger = logging.getLogger("koyu-ifc-validate")
    logger.handlers = [handler]
    logger.setLevel(logging.DEBUG)
    ifcopenshell.validate.validate(f, logger)
    problems = [line for line in stream.getvalue().splitlines() if line.strip()]
    assert not problems, "\n".join(problems[:20])


def test_the_spatial_structure_is_complete(pair):
    """Project holds site holds building holds storeys, and every space sits in a storey."""
    _, f = pair
    project = f.by_type("IfcProject")[0]
    site = _decomposed(project)
    assert [s.is_a() for s in site] == ["IfcSite"]
    building = _decomposed(site[0])
    assert [b.is_a() for b in building] == ["IfcBuilding"]
    storeys = _decomposed(building[0])
    assert storeys and all(s.is_a() == "IfcBuildingStorey" for s in storeys)

    placed = set()
    for storey in storeys:
        placed |= {s for s in _decomposed(storey) if s.is_a() == "IfcSpace"}
    assert placed == set(f.by_type("IfcSpace"))


def test_the_meridian_convergence_is_applied(built):
    """The rotation written into the map conversion is `azimuth + 90 - γ`, not `azimuth + 90`."""
    data, f, _ = built(GEOREFERENCED)
    origin = data["canonical"]["origin"]
    azimuth = float(data["canonical"]["azimuth"])

    conversion = f.by_type("IfcMapConversion")
    assert len(conversion) == 1
    m = conversion[0]

    assert m.Eastings == pytest.approx(origin["easting"])
    assert m.Northings == pytest.approx(origin["northing"])
    assert m.OrthogonalHeight == pytest.approx(origin["elevation"])
    # koyu is millimetres and the projected system is metres.
    assert m.Scale == pytest.approx(0.001)

    written = math.degrees(math.atan2(m.XAxisAbscissa, m.XAxisOrdinate)) % 360.0
    gamma = meridian_convergence_deg(int(origin["epsg"]), origin["easting"], origin["northing"])
    assert written == pytest.approx((azimuth + 90.0 - gamma) % 360.0, abs=1e-9)

    # The whole point: γ is not zero here, so an export that dropped it would differ.
    naive = (azimuth + 90.0) % 360.0
    assert abs(written - naive) > 1e-6, "this fixture no longer exercises the convergence"


def test_true_north_is_written(built):
    """True north on the representation context is +Y turned counter-clockwise by the azimuth."""
    data, f, _ = built(GEOREFERENCED)
    azimuth = math.radians(float(data["canonical"]["azimuth"]))
    context = [
        c
        for c in f.by_type("IfcGeometricRepresentationContext")
        if not c.is_a("IfcGeometricRepresentationSubContext")
    ][0]
    x, y = context.TrueNorth.DirectionRatios
    assert x == pytest.approx(-math.sin(azimuth))
    assert y == pytest.approx(math.cos(azimuth))


def test_a_model_with_no_frame_claims_no_position(built):
    """No origin, no map conversion — and no true north either.

    An absent bearing is not zero, so writing an identity rotation would be a claim the source
    never made.
    """
    data, f, _ = built("examples/two-rooms.muro")
    assert "origin" not in data["canonical"]
    assert f.by_type("IfcMapConversion") == []
    # A subcontext inherits true north from its parent, so only the parent is asked.
    parents = [
        c
        for c in f.by_type("IfcGeometricRepresentationContext")
        if not c.is_a("IfcGeometricRepresentationSubContext")
    ]
    assert parents and all(c.TrueNorth is None for c in parents)


def _decomposed(product) -> list:
    out = []
    for rel in getattr(product, "IsDecomposedBy", []) or []:
        out.extend(rel.RelatedObjects)
    return out


def test_every_identifier_is_unique(pair):
    """No two objects share a GlobalId.

    The schema check catches this too, but by then the report is full of noise. Here the failure
    names the identity that collided, which is always a key missing a discriminator — one koyu
    declaration realised as several objects.
    """
    _, f = pair
    seen = {}
    clashes = []
    for e in f:
        if not e.is_a("IfcRoot"):
            continue
        if e.GlobalId in seen:
            clashes.append(f"{e.GlobalId}: {seen[e.GlobalId]} and {e.is_a()} {e.Name}")
        seen[e.GlobalId] = f"{e.is_a()} {e.Name}"
    assert not clashes, "\n".join(clashes[:10])
