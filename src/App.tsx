import { useMemo, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import { MapView } from "./components/MapView";
import { Sidebar } from "./components/Sidebar";
import { useLicences } from "./hooks/useLicences";
import { CONTEXT_LAYERS } from "./layers";
import { EMPTY_FILTERS, matchesFilters, type Filters } from "./filterExpression";
import { buildCompanyColors } from "./companyColors";
import type { ColorMode } from "./types";

function App() {
  const { data, loading, error, facets } = useLicences();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [colorMode, setColorMode] = useState<ColorMode>("status");
  const [activeContextLayers, setActiveContextLayers] = useState<Set<string>>(
    () => new Set(CONTEXT_LAYERS.filter((l) => l.defaultOn).map((l) => l.id)),
  );

  const operatorColors = useMemo(() => buildCompanyColors(facets.companies), [facets.companies]);
  const licenseeColors = useMemo(() => buildCompanyColors(filters.companies), [filters.companies]);

  const matchCount = useMemo(() => {
    if (!data) return null;
    return data.features.filter((f) => matchesFilters(f.properties, filters)).length;
  }, [data, filters]);

  function toggleContextLayer(id: string) {
    setActiveContextLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="app">
      <Sidebar
        loading={loading}
        error={error}
        matchCount={matchCount}
        totalCount={data?.features.length ?? null}
        facets={facets}
        filters={filters}
        onFiltersChange={setFilters}
        activeContextLayers={activeContextLayers}
        onToggleContextLayer={toggleContextLayer}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        operatorColors={operatorColors}
        licenseeColors={licenseeColors}
      />
      <MapView
        licences={data}
        filters={filters}
        activeContextLayers={activeContextLayers}
        colorMode={colorMode}
        operatorColors={operatorColors}
        licenseeColors={licenseeColors}
      />
    </div>
  );
}

export default App;
