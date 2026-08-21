import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEliteU13Schedule, getEliteU13MatchSheet, type EliteU13Match, type EliteU13MatchSheet, type MatchSheetClub } from "../api";
import TabBar from "../components/TabBar";

function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day}, ${time}`;
}

function ClubSheet({ club }: { club: MatchSheetClub }) {
  return (
    <div className="elite-sheet-club">
      <h4>{club.name}</h4>
      {club.staff.length > 0 && (
        <div className="elite-sheet-group">
          <span className="elite-sheet-group-label">Staff</span>
          <ul className="elite-sheet-list">
            {club.staff.map((s, i) => (
              <li key={i}>
                {s.name} <span className="elite-sheet-role">({s.role})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {club.starters.length > 0 && (
        <div className="elite-sheet-group">
          <span className="elite-sheet-group-label">Starters</span>
          <ul className="elite-sheet-list">
            {club.starters.map((p, i) => (
              <li key={i}>
                #{p.shirtNo} {p.name}
                {p.captain ? " (C)" : ""} <span className="elite-sheet-role">{p.position}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {club.reserves.length > 0 && (
        <div className="elite-sheet-group">
          <span className="elite-sheet-group-label">Reserves</span>
          <ul className="elite-sheet-list">
            {club.reserves.map((p, i) => (
              <li key={i}>
                #{p.shirtNo} {p.name} <span className="elite-sheet-role">{p.position}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MatchLineups({ matchId }: { matchId: string }) {
  const [sheet, setSheet] = useState<EliteU13MatchSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEliteU13MatchSheet(matchId)
      .then(setSheet)
      .catch((err) => setError(err instanceof Error ? err.message : "Lineups not available"))
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <p className="empty-state">Loading lineups…</p>;
  if (error || !sheet) return <p className="empty-state">{error ?? "Lineups not available"}</p>;

  return (
    <div className="elite-sheet">
      <ClubSheet club={sheet.home} />
      <ClubSheet club={sheet.away} />
    </div>
  );
}

function MatchItem({ m, team, played }: { m: EliteU13Match; team: string; played: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <li className={`elite-match ${played ? "played" : ""}`}>
      <div className="elite-match-meta">
        Round {m.round} · {formatMatchDate(m.date)}
      </div>
      <div className="elite-match-teams">
        <span className={m.home === team ? "elite-team-us" : ""}>{m.home}</span>
        {played ? (
          <span className="elite-score">
            {m.homeGoals} – {m.awayGoals}
          </span>
        ) : (
          <span className="elite-vs">vs</span>
        )}
        <span className={m.away === team ? "elite-team-us" : ""}>{m.away}</span>
      </div>
      {!played && m.stadium && (
        <div className="elite-match-venue">
          {m.stadium}
          {m.town ? ` (${m.town})` : ""}
        </div>
      )}
      <button type="button" className="elite-lineups-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Hide lineups" : "Show lineups"}
      </button>
      {open && <MatchLineups matchId={m.matchId} />}
    </li>
  );
}

export default function EliteU13Schedule() {
  const [team, setTeam] = useState("");
  const [matches, setMatches] = useState<EliteU13Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [playedOpen, setPlayedOpen] = useState(false);

  useEffect(() => {
    getEliteU13Schedule()
      .then(({ team, matches }) => {
        setTeam(team);
        setMatches(matches);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the schedule"))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = matches.filter((m) => !m.played);
  const played = matches.filter((m) => m.played);

  return (
    <div className="dashboard">
      <Link to="/more" className="secondary">
        ‹ Back
      </Link>

      <header className="dashboard-header">
        <div className="header-title-block">
          <h1>Elite U13 Schedule</h1>
          {team && <span className="signed-in-as">{team} · Seria 1 · live from hailafotbal.ro</span>}
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : (
        <>
          {played.length > 0 && (
            <div className="elite-section">
              <button
                type="button"
                className="elite-section-toggle"
                onClick={() => setPlayedOpen((o) => !o)}
              >
                <span className={`elite-section-caret ${playedOpen ? "open" : ""}`}>▸</span>
                Played ({played.length})
              </button>
              {playedOpen && (
                <ul className="elite-match-list">
                  {played.map((m) => (
                    <MatchItem key={m.matchId} m={m} team={team} played />
                  ))}
                </ul>
              )}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="elite-section">
              <button
                type="button"
                className="elite-section-toggle"
                onClick={() => setUpcomingOpen((o) => !o)}
              >
                <span className={`elite-section-caret ${upcomingOpen ? "open" : ""}`}>▸</span>
                Upcoming ({upcoming.length})
              </button>
              {upcomingOpen && (
                <ul className="elite-match-list">
                  {upcoming.map((m) => (
                    <MatchItem key={m.matchId} m={m} team={team} played={false} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {matches.length === 0 && <p className="empty-state">No matches found.</p>}
        </>
      )}

      <TabBar />
    </div>
  );
}
