# Resolve member and drawing directions against the declared grid frame

An intersection fixes a position. A rectangular column, footing, pitched roof or elevation also needs a direction. Rotating only the centre of a rectangular member leaves its faces out of alignment with the bay, although its scheduled volume stays the same.

Use the declared frame basis for a rectangular member located wholly on that frame. At a junction where the two references belong to different frames, the centre alone supplies no orientation. An optional `frame` on the column or pad selects its local basis independently of its centre. Resolve roof ridge and rise directions against the named world or frame axes before producing faces. Carry the resolved member and roof geometry into the existing plan, section, scene and quantity consumers. When two grid references meet at the same physical column centre, both identify one placement within model precision.

A door's left or right jamb is relative to the room it swings into. This keeps its hand under rotation and lets both sides of a diagonal opening be addressed. For a frame-relative elevation, use the directed projection of the derived bodies with the viewer outside the building.

A beam crossing a section has a cut face and may extend beyond it on the sheet. Clip the beam to the far half-space, project it, and subtract the cut face. This uses the existing section and polygon operations and keeps the near side out of both the axis-aligned and directed views.
