import { Navigate, useParams } from "react-router-dom";
import CupaAgeGroupSchedule from "../components/CupaAgeGroupSchedule";
import {
  CUPA_2014_2015_DAYS,
  HIGHLIGHT_TEAM,
  SNAPSHOT_DATE as SNAPSHOT_DATE_2014_2015,
} from "../data/cupaSteleleViitorului2014_2015";
import {
  CUPA_2016_2017_DAYS,
  HIGHLIGHT_TEAM_PREFIX,
  SNAPSHOT_DATE as SNAPSHOT_DATE_2016_2017,
} from "../data/cupaSteleleViitorului2016_2017";

const YEARS_2014_2015 = new Set(["2014", "2015"]);
const YEARS_2016_2017 = new Set(["2016", "2017"]);

export default function CupaYearSchedule() {
  const { year = "" } = useParams<{ year: string }>();

  if (YEARS_2014_2015.has(year)) {
    return (
      <CupaAgeGroupSchedule
        ageGroup={year}
        subtitle="Cupa Stelele Viitorului 2026 · FCSB base"
        snapshotDate={SNAPSHOT_DATE_2014_2015}
        days={CUPA_2014_2015_DAYS}
        pinnedLabel={HIGHLIGHT_TEAM}
        isHighlightTeam={(name) => name === HIGHLIGHT_TEAM}
      />
    );
  }

  if (YEARS_2016_2017.has(year)) {
    return (
      <CupaAgeGroupSchedule
        ageGroup={year}
        subtitle="Cupa Stelele Viitorului 2026 · FCSB base"
        snapshotDate={SNAPSHOT_DATE_2016_2017}
        days={CUPA_2016_2017_DAYS}
        pinnedLabel={HIGHLIGHT_TEAM_PREFIX}
        isHighlightTeam={(name) => name.startsWith(HIGHLIGHT_TEAM_PREFIX)}
      />
    );
  }

  return <Navigate to="/more/cupa-stelele-viitorului" replace />;
}
