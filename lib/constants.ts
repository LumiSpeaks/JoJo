/**
 * App-wide constants for progression and levels.
 * Progression is structured so levels increase logically and reflect measurable learning improvement.
 * Level 100 is calibrated as a mastery benchmark (internal reference only; do not display in-app).
 */

/** Maximum user level (Premium: full mastery). IQ ~180 at Level 100. */
export const MAX_LEVEL = 100;

/** Free tier: level cap at IQ 130 (Level 50). */
export const FREE_TIER_MAX_LEVEL = 50;

/** Free tier: sessions per day. Premium: unlimited. */
export const FREE_TIER_SESSIONS_PER_DAY = 3;

/**
 * Internal calibration: Level 100 is designed to represent mastery-equivalent performance.
 * Used only as a reference point for structuring the progression curve; never shown in the UI.
 */
export const LEVEL_100_MASTERY_REFERENCE = 'internal_calibration_only';

