import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getInterligaU12Schedule, type InterligaU12Match } from "../api";
import TabBar from "../components/TabBar";

function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day}, ${time}`;
}

function MatchItem({ m, team }: { m: InterligaU12Match; team: string }) {
  return (
    <li className={`elite-match ${m.played ? "played" : ""}`}>
      <div className="elite-match-meta">
        Round {m.round} · {formatMatchDate(m.date)}
      </div>
      <div className="elite-match-teams">
        <span className={m.home === team ? "elite-team-us" : ""}>{m.home}</span>
        {m.played ? (
          <span className="elite-score">
            {m.homeGoals} – {m.awayGoals}
          </span>
        ) : (
          <span className="elite-vs">vs</span>
        )}
        <span className={m.away === team ? "elite-team-us" : ""}>{m.away}</span>
      </div>
      {!m.played && m.stadium && (
        <div className="elite-match-venue">
          {m.stadium}
          {m.town ? ` (${m.town})` : ""}
        </div>
      )}
    </li>
  );
}

export default function InterligaU12Schedule() {
  const [team, setTeam] = useState("");
  const [matches, setMatches] = useState<InterligaU12Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [playedOpen, setPlayedOpen] = useState(false);

  useEffect(() => {
    getInterligaU12Schedule()
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
      <Link to="/more" className="back-link">
        ← Back
      </Link>

      <header className="dashboard-header">
        <div className="header-title-block">
          <h1>Interliga U12 2026/2027</h1>
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
              <button type="button" className="elite-section-toggle" onClick={() => setPlayedOpen((o) => !o)}>
                <span className={`elite-section-caret ${playedOpen ? "open" : ""}`}>▸</span>
                Played ({played.length})
              </button>
              {playedOpen && (
                <ul className="elite-match-list">
                  {played.map((m) => (
                    <MatchItem key={m.matchId} m={m} team={team} />
                  ))}
                </ul>
              )}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="elite-section">
              <button type="button" className="elite-section-toggle" onClick={() => setUpcomingOpen((o) => !o)}>
                <span className={`elite-section-caret ${upcomingOpen ? "open" : ""}`}>▸</span>
                Upcoming ({upcoming.length})
              </button>
              {upcomingOpen && (
                <ul className="elite-match-list">
                  {upcoming.map((m) => (
                    <MatchItem key={m.matchId} m={m} team={team} />
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
