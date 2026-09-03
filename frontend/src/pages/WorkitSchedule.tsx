import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWorkitSchedule, type FrfAjfMatch } from "../api";
import TabBar from "../components/TabBar";

function formatMatchDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function MatchItem({ m, team }: { m: FrfAjfMatch; team: string }) {
  if (m.bye) {
    return (
      <li className="elite-match">
        <div className="elite-match-meta">
          Round {m.round} · {formatMatchDate(m.date)}
        </div>
        <div className="elite-match-teams">
          <span className="elite-vs">Bye — no match this round</span>
        </div>
      </li>
    );
  }

  return (
    <li className={`elite-match ${m.played ? "played" : ""}`}>
      <div className="elite-match-meta">
        Round {m.round} · {formatMatchDate(m.date)}
        {m.time ? ` · ${m.time}` : ""}
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
      {!m.played && m.venue && <div className="elite-match-venue">{m.venue}</div>}
    </li>
  );
}

export default function WorkitSchedule() {
  const [team, setTeam] = useState("");
  const [matches, setMatches] = useState<FrfAjfMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [playedOpen, setPlayedOpen] = useState(false);

  useEffect(() => {
    getWorkitSchedule()
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
          <h1>AJF U12 2026/2027</h1>
          {team && <span className="signed-in-as">{team} · Juniori U12 (2015) · live from frf-ajf.ro</span>}
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
                    <MatchItem key={m.matchUrl} m={m} team={team} />
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
                    <MatchItem key={m.matchUrl} m={m} team={team} />
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
