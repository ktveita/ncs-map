import type { ExpressionSpecification } from "maplibre-gl";

/** sodir's status value for a Drill-or-Drop task once the decision to drill has been made (but not yet carried out). */
export const DRILL_DECISION_TAKEN_STATUS = "Will be drilled";

export interface Filters {
  companies: string[];
  statuses: string[];
  phases: string[];
  mainAreas: string[];
  /** Pending Drill-or-Drop decision year(s), as strings (e.g. "2026") to match MultiSelect's string options. */
  drillOrDropYears: string[];
  /** Only licences where a drill decision has already been taken but not yet carried out. */
  drillDecisionTaken: boolean;
}

export const EMPTY_FILTERS: Filters = {
  companies: [],
  statuses: [],
  phases: [],
  mainAreas: [],
  drillOrDropYears: [],
  drillDecisionTaken: false,
};

export function buildFilterExpression(filters: Filters): ExpressionSpecification | null {
  const clauses: ExpressionSpecification[] = [];

  if (filters.companies.length > 0) {
    clauses.push([
      "any",
      ...filters.companies.map(
        (c): ExpressionSpecification => ["in", c, ["get", "licenseeNames"]] as unknown as ExpressionSpecification,
      ),
    ] as unknown as ExpressionSpecification);
  }
  if (filters.statuses.length > 0) {
    clauses.push(["in", ["get", "status"], ["literal", filters.statuses]] as unknown as ExpressionSpecification);
  }
  if (filters.phases.length > 0) {
    clauses.push(["in", ["get", "phase"], ["literal", filters.phases]] as unknown as ExpressionSpecification);
  }
  if (filters.mainAreas.length > 0) {
    clauses.push(["in", ["get", "mainArea"], ["literal", filters.mainAreas]] as unknown as ExpressionSpecification);
  }
  if (filters.drillOrDropYears.length > 0) {
    const years = filters.drillOrDropYears.map(Number);
    clauses.push(["in", ["get", "drillOrDropYear"], ["literal", years]] as unknown as ExpressionSpecification);
  }
  if (filters.drillDecisionTaken) {
    clauses.push([
      "==",
      ["get", "drillOrDropStatus"],
      DRILL_DECISION_TAKEN_STATUS,
    ] as unknown as ExpressionSpecification);
  }

  if (clauses.length === 0) return null;
  return ["all", ...clauses] as unknown as ExpressionSpecification;
}

interface FilterableProps {
  licenseeNames: string[];
  status: string | null;
  phase: string | null;
  mainArea: string | null;
  drillOrDropYear: number | null;
  drillOrDropStatus: string | null;
}

export function matchesFilters(props: FilterableProps, filters: Filters): boolean {
  if (filters.companies.length > 0 && !filters.companies.some((c) => props.licenseeNames.includes(c))) return false;
  if (filters.statuses.length > 0 && (!props.status || !filters.statuses.includes(props.status))) return false;
  if (filters.phases.length > 0 && (!props.phase || !filters.phases.includes(props.phase))) return false;
  if (filters.mainAreas.length > 0 && (!props.mainArea || !filters.mainAreas.includes(props.mainArea))) return false;
  if (
    filters.drillOrDropYears.length > 0 &&
    (props.drillOrDropYear == null || !filters.drillOrDropYears.includes(String(props.drillOrDropYear)))
  )
    return false;
  if (filters.drillDecisionTaken && props.drillOrDropStatus !== DRILL_DECISION_TAKEN_STATUS) return false;
  return true;
}

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.companies.length > 0 ||
    filters.statuses.length > 0 ||
    filters.phases.length > 0 ||
    filters.mainAreas.length > 0 ||
    filters.drillOrDropYears.length > 0 ||
    filters.drillDecisionTaken
  );
}
