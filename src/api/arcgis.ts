export const FACTMAPS_MAPSERVER = "https://factmaps.sodir.no/api/rest/services/Factmaps/FactMapsWGS84/MapServer";
export const DATASERVICE_MAPSERVER = "https://factmaps.sodir.no/api/rest/services/DataService/Data/MapServer";

/** Pages through an ArcGIS REST query endpoint, collecting every record. */
export async function fetchAllPages<T>(
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
