# Select a palette when rendering a drawing sheet

A plan can be printed on white paper or displayed on a dark screen. The same model supplies the geometry, dimensions and area labels in both drawings.

Plan, section, elevation and axonometric SVG renderers accept a per-call `drawingStyle`. Each preset supplies the paper, ink and drawing accents. The CLI and the SVG tools exposed through MCP use the same preset names. Omitting the option selects `ink`. A component supplied with its own SVG keeps its authored paint.

Each sheet embeds the Koyu symbol as vector paths and paints it with the sheet ink. An exported sheet therefore carries its mark when opened offline or printed. The choice of palette belongs to the SVG output and does not change the Muro document or the scene materials.
