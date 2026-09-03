import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MLMap, Popup, MapLayerMouseEvent, ImageSource } from "maplibre-gl";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { LicenceProperties } from "../types";
import { FACTMAPS_MAPSERVER } from "../api/sodirClient";
import { CONTEXT_LAYERS } from "../layers";
import { buildFilterExpression, type Filters } from "../filterExpression";
import { OVERLAP_COLOR, UNKNOWN_OPERATOR_COLOR } from "../companyColors";
import type { ColorMode } from "../types";

const LICENCE_SOURCE = "licences";
const LICENCE_FILL_LAYER = "licences-fill";
const LICENCE_LINE_LAYER = "licences-line";
const LICENCE_HIGHLIGHT_LAYER = "licences-highlight";

/**
 * MapLibre processes GeoJSON sources in a web worker (loaded from a separate
 * "maplibre-gl-worker.mjs" chunk it locates at runtime). Vite's production
 * build doesn't statically detect that reference, so no worker chunk gets
 * emitted — the source silently never finishes tiling and nothing renders.
 * Pointing at a copy in public/ (copied from node_modules by
 * scripts/copy-maplibre-worker.mjs, run via the predev/prebuild npm hooks)
 * sidesteps the auto-detection entirely.
 */
maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre-gl-worker.mjs`);

const MERCATOR_R = 6378137;

/** Web Mercator (EPSG:3857) x/y for a [lng, lat] pair. */
function toMercator([lng, lat]: [number, number]): [number, number] {
  const x = (lng * Math.PI * MERCATOR_R) / 180;
  const y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * MERCATOR_R;
  return [x, y];
}

/**
 * Builds a single export image covering exactly the given bbox, rather than
 * tiling requests through FactMaps' dynamic MapServer. Tiling independent
 * "export" calls causes each tile to re-render shared labels/grid lines at
 * its own local centroid, producing duplicated, misaligned grid lines and
 * labels at every tile seam that visibly shift as the map is panned/zoomed.
 * A single whole-viewport image, refetched on moveend, avoids that.
 */
function contextLayerImageUrl(
  layerIds: string,
  bbox: [number, number, number, number],
  width: number,
  height: number,
): string {
  const url = new URL(`${FACTMAPS_MAPSERVER}/export`);
  url.searchParams.set("bbox", bbox.join(","));
  url.searchParams.set("size", `${width},${height}`);
  url.searchParams.set("imageSR", "3857");
  url.searchParams.set("bboxSR", "3857");
  url.searchParams.set("format", "png32");
  url.searchParams.set("transparent", "true");
  url.searchParams.set("layers", `show:${layerIds}`);
  url.searchParams.set("f", "image");
  return url.toString();
}

/** Refetches a context layer's image to exactly match the current viewport. */
function refreshContextLayer(map: MLMap, layerId: string, layerIds: string) {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const [xmin, ymin] = toMercator([sw.lng, sw.lat]);
  const [xmax, ymax] = toMercator([ne.lng, ne.lat]);
  const canvas = map.getCanvas();
  const url = contextLayerImageUrl(layerIds, [xmin, ymin, xmax, ymax], canvas.width, canvas.height);
  const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
    [sw.lng, ne.lat],
    [ne.lng, ne.lat],
    [ne.lng, sw.lat],
    [sw.lng, sw.lat],
  ];
  const source = map.getSource(layerId) as ImageSource | undefined;
  if (source) {
    source.updateImage({ url, coordinates });
  } else {
    map.addSource(layerId, { type: "image", url, coordinates });
    map.addLayer({ id: layerId, type: "raster", source: layerId, layout: { visibility: "none" } });
  }
}

const STATUS_COLOR_EXPRESSION = ["case", ["==", ["get", "active"], "Y"], "#1f7a8c", "#8a8a8a"];

/**
 * "licensee" mode colours by whichever companies are currently selected in
 * the Company filter — one colour each, plus a distinct OVERLAP_COLOR for
 * any licence held by 2+ of them. Independent of the actual filter (which
 * only controls what's shown); this only affects colour, so it stays useful
 * even before/without applying that filter to visibility.
 */
function licenseeColorExpression(selectedCompanies: string[], licenseeColors: Map<string, string>): unknown {
  if (selectedCompanies.length === 0) return UNKNOWN_OPERATOR_COLOR;
  const matchCount = [
    "+",
    ...selectedCompanies.map((c) => ["case", ["in", c, ["get", "licenseeNames"]], 1, 0]),
  ];
  const singleCompanyColor = [
    "case",
    ...selectedCompanies.flatMap((c) => [
      ["in", c, ["get", "licenseeNames"]],
      licenseeColors.get(c) ?? UNKNOWN_OPERATOR_COLOR,
    ]),
    UNKNOWN_OPERATOR_COLOR,
  ];
  return ["case", [">=", matchCount, 2], OVERLAP_COLOR, ["==", matchCount, 1], singleCompanyColor, UNKNOWN_OPERATOR_COLOR];
}

function colorExpression(
  colorMode: ColorMode,
  operatorColors: Map<string, string>,
  licenseeColors: Map<string, string>,
  selectedCompanies: string[],
): unknown {
  if (colorMode === "status") return STATUS_COLOR_EXPRESSION;
  if (colorMode === "licensee") return licenseeColorExpression(selectedCompanies, licenseeColors);
  if (operatorColors.size === 0) return UNKNOWN_OPERATOR_COLOR;
  const pairs = [...operatorColors.entries()].flat();
  return ["match", ["get", "operatorName"], ...pairs, UNKNOWN_OPERATOR_COLOR];
}

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-GB");
}

function popupHtml(p: LicenceProperties): string {
  const licenseeRows = p.licensees
    .map(
      (l) =>
        `<tr><td>${l.companyName}</td><td class="num">${l.interestPct != null ? l.interestPct.toFixed(2) + "%" : "—"}</td></tr>`,
    )
    .join("");
  return `
    <div class="popup">
      <h3>${p.name}</h3>
      <div class="popup-meta">
        <span class="badge ${p.active === "Y" ? "badge-active" : "badge-inactive"}">${p.status ?? "Unknown"}</span>
        <span>${p.phase ?? ""}</span>
      </div>
      <table class="popup-facts">
        <tr><td>Main area</td><td>${p.mainArea ?? "—"}</td></tr>
        <tr><td>Operator</td><td>${p.operatorName ?? "—"}</td></tr>
        <tr><td>Area</td><td>${p.currentAreaKm2 ? p.currentAreaKm2.toFixed(1) + " km²" : "—"}</td></tr>
        <tr><td>Granted</td><td>${formatDate(p.dateGranted)}</td></tr>
        <tr><td>Valid to</td><td>${formatDate(p.dateValidTo)}</td></tr>
        ${
          p.drillOrDropDate
            ? `<tr><td>Drill-or-Drop</td><td>${formatDate(p.drillOrDropDate)}${p.drillOrDropStatus ? ` (${p.drillOrDropStatus})` : ""}</td></tr>`
            : ""
        }
      </table>
      ${
        licenseeRows
          ? `<div class="popup-subhead">Licensees</div><table class="popup-licensees">${licenseeRows}</table>`
          : ""
      }
      ${p.factPageUrl ? `<a class="popup-link" href="${p.factPageUrl}" target="_blank" rel="noreferrer">Open FactPage ↗</a>` : ""}
    </div>`;
}

interface Props {
  licences: FeatureCollection<Polygon | MultiPolygon, LicenceProperties> | null;
  filters: Filters;
  activeContextLayers: Set<string>;
  colorMode: ColorMode;
  operatorColors: Map<string, string>;
  licenseeColors: Map<string, string>;
}

export function MapView({
  licences,
  filters,
  activeContextLayers,
  colorMode,
  operatorColors,
  licenseeColors,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const readyRef = useRef(false);
  const activeContextLayersRef = useRef(activeContextLayers);
  activeContextLayersRef.current = activeContextLayers;
  const colorModeRef = useRef(colorMode);
  colorModeRef.current = colorMode;
  const operatorColorsRef = useRef(operatorColors);
  operatorColorsRef.current = operatorColors;
  const licenseeColorsRef = useRef(licenseeColors);
  licenseeColorsRef.current = licenseeColors;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            // Esri's classic World Light Gray Base — free, keyless, no signup, unlike
            // CARTO's basemaps.cartocdn.com which now watermarks anonymous tiles
            // with "API KEY REQUIRED" and needs a carto.com account to remove.
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution:
              'Basemap © <a href="https://www.esri.com/">Esri</a> · Licence data © <a href="https://www.sodir.no/">Norwegian Offshore Directorate</a> (NLOD)',
          },
        },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }],
      },
      center: [4.5, 61.5],
      zoom: 5,
      dragRotate: false,
      touchPitch: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    map.on("load", () => {
      readyRef.current = true;

      // Context layers: one whole-viewport image per active layer, refetched on moveend.
      for (const layer of CONTEXT_LAYERS) {
        refreshContextLayer(map, layer.id, layer.layerIds);
        map.setLayoutProperty(layer.id, "visibility", activeContextLayersRef.current.has(layer.id) ? "visible" : "none");
      }
      map.on("moveend", () => {
        for (const layer of CONTEXT_LAYERS) {
          if (activeContextLayersRef.current.has(layer.id)) refreshContextLayer(map, layer.id, layer.layerIds);
        }
      });

      map.addSource(LICENCE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      const initialColor = colorExpression(
        colorModeRef.current,
        operatorColorsRef.current,
        licenseeColorsRef.current,
        filtersRef.current.companies,
      );
      map.addLayer({
        id: LICENCE_FILL_LAYER,
        type: "fill",
        source: LICENCE_SOURCE,
        paint: {
          "fill-color": initialColor as any,
          "fill-opacity": 0.25,
        },
      });
      map.addLayer({
        id: LICENCE_LINE_LAYER,
        type: "line",
        source: LICENCE_SOURCE,
        paint: {
          "line-color": initialColor as any,
          "line-width": 1,
        },
      });
      map.addLayer({
        id: LICENCE_HIGHLIGHT_LAYER,
        type: "fill",
        source: LICENCE_SOURCE,
        paint: { "fill-color": "#ff6b35", "fill-opacity": 0.35 },
        filter: ["==", ["get", "npdId"], -1],
      });

      map.on("mousemove", LICENCE_FILL_LAYER, (e: MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = "pointer";
        const id = e.features?.[0]?.properties?.npdId ?? -1;
        map.setFilter(LICENCE_HIGHLIGHT_LAYER, ["==", ["get", "npdId"], id]);
      });
      map.on("mouseleave", LICENCE_FILL_LAYER, () => {
        map.getCanvas().style.cursor = "";
        map.setFilter(LICENCE_HIGHLIGHT_LAYER, ["==", ["get", "npdId"], -1]);
      });
      map.on("click", LICENCE_FILL_LAYER, (e: MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ maxWidth: "320px" })
          .setLngLat(e.lngLat)
          .setHTML(popupHtml(feature.properties as unknown as LicenceProperties))
          .addTo(map);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  // Push licence data into the map once loaded / whenever it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !licences) return;
    const apply = () => {
      const source = map.getSource(LICENCE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      source?.setData(licences as any);
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [licences]);

  // Recolor licences by status, operator, or selected-licensee overlap.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const expr = colorExpression(colorMode, operatorColors, licenseeColors, filters.companies);
    map.setPaintProperty(LICENCE_FILL_LAYER, "fill-color", expr as any);
    map.setPaintProperty(LICENCE_LINE_LAYER, "line-color", expr as any);
  }, [colorMode, operatorColors, licenseeColors, filters.companies]);

  // Apply attribute filters.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const expr = buildFilterExpression(filters);
    map.setFilter(LICENCE_FILL_LAYER, expr as any);
    map.setFilter(LICENCE_LINE_LAYER, expr as any);
  }, [filters]);

  // Toggle context layer visibility, refreshing newly-shown layers to match the current view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    for (const layer of CONTEXT_LAYERS) {
      const isActive = activeContextLayers.has(layer.id);
      if (map.getLayer(layer.id)) {
        map.setLayoutProperty(layer.id, "visibility", isActive ? "visible" : "none");
      }
      if (isActive) refreshContextLayer(map, layer.id, layer.layerIds);
    }
  }, [activeContextLayers]);

  return <div ref={containerRef} className="map-container" />;
}
