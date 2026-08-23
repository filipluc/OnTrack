import { useState } from "react";
import { Link } from "react-router-dom";
import TabBar from "./TabBar";
import type { CupaDay, CupaMatch } from "../data/cupaTypes";

interface Props {
  ageGroup: string;
  subtitle: string;
  snapshotDate: string;
  days: CupaDay[];
  pinnedLabel: string;
  isHighlightTeam: (name: string) => boolean;
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
                <span className="elite-vs">vs</span>
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

export default function CupaAgeGroupSchedule({
  ageGroup,
  subtitle,
  snapshotDate,
  days,
  pinnedLabel,
  isHighlightTeam,
}: Props) {
  const filteredDays: FilteredDay[] = days
    .map((day) => ({ label: day.label, matches: day.matches.filter((m) => m.group.startsWith(ageGroup)) }))
    .filter((day) => day.matches.length > 0);

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

      <p className="empty-state cupa-snapshot-note">
        Snapshot from the shared schedule, as of {snapshotDate} — not live. Ask for a refresh if it's changed.
      </p>

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
                  <span className="elite-vs">vs</span>
                  <TeamName name={m.away} isHighlightTeam={isHighlightTeam} />
                </div>
                <div className="elite-match-venue">{m.group}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {filteredDays.map((day) => (
        <DaySection key={day.label} day={day} defaultOpen={false} isHighlightTeam={isHighlightTeam} />
      ))}

      <TabBar />
    </div>
  );
}
