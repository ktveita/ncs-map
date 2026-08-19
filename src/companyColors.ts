/** Deterministic, evenly-spaced HSL palette so each operator gets a stable, distinct colour. */
export function buildCompanyColors(companies: string[]): Map<string, string> {
  const sorted = [...companies].sort();
  const map = new Map<string, string>();
  sorted.forEach((company, i) => {
    const hue = Math.round((360 * i) / Math.max(sorted.length, 1));
    map.set(company, `hsl(${hue}, 70%, 45%)`);
  });
  return map;
}

export const UNKNOWN_OPERATOR_COLOR = "#999999";
