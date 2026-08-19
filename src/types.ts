export interface Licensee {
  companyName: string;
  companyNpdId: number;
  interestPct: number | null;
}

export interface LicenceProperties {
  npdId: number;
  name: string;
  status: string | null;
  active: "Y" | "N" | null;
  phase: string | null;
  mainArea: string | null;
  stratigraphical: string | null;
  operatorName: string | null;
  originalAreaKm2: number | null;
  currentAreaKm2: number | null;
  dateGranted: number | null;
  dateValidTo: number | null;
  factPageUrl: string | null;
  licenseeNames: string[];
  licensees: Licensee[];
}

export type ColorMode = "status" | "operator" | "licensee";

export interface LayerDef {
  id: string;
  label: string;
  group: string;
  /** Sub-layer id(s) within the FactMaps MapServer, comma separated for "show:" param */
  layerIds: string;
  defaultOn: boolean;
}
