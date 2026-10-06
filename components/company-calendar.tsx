"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Link2 } from "lucide-react";
import { calendarDates, shiftCalendarDate, type CalendarEntry } from "@/lib/company-calendar";
import styles from "./company-calendar.module.css";

type CalendarView = "week" | "month" | "agenda";
type CompanyCalendarProps = {
  entries: CalendarEntry[];
  date: string;
  onDateChange: (date: string) => void;
  onPlanDay: () => void;
  onOpenRecord: (route: string, recordId: string | number) => void;
  onConnections: () => void;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dateLabel(date: string, withYear = false) {
  const [year, month, day] = date.split("-").map(Number);
  if (!MONTHS[month - 1] || !day) return "Choose a date";
  return `${MONTHS[month - 1]} ${day}${withYear ? `, ${year}` : ""}`;
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function entryTime(entry: CalendarEntry) {
  if (entry.kind === "deadline") return "Due · not booked time";
  return entry.start ? `${entry.start}${entry.end ? `–${entry.end}` : ""}` : "Local planning block";
}

/** Read-only calendar presentation; the parent controls record visibility. */
export function CompanyCalendar({ entries, date, onDateChange, onPlanDay, onOpenRecord, onConnections }: CompanyCalendarProps) {
  const [view, setView] = useState<CalendarView>("week");
  const [showPlanned, setShowPlanned] = useState(true);
  const [showDeadlines, setShowDeadlines] = useState(true);
  const rangeView = view === "month" ? "month" : "week";
  const dates = useMemo(() => calendarDates(date, rangeView), [date, rangeView]);
  const previous = shiftCalendarDate(date, -1, rangeView);
  const next = shiftCalendarDate(date, 1, rangeView);
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      if ((entry.kind === "planned" && !showPlanned) || (entry.kind === "deadline" && !showDeadlines)) continue;
      const list = map.get(entry.date);
      if (list) list.push(entry);
      else map.set(entry.date, [entry]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "planned" ? -1 : 1)
        || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title));
    }
    return map;
  }, [entries, showPlanned, showDeadlines]);
  const selectedEntries = byDate.get(date) ?? [];
  const rangeTitle = view === "month"
    ? `${MONTHS[Number(date.slice(5, 7)) - 1] ?? "Calendar"} ${date.slice(0, 4)}`
    : dates.length ? `${dateLabel(dates[0])} – ${dateLabel(dates[dates.length - 1], true)}` : "Choose a date";
  const agendaDates = dates.filter((day) => (byDate.get(day)?.length ?? 0) > 0);

  function openEntry(entry: CalendarEntry) {
    onDateChange(entry.date);
    if (entry.route && entry.recordId !== undefined) onOpenRecord(entry.route, entry.recordId);
    else if (entry.kind === "planned") onPlanDay();
  }

  return <section className={styles.calendar} aria-label="Company calendar">
    <div className={styles.connection}>
      <span><Link2 size={14} aria-hidden="true"/> Outlook &amp; Teams <b>Not connected</b></span>
      <button type="button" onClick={onConnections}>Setup details <ArrowUpRight size={13} aria-hidden="true"/></button>
    </div>

    <div className={styles.toolbar}>
      <div className={styles.navigation}>
        <button type="button" className={styles.iconButton} disabled={!previous} aria-label={`Previous ${rangeView}`} onClick={() => onDateChange(previous)}><ChevronLeft size={18} aria-hidden="true"/></button>
        <button type="button" className={styles.iconButton} disabled={!next} aria-label={`Next ${rangeView}`} onClick={() => onDateChange(next)}><ChevronRight size={18} aria-hidden="true"/></button>
        <button type="button" onClick={() => onDateChange(localToday())}>Today</button>
        <h3 aria-live="polite">{rangeTitle}</h3>
      </div>
      <div className={styles.views} role="group" aria-label="Calendar view">
        {(["week", "month", "agenda"] as const).map((option) => <button type="button" key={option} aria-pressed={view === option} className={view === option ? styles.activeView : undefined} onClick={() => setView(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}
      </div>
    </div>

    <div className={styles.filterRow}>
      <div className={styles.filters} role="group" aria-label="Calendar layers">
        <label><input type="checkbox" checked={showPlanned} onChange={(event) => setShowPlanned(event.target.checked)}/><span className={styles.plannedDot}/>Planned time</label>
        <label><input type="checkbox" checked={showDeadlines} onChange={(event) => setShowDeadlines(event.target.checked)}/><span className={styles.deadlineDot}/>Deadlines</label>
      </div>
      <label className={styles.datePicker}>Go to date<input type="date" aria-label="Calendar date" min="0001-01-01" max="9999-12-31" value={date} onChange={(event) => { if (event.target.value) onDateChange(event.target.value); }}/></label>
    </div>

    <div className={styles.layout}>
      <div className={styles.calendarBody}>
        {dates.length === 0 ? <div className={styles.empty}><CalendarDays size={25} aria-hidden="true"/><p>Choose a date to see your calendar.</p></div>
          : view === "agenda" ? <div className={styles.agenda} aria-label="Weekly agenda">
            {agendaDates.length === 0 ? <div className={styles.empty}><CalendarDays size={25} aria-hidden="true"/><h4>No entries in this week</h4><p>{!showPlanned && !showDeadlines ? "Turn on a calendar layer to see your entries." : "Accepted planning blocks and dated work will appear here."}</p><button type="button" onClick={onPlanDay}>Plan selected day</button></div>
              : agendaDates.map((day) => <section className={styles.agendaDay} key={day} aria-label={dateLabel(day, true)}>
                <button type="button" className={`${styles.agendaDate} ${day === date ? styles.selectedAgendaDate : ""}`} onClick={() => onDateChange(day)} aria-pressed={day === date}>{dateLabel(day)}</button>
                <ul>{byDate.get(day)!.map((entry) => <li key={entry.id}>
                  <span className={entry.kind === "planned" ? styles.plannedDot : styles.deadlineDot}/>
                  <div><small>{entryTime(entry)}</small><strong>{entry.title}</strong><small>{entry.label} · Spej local</small></div>
                  {entry.route && entry.recordId !== undefined || entry.kind === "planned" ? <button type="button" className={styles.iconButton} aria-label={`Open ${entry.title}`} onClick={() => openEntry(entry)}><ArrowUpRight size={16} aria-hidden="true"/></button> : null}
                </li>)}</ul>
              </section>)}
          </div> : <div className={styles.gridScroll} tabIndex={0} role="region" aria-label={`${view === "month" ? "Monthly" : "Weekly"} calendar, scroll horizontally if needed`}>
            <div className={`${styles.grid} ${view === "month" ? styles.monthGrid : styles.weekGrid}`}>
              {WEEKDAYS.map((day) => <div className={styles.weekday} key={day}>{day}</div>)}
              {dates.map((day) => {
                const dayEntries = byDate.get(day) ?? [];
                const limit = view === "month" ? 3 : 6;
                const outsideMonth = view === "month" && day.slice(0, 7) !== date.slice(0, 7);
                return <div key={day} className={`${styles.dayCell} ${day === date ? styles.selectedDay : ""} ${outsideMonth ? styles.outsideMonth : ""}`}>
                  <button type="button" className={styles.dayNumber} onClick={() => onDateChange(day)} aria-label={`Show ${dateLabel(day, true)}, ${dayEntries.length} ${dayEntries.length === 1 ? "entry" : "entries"}`} aria-pressed={day === date}><time dateTime={day}>{Number(day.slice(8))}</time>{view === "week" ? <small>{MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3)}</small> : null}</button>
                  <div className={styles.dayEntries}>{dayEntries.slice(0, limit).map((entry) => <button type="button" className={`${styles.entry} ${entry.kind === "deadline" ? styles.deadline : styles.planned}`} key={entry.id} onClick={() => onDateChange(day)} aria-label={`Review ${entry.title}, ${entryTime(entry)}, ${dateLabel(day)}`}>
                    <span>{entry.kind === "planned" ? entry.start ?? "Planned" : "Due"}</span><strong>{entry.title}</strong>
                  </button>)}</div>
                  {dayEntries.length > limit ? <button type="button" className={styles.more} onClick={() => onDateChange(day)}>+{dayEntries.length - limit} more<span className={styles.srOnly}> on {dateLabel(day)}</span></button> : null}
                  {view === "week" && dayEntries.length === 0 ? <p className={styles.noEntries}>No entries</p> : null}
                </div>;
              })}
            </div>
          </div>}
        <p className={styles.sourceNote}>Spej local · Deadlines are reminders, not booked time. Outlook meetings are not shown.</p>
      </div>

      <aside className={styles.selectedPanel} aria-label="Selected day details">
        <div className={styles.selectedHeading}><div><p>Selected day</p><h3>{dateLabel(date, true)}</h3></div><CalendarDays size={19} aria-hidden="true"/></div>
        {selectedEntries.length ? <ul className={styles.details}>{selectedEntries.map((entry) => <li key={entry.id}>
          <span className={`${styles.entryKind} ${entry.kind === "deadline" ? styles.deadlineKind : ""}`}>{entry.kind === "planned" ? <Clock3 size={12} aria-hidden="true"/> : null}{entryTime(entry)}</span>
          <h4>{entry.title}</h4><p>{entry.label} · Spej local</p>
          {entry.route && entry.recordId !== undefined ? <button type="button" className={styles.textButton} onClick={() => openEntry(entry)}>Open source record <ArrowUpRight size={13} aria-hidden="true"/></button>
            : entry.kind === "planned" ? <button type="button" className={styles.textButton} onClick={onPlanDay}>Manage time block <ArrowUpRight size={13} aria-hidden="true"/></button> : null}
        </li>)}</ul> : <div className={styles.selectedEmpty}><Clock3 size={23} aria-hidden="true"/><p>{!showPlanned && !showDeadlines ? "Both calendar layers are hidden." : "No visible entries for this day."}</p></div>}
        <button type="button" className={styles.planButton} onClick={onPlanDay}>Plan this day</button>
      </aside>
    </div>
  </section>;
}
