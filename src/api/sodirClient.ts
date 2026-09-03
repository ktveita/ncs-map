import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import type { Licensee, LicenceProperties } from "../types";
import { FACTMAPS_MAPSERVER, DATASERVICE_MAPSERVER, fetchAllPages } from "./arcgis";

export { FACTMAPS_MAPSERVER, DATASERVICE_MAPSERVER };

/** Production licence, all - current with geometry */
const LICENCE_LAYER = 616;
/** petreg_licence_licensee: current licensees per licence with ownership share */
const LICENSEE_TABLE = 3401;
/** licence_task: work programme tasks/decisions per licence, incl. Drill-or-Drop (DOD) */
const LICENCE_TASK_TABLE = 3010;
/** Wellbores, all */
const WELLBORE_LAYER = 201;

async function fetchLicenseeRows(): Promise<any[]> {
  return fetchAllPages(
    DATASERVICE_MAPSERVER,
    LICENSEE_TABLE,
    { where: "ptlKind='UTVINNINGSTILLATELSE'", outFields: "*", f: "json" },
    2000,
    (json: any) => (json.features ?? []).map((f: any) => f.attributes),
  );
}

interface DrillOrDrop {
  date: number | null;
  status: string | null;
  /** Populated once the committed well has actually been drilled. */
  wellboreName: string | null;
}

/** Latest Drill-or-Drop decision task per licence (a licence can have more than one over its life). */
async function fetchDrillOrDropByLicence(): Promise<Map<number, DrillOrDrop>> {
  const rows = await fetchAllPages<any>(
    DATASERVICE_MAPSERVER,
    LICENCE_TASK_TABLE,
    {
      where: "prlTaskTypeCode='DOD'",
      outFields: "prlNpdidLicence,prlTaskExpiryDate,prlTaskStatusEn,wlbName",
      f: "json",
    },
    2000,
    (json: any) => (json.features ?? []).map((f: any) => f.attributes),
  );
  const byLicence = new Map<number, DrillOrDrop>();
  for (const row of rows) {
    if (row.prlNpdidLicence == null) continue;
    const existing = byLicence.get(row.prlNpdidLicence);
    if (!existing || (row.prlTaskExpiryDate ?? 0) > (existing.date ?? 0)) {
      byLicence.set(row.prlNpdidLicence, {
        date: row.prlTaskExpiryDate,
        status: row.prlTaskStatusEn,
        wellboreName: row.wlbName,
      });
    }
  }
  return byLicence;
}

/**
 * Licence NPDIDs with at least one exploration or appraisal wellbore drilled in them.
 * The Drill-or-Drop task's own "wellbore if drilled" field (see DrillOrDrop above) is
 * only populated in rare cases — this wellbore-table lookup, keyed by "production
 * licence drilled in", is the reliable signal for whether a committed well already
 * exists, and is what actually fulfils a Drill-or-Drop commitment.
 */
async function fetchLicencesWithExplorationWell(): Promise<Set<number>> {
  const rows = await fetchAllPages<any>(
    FACTMAPS_MAPSERVER,
    WELLBORE_LAYER,
    {
      where: "wlbPurpose IN ('WILDCAT','APPRAISAL') AND prlNpdidProductionLicence IS NOT NULL",
      outFields: "prlNpdidProductionLicence",
      f: "json",
    },
    1000,
    (json: any) => (json.features ?? []).map((f: any) => f.attributes),
  );
  return new Set(rows.map((row) => row.prlNpdidProductionLicence).filter((id): id is number => id != null));
}

/**
 * Loads all production licence polygons and joins in the full current licensee
 * list (all owners with their ownership share, not just the operator).
 */
export async function loadLicences(): Promise<FeatureCollection<Polygon | MultiPolygon, LicenceProperties>> {
  const [rawFeatures, licenseeRows, drillOrDropByLicence, licencesWithExplorationWell] = await Promise.all([
    fetchAllPages(
      FACTMAPS_MAPSERVER,
      LICENCE_LAYER,
      { where: "1=1", outFields: "*", f: "geojson" },
      1000,
      (json: FeatureCollection) => json.features as any[],
    ),
    fetchLicenseeRows(),
    fetchDrillOrDropByLicence(),
    fetchLicencesWithExplorationWell(),
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
    const drillOrDrop = drillOrDropByLicence.get(p.prlNpdidLicence);
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
      drillOrDropDate: drillOrDrop?.date ?? null,
      drillOrDropYear: drillOrDrop?.date != null ? new Date(drillOrDrop.date).getUTCFullYear() : null,
      drillOrDropStatus: drillOrDrop?.status ?? null,
      drillOrDropWellbore: drillOrDrop?.wellboreName ?? null,
      explorationWellDrilled: licencesWithExplorationWell.has(p.prlNpdidLicence),
    };
    return { ...f, properties };
  });

  return { type: "FeatureCollection", features };
}
