import { useState } from "react";
import { Link } from "react-router-dom";
import TabBar from "./TabBar";
import type { CupaDay, CupaMatch, CupaStandingsGroup } from "../api";

interface Props {
  ageGroup: string;
  subtitle: string;
  /** When this data was last successfully fetched. */
  updatedAt: string;
  /** True if the live fetch just failed and this is the last known good data instead. */
  stale: boolean;
  days: CupaDay[];
  /** Only present for age groups with a CLASAMENT tab wired up. */
  standings?: CupaStandingsGroup[];
  pinnedLabel: string;
  isHighlightTeam: (name: string) => boolean;
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TeamName({ name, isHighlightTeam }: { name: string; isHighlightTeam: (name: string) => boolean }) {
  return isHighlightTeam(name) ? (
    <span className="elite-team-us cupa-highlight-team">
      <span aria-hidden="true">⭐</span> {name}
    </span>
  ) : (
    <span>{name}</span>
  );
}

interface FilteredDay {
  label: string;
  matches: CupaMatch[];
}

function DaySection({
  day,
  defaultOpen,
  isHighlightTeam,
}: {
  day: FilteredDay;
  defaultOpen: boolean;
  isHighlightTeam: (name: string) => boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="elite-section">
      <button type="button" className="elite-section-toggle" onClick={() => setOpen((o) => !o)}>
        <span className={`elite-section-caret ${open ? "open" : ""}`}>▸</span>
        {day.label} ({day.matches.length})
      </button>
      {open && (
        <ul className="elite-match-list">
          {day.matches.map((m, i) => (
            <li key={i} className="elite-match">
              <div className="elite-match-meta">
                {m.time}
                {m.field ? ` · ${m.field}` : ""}
              </div>
              <div className="elite-match-teams">
                <TeamName name={m.home} isHighlightTeam={isHighlightTeam} />
                {m.score ? <span className="elite-score">{m.score}</span> : <span className="elite-vs">vs</span>}
                <TeamName name={m.away} isHighlightTeam={isHighlightTeam} />
              </div>
              <div className="elite-match-venue">{m.group}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PinnedMatch extends CupaMatch {
  dayLabel: string;
}

function StandingsSection({
  groups,
  isHighlightTeam,
}: {
  groups: CupaStandingsGroup[];
  isHighlightTeam: (name: string) => boolean;
}) {
  return (
    <div className="elite-section cupa-standings">
      <div className="elite-section-toggle">Standings</div>
      {groups.map((g) => (
        <div key={g.group} className="cupa-standings-group">
          <div className="cupa-standings-group-label">{g.group}</div>
          <div className="cupa-standings-table-wrap">
            <table className="cupa-standings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>M</th>
                  <th>P</th>
                  <th>GM</th>
                  <th>GP</th>
                  <th>+/-</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.team} className={isHighlightTeam(r.team) ? "cupa-standings-us" : ""}>
                    <td>{r.rank}</td>
                    <td>
                      <TeamName name={r.team} isHighlightTeam={isHighlightTeam} />
                    </td>
                    <td>{r.played}</td>
                    <td>{r.points}</td>
                    <td>{r.goalsFor}</td>
                    <td>{r.goalsAgainst}</td>
                    <td>{r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CupaAgeGroupSchedule({
  ageGroup,
  subtitle,
  updatedAt,
  stale,
  days,
  standings,
  pinnedLabel,
  isHighlightTeam,
}: Props) {
  const filteredDays: FilteredDay[] = days
    .map((day) => ({ label: day.label, matches: day.matches.filter((m) => m.group.startsWith(ageGroup)) }))
    .filter((day) => day.matches.length > 0);

  const filteredStandings = (standings ?? []).filter((g) => g.group.startsWith(ageGroup));

  const pinned: PinnedMatch[] = filteredDays.flatMap((day) =>
    day.matches
      .filter((m) => isHighlightTeam(m.home) || isHighlightTeam(m.away))
      .map((m) => ({ ...m, dayLabel: day.label }))
  );

  return (
    <div className="dashboard">
      <Link to="/more/cupa-stelele-viitorului" className="back-link">
        ← Back
      </Link>

      <header className="dashboard-header">
        <div className="header-title-block">
          <h1>{ageGroup}</h1>
          <span className="signed-in-as">{subtitle}</span>
        </div>
      </header>

      {stale ? (
        <p className="cupa-stale-note">
          ⚠ Couldn't reach the live schedule — showing the last known data from {formatUpdatedAt(updatedAt)}
        </p>
      ) : (
        <p className="empty-state cupa-snapshot-note">Live from the shared schedule · updated {formatUpdatedAt(updatedAt)}</p>
      )}

      {pinned.length > 0 && (
        <div className="elite-section cupa-pinned">
          <div className="elite-section-toggle cupa-pinned-heading">
            <span aria-hidden="true">⭐</span> {pinnedLabel}'s matches ({pinned.length})
          </div>
          <ul className="elite-match-list">
            {pinned.map((m, i) => (
              <li key={i} className="elite-match">
                <div className="elite-match-meta">
                  {m.dayLabel.split("—")[0].trim()} · {m.time}
                  {m.field ? ` · ${m.field}` : ""}
                </div>
                <div className="elite-match-teams">
                  <TeamName name={m.home} isHighlightTeam={isHighlightTeam} />
                  {m.score ? <span className="elite-score">{m.score}</span> : <span className="elite-vs">vs</span>}
                  <TeamName name={m.away} isHighlightTeam={isHighlightTeam} />
                </div>
                <div className="elite-match-venue">{m.group}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {filteredStandings.length > 0 && <StandingsSection groups={filteredStandings} isHighlightTeam={isHighlightTeam} />}

      {filteredDays.map((day) => (
        <DaySection key={day.label} day={day} defaultOpen={false} isHighlightTeam={isHighlightTeam} />
      ))}

      <TabBar />
    </div>
  );
}
