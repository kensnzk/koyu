// Shared architectural plan conventions.
//
// These values describe paper symbols, never building geometry. They live outside core and Form
// so another drawing convention can replace them without changing a `.muro` file, canonical JSON,
// circulation, area or validation. The current set is broadly shared architectural practice; a
// jurisdiction module should override only a convention that is actually different.

export interface ArchitecturalPlanConvention {
  readonly openings: {
    /** Clear paper distance from the wall face to a sliding panel, in model millimetres. */
    readonly slidingGapMm: number;
    /** Extra overlap used to make two bypass leaves legible as separate panels. */
    readonly bypassOverlapRatio: number;
    /** Length of an automatic-door direction chevron relative to the aperture width. */
    readonly automaticDirectionRatio: number;
    /** Meeting point of the larger leaf in an unequal pair, measured from the first jamb. */
    readonly unequalLeafMeetingRatio: number;
  };
  readonly stairs: {
    /** How far an arrow enters a landing, relative to the narrower adjoining flight. */
    readonly landingOffsetFlightWidthRatio: number;
    readonly breakGlyph: {
      /** Rotation from the line that crosses the flight. */
      readonly angleDegrees: number;
      /** Source-glyph proportions. The glyph is scaled to the flight width. */
      readonly width: number;
      readonly height: number;
      readonly notch: number;
    };
    readonly arrowHead: {
      /** SVG-space sizes: legibility belongs to paper, not to the building model. */
      readonly length: number;
      readonly halfWidth: number;
      readonly startRadius: number;
    };
  };
}

export const ARCHITECTURAL_PLAN_CONVENTION: ArchitecturalPlanConvention = {
  openings: {
    slidingGapMm: 60,
    bypassOverlapRatio: 0.12,
    automaticDirectionRatio: 0.08,
    unequalLeafMeetingRatio: 2 / 3,
  },
  stairs: {
    landingOffsetFlightWidthRatio: 0.5,
    breakGlyph: {
      angleDegrees: 30,
      width: 10,
      height: 40,
      notch: 3.5,
    },
    arrowHead: {
      length: 8,
      halfWidth: 3.5,
      startRadius: 2.8,
    },
  },
};
