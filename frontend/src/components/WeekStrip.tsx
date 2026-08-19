import type { Category } from "../api";
import { formatDayNumber, formatMonthYear, formatWeekdayShort, getWeekDates, toISODate } from "../date";

export default function WeekStrip({
  selectedDate,
  onSelect,
  onPrevWeek,
  onNextWeek,
  categoriesForDate,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  categoriesForDate: (date: string) => Category[];
}) {
  const today = toISODate(new Date());
  const weekDates = getWeekDates(selectedDate);

  return (
    <div className="week-strip">
      <div className="week-strip-header">
        <button className="week-nav-btn" onClick={onPrevWeek} aria-label="Previous week">
          ‹
        </button>
        <span className="week-month-label">{formatMonthYear(selectedDate)}</span>
        <button className="week-nav-btn" onClick={onNextWeek} aria-label="Next week">
          ›
        </button>
      </div>
      <div className="week-days">
        {weekDates.map((date) => {
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const categories = categoriesForDate(date);
          return (
            <button
              key={date}
              type="button"
              className={`week-day${isSelected ? " selected" : ""}${isToday ? " today" : ""}`}
              onClick={() => onSelect(date)}
            >
              <span className="week-day-name">{formatWeekdayShort(date)}</span>
              <span className="week-day-num">{formatDayNumber(date)}</span>
              <span className="week-day-dots">
                {categories.slice(0, 4).map((cat) => (
                  <span key={cat} className={`week-day-dot cat-dot-${cat}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
