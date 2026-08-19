import type { LayerDef } from "./types";

/**
 * Context layers rendered as raster overlays straight from the FactMaps
 * dynamic MapServer (ArcGIS "export" endpoint, requested per-tile via
 * MapLibre's {bbox-epsg-3857} template).
 *
 * "layerIds" lists specific leaf sub-layer ids rather than a parent group
 * id: ArcGIS's "show:<id>" ignores each sub-layer's own default-visibility
 * once you target the group, so e.g. "show:500" (Hydrocarbon) also draws
 * the off-by-default Plays layer (540) and historical discoveries (505),
 * which visually swamps the fields/discoveries polygons. Listing the
 * current/non-historical leaf layers explicitly avoids that.
 */
export const CONTEXT_LAYERS: LayerDef[] = [
  { id: "blocks", label: "Blocks", group: "Borders & areas", layerIds: "802", defaultOn: true },
  { id: "quadrants", label: "Quadrants", group: "Borders & areas", layerIds: "803", defaultOn: true },
  { id: "baa", label: "Business arrangement areas", group: "Borders & areas", layerIds: "606", defaultOn: false },
  { id: "afex", label: "Area fee exemption (AFEX)", group: "Borders & areas", layerIds: "609", defaultOn: false },
  { id: "apa", label: "APA / predefined areas", group: "Borders & areas", layerIds: "603,604", defaultOn: false },
  { id: "wellbores", label: "Wellbores", group: "Wells & facilities", layerIds: "201", defaultOn: false },
  {
    id: "facilities",
    label: "Facilities & pipelines",
    group: "Wells & facilities",
    layerIds: "307,311",
    defaultOn: false,
  },
  { id: "hydrocarbon", label: "Fields & discoveries", group: "Hydrocarbon", layerIds: "502,503", defaultOn: false },
];
