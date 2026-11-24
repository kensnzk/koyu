# Independent arrival position on a return stair

The two flights of a return stair share an intermediate landing. Their opposite ends can meet their respective storeys at different positions. Using the same boarding depth for both forces the arrival line to coincide with the departure line even when the drawing locates them separately.

In Muro 1.8 the departing stair space may specify the upper end of its returning flight as a longitudinal grid reference, `arrival-at:`. Resolve that reference in the run's own grid. Use the signed distance to the existing landing edge to derive the upper flight and its treads. Plan marks, cuts and solids consume those same parts. Omitting the reference preserves the boarding-depth rule.

At an intermediate storey the arriving and departing runs have different owners. Moving one arrival line affects only that connection. The floor follows its own authored footprint.
