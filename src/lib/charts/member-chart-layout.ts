/**
 * Sizing for the per-member team charts (book points, customer meetings,
 * coaching sessions).
 *
 * These charts render one bar per team member with horizontal bars
 * (recharts `layout="vertical"`), so the chart has to grow *downwards* with the
 * team instead of squeezing more bars into a fixed width — on a phone a vertical
 * bar chart with a dozen members clips its axis labels and overflows sideways.
 */

/** Vertical space each member's bar occupies. */
export const MEMBER_CHART_ROW_HEIGHT = 32;

/** Value axis plus the chart's top margin. */
export const MEMBER_CHART_AXIS_HEIGHT = 40;

/** Extra chrome for charts that render a `<Legend />`. */
export const MEMBER_CHART_LEGEND_HEIGHT = 28;

/**
 * Top margin for charts with `<ReferenceLine label={{ position: 'top' }} />` —
 * the label sits above the plot area and is clipped without it.
 */
export const MEMBER_CHART_REFERENCE_LABEL_HEIGHT = 16;

/** Keeps one- or two-member charts from collapsing to a sliver. */
export const MEMBER_CHART_MIN_HEIGHT = 140;

/**
 * Name axis width — fits `shortName()` output (max 12 chars) at 11px on one
 * line. Recharts wraps a tick that overflows its axis, so this has slack.
 */
export const MEMBER_CHART_NAME_WIDTH = 100;

/**
 * Pixel height for a member chart with `memberCount` bars.
 * `extraChrome` covers optional elements such as a legend.
 */
export function memberChartHeight(memberCount: number, extraChrome = 0): number {
  const contentHeight =
    memberCount * MEMBER_CHART_ROW_HEIGHT + MEMBER_CHART_AXIS_HEIGHT + extraChrome;
  return Math.max(MEMBER_CHART_MIN_HEIGHT, contentHeight);
}
