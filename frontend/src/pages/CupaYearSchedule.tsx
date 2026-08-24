import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import CupaAgeGroupSchedule from "../components/CupaAgeGroupSchedule";
import TabBar from "../components/TabBar";
import { getCupaSchedule, type CupaScheduleResponse } from "../api";

const YEARS_2014_2015 = new Set(["2014", "2015"]);
const YEARS_2016_2017 = new Set(["2016", "2017"]);

// Tab keys in the backend's live feed (backend/src/routes/cupaSchedule.ts).
const SHEET_2014_2015 = "2014-2015";
const SHEET_2016_2017 = "2016-2017";

const HIGHLIGHT_TEAM = "Coerver România";
const HIGHLIGHT_TEAM_PREFIX = "Coerver"; // Coerver fields two 2016-2017 squads (Verde/Negru)

function CupaStatusPage({ message }: { message: string }) {
  return (
    <div className="dashboard">
      <Link to="/more/cupa-stelele-viitorului" className="back-link">
        ← Back
      </Link>
      <p className="empty-state">{message}</p>
      <TabBar />
    </div>
  );
}

export default function CupaYearSchedule() {
  const { year = "" } = useParams<{ year: string }>();
  const [data, setData] = useState<CupaScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCupaSchedule()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the schedule"));
  }, []);

  if (!YEARS_2014_2015.has(year) && !YEARS_2016_2017.has(year)) {
    return <Navigate to="/more/cupa-stelele-viitorului" replace />;
  }

  if (error) return <CupaStatusPage message={error} />;
  if (!data) return <CupaStatusPage message="Loading…" />;

  const isFirstAgeGroup = YEARS_2014_2015.has(year);
  const sheetName = isFirstAgeGroup ? SHEET_2014_2015 : SHEET_2016_2017;
  const pinnedLabel = isFirstAgeGroup ? HIGHLIGHT_TEAM : HIGHLIGHT_TEAM_PREFIX;

  return (
    <CupaAgeGroupSchedule
      ageGroup={year}
      subtitle="Cupa Stelele Viitorului 2026 · FCSB base"
      updatedAt={data.updatedAt}
      stale={data.stale}
      days={data.sheets[sheetName] ?? []}
      standings={data.standings[year]}
      pinnedLabel={pinnedLabel}
      isHighlightTeam={isFirstAgeGroup ? (name) => name === HIGHLIGHT_TEAM : (name) => name.startsWith(HIGHLIGHT_TEAM_PREFIX)}
    />
  );
}
