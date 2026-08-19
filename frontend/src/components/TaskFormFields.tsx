import type { Category } from "../api";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "school", label: "School" },
  { value: "study", label: "Study" },
  { value: "sport", label: "Sport" },
  { value: "routine", label: "Routine" },
  { value: "leisure", label: "Leisure" },
  { value: "other", label: "Other" },
];

export const FIXED_TITLES: Record<Category, string[]> = {
  school: ["Mate", "Romana", "Istorie", "Geografie", "Sport"],
  sport: [
    "Antrenament fotbal",
    "Antrenament individual",
    "Antrenament Coerver",
    "Sport complementar",
    "Meci fotbal",
    "Turneu",
  ],
  routine: ["Spalat pe dinti", "Pregatit ghiozdan"],
  leisure: ["TV", "PS"],
  study: ["Teme scoala", "Extra Mate/Romana", "Extra Engleza", "Duolingo", "Citit"],
  other: [],
};

export const CUSTOM_OPTION = "__custom__";

// Tappable buttons instead of a <select> -- every option is visible at once, no menu to open,
// easier to hit on a phone than a native dropdown.
export function CategoryPicker({ value, onChange }: { value: Category; onChange: (next: Category) => void }) {
  return (
    <div className="field">
      <span className="field-label">Category</span>
      <div className="day-picker">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`day-chip ${value === c.value ? "selected" : ""}`}
            onClick={() => onChange(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TitlePicker({
  category,
  titleChoice,
  onTitleChoiceChange,
  customTitle,
  onCustomTitleChange,
}: {
  category: Category;
  titleChoice: string;
  onTitleChoiceChange: (next: string) => void;
  customTitle: string;
  onCustomTitleChange: (next: string) => void;
}) {
  const fixedTitles = FIXED_TITLES[category];
  const isCustom = fixedTitles.length === 0 || titleChoice === CUSTOM_OPTION;

  return (
    <div className="field">
      {fixedTitles.length > 0 && (
        <>
          <span className="field-label">Title</span>
          <div className="day-picker">
            {fixedTitles.map((t) => (
              <button
                key={t}
                type="button"
                className={`day-chip ${titleChoice === t ? "selected" : ""}`}
                onClick={() => onTitleChoiceChange(t)}
              >
                {t}
              </button>
            ))}
            <button
              type="button"
              className={`day-chip ${titleChoice === CUSTOM_OPTION ? "selected" : ""}`}
              onClick={() => onTitleChoiceChange(CUSTOM_OPTION)}
            >
              Other…
            </button>
          </div>
        </>
      )}
      {isCustom && (
        <input
          type="text"
          value={customTitle}
          onChange={(e) => onCustomTitleChange(e.target.value)}
          placeholder="Title"
          required
        />
      )}
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
// The day timeline already only ever snaps to quarter-hours, so offering anything finer here
// would just be precision the rest of the app throws away.
const QUARTER_MINUTES = ["00", "15", "30", "45"];

/** Two plain hour/minute selects instead of <input type="time"> -- the native picker's
    12h-vs-24h rendering depends on the device's own locale and was unusable on at least
    one phone (see NotificationsToggle's homework-check-time picker, same fix). */
export function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [hh, mm] = value ? value.split(":") : ["", ""];

  return (
    <label className="time-select-field">
      {label}
      <span className="time-select-row">
        <select value={hh} onChange={(e) => onChange(`${e.target.value}:${mm || "00"}`)} required aria-label={`${label} hour`}>
          <option value="" disabled>
            --
          </option>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        :
        <select
          value={mm}
          onChange={(e) => onChange(`${hh || "00"}:${e.target.value}`)}
          required
          aria-label={`${label} minute`}
        >
          <option value="" disabled>
            --
          </option>
          {QUARTER_MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
