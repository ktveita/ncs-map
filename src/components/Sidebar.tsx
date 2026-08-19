import { MultiSelect } from "./MultiSelect";
import { CONTEXT_LAYERS } from "../layers";
import { EMPTY_FILTERS, hasActiveFilters, type Filters } from "../filterExpression";
import { OVERLAP_COLOR } from "../companyColors";
import type { ColorMode } from "../types";

interface Facets {
  companies: string[];
  statuses: string[];
  phases: string[];
  mainAreas: string[];
  drillOrDropYears: string[];
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
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  operatorColors: Map<string, string>;
  licenseeColors: Map<string, string>;
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
  colorMode,
  onColorModeChange,
  operatorColors,
  licenseeColors,
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
        <h2>Colour licences by</h2>
        <div className="segmented">
          <button
            type="button"
            className={colorMode === "status" ? "segmented-btn active" : "segmented-btn"}
            onClick={() => onColorModeChange("status")}
          >
            Status
          </button>
          <button
            type="button"
            className={colorMode === "operator" ? "segmented-btn active" : "segmented-btn"}
            onClick={() => onColorModeChange("operator")}
          >
            Operator
          </button>
          <button
            type="button"
            className={colorMode === "licensee" ? "segmented-btn active" : "segmented-btn"}
            onClick={() => onColorModeChange("licensee")}
          >
            Licensee
          </button>
        </div>
        {colorMode === "operator" && (
          <div className="legend">
            {facets.companies.map((op) => (
              <div className="legend-row" key={op}>
                <span className="legend-swatch" style={{ background: operatorColors.get(op) }} />
                <span className="legend-label">{op}</span>
              </div>
            ))}
          </div>
        )}
        {colorMode === "licensee" &&
          (filters.companies.length === 0 ? (
            <p className="hint">Select companies in the Company filter below to colour by licensee.</p>
          ) : (
            <div className="legend">
              {filters.companies.map((company) => (
                <div className="legend-row" key={company}>
                  <span className="legend-swatch" style={{ background: licenseeColors.get(company) }} />
                  <span className="legend-label">{company}</span>
                </div>
              ))}
              {filters.companies.length > 1 && (
                <div className="legend-row">
                  <span className="legend-swatch" style={{ background: OVERLAP_COLOR }} />
                  <span className="legend-label">2+ selected companies (overlap)</span>
                </div>
              )}
            </div>
          ))}
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
        <MultiSelect
          label="Drill-or-Drop year (pending)"
          options={facets.drillOrDropYears}
          selected={filters.drillOrDropYears}
          onChange={(drillOrDropYears) => onFiltersChange({ ...filters, drillOrDropYears })}
        />
        <label className="option-row">
          <input
            type="checkbox"
            checked={filters.drillDecisionTaken}
            onChange={(e) => onFiltersChange({ ...filters, drillDecisionTaken: e.target.checked })}
          />
          <span>Drill decision taken</span>
        </label>
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
