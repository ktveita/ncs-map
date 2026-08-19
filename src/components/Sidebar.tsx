import { MultiSelect } from "./MultiSelect";
import { CONTEXT_LAYERS } from "../layers";
import { EMPTY_FILTERS, hasActiveFilters, type Filters } from "../filterExpression";

interface Facets {
  companies: string[];
  statuses: string[];
  phases: string[];
  mainAreas: string[];
}

interface Props {
  loading: boolean;
  error: string | null;
  matchCount: number | null;
  totalCount: number | null;
  facets: Facets;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  activeContextLayers: Set<string>;
  onToggleContextLayer: (id: string) => void;
}

export function Sidebar({
  loading,
  error,
  matchCount,
  totalCount,
  facets,
  filters,
  onFiltersChange,
  activeContextLayers,
  onToggleContextLayer,
}: Props) {
  const grouped = CONTEXT_LAYERS.reduce<Record<string, typeof CONTEXT_LAYERS>>((acc, l) => {
    (acc[l.group] ??= []).push(l);
    return acc;
  }, {});

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <h1>NCS Licence Map</h1>
        <p className="sidebar-sub">Norwegian Continental Shelf · data from sodir.no FactMaps &amp; FactPages</p>
      </header>

      <section className="sidebar-section">
        <div className="status-line">
          {loading && "Loading licence data…"}
          {error && <span className="error">Failed to load: {error}</span>}
          {!loading && !error && totalCount != null && (
            <span>
              Showing <strong>{matchCount}</strong> / {totalCount} production licences
            </span>
          )}
        </div>
      </section>

      <section className="sidebar-section">
        <h2>Filters</h2>
        <MultiSelect
          label="Company (any licensee)"
          options={facets.companies}
          selected={filters.companies}
          onChange={(companies) => onFiltersChange({ ...filters, companies })}
          placeholder="Search companies…"
        />
        <MultiSelect
          label="Status"
          options={facets.statuses}
          selected={filters.statuses}
          onChange={(statuses) => onFiltersChange({ ...filters, statuses })}
        />
        <MultiSelect
          label="Phase"
          options={facets.phases}
          selected={filters.phases}
          onChange={(phases) => onFiltersChange({ ...filters, phases })}
        />
        <MultiSelect
          label="Main area"
          options={facets.mainAreas}
          selected={filters.mainAreas}
          onChange={(mainAreas) => onFiltersChange({ ...filters, mainAreas })}
        />
        {hasActiveFilters(filters) && (
          <button type="button" className="reset-btn" onClick={() => onFiltersChange(EMPTY_FILTERS)}>
            Reset all filters
          </button>
        )}
      </section>

      <section className="sidebar-section">
        <h2>Map layers</h2>
        {Object.entries(grouped).map(([group, layers]) => (
          <div key={group} className="layer-group">
            <div className="layer-group-title">{group}</div>
            {layers.map((layer) => (
              <label className="option-row" key={layer.id}>
                <input
                  type="checkbox"
                  checked={activeContextLayers.has(layer.id)}
                  onChange={() => onToggleContextLayer(layer.id)}
                />
                <span>{layer.label}</span>
              </label>
            ))}
          </div>
        ))}
      </section>
    </aside>
  );
}
