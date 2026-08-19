import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { Licensee, LicenceProperties } from "../types";

export const FACTMAPS_MAPSERVER =
  "https://factmaps.sodir.no/api/rest/services/Factmaps/FactMapsWGS84/MapServer";
export const DATASERVICE_MAPSERVER =
  "https://factmaps.sodir.no/api/rest/services/DataService/Data/MapServer";

/** Production licence, all - current with geometry */
const LICENCE_LAYER = 616;
/** petreg_licence_licensee: current licensees per licence with ownership share */
const LICENSEE_TABLE = 3401;

async function fetchAllPages<T>(
  baseUrl: string,
  layerId: number,
  params: Record<string, string>,
  pageSize: number,
  extract: (json: any) => T[],
): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (;;) {
    const url = new URL(`${baseUrl}/${layerId}/query`);
    Object.entries({ ...params, resultOffset: String(offset), resultRecordCount: String(pageSize) }).forEach(
      ([k, v]) => url.searchParams.set(k, v),
    );
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`sodir API error ${res.status} on layer ${layerId}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message ?? "sodir API error");
    const page = extract(json);
    out.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

async function fetchLicenseeRows(): Promise<any[]> {
  return fetchAllPages(
    DATASERVICE_MAPSERVER,
    LICENSEE_TABLE,
    { where: "ptlKind='UTVINNINGSTILLATELSE'", outFields: "*", f: "json" },
    2000,
    (json: any) => (json.features ?? []).map((f: any) => f.attributes),
  );
}

/**
 * Loads all production licence polygons and joins in the full current licensee
 * list (all owners with their ownership share, not just the operator).
 */
export async function loadLicences(): Promise<FeatureCollection<Polygon | MultiPolygon, LicenceProperties>> {
  const [rawFeatures, licenseeRows] = await Promise.all([
    fetchAllPages(
      FACTMAPS_MAPSERVER,
      LICENCE_LAYER,
      { where: "1=1", outFields: "*", f: "geojson" },
      1000,
      (json: FeatureCollection) => json.features as any[],
    ),
    fetchLicenseeRows(),
  ]);

  const licenseesByLicence = new Map<number, Licensee[]>();
  for (const row of licenseeRows) {
    if (row.prlNpdidLicence == null) continue;
    const list = licenseesByLicence.get(row.prlNpdidLicence) ?? [];
    list.push({
      companyName: row.cmpLongName,
      companyNpdId: row.cmpNpdidCompany,
      interestPct: row.ptlLicenseeInterest,
    });
    licenseesByLicence.set(row.prlNpdidLicence, list);
  }

  const features = rawFeatures.map((f: any) => {
    const p = f.properties;
    const licensees = (licenseesByLicence.get(p.prlNpdidLicence) ?? []).sort(
      (a, b) => (b.interestPct ?? 0) - (a.interestPct ?? 0),
    );
    const properties: LicenceProperties = {
      npdId: p.prlNpdidLicence,
      name: p.prlName,
      status: p.prlStatus,
      active: p.prlActive,
      phase: p.prlPhaseCurrent,
      mainArea: p.prlMainArea,
      stratigraphical: p.prlStratigraphical,
      operatorName: p.cmpLongName,
      originalAreaKm2: p.prlOriginalArea,
      currentAreaKm2: p.prlCurrentArea,
      dateGranted: p.prlDateGranted,
      dateValidTo: p.prlDateValidTo,
      factPageUrl: p.prlFactPageUrl,
      licenseeNames: licensees.map((l) => l.companyName).filter(Boolean),
      licensees,
    };
    return { ...f, properties };
  });

  return { type: "FeatureCollection", features };
}
