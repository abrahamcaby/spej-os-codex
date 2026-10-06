export type WorkCandidate = {
  id: string;
  title: string;
  minutes: number;
  priority: "urgent" | "high" | "normal" | "low";
  due?: string;
  blocked?: boolean;
  source: "task" | "routine";
  sourceId: string;
};

/** Times are local HH:mm values for the date supplied to proposeWorkday. */
export type WorkBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
  source: "manual" | "task" | "routine";
  sourceId?: string;
};

export type WorkdayPreferences = {
  start: string;
  end: string;
  reserveMinutes: number;
  /** JavaScript weekday numbers: 0 = Sunday, 6 = Saturday. */
  weekdays: number[];
};

export type PlanDayResult = {
  suggested: WorkBlock[];
  unscheduled: Array<{ candidate: WorkCandidate; reason: string }>;
  warnings: string[];
  /** Usable capacity before suggestions, after existing blocks and reserve. */
  availableMinutes: number;
  /** Minutes in suggested blocks only; does not include existing commitments. */
  scheduledMinutes: number;
  /** Free minutes protected from suggestions, not a synthetic calendar event. */
  reservedMinutes: number;
};

type Interval = { start: number; end: number };

const priorityOrder: Record<WorkCandidate["priority"], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function parseTime(value: string): number | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1] ? { year, month, day } : null;
}

/** Gregorian arithmetic avoids interpreting a date-only value as a UTC instant. */
function weekday({ year, month, day }: NonNullable<ReturnType<typeof parseDate>>): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  return (adjustedYear + Math.floor(adjustedYear / 4) - Math.floor(adjustedYear / 100)
    + Math.floor(adjustedYear / 400) + offsets[month - 1] + day) % 7;
}

function sourceKey(source: string, id: string): string {
  return JSON.stringify([source, id]);
}

/**
 * Deterministic, whole-block suggestions only. Existing commitments are never
 * moved, split, or mutated. A caller must explicitly accept suggestions; this
 * function neither persists a plan nor writes to an external calendar.
 */
export function proposeWorkday(
  date: string,
  preferences: WorkdayPreferences,
  existing: WorkBlock[],
  candidates: WorkCandidate[],
): PlanDayResult {
  const result: PlanDayResult = {
    suggested: [], unscheduled: [], warnings: [],
    availableMinutes: 0, scheduledMinutes: 0, reservedMinutes: 0,
  };
  const stop = (reason: string): PlanDayResult => {
    result.unscheduled = candidates.map((candidate) => ({ candidate, reason }));
    return result;
  };

  const parsedDate = parseDate(date);
  if (!parsedDate) result.warnings.push("Choose a valid date in YYYY-MM-DD format.");
  const start = parseTime(preferences.start);
  const end = parseTime(preferences.end);
  if (start === null || end === null || end <= start) {
    result.warnings.push("Working hours must use HH:mm and end after they start on the same day.");
  }
  if (!Number.isSafeInteger(preferences.reserveMinutes) || preferences.reserveMinutes < 0) {
    result.warnings.push("Reserved time must be a non-negative whole number of minutes.");
  }
  if (!Array.isArray(preferences.weekdays)
    || preferences.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    result.warnings.push("Working days must use weekday numbers from 0 (Sunday) to 6 (Saturday).");
  }
  if (result.warnings.length || !parsedDate || start === null || end === null) {
    return stop("Correct the date or working preferences before planning.");
  }

  const intervals: Interval[] = [];
  const existingIds = new Set(existing.map((block) => block.id));
  const existingSources = new Set(existing
    .filter((block) => block.source !== "manual" && block.sourceId)
    .map((block) => sourceKey(block.source, block.sourceId!)));
  let malformedExisting = false;
  for (const block of existing) {
    const blockStart = parseTime(block.start);
    const blockEnd = parseTime(block.end);
    if (blockStart === null || blockEnd === null || blockEnd <= blockStart) {
      result.warnings.push(`Existing block "${block.title}" has invalid times; correct it before planning.`);
      malformedExisting = true;
      continue;
    }
    intervals.push({ start: blockStart, end: blockEnd });
  }
  // Ignoring an invalid commitment could create a conflict. Fail closed instead.
  if (malformedExisting) return stop("Correct existing block times before planning.");

  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  let furthestEnd = -1;
  let hasOverlap = false;
  for (const interval of intervals) {
    if (interval.start < furthestEnd) hasOverlap = true;
    furthestEnd = Math.max(furthestEnd, interval.end);
  }
  if (hasOverlap) result.warnings.push("Existing blocks overlap. Shared time is counted once; no existing blocks were moved.");
  if (!preferences.weekdays.includes(weekday(parsedDate))) {
    result.warnings.push("This date is not one of your working days.");
    return stop("Not a working day under the current preferences.");
  }

  const occupied: Interval[] = [];
  for (const interval of intervals) {
    const clipped = { start: Math.max(start, interval.start), end: Math.min(end, interval.end) };
    if (clipped.end <= clipped.start) continue;
    const previous = occupied[occupied.length - 1];
    if (previous && clipped.start <= previous.end) previous.end = Math.max(previous.end, clipped.end);
    else occupied.push(clipped);
  }
  const free: Interval[] = [];
  let cursor = start;
  for (const interval of occupied) {
    if (interval.start > cursor) free.push({ start: cursor, end: interval.start });
    cursor = interval.end;
  }
  if (cursor < end) free.push({ start: cursor, end });
  const freeMinutes = free.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  result.reservedMinutes = Math.min(preferences.reserveMinutes, freeMinutes);
  result.availableMinutes = freeMinutes - result.reservedMinutes;
  if (preferences.reserveMinutes > freeMinutes) {
    result.warnings.push("Existing commitments leave less free time than your requested reserve. All remaining free time is protected.");
  }

  const seenIds = new Set<string>();
  const seenSources = new Set<string>();
  const eligible: Array<{ candidate: WorkCandidate; index: number }> = [];
  const exclude = (candidate: WorkCandidate, reason: string) => result.unscheduled.push({ candidate, reason });
  for (const [index, candidate] of candidates.entries()) {
    if (!candidate.id?.trim() || !candidate.sourceId?.trim()
      || !["task", "routine"].includes(candidate.source)) {
      exclude(candidate, "A valid work identity and source are required.");
      continue;
    }
    const key = sourceKey(candidate.source, candidate.sourceId);
    if (seenIds.has(candidate.id) || seenSources.has(key)) {
      exclude(candidate, "Duplicate work item; considered only once.");
      continue;
    }
    seenIds.add(candidate.id);
    seenSources.add(key);
    if (existingIds.has(candidate.id) || existingSources.has(key)) {
      exclude(candidate, "Already scheduled in an existing block.");
    } else if (candidate.blocked) {
      exclude(candidate, "Blocked work needs its dependency resolved before scheduling.");
    } else if (!Number.isSafeInteger(candidate.minutes) || candidate.minutes <= 0) {
      exclude(candidate, "Estimate must be a positive whole number of minutes.");
    } else if (!Object.prototype.hasOwnProperty.call(priorityOrder, candidate.priority)) {
      exclude(candidate, "Choose a valid priority before scheduling.");
    } else if (candidate.due !== undefined && !parseDate(candidate.due)) {
      exclude(candidate, "Due date must be a valid date in YYYY-MM-DD format.");
    } else {
      eligible.push({ candidate, index });
    }
  }

  eligible.sort((a, b) => priorityOrder[a.candidate.priority] - priorityOrder[b.candidate.priority]
    || (a.candidate.due ?? "9999-99-99").localeCompare(b.candidate.due ?? "9999-99-99")
    || a.index - b.index);
  for (const { candidate } of eligible) {
    if (candidate.minutes > result.availableMinutes - result.scheduledMinutes) {
      exclude(candidate, "Not enough remaining capacity after existing commitments and reserved time.");
      continue;
    }
    const slot = free.find((interval) => interval.end - interval.start >= candidate.minutes);
    if (!slot) {
      exclude(candidate, "No uninterrupted gap is long enough. This work item was not split.");
      continue;
    }
    const block: WorkBlock = {
      id: `work:${date}:${encodeURIComponent(candidate.source)}:${encodeURIComponent(candidate.sourceId)}`,
      title: candidate.title,
      start: formatTime(slot.start),
      end: formatTime(slot.start + candidate.minutes),
      source: candidate.source,
      sourceId: candidate.sourceId,
    };
    // Avoid a collision with any existing manual block ID as well as work IDs.
    if (existingIds.has(block.id)) {
      exclude(candidate, "Already scheduled in an existing block.");
      continue;
    }
    result.suggested.push(block);
    result.scheduledMinutes += candidate.minutes;
    slot.start += candidate.minutes;
  }
  result.suggested.sort((a, b) => a.start.localeCompare(b.start));
  return result;
}
