# Preserve the identity of a room across grid frames

A room may turn inward where two grids meet and surround another room on the same storey. Giving each convex piece a space path introduces extra graph nodes, area entries and shared boundaries.

Muro 1.8 accepts a simple concave outer ring in the existing `cell` declaration. An indented `hole` uses the same grid-point spelling as a roof hole. The space owns the net region on its storey. The source retains the referenced rings, and Core decomposes their difference into the convex pieces its geometry consumers already accept. A separately declared space can occupy an excluded region.

The canonical space entry contains an optional `holes` array. A cell with a convex perimeter and no holes retains its canonical representation. Multiple openings on different sides of a shared boundary can use their grid stations when each station and full width fit exactly one segment.
