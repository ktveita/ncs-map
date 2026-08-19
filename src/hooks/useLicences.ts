import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { loadLicences } from "../api/sodirClient";
import type { LicenceProperties } from "../types";

interface State {
  data: FeatureCollection<Polygon | MultiPolygon, LicenceProperties> | null;
  loading: boolean;
  error: string | null;
}

export function useLicences() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    loadLicences()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message ?? String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const facets = useMemo(() => {
    if (!state.data) return { companies: [], statuses: [], phases: [], mainAreas: [], drillOrDropYears: [] };
    const currentYear = new Date().getUTCFullYear();
    const companies = new Set<string>();
    const statuses = new Set<string>();
    const phases = new Set<string>();
    const mainAreas = new Set<string>();
    const drillOrDropYears = new Set<string>();
    for (const f of state.data.features) {
      f.properties.licenseeNames.forEach((c) => companies.add(c));
      if (f.properties.status) statuses.add(f.properties.status);
      if (f.properties.phase) phases.add(f.properties.phase);
      if (f.properties.mainArea) mainAreas.add(f.properties.mainArea);
      // Only pending (not-yet-decided) drill-or-drop years are filterable — years already past.
      if (f.properties.drillOrDropYear != null && f.properties.drillOrDropYear >= currentYear) {
        drillOrDropYears.add(String(f.properties.drillOrDropYear));
      }
    }
    return {
      companies: [...companies].sort(),
      statuses: [...statuses].sort(),
      phases: [...phases].sort(),
      mainAreas: [...mainAreas].sort(),
      drillOrDropYears: [...drillOrDropYears].sort((a, b) => Number(a) - Number(b)),
    };
  }, [state.data]);

  return { ...state, facets };
}
