"""Put the model on the map — `IfcProjectedCRS` and `IfcMapConversion`.

The rotation is the part everyone gets wrong, and koyu's own reference page says so in print.
A projected coordinate system's axes are aligned to **grid north**, while koyu's `azimuth` is
measured from **true north**. The two differ by the meridian convergence at the origin:

    rotation from the model frame to the CRS grid = azimuth − γ(origin)

γ is zero on a system's central meridian and grows to roughly 0.87° at a system's edge. Half a
degree puts the far corner of a 100 m building 0.87 m out of place — under the resolution of most
decisions, over the resolution of a drawing checked against a boundary line.

koyu itself computes none of this. It holds the frame and says the formula; applying it needs a
projection, which is why it is done here and not there.

**Nothing is written unless both halves of the frame are present.** A position with no bearing
cannot place anything, and writing a map conversion without a rotation would claim one — the same
reasoning `SIT06` gives on the koyu side.
"""

from __future__ import annotations

import math

import pyproj

# `Scale` carries the model's length unit into the map's. koyu is millimetres, and the projected
# systems this is used with are metres.
MM_TO_M = 0.001


def meridian_convergence_deg(epsg: int, easting_m: float, northing_m: float) -> float:
    """γ at a point, in degrees, positive where grid north lies east of true north."""
    projected = pyproj.CRS.from_epsg(epsg)
    geographic = projected.geodetic_crs
    to_geographic = pyproj.Transformer.from_crs(projected, geographic, always_xy=True)
    lon, lat = to_geographic.transform(easting_m, northing_m)
    return pyproj.Proj(projected).get_factors(lon, lat).meridian_convergence


def write(f, context, origin: dict, azimuth_deg: float):
    """Write the projected CRS and the map conversion. Returns the conversion."""
    epsg = int(origin["epsg"])
    projected = pyproj.CRS.from_epsg(epsg)
    gamma = meridian_convergence_deg(epsg, float(origin["easting"]), float(origin["northing"]))

    # The bearing of the model's +X axis, measured clockwise from **grid** north. +X is a quarter
    # turn clockwise from +Y, and taking γ off converts a true bearing into a grid one.
    bearing = math.radians(azimuth_deg + 90.0 - gamma)

    target = f.create_entity(
        "IfcProjectedCRS",
        Name=f"EPSG:{epsg}",
        Description=projected.name,
        GeodeticDatum=projected.datum.name if projected.datum else None,
        VerticalDatum=_vertical_name(origin),
        MapUnit=f.create_entity("IfcSIUnit", UnitType="LENGTHUNIT", Name="METRE"),
    )
    return f.create_entity(
        "IfcMapConversion",
        SourceCRS=context,
        TargetCRS=target,
        Eastings=float(origin["easting"]),
        Northings=float(origin["northing"]),
        OrthogonalHeight=float(origin.get("elevation", 0.0)),
        # (easting component, northing component) of the model's +X axis in the map's grid
        XAxisAbscissa=math.sin(bearing),
        XAxisOrdinate=math.cos(bearing),
        Scale=MM_TO_M,
    )


def _vertical_name(origin: dict):
    """The vertical CRS by name, where a height was written.

    koyu refuses a height without the datum it is measured from, so either both are here or
    neither is.
    """
    code = origin.get("vertical")
    if code is None:
        return None
    try:
        return pyproj.CRS.from_epsg(int(code)).name
    except pyproj.exceptions.CRSError:
        return f"EPSG:{int(code)}"
