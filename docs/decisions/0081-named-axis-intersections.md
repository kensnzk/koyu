# Name the axis and resolve the intersection

Muro 1.8 defines a common slope for the primary Y grid lines and an additional infinite straight axis from two primary grid intersections. Y dimensions measure northing at X1. The pair of references in a position can now also name an intersection with an authored axis. The input to each axis stays visible when primary grids move. X and Y ranges keep their grid-relative dimensions and existing X/Y points keep their order.

Cells use these named intersections to allocate real floor geometry. The normal derivation of surfaces, shared boundaries and openings consumes the allocation. An authored boundary line can still refine an allocation.

Named axis definitions and cell references are optional records in the canonical document. Existing editions and their canonical output remain readable unchanged. To use the new syntax, declare Muro 1.8. The grammar does not infer a Z dimension, an opening or a structural element merely because an axis exists.
