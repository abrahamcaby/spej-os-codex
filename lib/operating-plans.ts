/**
 * Personal preview planning data. These helpers do not grant access, send
 * messages, create tasks, or write to an external calendar. The UI must store
 * each owner's workspace separately; production ownership belongs on a server.
 */
export type Routine = {
  id: string;
  title: string;
  minutes: number;
  /** JavaScript weekdays: Sunday = 0, Saturday = 6. */
  weekdays: number[];
  priority: "urgent" | "high" | "normal" | "low";
};

export type OperatingPlan = {
  id: string;
  ownerId: string;
  title: string;
  outcome: string;
  status: "draft" | "active" | "archived";
  revision: number;
  routines: Routine[];
  updatedAt: string;
  /** Prior content revisions, oldest first; the current revision is above. */
  history: Array<{
    revision: number;
    title: string;
    outcome: string;
    routines: Routine[];
    recordedAt: string;
  }>;
};

export type PlanningWorkspace = {
  version: 1;
  plans: OperatingPlan[];
  preferences: {
    start: string;
    end: string;
    reserveMinutes: number;
    weekdays: number[];
  };
  /** Per-task estimates; task records remain canonical in the task store. */
  estimates: Record<string, number>;
  days: Record<
    string,
    Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      source: "manual" | "task" | "routine";
      sourceId?: string;
    }>
  >;
};

const MAX_PLANS = 50;
const MAX_ROUTINES = 50;
const MAX_HISTORY = 100;
const MAX_DAYS = 366;
const MAX_BLOCKS_PER_DAY = 100;
const MAX_ESTIMATES = 1_000;
const PRIORITIES = new Set(["urgent", "high", "normal", "low"]);
const STATUSES = new Set(["draft", "active", "archived"]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function identifier(value: unknown, max = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max || /[\s\p{Cc}]/u.test(cleaned)) return undefined;
  if (["__proto__", "constructor", "prototype"].includes(cleaned)) return undefined;
  return cleaned;
}

function content(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  return cleaned && cleaned.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(cleaned)
    ? cleaned
    : undefined;
}

function whole(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function weekdays(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length > 7 || !value.every((day) => whole(day, 0, 6))) return undefined;
  return [...new Set(value)].sort((a, b) => a - b);
}

function clockMinutes(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
}

function dateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function timestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return undefined;
  if (!dateKey(value.slice(0, 10)) || clockMinutes(value.slice(11, 16)) === undefined || Number(value.slice(17, 19)) > 59) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function normalizedRoutine(value: unknown): Routine | undefined {
  const raw = record(value);
  if (!raw) return undefined;
  const id = identifier(raw.id);
  const title = content(raw.title, 200);
  const days = weekdays(raw.weekdays);
  if (!id || !title || !whole(raw.minutes, 1, 480) || !days?.length || typeof raw.priority !== "string" || !PRIORITIES.has(raw.priority)) return undefined;
  return { id, title, minutes: raw.minutes, weekdays: days, priority: raw.priority as Routine["priority"] };
}

function normalizedRoutines(value: unknown): Routine[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, MAX_ROUTINES).flatMap((item) => {
    const routine = normalizedRoutine(item);
    if (!routine || seen.has(routine.id)) return [];
    seen.add(routine.id);
    return [routine];
  });
}

function normalizedPlan(value: unknown, ownerId: string): OperatingPlan | undefined {
  const raw = record(value);
  if (!raw || identifier(raw.ownerId) !== ownerId) return undefined;
  const id = identifier(raw.id);
  const title = content(raw.title, 200);
  const outcome = content(raw.outcome, 4_000);
  const updatedAt = timestamp(raw.updatedAt);
  if (!id || !title || !outcome || !updatedAt || !whole(raw.revision, 1, Number.MAX_SAFE_INTEGER) || typeof raw.status !== "string" || !STATUSES.has(raw.status) || !Array.isArray(raw.routines)) return undefined;
  const revision = raw.revision;
  const seenRevisions = new Set<number>();
  const history: OperatingPlan["history"] = Array.isArray(raw.history)
    ? raw.history.slice(-MAX_HISTORY).flatMap((item) => {
      const old = record(item);
      if (!old || !whole(old.revision, 1, revision - 1) || seenRevisions.has(old.revision)) return [];
      const oldTitle = content(old.title, 200);
      const oldOutcome = content(old.outcome, 4_000);
      const recordedAt = timestamp(old.recordedAt);
      if (!oldTitle || !oldOutcome || !recordedAt || !Array.isArray(old.routines)) return [];
      seenRevisions.add(old.revision);
      return [{ revision: old.revision, title: oldTitle, outcome: oldOutcome, routines: normalizedRoutines(old.routines), recordedAt }];
    }).sort((a, b) => a.revision - b.revision)
    : [];
  return { id, ownerId, title, outcome, status: raw.status as OperatingPlan["status"], revision, routines: normalizedRoutines(raw.routines), updatedAt, history };
}

/** Neutral, editable starting settings, never a prescribed company schedule. */
export function createPlanningWorkspace(): PlanningWorkspace {
  return {
    version: 1,
    plans: [],
    preferences: { start: "09:00", end: "17:00", reserveMinutes: 60, weekdays: [1, 2, 3, 4, 5] },
    estimates: {},
    days: {},
  };
}

/**
 * Read bounded local data without trusting imported objects. Foreign-owned
 * plans are removed. Days/preferences have no identity field in this preview
 * schema, so the caller must use an owner-specific storage key, not shared data.
 */
export function normalizePlanningWorkspace(raw: unknown, ownerId: string): PlanningWorkspace {
  const result = createPlanningWorkspace();
  const owner = identifier(ownerId);
  const value = record(raw);
  if (!owner || !value || value.version !== 1) return result;
  const seenPlanIds = new Set<string>();
  if (Array.isArray(value.plans)) {
    result.plans = value.plans.slice(0, MAX_PLANS).flatMap((item) => {
      const plan = normalizedPlan(item, owner);
      if (!plan || seenPlanIds.has(plan.id)) return [];
      seenPlanIds.add(plan.id);
      return [plan];
    });
  }
  const preferences = record(value.preferences);
  if (preferences) {
    const start = clockMinutes(preferences.start);
    const end = clockMinutes(preferences.end);
    if (start !== undefined && end !== undefined && start < end) {
      result.preferences.start = preferences.start as string;
      result.preferences.end = preferences.end as string;
    }
    const windowMinutes = clockMinutes(result.preferences.end)! - clockMinutes(result.preferences.start)!;
    if (whole(preferences.reserveMinutes, 0, windowMinutes)) result.preferences.reserveMinutes = preferences.reserveMinutes;
    else result.preferences.reserveMinutes = Math.min(result.preferences.reserveMinutes, windowMinutes);
    const days = weekdays(preferences.weekdays);
    if (days) result.preferences.weekdays = days;
  }
  const estimates = record(value.estimates);
  if (estimates) {
    for (const [key, minutes] of Object.entries(estimates).slice(0, MAX_ESTIMATES)) {
      if (identifier(key) === key && whole(minutes, 1, 480)) result.estimates[key] = minutes;
    }
  }
  const days = record(value.days);
  if (days) {
    for (const [key, blocks] of Object.entries(days).slice(0, MAX_DAYS)) {
      if (!dateKey(key) || !Array.isArray(blocks)) continue;
      const seenIds = new Set<string>();
      result.days[key] = blocks.slice(0, MAX_BLOCKS_PER_DAY).flatMap((item) => {
        const block = record(item);
        if (!block) return [];
        const id = identifier(block.id, 400);
        const title = content(block.title, 200);
        const start = clockMinutes(block.start);
        const end = clockMinutes(block.end);
        if (!id || seenIds.has(id) || !title || start === undefined || end === undefined || start >= end || typeof block.source !== "string" || !["manual", "task", "routine"].includes(block.source)) return [];
        const source = block.source as PlanningWorkspace["days"][string][number]["source"];
        const sourceId = identifier(block.sourceId, 321);
        if (source !== "manual" && !sourceId) return [];
        // Accepted blocks are historical commitments. A later plan edit or
        // archive must not silently delete them; they are never new proposals.
        seenIds.add(id);
        return [{ id, title, start: block.start as string, end: block.end as string, source, ...(sourceId ? { sourceId } : {}) }];
      });
    }
  }
  return result;
}

function requireOwner(ownerId: string): string {
  const owner = identifier(ownerId);
  if (!owner) throw new Error("Choose a valid workspace owner before saving a plan.");
  return owner;
}

function requireTimestamp(now: string): string {
  const valid = timestamp(now);
  if (!valid) throw new Error("The plan update needs a valid UTC timestamp.");
  return valid;
}

function validateRoutines(routines: Routine[]): Routine[] {
  if (!Array.isArray(routines) || routines.length > MAX_ROUTINES) throw new Error("A plan can have at most 50 routines.");
  const ids = new Set<string>();
  return routines.map((item, index) => {
    const routine = normalizedRoutine(item);
    if (!routine) throw new Error(`Routine ${index + 1} needs a title, a valid ID, 1–480 whole minutes, at least one weekday, and a valid priority.`);
    if (ids.has(routine.id)) throw new Error("Each routine needs its own unique ID.");
    ids.add(routine.id);
    return routine;
  });
}

export function saveOperatingPlan(
  workspace: PlanningWorkspace,
  input: { id?: string; title: string; outcome: string; routines: Routine[] },
  ownerId: string,
  now: string,
  id: string,
): PlanningWorkspace {
  const owner = requireOwner(ownerId);
  const updatedAt = requireTimestamp(now);
  const title = content(input.title, 200);
  const outcome = content(input.outcome, 4_000);
  if (!title) throw new Error("Give the plan a title of 1–200 characters.");
  if (!outcome) throw new Error("Describe the intended outcome in 1–4,000 characters.");
  const routines = validateRoutines(input.routines);
  const planId = identifier(input.id ?? id);
  if (!planId) throw new Error("The plan needs a valid ID.");
  // Reject cross-owner targeting explicitly before filtering local data.
  if (workspace.plans.some((plan) => plan.id === planId && plan.ownerId !== owner)) throw new Error("This plan belongs to another workspace owner.");
  const next = normalizePlanningWorkspace(workspace, owner);
  const existing = next.plans.find((plan) => plan.id === planId);
  if (input.id !== undefined && !existing) throw new Error("This plan no longer exists in your workspace. Reload before editing.");
  if (input.id === undefined && existing) throw new Error("A plan already uses that ID. Reload before creating another plan.");
  if (!existing) {
    if (next.plans.length >= MAX_PLANS) throw new Error("This workspace has reached its 50-plan limit.");
    next.plans.push({ id: planId, ownerId: owner, title, outcome, status: "draft", revision: 1, routines, updatedAt, history: [] });
    return next;
  }
  if (existing.title === title && existing.outcome === outcome && JSON.stringify(existing.routines) === JSON.stringify(routines)) return next;
  if (existing.revision >= Number.MAX_SAFE_INTEGER) throw new Error("This plan has reached its revision limit.");
  const changed: OperatingPlan = {
    ...existing,
    title,
    outcome,
    routines,
    revision: existing.revision + 1,
    updatedAt,
    history: [...existing.history, {
      revision: existing.revision,
      title: existing.title,
      outcome: existing.outcome,
      routines: existing.routines.map((routine) => ({ ...routine, weekdays: [...routine.weekdays] })),
      recordedAt: existing.updatedAt,
    }].slice(-MAX_HISTORY),
  };
  next.plans = next.plans.map((plan) => plan.id === planId ? changed : plan);
  return next;
}

/** Changing status affects future proposals, not already accepted blocks. */
export function setOperatingPlanStatus(
  workspace: PlanningWorkspace,
  id: string,
  status: OperatingPlan["status"],
  ownerId: string,
  now: string,
): PlanningWorkspace {
  const owner = requireOwner(ownerId);
  const updatedAt = requireTimestamp(now);
  if (!STATUSES.has(status)) throw new Error("Choose draft, active, or archived for this plan.");
  if (workspace.plans.some((plan) => plan.id === id && plan.ownerId !== owner)) throw new Error("This plan belongs to another workspace owner.");
  const next = normalizePlanningWorkspace(workspace, owner);
  const existing = next.plans.find((plan) => plan.id === id);
  if (!existing) throw new Error("This plan no longer exists in your workspace.");
  next.plans = next.plans.map((plan) => plan.id === id && plan.status !== status ? { ...plan, status, updatedAt } : plan);
  return next;
}
